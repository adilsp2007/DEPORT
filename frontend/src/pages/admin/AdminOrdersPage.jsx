import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import adminService from '../../services/adminService';
import Button from '../../components/Button';
import AdminPagination from '../../components/admin/AdminPagination';
import {
  ShoppingBag,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Truck,
  PackageCheck,
  Clock,
  User as UserIcon,
  MapPin,
  Phone,
  Mail,
  IndianRupee,
  Calendar,
  RotateCcw,
  ArrowUpDown,
  Printer
} from 'lucide-react';
import { formatINR } from '../../utils/currencyUtils';

export const AdminOrdersPage = () => {
  const queryClient = useQueryClient();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('newest'); // descending order by default

  // Order Details & Status Update Modal state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [successMessage, setSuccessMessage] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch orders from API in descending order
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getOrders({
        page,
        pageSize,
        search: debouncedSearch,
        status: statusFilter,
        sort
      });
      setOrders(data.results || []);
      setTotalOrders(data.count || 0);
      setTotalPages(data.total_pages || Math.ceil((data.count || 0) / pageSize) || 1);
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to load store orders.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, sort]);

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setSort('newest');
    setPage(1);
  };

  const handleOpenDetailModal = (orderObj) => {
    setSelectedOrder(orderObj);
    setNewStatus(orderObj.status);
    setIsDetailModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus || updatingStatus) return;

    setUpdatingStatus(true);
    try {
      const response = await adminService.updateOrderStatus(selectedOrder.id, newStatus);
      setSelectedOrder(response.order);
      setSuccessMessage(response.message || 'Order status updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      fetchOrders();
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to update order status.');
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatCurrency = (amount) => formatINR(amount);

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

  const getStatusBadge = (statusKey) => {
    const map = {
      pending: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      confirmed: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      processing: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      shipped: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      out_for_delivery: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40',
      delivered: 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30',
      cancelled: 'text-rose-400 bg-rose-950/60 border-rose-800/50',
      return_requested: 'text-purple-300 bg-purple-950/60 border-purple-800/50',
      returned: 'text-stone-400 bg-stone-900 border-stone-700'
    };
    const style = map[statusKey] || 'text-gray-400 bg-gray-900 border-gray-800';

    return (
      <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase font-bold px-2.5 py-1 border ${style}`}>
        <Clock size={10} />
        {statusKey ? statusKey.replace('_', ' ') : 'Pending'}
      </span>
    );
  };

  const getPaymentBadge = (order) => {
    const payment = order?.payments && order.payments.length > 0 ? order.payments[0] : null;
    const status = payment ? payment.status : (order?.payment_method === 'Cash on Delivery' && order?.status === 'delivered' ? 'completed' : 'pending');

    const map = {
      completed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      pending: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      failed: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      cancelled: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
      refunded: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    };
    const style = map[status] || 'text-gray-400 bg-gray-900 border-gray-800';

    return (
      <span className={`inline-flex items-center gap-1 text-[9px] uppercase font-bold px-2 py-0.5 border ${style}`}>
        {status === 'completed' ? 'Paid' : status === 'pending' ? 'Unpaid' : status}
      </span>
    );
  };

  const isFiltered = Boolean(search || statusFilter || sort !== 'newest');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#131915] border border-[#1E2922] p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            ORDER MANAGEMENT
          </span>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#F3F4F6]">
            Store Orders ({totalOrders})
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Review customer orders in descending order, inspect delivery details, and manage fulfillment statuses.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981]/50 text-xs font-semibold uppercase tracking-wider text-gray-300 hover:text-[#10B981] transition-all cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#10B981]' : ''} />
          <span>Refresh Orders</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 bg-[#10B981]/10 border-l-4 border-[#10B981] text-[#10B981] text-xs font-medium flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-gray-400 hover:text-white cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 bg-rose-950/70 border-l-4 border-rose-500 text-rose-300 text-xs font-medium flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-gray-400 hover:text-white cursor-pointer">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filter, Sort, and Search Bar */}
      <div className="bg-[#131915] border border-[#1E2922] p-4 md:p-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search by order ID (LUX-...), customer name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 pl-11 pr-10 border border-[#1E2922] focus:border-[#10B981] focus:outline-none placeholder-[#9CA3AF]/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-semibold text-gray-400 hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#161D19] text-[#F3F4F6] text-xs px-3.5 py-3 border border-[#1E2922] focus:border-[#10B981] focus:outline-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="return_requested">Return Requested</option>
              <option value="returned">Returned</option>
            </select>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-semibold text-gray-400 hidden sm:inline">Sort:</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="bg-[#161D19] text-[#F3F4F6] text-xs px-3.5 py-3 border border-[#1E2922] focus:border-[#10B981] focus:outline-none cursor-pointer"
            >
              <option value="newest">Order Date: Newest First</option>
              <option value="oldest">Order Date: Oldest First</option>
              <option value="total_high">Total: High to Low</option>
              <option value="total_low">Total: Low to High</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {isFiltered && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-3 py-3 border border-rose-900/40 text-rose-400 hover:bg-rose-950/30 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              title="Reset all filters and search"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-[#131915] border border-[#1E2922] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#161D19] border-b border-[#1E2922] text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <th className="py-4 px-6">Order ID</th>
                <th className="py-4 px-6">Order Date</th>
                <th className="py-4 px-6">User / Customer Details</th>
                <th className="py-4 px-6">Total & Payment</th>
                <th className="py-4 px-6">Fulfillment Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2922] text-xs">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-28" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-24" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-36 mb-1" /><div className="h-3 bg-[#161D19] w-28" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-20" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-20" /></td>
                    <td className="py-4 px-6 text-right"><div className="h-8 bg-[#161D19] w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 space-y-2">
                    <ShoppingBag size={32} className="mx-auto text-gray-600 mb-2" />
                    <p className="font-serif text-lg text-[#F3F4F6]">No store orders found.</p>
                    <p className="text-xs text-gray-500">Orders submitted by customers will appear here in descending order.</p>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-[#161D19]/50 transition-colors">
                    {/* Order ID */}
                    <td className="py-4 px-6 font-mono font-bold text-[#10B981]">
                      {o.order_number}
                    </td>

                    {/* Date */}
                    <td className="py-4 px-6 text-gray-400 text-[11px] whitespace-nowrap">
                      {formatDate(o.created_at)}
                    </td>

                    {/* User Details */}
                    <td className="py-4 px-6">
                      <p className="font-semibold text-[#F3F4F6]">
                        {o.user_name || o.shipping_full_name}
                      </p>
                      <p className="text-[11px] text-gray-400 font-mono">
                        {o.user_email || 'No email provided'}
                      </p>
                      {o.shipping_phone && (
                        <p className="text-[10px] text-gray-500 font-mono">
                          Ph: {o.shipping_phone}
                        </p>
                      )}
                    </td>

                    {/* Total & Payment */}
                    <td className="py-4 px-6">
                      <div className="font-bold text-[#F3F4F6]">{formatCurrency(o.total)}</div>
                      <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="truncate max-w-[120px]">{o.payment_method || 'Cash on Delivery'}</span>
                        {getPaymentBadge(o)}
                      </div>
                    </td>

                    {/* Fulfillment Status */}
                    <td className="py-4 px-6">
                      {getStatusBadge(o.status)}
                    </td>

                    {/* View Detail Button */}
                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetailModal(o)}
                        className="px-3.5 py-1.5 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981] text-gray-300 hover:text-[#10B981] text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye size={14} />
                        <span>View Detail</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <AdminPagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalOrders}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[10, 20, 50]}
          itemName="orders"
          loading={loading}
        />
      </div>

      {/* Order Details & Status Updater Modal */}
      {isDetailModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#131915] border border-[#1E2922] p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#10B981] tracking-widest">
                  ORDER SPECIFICATION
                </span>
                <h3 className="font-mono text-xl font-bold text-[#F3F4F6]">
                  {selectedOrder.order_number}
                </h3>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Status Update Control */}
            <div className="p-4 bg-[#161D19] border border-[#1E2922] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs uppercase font-bold text-gray-400 tracking-wider block mb-1">
                  Change Order Status
                </span>
                <div>{getStatusBadge(selectedOrder.status)}</div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="bg-[#0B0F0D] text-[#F3F4F6] text-xs px-3 py-2 border border-[#10B981]/40 focus:outline-none cursor-pointer"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="return_requested">Return Requested</option>
                  <option value="returned">Returned</option>
                </select>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={updatingStatus}
                  onClick={handleUpdateStatus}
                  disabled={updatingStatus || newStatus === selectedOrder.status}
                >
                  Save Status
                </Button>
              </div>
            </div>

            {/* Cancellation / Return notices */}
            {selectedOrder.status === 'cancelled' && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                <strong>Order Cancelled:</strong> {selectedOrder.cancellation_reason || 'No cancellation reason provided.'}
                {selectedOrder.cancelled_at && ` • ${new Date(selectedOrder.cancelled_at).toLocaleDateString()}`}
              </div>
            )}

            {selectedOrder.status === 'return_requested' && (
              <div className="p-3 bg-purple-950/60 border border-purple-800 text-purple-200 text-xs">
                <strong>Return Requested by Customer:</strong> {selectedOrder.return_reason || 'No return reason provided.'}
              </div>
            )}

            {/* Customer & Shipping Information Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#161D19] border border-[#1E2922] space-y-2">
                <span className="text-gray-400 uppercase tracking-wider text-[10px] font-bold block flex items-center gap-1.5">
                  <UserIcon size={12} className="text-[#10B981]" /> Customer Details
                </span>
                <p className="font-bold text-[#F3F4F6]">{selectedOrder.user_name || selectedOrder.shipping_full_name}</p>
                <p className="text-gray-400 flex items-center gap-1.5">
                  <Mail size={12} /> {selectedOrder.user_email || 'Guest'}
                </p>
                <p className="text-gray-400 flex items-center gap-1.5">
                  <Phone size={12} /> {selectedOrder.shipping_phone}
                </p>
                <p className="text-gray-400 flex items-center gap-1.5">
                  <Calendar size={12} /> Placed: {formatDate(selectedOrder.created_at)}
                </p>
              </div>

              <div className="p-4 bg-[#161D19] border border-[#1E2922] space-y-2">
                <span className="text-gray-400 uppercase tracking-wider text-[10px] font-bold block flex items-center gap-1.5">
                  <MapPin size={12} className="text-[#10B981]" /> Shipping Address
                </span>
                <p className="text-[#F3F4F6] font-medium">{selectedOrder.shipping_address_line_1}</p>
                {selectedOrder.shipping_address_line_2 && (
                  <p className="text-gray-400">{selectedOrder.shipping_address_line_2}</p>
                )}
                <p className="text-gray-400">
                  {selectedOrder.shipping_city}, {selectedOrder.shipping_state} {selectedOrder.shipping_postal_code}
                </p>
                <p className="text-gray-400">{selectedOrder.shipping_country}</p>
                <div className="pt-2 border-t border-[#1E2922] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Payment Method:</span>
                    <strong className="text-[#F3F4F6]">{selectedOrder.payment_method || 'Cash on Delivery'}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Payment Status:</span>
                    {getPaymentBadge(selectedOrder)}
                  </div>
                  {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                    <div className="pt-2 border-t border-[#1E2922] space-y-1.5">
                      {selectedOrder.payments.map((p, idx) => (
                        <div key={p.id || idx} className="text-[11px] font-mono bg-[#0B0F0D] p-2.5 border border-[#1E2922] space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-300 font-semibold">{p.payment_method}:</span>
                            <span className={p.status === 'completed' ? 'text-emerald-400 font-bold' : p.status === 'failed' ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                              {p.status.toUpperCase()} &bull; {p.currency || 'INR'} {p.amount}
                            </span>
                          </div>
                          {(p.razorpay_order_id || p.gateway_order_id) && (
                            <div className="flex items-center justify-between text-[10px] text-gray-400">
                              <span>Razorpay Order ID:</span>
                              <span className="text-gray-200 select-all font-mono">{p.razorpay_order_id || p.gateway_order_id}</span>
                            </div>
                          )}
                          {(p.razorpay_payment_id || p.transaction_id) && (
                            <div className="flex items-center justify-between text-[10px] text-gray-400">
                              <span>Razorpay Payment ID:</span>
                              <span className="text-emerald-400 select-all font-mono">{p.razorpay_payment_id || p.transaction_id}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Order Items Table */}
            <div className="space-y-2">
              <span className="text-xs uppercase font-bold text-gray-400 tracking-wider block">
                Purchased Bag Items ({(selectedOrder.items || []).length})
              </span>
              <div className="border border-[#1E2922] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#161D19] text-gray-400 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Item</th>
                      <th className="py-2.5 px-4">SKU</th>
                      <th className="py-2.5 px-4 text-center">Qty</th>
                      <th className="py-2.5 px-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2922]">
                    {(selectedOrder.items || []).map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 px-4 font-semibold text-[#F3F4F6]">
                          {item.product_name}
                          {item.is_cancelled && (
                            <span className="text-[10px] text-rose-400 block font-normal">
                              [Cancelled Item]
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-400 text-[11px]">{item.product_sku}</td>
                        <td className="py-3 px-4 text-center">{item.quantity}</td>
                        <td className="py-3 px-4 text-right font-bold text-[#10B981]">
                          {formatCurrency(item.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals Summary */}
            <div className="p-4 bg-[#161D19] border border-[#1E2922] space-y-1.5 text-xs text-right">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal:</span>
                <span>{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Shipping:</span>
                <span>{parseFloat(selectedOrder.shipping_cost) === 0 ? 'COMPLIMENTARY' : formatCurrency(selectedOrder.shipping_cost)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[#F3F4F6] pt-2 border-t border-[#1E2922]">
                <span>Total Amount Due (COD):</span>
                <span className="text-[#10B981]">{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-[#1E2922] flex justify-end">
              <Button type="button" variant="outline" size="md" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrdersPage;
