import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import orderService from '../services/orderService';
import { useShop } from '../context/ShopContext';
import Button from '../components/Button';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { formatINR } from '../utils/currencyUtils';
import {
  Package,
  Calendar,
  Banknote,
  Truck,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertCircle,
  FileText,
  Printer,
  ChevronRight,
  ArrowLeft,
  XCircle,
  Sparkles,
  CreditCard
} from 'lucide-react';
import { loadRazorpayScript } from '../utils/razorpay';

export const OrderDetailPage = () => {
  const queryClient = useQueryClient();
  const { orderId } = useParams();
  const { showToast } = useShop();
  const navigate = useNavigate();

  // Cache order detail in React Query to enable instantaneous navigation
  const {
    data: order,
    isLoading: loading,
    error: queryError,
    refetch: fetchOrderDetail
  } = useQuery({
    queryKey: ['customer-order-detail', orderId],
    queryFn: () => orderService.getOrderDetail(orderId),
    enabled: Boolean(orderId),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const error = queryError ? 'Order not found or has been removed.' : null;

  // Cancellation Modal (Whole Order or Item)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelItemTarget, setCancelItemTarget] = useState(null); // null = entire order, or OrderItem
  const [cancelReason, setCancelReason] = useState('Changed mind');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Return Modal (When Delivered)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('Defective/Quality issue');
  const [returnDetails, setReturnDetails] = useState('');
  const [returnError, setReturnError] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Invoice Printing state
  const [printingInvoice, setPrintingInvoice] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);

  // Handle Cancel Order or Specific Product
  const handleConfirmCancel = async () => {
    if (submittingCancel) return;
    setSubmittingCancel(true);
    try {
      const fullReason = cancelReason === 'Other' ? customCancelReason : cancelReason;
      const res = await orderService.cancelOrder(order.order_number, {
        reason: fullReason,
        item_id: cancelItemTarget ? cancelItemTarget.id : null
      });

      showToast(res.message || 'Cancellation processed successfully.');
      setIsCancelModalOpen(false);
      setCancelItemTarget(null);
      setCustomCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      fetchOrderDetail();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to cancel item/order.', 'error');
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Handle Return Order Request
  const handleConfirmReturn = async () => {
    setReturnError('');
    if (!returnDetails.trim()) {
      setReturnError('Detailed reason is required to process your return.');
      return;
    }

    setSubmittingReturn(true);
    try {
      const fullReason = `${returnReason}: ${returnDetails.trim()}`;
      const res = await orderService.returnOrder(order.order_number, { reason: fullReason });
      showToast(res.message || 'Return request submitted successfully.');
      setIsReturnModalOpen(false);
      setReturnDetails('');
      fetchOrderDetail();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to submit return request.', 'error');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Retry or Complete Razorpay Online Payment
  const handleRetryPayment = async () => {
    if (!order) return;
    setRetryingPayment(true);
    try {
      const payRes = await orderService.createPayment(order.id, 'Razorpay');
      const razorpayOrderId = payRes.razorpay_order_id || payRes.gateway_order_id;
      const razorpayKeyId = payRes.razorpay_key_id;
      const amountInPaise = payRes.amount || payRes.amount_in_paise;
      const currency = payRes.currency || 'INR';

      if (!razorpayKeyId) {
        showToast('Razorpay Key ID is not configured on the server. Please check backend settings.', 'error');
        setRetryingPayment(false);
        return;
      }

      let RazorpayClass;
      try {
        RazorpayClass = await loadRazorpayScript();
      } catch (loadErr) {
        showToast('Failed to load Razorpay checkout script. Check your internet connection.', 'error');
        setRetryingPayment(false);
        return;
      }

      const rzpOptions = {
        key: razorpayKeyId,
        amount: amountInPaise,
        currency: currency,
        name: 'DEPORT Atelier',
        description: `Order #${order.order_number}`,
        order_id: razorpayOrderId,
        prefill: {
          name: order.shipping_full_name || order.user_name || '',
          email: order.user_email || '',
          contact: order.shipping_phone || ''
        },
        notes: {
          order_id: String(order.id),
          order_number: order.order_number
        },
        theme: {
          color: '#10B981',
          backdrop_color: 'rgba(11, 15, 13, 0.95)'
        },
        handler: async function (response) {
          try {
            showToast('Verifying payment signature with atelier gateway...', 'info');
            await orderService.verifyPayment(order.id, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
            showToast('Payment completed and verified successfully!');
            fetchOrderDetail();
            queryClient.invalidateQueries({ queryKey: ['orders'] });
          } catch (verifyErr) {
            const errMsg = verifyErr.response?.data?.detail || 'Signature verification failed. Please contact support.';
            showToast(errMsg, 'error');
            fetchOrderDetail();
          } finally {
            setRetryingPayment(false);
          }
        },
        modal: {
          ondismiss: async function () {
            try {
              await orderService.failPayment(order.id, {
                reason: 'Customer closed payment window',
                razorpay_order_id: razorpayOrderId
              });
            } catch {}
            showToast('Payment window closed. You can retry anytime.', 'info');
            setRetryingPayment(false);
            fetchOrderDetail();
          }
        }
      };

      const rzp = new RazorpayClass(rzpOptions);

      rzp.on('payment.failed', async function (failedResponse) {
        const failReason = failedResponse.error?.description || 'Payment failed at gateway';
        try {
          await orderService.failPayment(order.id, {
            reason: failReason,
            error_code: failedResponse.error?.code,
            error_description: failedResponse.error?.description,
            razorpay_order_id: razorpayOrderId,
            transaction_id: failedResponse.error?.metadata?.payment_id
          });
        } catch {}
        showToast(failReason, 'error');
        setRetryingPayment(false);
        fetchOrderDetail();
      });

      rzp.open();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to initialize Razorpay checkout. Please try again.', 'error');
      setRetryingPayment(false);
      fetchOrderDetail();
    }
  };

  // Download / Print Invoice (Using hidden iframe for zero lag and clean back navigation)
  const handleDownloadInvoice = () => {
    if (!order) return;
    setPrintingInvoice(true);
    try {
      const invoiceHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice - ${order.order_number}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; margin: 40px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #10B981; padding-bottom: 20px; margin-bottom: 30px; }
            .brand { font-size: 26px; font-weight: bold; letter-spacing: 2px; color: #064E3B; font-family: Georgia, serif; }
            .badge { display: inline-block; padding: 4px 10px; background: #ECFDF5; color: #065F46; font-size: 11px; font-weight: bold; text-transform: uppercase; border: 1px solid #10B981; }
            .grid { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .table th { background: #F3F4F6; text-align: left; padding: 10px; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #E5E7EB; }
            .table td { padding: 12px 10px; border-bottom: 1px solid #E5E7EB; font-size: 13px; }
            .totals { margin-left: auto; width: 300px; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
            .totals-row.grand { font-size: 18px; font-weight: bold; border-top: 2px solid #111; padding-top: 10px; color: #064E3B; }
            .footer { margin-top: 50px; font-size: 11px; color: #6B7280; text-align: center; border-top: 1px solid #E5E7EB; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="brand">DEPORT ATELIER</div>
              <div style="font-size: 12px; color: #6B7280; margin-top: 4px;">Luxury Handcrafted Bags & Leather Goods</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: bold;">INVOICE</div>
              <div style="font-family: monospace; font-size: 13px; margin: 4px 0;">${order.order_number}</div>
              <div style="font-size: 12px; color: #6B7280;">Date: ${new Date(order.created_at).toLocaleDateString()}</div>
              <div style="margin-top: 6px;"><span class="badge">${order.status.toUpperCase()}</span></div>
            </div>
          </div>

          <div class="grid">
            <div>
              <strong>BILLED & SHIPPED TO:</strong><br>
              ${order.shipping_full_name}<br>
              ${order.shipping_address_line_1}${order.shipping_address_line_2 ? ', ' + order.shipping_address_line_2 : ''}<br>
              ${order.shipping_city}, ${order.shipping_state} ${order.shipping_postal_code}<br>
              ${order.shipping_country}<br>
              Phone: ${order.shipping_phone}
            </div>
            <div style="text-align: right;">
              <strong>PAYMENT METHOD:</strong><br>
              ${order.payment_method || 'Cash on Delivery'}<br>
              <br>
              <strong>STATUS:</strong><br>
              ${order.status.toUpperCase()}
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>SKU</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(order.items || []).map((i) => `
                <tr>
                  <td>
                    <strong>${i.product_name}</strong>
                    ${i.is_cancelled ? '<span style="color: #DC2626; font-size: 10px; margin-left: 6px;">[CANCELLED]</span>' : ''}
                  </td>
                  <td>${i.product_sku}</td>
                  <td style="text-align: center;">${i.quantity}</td>
                  <td style="text-align: right;">${formatINR(i.unit_price)}</td>
                  <td style="text-align: right;">${formatINR(i.total_price)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row">
              <span>Subtotal:</span>
              <span>${formatINR(order.subtotal)}</span>
            </div>
            <div class="totals-row">
              <span>Estimated Tax (5%):</span>
              <span>${formatINR(order.tax || 0)}</span>
            </div>
            <div class="totals-row">
              <span>Shipping:</span>
              <span>${parseFloat(order.shipping_cost) === 0 ? 'COMPLIMENTARY' : formatINR(order.shipping_cost)}</span>
            </div>
            ${parseFloat(order.discount || 0) > 0 ? `
              <div class="totals-row" style="color: #065F46;">
                <span>Discount:</span>
                <span>-${formatINR(order.discount)}</span>
              </div>
            ` : ''}
            <div class="totals-row grand">
              <span>${order.payment_status === 'completed' ? 'Total Paid' : order.payment_method === 'Cash on Delivery' ? 'Total Due (COD)' : 'Total Due'}:</span>
              <span>${formatINR(order.total)}</span>
            </div>
          </div>

          <div class="footer">
            Thank you for selecting DEPORT. Each piece is handcrafted with precision and backed by our Lifetime Heritage Warranty.<br>
            DEPORT Atelier Concierge • concierge@deport.com • 742 Evergreen Terrace, Suite 400, New York, NY
          </div>
        </body>
        </html>
      `;

      // Non-blocking hidden iframe print: prevents blank tabs and eliminates history back lag
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(invoiceHtml);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setPrintingInvoice(false);
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }, 300);
    } catch (e) {
      showToast('Could not open print invoice view.', 'error');
      setPrintingInvoice(false);
    }
  };

  // Timeline Progress Steps
  const timelineSteps = [
    { key: 'pending', label: 'Order Placed', icon: Clock },
    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
    { key: 'processing', label: 'Atelier Processing', icon: Sparkles },
    { key: 'shipped', label: 'Shipped', icon: Truck },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: Package }
  ];

  const getStepStatus = (stepKey) => {
    if (order.status === 'cancelled') return 'cancelled';
    if (order.status === 'return_requested' || order.status === 'returned') {
      return stepKey === 'delivered' ? 'completed' : 'completed';
    }

    const orderStatusIndex = timelineSteps.findIndex((s) => s.key === order.status);
    const thisStepIndex = timelineSteps.findIndex((s) => s.key === stepKey);

    if (thisStepIndex < orderStatusIndex) return 'completed';
    if (thisStepIndex === orderStatusIndex) return 'current';
    return 'upcoming';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8 text-[#F3F4F6]">
        <Skeleton className="w-48 h-6" />
        <Skeleton className="w-full h-32" />
        <Skeleton className="w-full h-64" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <EmptyState
          icon={AlertCircle}
          title="Order Not Found"
          description={error || "We couldn't retrieve the details for this order reference."}
          actionLabel="Return to My Orders"
          actionIcon={ArrowLeft}
          onAction={() => navigate('/orders')}
        />
      </div>
    );
  }

  const isCancellable = ['pending', 'confirmed', 'processing'].includes(order.status);
  const isReturnable = order.status === 'delivered';
  const isCancelled = order.status === 'cancelled';
  const isReturnRequested = order.status === 'return_requested';
  const isReturned = order.status === 'returned';
  const isOnlinePayment = order.payment_method && order.payment_method !== 'Cash on Delivery';
  const isPaymentPending = isOnlinePayment && order.payment_status !== 'completed' && !isCancelled;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 text-[#F3F4F6] space-y-10">
      {/* Breadcrumbs Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-gray-400">
        <Link to="/" className="hover:text-[#10B981] transition-colors">Home</Link>
        <ChevronRight size={14} />
        <Link to="/orders" className="hover:text-[#10B981] transition-colors">My Orders</Link>
        <ChevronRight size={14} />
        <span className="text-[#10B981] font-mono font-semibold">{order.order_number}</span>
      </nav>

      {/* Header Bar */}
      <div className="bg-[#131915] border border-[#1E2922] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold">
              ORDER SPECIFICATION
            </span>
            <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-[#161D19] border border-[#10B981]/30 text-[#10B981]">
              {order.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          <h1 className="font-mono text-2xl sm:text-3xl font-bold text-[#F3F4F6]">
            {order.order_number}
          </h1>

          <p className="text-xs text-gray-400 mt-2 flex items-center gap-2">
            <Calendar size={14} className="text-[#10B981]" />
            <span>Placed on {new Date(order.created_at).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Complete Payment Button if unpaid online order */}
          {isPaymentPending && (
            <Button
              variant="primary"
              size="sm"
              icon={CreditCard}
              loading={retryingPayment}
              onClick={handleRetryPayment}
              className="bg-emerald-600 hover:bg-emerald-500 text-black font-bold"
            >
              Pay Now ({formatINR(order.total)})
            </Button>
          )}

          {/* Download Invoice Button */}
          <Button
            variant="outline"
            size="sm"
            icon={Printer}
            loading={printingInvoice}
            onClick={handleDownloadInvoice}
          >
            Download Invoice (PDF)
          </Button>

          {/* Cancel Entire Order Button */}
          {isCancellable && (
            <Button
              variant="outline"
              size="sm"
              icon={XCircle}
              onClick={() => {
                setCancelItemTarget(null);
                setIsCancelModalOpen(true);
              }}
              className="border-rose-900 text-rose-400 hover:bg-rose-950/40"
            >
              Cancel Order
            </Button>
          )}

          {/* Return Order Button */}
          {isReturnable && (
            <Button
              variant="primary"
              size="sm"
              icon={RotateCcw}
              onClick={() => setIsReturnModalOpen(true)}
              className="bg-purple-800 hover:bg-purple-900 border-purple-700"
            >
              Request Return
            </Button>
          )}
        </div>
      </div>

      {/* Pending Payment Alert for Online Orders */}
      {isPaymentPending && (
        <div className="p-4 bg-amber-950/40 border-l-4 border-amber-500 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-amber-400 flex-shrink-0" />
            <div>
              <p className="font-bold text-white text-sm">Payment Awaiting Verification</p>
              <p className="mt-0.5">
                Your online transaction has not been completed. Complete payment now to initiate bespoke processing and shipping.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={CreditCard}
            loading={retryingPayment}
            onClick={handleRetryPayment}
            className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-500 text-black font-bold"
          >
            Complete Payment ({formatINR(order.total)})
          </Button>
        </div>
      )}

      {/* Cancellation / Return Banner if applicable */}
      {isCancelled && (
        <div className="p-4 bg-rose-950/50 border-l-4 border-rose-500 text-rose-200 text-xs flex items-start gap-3">
          <AlertCircle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-white text-sm">Order Cancelled</p>
            <p className="mt-0.5">
              Reason: <strong>{order.cancellation_reason || 'Cancelled by customer'}</strong>
              {order.cancelled_at && ` • ${new Date(order.cancelled_at).toLocaleDateString()}`}
            </p>
            <p className="text-gray-400 mt-1">
              All reserved product stock has been restored to catalog inventory.
            </p>
          </div>
        </div>
      )}

      {isReturnRequested && (
        <div className="p-4 bg-purple-950/50 border-l-4 border-purple-500 text-purple-200 text-xs flex items-start gap-3">
          <RotateCcw size={18} className="text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-white text-sm">Return Request Under Atelier Review</p>
            <p className="mt-0.5">
              Reason: <strong>{order.return_reason || 'Return requested'}</strong>
              {order.return_requested_at && ` • ${new Date(order.return_requested_at).toLocaleDateString()}`}
            </p>
            <p className="text-gray-400 mt-1">
              Our concierge team is reviewing your return request and will dispatch courier reverse pickup instructions.
            </p>
          </div>
        </div>
      )}

      {/* Order Fulfillment Timeline */}
      {!isCancelled && (
        <div className="bg-[#131915] border border-[#1E2922] p-6 sm:p-8 space-y-6">
          <h3 className="font-serif text-lg font-medium text-[#F3F4F6] pb-4 border-b border-[#1E2922]">
            Order Fulfillment Progress
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {timelineSteps.map((step, idx) => {
              const status = getStepStatus(step.key);
              const Icon = step.icon;
              const isDone = status === 'completed';
              const isCurrent = status === 'current';

              return (
                <div
                  key={step.key}
                  className={`p-4 border text-center flex flex-col items-center gap-2 relative transition-all ${
                    isCurrent
                      ? 'bg-[#161D19] border-[#10B981] shadow-lg shadow-[#10B981]/10'
                      : isDone
                      ? 'bg-[#131915] border-[#10B981]/40'
                      : 'bg-[#0B0F0D] border-[#1E2922] opacity-50'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                      isDone || isCurrent ? 'bg-[#10B981] text-black' : 'bg-[#1E2922] text-gray-400'
                    }`}
                  >
                    <Icon size={16} />
                  </div>

                  <span className="font-serif text-xs font-semibold text-[#F3F4F6]">
                    {step.label}
                  </span>

                  <span className="text-[10px] uppercase tracking-wider text-gray-400">
                    {isCurrent ? 'Current Status' : isDone ? 'Completed' : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Details Grid: Items (8 cols) & Summary/Shipping (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Purchased Items Table (8 cols) */}
        <div className="lg:col-span-8 bg-[#131915] border border-[#1E2922] p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
            <h3 className="font-serif text-xl font-medium text-[#F3F4F6]">
              Purchased Atelier Items
            </h3>
            <span className="text-xs text-gray-400">
              {(order.items || []).length} Product(s)
            </span>
          </div>

          <div className="divide-y divide-[#1E2922]">
            {(order.items || []).map((item) => (
              <div key={item.id} className="py-5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-20 bg-[#0B0F0D] border border-[#1E2922] flex-shrink-0 overflow-hidden">
                    {item.product_image ? (
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-serif text-base text-[#10B981] font-bold">
                        LX
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-serif text-base font-semibold text-[#F3F4F6]">
                      {item.product_name}
                    </h4>
                    <p className="text-xs text-gray-400 font-mono">
                      SKU: {item.product_sku}
                    </p>
                    <p className="text-xs text-gray-400">
                      Quantity: <strong>{item.quantity}</strong> × {formatINR(item.unit_price)}
                    </p>

                    {item.is_cancelled && (
                      <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider bg-rose-950/60 border border-rose-800 px-2 py-0.5 inline-block">
                        Item Cancelled • Stock Restored ({item.cancellation_reason || 'Customer request'})
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                  <span className="font-serif text-base font-bold text-[#10B981]">
                    {formatINR(item.total_price)}
                  </span>

                  {/* Cancel Specific Product Button */}
                  {isCancellable && !item.is_cancelled && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelItemTarget(item);
                        setIsCancelModalOpen(true);
                      }}
                      className="text-xs text-rose-400 hover:text-rose-300 underline font-medium cursor-pointer"
                    >
                      Cancel Product
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Shipping & Summary Cards (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Shipping Address Card */}
          <div className="bg-[#131915] border border-[#1E2922] p-6 space-y-4">
            <h4 className="font-serif text-base font-semibold text-[#F3F4F6] pb-3 border-b border-[#1E2922] flex items-center gap-2">
              <MapPin size={16} className="text-[#10B981]" />
              Shipping Destination
            </h4>

            <div className="text-xs text-gray-300 space-y-1 leading-relaxed">
              <p className="font-bold text-[#F3F4F6] text-sm">{order.shipping_full_name}</p>
              <p>{order.shipping_address_line_1}</p>
              {order.shipping_address_line_2 && <p>{order.shipping_address_line_2}</p>}
              <p>{order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}</p>
              <p>{order.shipping_country}</p>
              <p className="text-gray-400 font-mono pt-1">Phone: {order.shipping_phone}</p>
            </div>
          </div>

          {/* Payment Method Card */}
          <div className="bg-[#131915] border border-[#1E2922] p-6 space-y-4">
            <h4 className="font-serif text-base font-semibold text-[#F3F4F6] pb-3 border-b border-[#1E2922] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Banknote size={16} className="text-[#10B981]" />
                Payment Information
              </span>
              {order.payment_status === 'completed' ? (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                  Paid
                </span>
              ) : order.payment_status === 'failed' ? (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-950/80 text-rose-400 border border-rose-800">
                  Failed
                </span>
              ) : order.payment_method === 'Cash on Delivery' ? (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-800">
                  Pay On Delivery
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-800">
                  Unpaid
                </span>
              )}
            </h4>

            <div className="text-xs text-gray-300 space-y-2">
              <div className="flex justify-between">
                <span>Method:</span>
                <strong className="text-[#F3F4F6]">{order.payment_method || 'Cash on Delivery'}</strong>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={
                  order.payment_status === 'completed' ? 'text-emerald-400 font-semibold uppercase text-[11px]' :
                  order.payment_status === 'failed' ? 'text-rose-400 font-semibold uppercase text-[11px]' :
                  'text-amber-400 font-semibold uppercase text-[11px]'
                }>
                  {order.payment_status === 'completed' ? 'Verified & Completed' :
                   order.payment_status === 'failed' ? 'Payment Failed / Incomplete' :
                   order.payment_method === 'Cash on Delivery' ? 'Pay Upon Delivery' : 'Awaiting Payment'}
                </span>
              </div>

              {order.latest_payment?.transaction_id && (
                <div className="flex justify-between font-mono text-[11px]">
                  <span>Transaction ID:</span>
                  <span className="text-gray-400 truncate max-w-[170px]">{order.latest_payment.transaction_id}</span>
                </div>
              )}

              {order.latest_payment?.gateway_order_id && (
                <div className="flex justify-between font-mono text-[11px]">
                  <span>Gateway Ref:</span>
                  <span className="text-gray-400 truncate max-w-[170px]">{order.latest_payment.gateway_order_id}</span>
                </div>
              )}

              {isPaymentPending && (
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    icon={CreditCard}
                    loading={retryingPayment}
                    onClick={handleRetryPayment}
                    className="bg-emerald-600 hover:bg-emerald-500 text-black font-bold"
                  >
                    Pay Now ({formatINR(order.total)})
                  </Button>
                </div>
              )}

              {order.payment_method === 'Cash on Delivery' && order.status !== 'delivered' && (
                <p className="text-[11px] text-gray-400 font-light pt-1">
                  Please keep exact cash or mobile POS ready when courier arrives.
                </p>
              )}
            </div>
          </div>

          {/* Cost Breakdown Summary Card */}
          <div className="bg-[#131915] border border-[#1E2922] p-6 space-y-3 text-xs text-gray-400">
            <h4 className="font-serif text-base font-semibold text-[#F3F4F6] pb-3 border-b border-[#1E2922]">
              Financial Breakdown
            </h4>

            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-[#F3F4F6] font-mono">{formatINR(order.subtotal)}</span>
            </div>

            <div className="flex justify-between">
              <span>Estimated Tax (5%)</span>
              <span className="text-[#F3F4F6] font-mono">{formatINR(order.tax || 0)}</span>
            </div>

            <div className="flex justify-between">
              <span>Global Express Shipping</span>
              <span className={parseFloat(order.shipping_cost) === 0 ? 'text-[#10B981] font-semibold' : 'text-[#F3F4F6] font-mono'}>
                {parseFloat(order.shipping_cost) === 0 ? 'COMPLIMENTARY' : formatINR(order.shipping_cost)}
              </span>
            </div>

            {parseFloat(order.discount || 0) > 0 && (
              <div className="flex justify-between text-[#10B981]">
                <span>Promotional Discount</span>
                <span className="font-mono">-{formatINR(order.discount)}</span>
              </div>
            )}

            <div className="pt-3 border-t border-[#1E2922] flex justify-between items-baseline">
              <span className="font-serif text-base text-[#F3F4F6]">Grand Total</span>
              <span className="font-serif text-2xl font-bold text-[#10B981]">
                {formatINR(order.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Modal (Whole Order or Specific Product) */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#131915] border border-rose-900/50 p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertCircle size={22} />
              <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">
                {cancelItemTarget ? `Cancel "${cancelItemTarget.product_name}"` : 'Cancel Entire Order'}
              </h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              {cancelItemTarget
                ? `Confirm cancellation of ${cancelItemTarget.quantity} unit(s) of "${cancelItemTarget.product_name}". Reserved inventory will be restocked immediately.`
                : `Are you sure you wish to cancel order ${order.order_number}? All items will be cancelled and stock replenished.`}
            </p>

            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block">
                Reason for Cancellation (Optional)
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-[#161D19] text-[#F3F4F6] text-xs p-2.5 border border-[#1E2922] focus:outline-none focus:border-[#10B981]"
              >
                <option value="Changed mind">Changed mind</option>
                <option value="Found better price">Found better alternative / price</option>
                <option value="Ordered by mistake">Ordered by mistake</option>
                <option value="Delivery time too long">Delivery time is too long</option>
                <option value="Other">Other reason</option>
              </select>

              {cancelReason === 'Other' && (
                <textarea
                  rows={2}
                  placeholder="Please specify reason..."
                  value={customCancelReason}
                  onChange={(e) => setCustomCancelReason(e.target.value)}
                  className="w-full bg-[#161D19] text-[#F3F4F6] text-xs p-2.5 border border-[#1E2922] focus:outline-none focus:border-[#10B981] mt-2"
                />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#1E2922]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setCancelItemTarget(null);
                }}
                disabled={submittingCancel}
              >
                Keep Order
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={submittingCancel}
                onClick={handleConfirmCancel}
                className="bg-rose-700 hover:bg-rose-800 text-white border-rose-600"
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal (Mandatory Reason When Delivered) */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#131915] border border-purple-900/50 p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-purple-400">
              <RotateCcw size={22} />
              <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">Request Order Return</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Order <strong className="text-[#10B981] font-mono">{order.order_number}</strong> was marked delivered.
              Under the DEPORT Heritage Guarantee, you can return items within 30 days.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block mb-1">
                  Primary Return Reason <span className="text-rose-400">*</span>
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full bg-[#161D19] text-[#F3F4F6] text-xs p-2.5 border border-[#1E2922] focus:outline-none focus:border-[#10B981]"
                >
                  <option value="Defective/Quality issue">Defective / Quality issue</option>
                  <option value="Damaged in transit">Damaged in transit</option>
                  <option value="Wrong item delivered">Wrong item received</option>
                  <option value="Item does not match description">Item does not match description</option>
                  <option value="Changed styling preference">Changed styling preference</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block mb-1">
                  Mandatory Details & Explanation <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Please describe the condition or defect in detail..."
                  value={returnDetails}
                  onChange={(e) => {
                    setReturnDetails(e.target.value);
                    if (returnError) setReturnError('');
                  }}
                  className={`w-full bg-[#161D19] text-[#F3F4F6] text-xs p-2.5 border focus:outline-none ${
                    returnError ? 'border-rose-500' : 'border-[#1E2922] focus:border-[#10B981]'
                  }`}
                />
                {returnError && <p className="text-xs text-rose-400 mt-1">{returnError}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#1E2922]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReturnModalOpen(false)}
                disabled={submittingReturn}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={submittingReturn}
                onClick={handleConfirmReturn}
              >
                Submit Return Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailPage;
