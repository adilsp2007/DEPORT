import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import orderService from '../services/orderService';
import { useShop } from '../context/ShopContext';
import AccountSidebar from '../components/AccountSidebar';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import { formatINR } from '../utils/currencyUtils';
import {
  Package,
  Search,
  X,
  ChevronRight,
  Clock,
  CheckCircle2,
  Truck,
  RotateCcw,
  XCircle,
  FileText,
  AlertCircle,
  ArrowRight,
  Calendar,
  Banknote,
  Eye
} from 'lucide-react';

export const OrdersPage = () => {
  const queryClient = useQueryClient();
  const { showToast } = useShop();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // TanStack React Query: cache orders in memory for instant zero-delay navigation back
  const {
    data: ordersData,
    isLoading: loading,
    refetch: fetchOrders
  } = useQuery({
    queryKey: ['customer-orders', { page, search, status: statusFilter }],
    queryFn: () => orderService.getOrders({
      page,
      search,
      status: statusFilter === 'all' ? '' : statusFilter
    }),
    staleTime: 1000 * 60 * 3, // 3 minutes cache
    keepPreviousData: true
  });

  const orders = ordersData?.results || [];
  const totalCount = ordersData?.count || 0;

  // Cancellation Modal state
  const [cancelModalOrder, setCancelModalOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('Changed mind');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Return Modal state
  const [returnModalOrder, setReturnModalOrder] = useState(null);
  const [returnReason, setReturnReason] = useState('Defective/Quality issue');
  const [returnDetails, setReturnDetails] = useState('');
  const [returnError, setReturnError] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const handleClearSearch = () => {
    setSearch('');
    setPage(1);
  };

  // Status Badge helper
  const getStatusBadge = (status) => {
    const config = {
      pending: { label: 'Pending', bg: 'bg-amber-950/60 text-amber-300 border-amber-800' },
      confirmed: { label: 'Confirmed', bg: 'bg-blue-950/60 text-blue-300 border-blue-800' },
      processing: { label: 'Processing', bg: 'bg-indigo-950/60 text-indigo-300 border-indigo-800' },
      shipped: { label: 'Shipped', bg: 'bg-cyan-950/60 text-cyan-300 border-cyan-800' },
      out_for_delivery: { label: 'Out for Delivery', bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-600' },
      delivered: { label: 'Delivered', bg: 'bg-emerald-950/60 text-emerald-400 border-emerald-800' },
      cancelled: { label: 'Cancelled', bg: 'bg-rose-950/60 text-rose-300 border-rose-800' },
      return_requested: { label: 'Return Requested', bg: 'bg-purple-950/60 text-purple-300 border-purple-800' },
      returned: { label: 'Returned', bg: 'bg-stone-900 text-stone-400 border-stone-700' }
    };
    const c = config[status] || { label: status, bg: 'bg-gray-800 text-gray-300 border-gray-700' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${c.bg}`}>
        {c.label}
      </span>
    );
  };

  // Confirm Cancellation
  const handleConfirmCancel = async () => {
    if (!cancelModalOrder || submittingCancel) return;
    setSubmittingCancel(true);
    try {
      const fullReason = cancelReason === 'Other' ? customCancelReason : cancelReason;
      await orderService.cancelOrder(cancelModalOrder.order_number, { reason: fullReason });
      showToast(`Order ${cancelModalOrder.order_number} cancelled successfully. Stock has been restored.`);
      setCancelModalOrder(null);
      setCustomCancelReason('');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      fetchOrders();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to cancel order.', 'error');
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Confirm Return
  const handleConfirmReturn = async () => {
    if (!returnModalOrder) return;
    setReturnError('');

    if (!returnDetails.trim()) {
      setReturnError('Detailed reason is required to process your return.');
      return;
    }

    setSubmittingReturn(true);
    try {
      const fullReason = `${returnReason}: ${returnDetails.trim()}`;
      await orderService.returnOrder(returnModalOrder.order_number, { reason: fullReason });
      showToast('Return request submitted successfully. Our atelier team will review it.');
      setReturnModalOrder(null);
      setReturnDetails('');
      fetchOrders();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to submit return request.', 'error');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 text-[#F3F4F6]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#1E2922] mb-10 gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            MY ACCOUNT
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#F3F4F6]">
            My Orders
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Track, inspect, or manage your bespoke purchases and shipments.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Account Sidebar Navigation (3 cols) */}
        <div className="lg:col-span-3">
          <AccountSidebar />
        </div>

        {/* Main Orders Content Area (9 cols) */}
        <div className="lg:col-span-9 space-y-6">
          {/* Controls: Search & Status Filter */}
          <div className="bg-[#131915] border border-[#1E2922] p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Order ID (LUX-...) or item name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#161D19] text-[#F3F4F6] text-xs pl-10 pr-10 py-2.5 border border-[#1E2922] focus:outline-none focus:border-[#10B981]"
              />
              {search && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {[
                { key: 'all', label: 'All' },
                { key: 'pending', label: 'Pending' },
                { key: 'shipped', label: 'Shipped' },
                { key: 'delivered', label: 'Delivered' },
                { key: 'cancelled', label: 'Cancelled' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setStatusFilter(tab.key);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                    statusFilter === tab.key
                      ? 'bg-[#10B981] text-black font-bold'
                      : 'bg-[#161D19] text-gray-400 hover:text-white border border-[#1E2922]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-[#131915] border border-[#1E2922] p-6 animate-pulse space-y-4">
                  <div className="h-4 bg-[#1E2922] w-1/4" />
                  <div className="h-16 bg-[#161D19]" />
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && orders.length === 0 && (
            <EmptyState
              icon={Package}
              title="No Orders Found"
              description={
                search || statusFilter !== 'all'
                  ? 'No orders matched your search or status filter. Try clearing filters.'
                  : 'You have not placed any orders yet. Explore our handcrafted collections.'
              }
              actionLabel={search || statusFilter !== 'all' ? 'Reset Filters' : 'Explore Collections'}
              actionIcon={ArrowRight}
              onAction={() => {
                if (search || statusFilter !== 'all') {
                  setSearch('');
                  setStatusFilter('all');
                } else {
                  navigate('/shop');
                }
              }}
            />
          )}

          {/* Orders Cards List */}
          {!loading && orders.length > 0 && (
            <div className="space-y-6">
              {orders.map((order) => {
                const isCancellable = ['pending', 'confirmed', 'processing'].includes(order.status);
                const isReturnable = order.status === 'delivered';
                const itemsCount = (order.items || []).reduce((c, i) => c + i.quantity, 0);

                return (
                  <div
                    key={order.id}
                    className="bg-[#131915] border border-[#1E2922] hover:border-[#10B981]/40 transition-colors shadow-xs overflow-hidden"
                  >
                    {/* Order Card Top Bar */}
                    <div className="p-4 sm:p-6 bg-[#161D19] border-b border-[#1E2922] flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm sm:text-base font-bold text-[#10B981]">
                            {order.order_number}
                          </span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Calendar size={13} className="text-[#10B981]" />
                          <span>Placed on {formatDate(order.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                            Total Value (COD)
                          </span>
                          <span className="font-serif text-lg font-bold text-[#F3F4F6]">
                            {formatINR(order.total)}
                          </span>
                        </div>

                        <Link to={`/orders/${order.order_number}`}>
                          <Button variant="outline" size="sm" icon={Eye}>
                            Details
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Order Items Preview */}
                    <div className="p-4 sm:p-6 divide-y divide-[#1E2922]">
                      {(order.items || []).map((item) => (
                        <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-4">
                          <div className="w-14 h-16 bg-[#0B0F0D] border border-[#1E2922] flex-shrink-0 overflow-hidden">
                            {item.product_image ? (
                              <img
                                src={item.product_image}
                                alt={item.product_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-serif text-xs text-[#10B981] font-bold">
                                LX
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h5 className="font-serif text-sm font-semibold text-[#F3F4F6] truncate">
                              {item.product_name}
                            </h5>
                            <p className="text-xs text-gray-400 font-mono">
                              SKU: {item.product_sku} • Qty: {item.quantity} × {formatINR(item.unit_price)}
                            </p>
                            {item.is_cancelled && (
                              <span className="inline-block text-[10px] uppercase font-bold text-rose-400 mt-1">
                                [Cancelled Item]
                              </span>
                            )}
                          </div>

                          <span className="font-serif text-sm font-bold text-[#10B981]">
                            {formatINR(item.total_price)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Order Card Footer Actions */}
                    <div className="p-4 bg-[#111613] border-t border-[#1E2922] flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Banknote size={14} className="text-[#10B981]" />
                        <span>Payment: <strong>{order.payment_method || 'Cash on Delivery'}</strong></span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Cancel Button */}
                        {isCancellable && (
                          <button
                            type="button"
                            onClick={() => setCancelModalOrder(order)}
                            className="px-3 py-1.5 border border-rose-900/60 text-rose-400 hover:bg-rose-950/40 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Cancel Order
                          </button>
                        )}

                        {/* Return Button */}
                        {isReturnable && (
                          <button
                            type="button"
                            onClick={() => setReturnModalOrder(order)}
                            className="px-3 py-1.5 border border-purple-900/60 text-purple-300 hover:bg-purple-950/40 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Request Return
                          </button>
                        )}

                        <Link
                          to={`/orders/${order.order_number}`}
                          className="text-[#10B981] hover:underline flex items-center gap-1 font-semibold ml-2"
                        >
                          <span>Full Timeline & Invoice</span>
                          <ChevronRight size={14} />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#131915] border border-rose-900/50 p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertCircle size={22} />
              <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">Cancel Order</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you wish to cancel order{' '}
              <strong className="text-[#10B981] font-mono">{cancelModalOrder.order_number}</strong>?
              All reserved product stock will be immediately replenished to our catalog.
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
                <option value="Incorrect shipping address">Incorrect shipping address</option>
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
                onClick={() => setCancelModalOrder(null)}
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

      {/* Return Request Modal */}
      {returnModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#131915] border border-purple-900/50 p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-purple-400">
              <RotateCcw size={22} />
              <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">Request Order Return</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Order <strong className="text-[#10B981] font-mono">{returnModalOrder.order_number}</strong> was marked delivered.
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
                  placeholder="Please describe the issue or condition in detail..."
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
                onClick={() => setReturnModalOrder(null)}
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

export default OrdersPage;
