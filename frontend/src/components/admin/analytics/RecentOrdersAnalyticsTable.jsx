import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  RotateCcw
} from 'lucide-react';
import { formatINR } from '../../../utils/currencyUtils';

const statusBadgeConfig = {
  delivered: { text: 'Delivered', bg: 'bg-[#10B981]/10', border: 'border-[#10B981]/30', color: 'text-[#10B981]', icon: CheckCircle2 },
  pending: { text: 'Pending', bg: 'bg-amber-500/10', border: 'border-amber-500/30', color: 'text-amber-400', icon: Clock },
  confirmed: { text: 'Confirmed', bg: 'bg-blue-500/10', border: 'border-blue-500/30', color: 'text-blue-400', icon: CheckCircle2 },
  processing: { text: 'Processing', bg: 'bg-purple-500/10', border: 'border-purple-500/30', color: 'text-purple-400', icon: Clock },
  shipped: { text: 'Shipped', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', color: 'text-cyan-400', icon: Truck },
  out_for_delivery: { text: 'Out for Delivery', bg: 'bg-teal-500/10', border: 'border-teal-500/30', color: 'text-teal-400', icon: Truck },
  cancelled: { text: 'Cancelled', bg: 'bg-rose-950/50', border: 'border-rose-800/40', color: 'text-rose-400', icon: XCircle },
  returned: { text: 'Returned', bg: 'bg-gray-800/60', border: 'border-gray-700', color: 'text-gray-400', icon: RotateCcw },
  return_requested: { text: 'Return Requested', bg: 'bg-orange-500/10', border: 'border-orange-500/30', color: 'text-orange-400', icon: RotateCcw }
};

export const RecentOrdersAnalyticsTable = ({
  orders = [],
  searchTerm = '',
  onSearchChange,
  statusFilter = '',
  onStatusChange,
  isLoading = false
}) => {
  const statusOptions = [
    { id: '', label: 'All Statuses' },
    { id: 'pending', label: 'Pending' },
    { id: 'confirmed', label: 'Confirmed' },
    { id: 'processing', label: 'Processing' },
    { id: 'shipped', label: 'Shipped' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'cancelled', label: 'Cancelled' },
    { id: 'returned', label: 'Returned' }
  ];

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-[#131915] border border-[#1E2922] p-5 sm:p-6 shadow-sm">
      {/* Header, Search & Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#1E2922]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
              <ShoppingBag size={16} />
            </span>
            <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
              Recent Orders Breakdown
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Filtered customer orders for the selected period
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order #, customer..."
              value={searchTerm}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              className="w-full sm:w-56 bg-[#161D19] border border-[#1E2922] text-white pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#10B981] transition-colors"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange && onStatusChange(e.target.value)}
              className="w-full sm:w-40 bg-[#161D19] border border-[#1E2922] text-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:border-[#10B981] transition-colors cursor-pointer"
            >
              {statusOptions.map((opt) => (
                <option key={opt.id} value={opt.id} className="bg-[#131915] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <Link
            to="/admin/orders"
            className="px-3 py-1.5 bg-[#161D19] hover:bg-[#1E2922] border border-[#1E2922] text-xs font-semibold uppercase tracking-wider text-gray-300 hover:text-[#10B981] transition-colors flex items-center justify-center gap-1.5 shrink-0"
          >
            <span>View All</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-x-auto">
        {!orders || orders.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 space-y-2">
            <ShoppingBag size={28} className="mx-auto text-gray-600" />
            <p>No orders match the selected filters.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E2922] text-[10px] uppercase tracking-wider text-gray-400">
                <th className="pb-3 font-semibold">Order ID</th>
                <th className="pb-3 font-semibold">Customer</th>
                <th className="pb-3 font-semibold hidden md:table-cell">Date</th>
                <th className="pb-3 font-semibold">Amount</th>
                <th className="pb-3 font-semibold hidden sm:table-cell">Payment</th>
                <th className="pb-3 font-semibold">Fulfillment</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2922]/50">
              {orders.map((o) => {
                const badge = statusBadgeConfig[o.order_status] || {
                  text: o.status_display,
                  bg: 'bg-gray-800',
                  border: 'border-gray-700',
                  color: 'text-gray-300',
                  icon: Clock
                };
                const BadgeIcon = badge.icon;
                const isPaid = o.payment_status === 'completed';

                return (
                  <tr key={o.id} className="hover:bg-[#161D19]/60 transition-colors">
                    <td className="py-3 pr-3 font-mono font-bold text-[#10B981]">
                      {o.order_number}
                    </td>

                    <td className="py-3 px-3">
                      <p className="font-semibold text-white truncate max-w-[140px] sm:max-w-none">
                        {o.customer_name}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate max-w-[140px] sm:max-w-none">
                        {o.customer_email}
                      </p>
                    </td>

                    <td className="py-3 px-3 hidden md:table-cell text-gray-400 text-[11px]">
                      {formatDate(o.created_at)}
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-white">
                      {formatINR(o.total)}
                    </td>

                    <td className="py-3 px-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 border ${
                        isPaid
                          ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
                          : o.payment_status === 'failed'
                          ? 'bg-rose-950/50 border-rose-800/40 text-rose-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}>
                        {o.payment_status?.toUpperCase() || 'PENDING'}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 border ${badge.bg} ${badge.border} ${badge.color}`}>
                        <BadgeIcon size={11} />
                        <span>{badge.text}</span>
                      </span>
                    </td>

                    <td className="py-3 pl-3 text-right">
                      <Link
                        to={`/admin/orders/${o.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981] text-[11px] text-gray-300 hover:text-[#10B981] transition-colors"
                      >
                        <span>Details</span>
                        <ExternalLink size={11} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RecentOrdersAnalyticsTable;

