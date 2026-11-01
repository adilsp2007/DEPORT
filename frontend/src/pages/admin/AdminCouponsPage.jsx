import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import Button from '../../components/Button';
import AdminPagination from '../../components/admin/AdminPagination';
import { validateCouponForm, normalizeCouponCode } from '../../utils/couponUtils';
import { formatINR } from '../../utils/currencyUtils';
import {
  Ticket,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  X,
  Percent,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export const AdminCouponsPage = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [discountTypeFilter, setDiscountTypeFilter] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    min_order_amount: '0.00',
    max_discount_amount: '',
    start_date: '',
    expiration_date: '',
    usage_limit: '',
    per_user_limit: '1',
    is_active: true
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch Coupons
  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getCoupons({
        page,
        pageSize,
        search: debouncedSearch,
        is_active: statusFilter,
        discount_type: discountTypeFilter
      });

      if (data && data.results) {
        setCoupons(data.results);
        setTotalCount(data.count || 0);
        setTotalPages(data.total_pages || Math.ceil((data.count || 0) / pageSize) || 1);
      } else if (Array.isArray(data)) {
        setCoupons(data);
        setTotalCount(data.length);
        setTotalPages(1);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load coupons. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, discountTypeFilter]);

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  // Handle Quick Toggle Active / Deactivate
  const handleToggleActive = async (coupon, e) => {
    if (e) e.stopPropagation();
    try {
      const res = await adminService.toggleCouponActive(coupon.id);
      setSuccessMessage(res.message || `Coupon "${coupon.code}" status updated.`);
      fetchCoupons();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update coupon status.');
    }
  };

  // Helper for rendering field validation errors
  const renderFieldError = (fieldName) => {
    const err = formErrors[fieldName];
    if (!err) return null;
    const msg = Array.isArray(err) ? err[0] : typeof err === 'object' ? Object.values(err)[0] : err;
    return <p className="text-rose-400 text-[11px] mt-1 font-medium">{msg}</p>;
  };

  // Handle Form Change
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'code' ? value.toUpperCase() : value)
    }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      discount_type: 'percentage',
      discount_value: '',
      min_order_amount: '0.00',
      max_discount_amount: '',
      start_date: '',
      expiration_date: '',
      usage_limit: '',
      per_user_limit: '1',
      is_active: true
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_amount: coupon.min_order_amount ?? coupon.min_purchase_amount ?? '0.00',
      max_discount_amount: coupon.max_discount_amount || '',
      start_date: coupon.start_date ? coupon.start_date.substring(0, 16) : '',
      expiration_date: (coupon.expiration_date || coupon.end_date) ? (coupon.expiration_date || coupon.end_date).substring(0, 16) : '',
      usage_limit: coupon.usage_limit ?? '',
      per_user_limit: coupon.per_user_limit ?? coupon.user_limit ?? '1',
      is_active: coupon.is_active
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Form Submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    // Client-side validation
    const clientValidation = validateCouponForm(formData);
    if (!clientValidation.isValid) {
      setFormErrors(clientValidation.errors);
      return;
    }

    setSubmitting(true);

    const payload = {
      code: normalizeCouponCode(formData.code),
      discount_type: formData.discount_type,
      discount_value: formData.discount_value,
      min_order_amount: formData.min_order_amount || '0.00',
      min_purchase_amount: formData.min_order_amount || '0.00',
      max_discount_amount: formData.max_discount_amount ? formData.max_discount_amount : null,
      start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
      expiration_date: formData.expiration_date ? new Date(formData.expiration_date).toISOString() : null,
      end_date: formData.expiration_date ? new Date(formData.expiration_date).toISOString() : null,
      usage_limit: formData.usage_limit ? parseInt(formData.usage_limit, 10) : null,
      per_user_limit: formData.per_user_limit ? parseInt(formData.per_user_limit, 10) : 1,
      user_limit: formData.per_user_limit ? parseInt(formData.per_user_limit, 10) : 1,
      is_active: formData.is_active
    };

    try {
      if (editingCoupon) {
        await adminService.updateCoupon(editingCoupon.id, payload);
        setSuccessMessage(`Coupon "${payload.code}" updated successfully.`);
      } else {
        await adminService.createCoupon(payload);
        setSuccessMessage(`Coupon "${payload.code}" created successfully.`);
      }
      setIsModalOpen(false);
      fetchCoupons();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      if (err.response?.data) {
        setFormErrors(err.response.data);
      } else {
        setError('An unexpected error occurred. Please check values.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Action
  const handleDeleteClick = (coupon) => {
    setCouponToDelete(coupon);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!couponToDelete) return;
    setSubmitting(true);
    try {
      await adminService.deleteCoupon(couponToDelete.id);
      setIsDeleteModalOpen(false);
      setSuccessMessage(`Coupon "${couponToDelete.code}" deleted successfully.`);
      fetchCoupons();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      setError('Failed to delete coupon.');
    } finally {
      setSubmitting(false);
      setCouponToDelete(null);
    }
  };

  const activeCount = coupons.filter(c => c.is_active).length;
  const totalUsages = coupons.reduce((acc, c) => acc + (c.used_count ?? c.times_used ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E2922]">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            PROMOTIONS & DISCOUNTS
          </span>
          <h2 className="font-serif text-2xl font-bold text-[#F3F4F6]">
            Coupon Management
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Create and monitor store promo codes, discount percentages, limits, and redemption rules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCoupons}
            disabled={loading}
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
            icon={Plus}
          >
            Create Coupon
          </Button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#131915] border border-[#1E2922] p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Total Coupons</span>
            <div className="font-serif text-2xl font-bold text-white mt-0.5">{totalCount}</div>
          </div>
          <div className="p-2.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Ticket size={18} />
          </div>
        </div>

        <div className="bg-[#131915] border border-[#1E2922] p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Active Codes</span>
            <div className="font-serif text-2xl font-bold text-[#10B981] mt-0.5">{activeCount}</div>
          </div>
          <div className="p-2.5 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
            <CheckCircle2 size={18} />
          </div>
        </div>

        <div className="bg-[#131915] border border-[#1E2922] p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">Redemptions Recorded</span>
            <div className="font-serif text-2xl font-bold text-amber-400 mt-0.5">{totalUsages}</div>
          </div>
          <div className="p-2.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Percent size={18} />
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-gray-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-gray-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-[#131915] border border-[#1E2922] p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search coupons by code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0B0F0D] border border-[#1E2922] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#10B981]"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#0B0F0D] border border-[#1E2922] text-xs text-gray-300 px-3 py-2 focus:outline-none focus:border-[#10B981]"
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>

          <select
            value={discountTypeFilter}
            onChange={(e) => {
              setDiscountTypeFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#0B0F0D] border border-[#1E2922] text-xs text-gray-300 px-3 py-2 focus:outline-none focus:border-[#10B981]"
          >
            <option value="">All Types</option>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (₹)</option>
          </select>
        </div>
      </div>

      {/* Coupons Table */}
      <div className="bg-[#131915] border border-[#1E2922] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B0F0D] border-b border-[#1E2922] text-gray-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Coupon Code</th>
                <th className="py-3 px-4">Discount</th>
                <th className="py-3 px-4">Min Purchase</th>
                <th className="py-3 px-4">Redemptions</th>
                <th className="py-3 px-4">Validity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2922] text-gray-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 animate-pulse">
                    Loading promotional coupons...
                  </td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 font-light">
                    No coupons found matching your search.
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-[#161D19] transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-white bg-[#0B0F0D] px-2.5 py-1 border border-[#1E2922]">
                        {coupon.code}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 font-semibold text-[#10B981]">
                        {coupon.discount_type === 'percentage' ? (
                          <>
                            <span>{coupon.discount_value}% OFF</span>
                            {coupon.max_discount_amount && (
                              <span className="text-[10px] text-gray-400 font-normal">
                                (Max {formatINR(coupon.max_discount_amount)})
                              </span>
                            )}
                          </>
                        ) : (
                          <span>{formatINR(coupon.discount_value)} OFF</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-300">
                      {formatINR(coupon.min_order_amount ?? coupon.min_purchase_amount ?? 0)}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span>{coupon.used_count ?? coupon.times_used ?? 0}</span>
                      <span className="text-gray-500"> / {coupon.usage_limit ?? '∞'}</span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-gray-400">
                      {(coupon.expiration_date || coupon.end_date) ? (
                        <span>Expires {new Date(coupon.expiration_date || coupon.end_date).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-emerald-400">No Expiration</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={(e) => handleToggleActive(coupon, e)}
                        title={coupon.is_active ? 'Click to Deactivate' : 'Click to Activate'}
                        className="cursor-pointer focus:outline-none"
                      >
                        {coupon.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 hover:bg-rose-500/20 hover:text-rose-300 transition-colors">
                            <CheckCircle2 size={11} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-[#10B981]/20 hover:text-[#10B981] transition-colors">
                            <XCircle size={11} /> Inactive
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleToggleActive(coupon, e)}
                          className={`p-1.5 transition-colors rounded ${
                            coupon.is_active
                              ? 'text-[#10B981] hover:text-rose-400 hover:bg-rose-500/10'
                              : 'text-gray-500 hover:text-[#10B981] hover:bg-[#10B981]/10'
                          }`}
                          title={coupon.is_active ? 'Deactivate Coupon' : 'Activate Coupon'}
                        >
                          {coupon.is_active ? <ToggleRight size={17} /> : <ToggleLeft size={17} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(coupon)}
                          className="p-1.5 hover:bg-[#10B981]/15 text-gray-400 hover:text-[#10B981] transition-colors rounded"
                          title="Edit Coupon"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(coupon)}
                          className="p-1.5 hover:bg-rose-500/15 text-gray-400 hover:text-rose-400 transition-colors rounded"
                          title="Delete Coupon"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <AdminPagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[10, 20, 50]}
          itemName="coupons"
          loading={loading}
        />
      </div>

      {/* Modal: Create or Edit Coupon */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#131915] border border-[#1E2922] w-full max-w-lg p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <span className="text-xs uppercase tracking-widest text-[#10B981] font-bold block mb-1">
              {editingCoupon ? 'MODIFY PROMOTION' : 'NEW PROMOTION'}
            </span>
            <h3 className="font-serif text-xl font-bold text-white mb-6">
              {editingCoupon ? `Edit Coupon "${editingCoupon.code}"` : 'Create Store Coupon'}
            </h3>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              {(formErrors.detail || formErrors.non_field_errors) && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {formErrors.detail || (Array.isArray(formErrors.non_field_errors) ? formErrors.non_field_errors[0] : formErrors.non_field_errors)}
                </div>
              )}

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Coupon Code *</label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  placeholder="e.g. LUXURY20"
                  required
                  className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white font-mono uppercase focus:border-[#10B981] focus:outline-none"
                />
                {renderFieldError('code')}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Discount Type</label>
                  <select
                    name="discount_type"
                    value={formData.discount_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Rupee (₹)</option>
                  </select>
                  {renderFieldError('discount_type')}
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Discount Value * {formData.discount_type === 'percentage' ? '(%)' : '(₹)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="discount_value"
                    value={formData.discount_value}
                    onChange={handleInputChange}
                    placeholder={formData.discount_type === 'percentage' ? '15' : '50.00'}
                    required
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                  {renderFieldError('discount_value')}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Min Order Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="min_order_amount"
                    value={formData.min_order_amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                  {renderFieldError('min_order_amount')}
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Max Discount Cap (₹ optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="max_discount_amount"
                    value={formData.max_discount_amount}
                    onChange={handleInputChange}
                    placeholder="e.g. 100.00"
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                  {renderFieldError('max_discount_amount')}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Start Date</label>
                  <input
                    type="datetime-local"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                  {renderFieldError('start_date')}
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Expiration Date</label>
                  <input
                    type="datetime-local"
                    name="expiration_date"
                    value={formData.expiration_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                  {renderFieldError('expiration_date')}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Total Usage Limit</label>
                  <input
                    type="number"
                    name="usage_limit"
                    value={formData.usage_limit}
                    onChange={handleInputChange}
                    placeholder="Unlimited if blank"
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                  {renderFieldError('usage_limit')}
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Limit Per Customer</label>
                  <input
                    type="number"
                    name="per_user_limit"
                    value={formData.per_user_limit}
                    onChange={handleInputChange}
                    placeholder="1"
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                  {renderFieldError('per_user_limit')}
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="accent-[#10B981] w-4 h-4"
                  />
                  <span className="text-gray-300 font-medium">Coupon is Active and redeemable at checkout</span>
                </label>
                {renderFieldError('is_active')}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1E2922]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {isDeleteModalOpen && couponToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#131915] border border-rose-500/30 w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="font-serif text-lg font-bold text-white mb-2">Delete Coupon</h3>
            <p className="text-xs text-gray-300 leading-relaxed mb-6 font-light">
              Are you sure you want to permanently delete coupon{' '}
              <strong className="text-white font-mono">{couponToDelete.code}</strong>? Customers will no
              longer be able to apply this code at checkout.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="bg-rose-600 hover:bg-rose-700 text-white border-rose-600"
              >
                {submitting ? 'Deleting...' : 'Delete Coupon'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCouponsPage;
