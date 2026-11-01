import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import orderService from '../services/orderService';
import Button from '../components/Button';
import { formatINR } from '../utils/currencyUtils';
import {
  CheckCircle2,
  PackageCheck,
  ShoppingBag,
  ArrowRight,
  Truck,
  MapPin,
  Calendar,
  Banknote,
  ShieldCheck,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export const OrderSuccessPage = () => {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!location.state?.order);

  useEffect(() => {
    if (!order && orderId) {
      const fetchOrder = async () => {
        try {
          setLoading(true);
          const data = await orderService.getOrderDetail(orderId);
          setOrder(data);
        } catch (e) {
          // If fetching fails, still display orderId
        } finally {
          setLoading(false);
        }
      };
      fetchOrder();
    }
  }, [orderId, order]);

  const orderNumber = order?.order_number || orderId || 'DEP-ORDER';
  const orderTotal = order?.total ? formatINR(order.total) : null;
  const paymentMethod = order?.payment_method || 'Cash on Delivery';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 text-[#F3F4F6] text-center">
      {/* Celebration Graphic / Luxury Illustration */}
      <div className="relative inline-block mx-auto mb-8 animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#161D19] border-2 border-[#10B981] flex items-center justify-center shadow-2xl shadow-[#10B981]/20 relative">
          <PackageCheck size={52} className="text-[#10B981]" />
          <div className="absolute -top-2 -right-2 bg-[#10B981] text-black p-1.5 rounded-full shadow-lg">
            <CheckCircle2 size={18} />
          </div>
        </div>
        <div className="absolute -inset-4 rounded-full bg-[#10B981]/10 blur-xl -z-10 animate-pulse" />
      </div>

      {/* Thank You Statement */}
      <span className="text-xs uppercase tracking-[0.3em] text-[#10B981] font-bold block mb-3">
        ORDER CONFIRMATION • DEPORT ATELIER
      </span>
      <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#F3F4F6] font-normal mb-4">
        Thank You for Your Order
      </h1>
      <p className="text-gray-300 text-sm sm:text-base font-light max-w-xl mx-auto leading-relaxed mb-8">
        Your bespoke luxury pieces have been reserved. Our master artisans are preparing your order with signature gift packaging and heritage authentication.
      </p>

      {/* Order Summary Snapshot Card */}
      <div className="bg-[#131915] border border-[#1E2922] p-6 sm:p-8 text-left max-w-2xl mx-auto shadow-xl space-y-6 mb-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-[#1E2922] gap-2">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 block">
              ORDER REFERENCE
            </span>
            <span className="font-mono text-base font-bold text-[#10B981]">
              {orderNumber}
            </span>
          </div>

          {orderTotal && (
            <div className="text-left sm:text-right">
              <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400 block">
                TOTAL DUE (COD)
              </span>
              <span className="font-serif text-xl font-bold text-[#F3F4F6]">
                {orderTotal}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-300">
          <div className="flex items-start gap-2.5">
            <Banknote size={18} className="text-[#10B981] flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-[#F3F4F6] font-medium">Payment Mode</strong>
              <span className="text-gray-400">{paymentMethod}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Truck size={18} className="text-[#10B981] flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-[#F3F4F6] font-medium">Estimated Delivery</strong>
              <span className="text-gray-400">3 - 5 Business Days</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-[#10B981] flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block text-[#F3F4F6] font-medium">Warranty</strong>
              <span className="text-gray-400">Lifetime Guarantee</span>
            </div>
          </div>
        </div>

        {order?.shipping_address_line_1 && (
          <div className="pt-4 border-t border-[#1E2922] text-xs text-gray-400 flex items-start gap-2">
            <MapPin size={16} className="text-[#10B981] flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-gray-300 font-medium">Shipping to: </span>
              {order.shipping_full_name} • {order.shipping_address_line_1}, {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons: Order Details & Continue Shopping */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          icon={ArrowRight}
          onClick={() => navigate(`/orders/${orderNumber}`)}
        >
          View Order Details
        </Button>

        <Button
          variant="outline"
          size="lg"
          fullWidth
          icon={ShoppingBag}
          onClick={() => navigate('/shop')}
        >
          Continue Shopping
        </Button>
      </div>
    </div>
  );
};

export default OrderSuccessPage;
