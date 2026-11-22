import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import Button from '../../components/Button';
import Input from '../../components/Input';
import AdminPagination from '../../components/admin/AdminPagination';
import { formatINR } from '../../utils/currencyUtils';
import { parseApiError } from '../../utils/errorHandler';
import {
  Percent,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  FolderTree,
  Calendar,
  Clock,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';

export const AdminCategoryOffersPage = () => {
  const [offers, setOffers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '', 'active', 'scheduled', 'expired', 'inactive'
  const [sort, setSort] = useState('newest');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [offerToDelete, setOfferToDelete] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    category: '',
    offer_type: 'percentage',
    offer_value: '',
    start_date: '',
    end_date: '',
    is_active: true
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Load active categories for dropdown
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const catData = await adminService.getCategories({ status: 'active', pageSize: 100 });
        setCategories(catData.results || catData || []);
      } catch (e) {
        console.error('Failed to load categories', e);
      }
    };
    loadCategories();
  }, []);

  // Fetch Category Offers
  const fetchOffers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getCategoryOffers({
        page,
        pageSize,
        search: debouncedSearch,
        status: statusFilter,
        sort
      });

      if (data && data.results) {
        setOffers(data.results);
        setTotalCount(data.count || 0);
        setTotalPages(data.total_pages || Math.ceil((data.count || 0) / pageSize) || 1);
      } else if (Array.isArray(data)) {
        setOffers(data);
        setTotalCount(data.length);
        setTotalPages(1);
      }
    } catch (err) {
      const parsed = parseApiError(err, 'Failed to load category offers.');
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, sort]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // Format date helper for datetime-local input (YYYY-MM-DDTHH:mm)
  const toLocalISOString = (dateInput) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  };

  const handleOpenAddModal = () => {
    setEditingOffer(null);
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setFormData({
      category: '',
      offer_type: 'percentage',
      offer_value: '',
      start_date: toLocalISOString(now),
      end_date: toLocalISOString(nextWeek),
      is_active: true
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (off) => {
    setEditingOffer(off);
    setFormData({
      category: off.category,
      offer_type: off.offer_type,
      offer_value: off.offer_value,
      start_date: toLocalISOString(off.start_date),
      end_date: toLocalISOString(off.end_date),
      is_active: off.is_active
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field] || formErrors.general) {
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        delete copy.general;
        return copy;
      });
    }
  };

  const validateForm = () => {
    const errs = {};

    if (!formData.category) {
      errs.category = 'Please select a category.';
    }

    if (!formData.offer_type) {
      errs.offer_type = 'Please select an offer type.';
    }

    const val = parseFloat(formData.offer_value);
    if (!formData.offer_value || isNaN(val) || val <= 0) {
      errs.offer_value = 'Offer value must be greater than zero.';
    } else if (formData.offer_type === 'percentage' && val > 100) {
      errs.offer_value = 'Percentage offer cannot exceed 100%.';
    }

    if (!formData.start_date) {
      errs.start_date = 'Start date is required.';
    }

    if (!formData.end_date) {
      errs.end_date = 'End date is required.';
    }

    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date).getTime();
      const end = new Date(formData.end_date).getTime();
      if (end <= start) {
        errs.end_date = 'End date must be later than start date.';
      }
    }

    // Client-side overlapping active offer check
    if (formData.is_active && formData.category && formData.start_date && formData.end_date) {
      const selectedCatId = parseInt(formData.category, 10);
      const startMs = new Date(formData.start_date).getTime();
      const endMs = new Date(formData.end_date).getTime();
      const currentId = editingOffer ? editingOffer.id : null;

      const overlap = offers.find((o) => {
        if (o.id === currentId || !o.is_active || o.category !== selectedCatId) return false;
        const oStart = new Date(o.start_date).getTime();
        const oEnd = new Date(o.end_date).getTime();
        return startMs <= oEnd && endMs >= oStart;
      });

      if (overlap) {
        errs.category = `An active offer for this category already exists (${new Date(overlap.start_date).toLocaleDateString()} to ${new Date(overlap.end_date).toLocaleDateString()}).`;
      }
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setFormErrors({});

    try {
      const payload = {
        category: parseInt(formData.category, 10),
        offer_type: formData.offer_type,
        offer_value: parseFloat(formData.offer_value),
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        is_active: formData.is_active
      };

      if (editingOffer) {
        await adminService.updateCategoryOffer(editingOffer.id, payload);
        setSuccessMessage('Category offer updated successfully.');
      } else {
        await adminService.createCategoryOffer(payload);
        setSuccessMessage('Category offer created successfully.');
      }

      setIsModalOpen(false);
      fetchOffers();
    } catch (err) {
      const parsed = parseApiError(err, 'Failed to save category offer.');
      if (parsed.fieldErrors && Object.keys(parsed.fieldErrors).length > 0) {
        setFormErrors(parsed.fieldErrors);
      } else {
        setFormErrors({ general: parsed.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (offer) => {
    try {
      await adminService.toggleCategoryOfferStatus(offer.id);
      fetchOffers();
    } catch (err) {
      const parsed = parseApiError(err, 'Failed to toggle offer status.');
      setError(parsed.message);
    }
  };

  const handleDeleteOffer = async () => {
    if (!offerToDelete) return;
    setSubmitting(true);
    try {
      await adminService.deleteCategoryOffer(offerToDelete.id);
      setSuccessMessage('Category offer deleted successfully.');
      setIsDeleteModalOpen(false);
      setOfferToDelete(null);
      fetchOffers();
    } catch (err) {
      const parsed = parseApiError(err, 'Failed to delete category offer.');
      setError(parsed.message);
      setIsDeleteModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDisplayDate = (dateString) => {
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
    switch (statusKey) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-400 bg-sky-950/60 border border-sky-800">
            <Clock size={12} />
            Scheduled
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-gray-900 border border-gray-700">
            <XCircle size={12} />
            Expired
          </span>
        );
      case 'inactive':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-400 bg-rose-950/60 border border-rose-800">
            <XCircle size={12} />
            Inactive
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1E2922]">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#F3F4F6] tracking-wide flex items-center gap-3">
            <Percent className="text-[#10B981]" size={28} />
            Category Offer Management
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Create and schedule targeted percentage or fixed discounts across product categories.
          </p>
        </div>

        <Button
          variant="primary"
          icon={Plus}
          onClick={handleOpenAddModal}
          className="shrink-0"
        >
          Create Category Offer
        </Button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filters & Search Control Bar */}
      <div className="bg-[#131915] border border-[#1E2922] p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search by Category */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search by category name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#161D19] text-[#F3F4F6] text-xs pl-10 pr-10 py-2.5 border border-[#1E2922] focus:border-[#10B981] focus:outline-none transition-colors placeholder-gray-500"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setDebouncedSearch('');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#161D19] text-[#F3F4F6] text-xs px-3 py-2.5 border border-[#1E2922] focus:border-[#10B981] focus:outline-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Offers</option>
            <option value="scheduled">Scheduled Offers</option>
            <option value="expired">Expired Offers</option>
            <option value="inactive">Inactive Offers</option>
          </select>

          {/* Sort Control */}
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="bg-[#161D19] text-[#F3F4F6] text-xs px-3 py-2.5 border border-[#1E2922] focus:border-[#10B981] focus:outline-none cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="value_high">Discount (High to Low)</option>
            <option value="value_low">Discount (Low to High)</option>
            <option value="end_date">Expiring Soonest</option>
          </select>

          <button
            onClick={() => {
              setSearch('');
              setDebouncedSearch('');
              setStatusFilter('');
              setSort('newest');
              setPage(1);
            }}
            title="Reset Filters"
            className="p-2.5 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981]/50 text-gray-300 hover:text-[#10B981] text-xs transition-colors cursor-pointer"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Offers Table */}
      <div className="bg-[#131915] border border-[#1E2922] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1E2922] bg-[#161D19] text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Offer Discount</th>
                <th className="py-3.5 px-4">Validity Window</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Active Toggle</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2922] text-xs text-[#F3F4F6]">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    <RefreshCw className="animate-spin inline-block mr-2 text-[#10B981]" size={18} />
                    Loading category offers...
                  </td>
                </tr>
              ) : offers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-gray-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <FolderTree size={32} className="mx-auto text-gray-600 mb-2" />
                      <p className="font-semibold text-gray-300">No category offers found</p>
                      <p className="text-[11px] text-gray-500">
                        {search || statusFilter ? 'Try clearing your search filters.' : 'Click "Create Category Offer" to add your first promotion.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                offers.map((off) => (
                  <tr key={off.id} className="hover:bg-[#161D19]/60 transition-colors">
                    {/* Category */}
                    <td className="py-4 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        <FolderTree size={16} className="text-[#10B981] shrink-0" />
                        <div>
                          <span className="font-serif font-bold text-sm text-[#F3F4F6]">
                            {off.category_name}
                          </span>
                          <span className="block text-[10px] font-mono text-gray-400">
                            /{off.category_slug}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Offer Value */}
                    <td className="py-4 px-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] font-mono font-bold text-xs rounded-xs">
                        <Sparkles size={13} />
                        {off.offer_type === 'percentage'
                          ? `${parseFloat(off.offer_value)}% OFF`
                          : `${formatINR(off.offer_value)} OFF`}
                      </div>
                    </td>

                    {/* Validity Period */}
                    <td className="py-4 px-4 text-gray-300">
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <span className="text-gray-500 w-10">Start:</span>
                          <span className="font-mono text-gray-300">{formatDisplayDate(off.start_date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <span className="text-gray-500 w-10">End:</span>
                          <span className="font-mono text-gray-300">{formatDisplayDate(off.end_date)}</span>
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-4">
                      {getStatusBadge(off.status)}
                    </td>

                    {/* Active Toggle */}
                    <td className="py-4 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(off)}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                          off.is_active
                            ? 'text-emerald-400 hover:text-emerald-300'
                            : 'text-gray-500 hover:text-gray-400'
                        }`}
                        title={off.is_active ? 'Deactivate this offer' : 'Activate this offer'}
                      >
                        {off.is_active ? (
                          <ToggleRight size={22} className="text-[#10B981]" />
                        ) : (
                          <ToggleLeft size={22} className="text-gray-600" />
                        )}
                        <span className="text-[11px]">{off.is_active ? 'Active' : 'Disabled'}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(off)}
                          className="px-3 py-1.5 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981]/50 text-gray-300 hover:text-[#10B981] text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Edit Offer"
                        >
                          <Edit2 size={12} />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOfferToDelete(off);
                            setIsDeleteModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 text-rose-400 text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Delete Offer"
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </div>
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
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          pageSizeOptions={[10, 20, 50]}
          itemName="category offers"
          loading={loading}
        />
      </div>

      {/* Create / Edit Category Offer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-[#131915] border border-[#1E2922] p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
              <h3 className="font-serif text-xl font-bold text-[#F3F4F6] flex items-center gap-2">
                <Percent className="text-[#10B981]" size={20} />
                {editingOffer ? 'Edit Category Offer' : 'Create Category Offer'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {formErrors.general && (
              <div className="p-3 bg-rose-950/70 border-l-4 border-rose-500 text-rose-300 text-xs">
                {formErrors.general}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category Dropdown */}
              <div className="w-full flex flex-col gap-1.5">
                <label htmlFor="offer-category-select" className="text-xs uppercase tracking-wider font-semibold text-[#E5E7EB]/90">
                  Target Category <span className="text-[#10B981]">*</span>
                </label>
                <select
                  id="offer-category-select"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className={`w-full bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 border transition-all duration-200 focus:outline-none cursor-pointer ${
                    formErrors.category
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-[#10B981]/30 focus:border-[#10B981]'
                  }`}
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {formErrors.category && (
                  <span className="text-xs text-rose-500 font-medium tracking-wide flex items-center gap-1">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>{formErrors.category}</span>
                  </span>
                )}
              </div>

              {/* Offer Type & Value Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Offer Type */}
                <div className="w-full flex flex-col gap-1.5">
                  <label htmlFor="offer-type-select" className="text-xs uppercase tracking-wider font-semibold text-[#E5E7EB]/90">
                    Offer Type <span className="text-[#10B981]">*</span>
                  </label>
                  <select
                    id="offer-type-select"
                    value={formData.offer_type}
                    onChange={(e) => handleInputChange('offer_type', e.target.value)}
                    className="w-full bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 border border-[#10B981]/30 focus:border-[#10B981] focus:outline-none cursor-pointer"
                  >
                    <option value="percentage">Percentage Discount (%)</option>
                    <option value="fixed">Fixed Amount Discount (₹)</option>
                  </select>
                </div>

                {/* Offer Value */}
                <Input
                  label={formData.offer_type === 'percentage' ? 'Discount Value (% Off) *' : 'Discount Value (₹ Off) *'}
                  type="number"
                  step={formData.offer_type === 'percentage' ? '1' : '0.01'}
                  min="0.01"
                  max={formData.offer_type === 'percentage' ? '100' : undefined}
                  name="offer_value"
                  placeholder={formData.offer_type === 'percentage' ? 'e.g. 20' : 'e.g. 300.00'}
                  value={formData.offer_value}
                  onChange={(e) => handleInputChange('offer_value', e.target.value)}
                  error={formErrors.offer_value}
                  required
                />
              </div>

              {/* Date Validity Window */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="w-full flex flex-col gap-1.5">
                  <label htmlFor="offer-start-date" className="text-xs uppercase tracking-wider font-semibold text-[#E5E7EB]/90">
                    Start Date & Time <span className="text-[#10B981]">*</span>
                  </label>
                  <input
                    id="offer-start-date"
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => handleInputChange('start_date', e.target.value)}
                    className={`w-full bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 border transition-all duration-200 focus:outline-none ${
                      formErrors.start_date
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : 'border-[#10B981]/30 focus:border-[#10B981]'
                    }`}
                  />
                  {formErrors.start_date && (
                    <span className="text-xs text-rose-500 font-medium tracking-wide flex items-center gap-1">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{formErrors.start_date}</span>
                    </span>
                  )}
                </div>

                <div className="w-full flex flex-col gap-1.5">
                  <label htmlFor="offer-end-date" className="text-xs uppercase tracking-wider font-semibold text-[#E5E7EB]/90">
                    End Date & Time <span className="text-[#10B981]">*</span>
                  </label>
                  <input
                    id="offer-end-date"
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => handleInputChange('end_date', e.target.value)}
                    className={`w-full bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 border transition-all duration-200 focus:outline-none ${
                      formErrors.end_date
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                        : 'border-[#10B981]/30 focus:border-[#10B981]'
                    }`}
                  />
                  {formErrors.end_date && (
                    <span className="text-xs text-rose-500 font-medium tracking-wide flex items-center gap-1">
                      <AlertCircle size={12} className="shrink-0" />
                      <span>{formErrors.end_date}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Status Active Checkbox */}
              <div className="pt-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="offer-is-active"
                  checked={formData.is_active}
                  onChange={(e) => handleInputChange('is_active', e.target.checked)}
                  className="w-4 h-4 rounded-xs border-[#1E2922] bg-[#161D19] text-[#10B981] focus:ring-[#10B981] cursor-pointer"
                />
                <label htmlFor="offer-is-active" className="text-xs font-semibold text-gray-200 cursor-pointer">
                  Activate Offer Immediately
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#1E2922]">
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
                  loading={submitting}
                >
                  {editingOffer ? 'Save Changes' : 'Create Offer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && offerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#131915] border border-rose-900/50 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-950/60 border border-rose-900 rounded-full">
                <Trash2 size={24} />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">
                Delete Category Offer
              </h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed font-light">
              Are you sure you want to permanently delete the promotion for category{' '}
              <strong className="text-white font-bold">"{offerToDelete.category_name}"</strong>{' '}
              ({offerToDelete.offer_type === 'percentage' ? `${parseFloat(offerToDelete.offer_value)}% OFF` : `${formatINR(offerToDelete.offer_value)} OFF`})?
              Products in this category will immediately revert to their default pricing.
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1E2922]">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setOfferToDelete(null);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>

              <button
                type="button"
                onClick={handleDeleteOffer}
                disabled={submitting}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategoryOffersPage;

