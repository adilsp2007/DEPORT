import React, { useState, useEffect, useCallback, useMemo } from 'react';
import adminService from '../../services/adminService';
import Button from '../../components/Button';
import { AdminPagination } from '../../components/admin/AdminPagination';
import { parseApiError } from '../../utils/errorHandler';
import {
  Image as ImageIcon,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  X,
  ExternalLink,
  Eye,
  Search,
  Filter,
  RotateCcw,
  Calendar,
  Layers,
  LayoutGrid,
  Table as TableIcon,
  ToggleLeft,
  ToggleRight,
  Upload,
  Link as LinkIcon,
  Tag,
  Package,
  Clock
} from 'lucide-react';

const STATUS_FILTERS = [
  { id: '', label: 'All Statuses' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'expired', label: 'Expired' }
];

export const AdminBannersPage = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Available metadata
  const [availableTypes, setAvailableTypes] = useState([
    { value: 'hero', label: 'Hero Section' },
    { value: 'promotional', label: 'Promotional Banner' },
    { value: 'secondary', label: 'Secondary Banner' }
  ]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);

  // Filters & Pagination State
  const [bannerTypeFilter, setBannerTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bannerToDelete, setBannerToDelete] = useState(null);
  const [previewBanner, setPreviewBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    tagline: '',
    placement: 'hero',
    image_url: '',
    button_text: 'Shop Collection',
    button_link: '/shop',
    secondary_button_text: '',
    secondary_button_link: '',
    destination_type: 'custom', // 'custom' | 'category' | 'product'
    linked_category: '',
    linked_product: '',
    start_date: '',
    end_date: '',
    display_order: 0,
    is_active: true
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset page on search change
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load types, categories, and products on mount
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [typesData, catsData, prodsData, summaryData] = await Promise.all([
          adminService.getBannerTypes().catch(() => null),
          adminService.getCategories({ pageSize: 100 }).catch(() => null),
          adminService.getProducts({ pageSize: 100 }).catch(() => null),
          adminService.getBannerSummary().catch(() => null)
        ]);

        if (typesData && Array.isArray(typesData)) {
          setAvailableTypes(typesData);
        }
        if (catsData) {
          setCategories(catsData.results || (Array.isArray(catsData) ? catsData : []));
        }
        if (prodsData) {
          setProducts(prodsData.results || (Array.isArray(prodsData) ? prodsData : []));
        }
        if (summaryData) {
          setSummary(summaryData);
        }
      } catch {
        // silent fallback
      }
    };
    loadMetadata();
  }, []);

  // Fetch Banners from API
  const fetchBanners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getBanners({
        page: currentPage,
        pageSize: pageSize,
        bannerType: bannerTypeFilter,
        status: statusFilter,
        search: debouncedSearch,
        startDate: startDateFilter,
        endDate: endDateFilter
      });

      const items = data.results || (Array.isArray(data) ? data : []);
      setBanners(items);
      setTotalCount(data.count ?? items.length);

      // Refresh summary
      adminService.getBannerSummary().then(setSummary).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load banners.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, bannerTypeFilter, statusFilter, debouncedSearch, startDateFilter, endDateFilter]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [totalCount, pageSize]);

  // Filter Handlers
  const handleTypeChange = (e) => {
    setBannerTypeFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setBannerTypeFilter('');
    setStatusFilter('');
    setSearchQuery('');
    setDebouncedSearch('');
    setStartDateFilter('');
    setEndDateFilter('');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    bannerTypeFilter || statusFilter || searchQuery || startDateFilter || endDateFilter
  );

  // Image Upload Handling
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFormErrors((prev) => ({ ...prev, image: 'Image size must be less than 5MB.' }));
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!validTypes.includes(file.type)) {
      setFormErrors((prev) => ({
        ...prev,
        image: 'Unsupported format. Please select JPEG, PNG, WebP, or AVIF.'
      }));
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setFormErrors((prev) => ({ ...prev, image: null }));
  };

  // Form Handlers
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleDestinationTypeChange = (destType) => {
    setFormData((prev) => {
      let newLink = prev.button_link;
      if (destType === 'category' && prev.linked_category) {
        const cat = categories.find((c) => String(c.id) === String(prev.linked_category));
        if (cat) newLink = `/shop?category=${cat.slug}`;
      } else if (destType === 'product' && prev.linked_product) {
        const prod = products.find((p) => String(p.id) === String(prev.linked_product));
        if (prod) newLink = `/product/${prod.slug}`;
      }
      return {
        ...prev,
        destination_type: destType,
        button_link: newLink
      };
    });
  };

  const handleCategorySelect = (e) => {
    const catId = e.target.value;
    const cat = categories.find((c) => String(c.id) === String(catId));
    setFormData((prev) => ({
      ...prev,
      linked_category: catId,
      button_link: cat ? `/shop?category=${cat.slug}` : prev.button_link
    }));
  };

  const handleProductSelect = (e) => {
    const prodId = e.target.value;
    const prod = products.find((p) => String(p.id) === String(prodId));
    setFormData((prev) => ({
      ...prev,
      linked_product: prodId,
      button_link: prod ? `/product/${prod.slug}` : prev.button_link
    }));
  };

  const handleOpenCreateModal = () => {
    setEditingBanner(null);
    setImageFile(null);
    setImagePreview('');
    setFormData({
      title: '',
      subtitle: '',
      tagline: 'NEW COLLECTION 2026',
      placement: availableTypes[0]?.value || 'hero',
      image_url: '',
      button_text: 'Shop Collection',
      button_link: '/shop',
      secondary_button_text: '',
      secondary_button_link: '',
      destination_type: 'custom',
      linked_category: '',
      linked_product: '',
      start_date: '',
      end_date: '',
      display_order: 0,
      is_active: true
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (banner) => {
    setEditingBanner(banner);
    setImageFile(null);
    setImagePreview(banner.image || banner.image_url || '');

    let destType = 'custom';
    if (banner.linked_category) destType = 'category';
    else if (banner.linked_product) destType = 'product';

    // Format datetime-local strings
    const formatForInput = (dt) => {
      if (!dt) return '';
      const d = new Date(dt);
      if (isNaN(d.getTime())) return '';
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    setFormData({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      tagline: banner.tagline || '',
      placement: banner.placement || 'hero',
      image_url: banner.image_url || '',
      button_text: banner.button_text || 'Shop Collection',
      button_link: banner.button_link || '/shop',
      secondary_button_text: banner.secondary_button_text || '',
      secondary_button_link: banner.secondary_button_link || '',
      destination_type: destType,
      linked_category: banner.linked_category || '',
      linked_product: banner.linked_product || '',
      start_date: formatForInput(banner.start_date),
      end_date: formatForInput(banner.end_date),
      display_order: banner.display_order ?? 0,
      is_active: banner.is_active
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    const errors = {};
    const cleanedTitle = (formData.title || '').trim();
    if (!cleanedTitle) {
      errors.title = 'Banner title is required.';
    }

    // Image requirement: on create, need either image file or image_url
    if (!editingBanner && !imageFile && !formData.image_url?.trim()) {
      errors.image = 'Please upload a banner image or provide an image URL.';
    }

    // Date validation
    if (formData.start_date && formData.end_date) {
      if (new Date(formData.start_date) > new Date(formData.end_date)) {
        errors.end_date = 'Expiry date must be later than start date.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      // Build FormData payload for file upload support
      const payload = new FormData();
      payload.append('title', cleanedTitle);
      payload.append('subtitle', (formData.subtitle || '').trim());
      payload.append('tagline', (formData.tagline || '').trim());
      payload.append('placement', formData.placement);
      payload.append('banner_type', formData.placement);
      payload.append('button_text', (formData.button_text || 'Shop Collection').trim());
      payload.append('button_link', (formData.button_link || '/shop').trim());
      payload.append('secondary_button_text', (formData.secondary_button_text || '').trim());
      payload.append('secondary_button_link', (formData.secondary_button_link || '').trim());
      payload.append('display_order', String(parseInt(formData.display_order, 10) || 0));
      payload.append('is_active', String(formData.is_active));

      if (imageFile) {
        payload.append('image', imageFile);
      } else if (formData.image_url?.trim()) {
        payload.append('image_url', formData.image_url.trim());
      }

      if (formData.start_date) {
        payload.append('start_date', new Date(formData.start_date).toISOString());
      } else {
        payload.append('start_date', '');
      }

      if (formData.end_date) {
        payload.append('end_date', new Date(formData.end_date).toISOString());
      } else {
        payload.append('end_date', '');
      }

      if (formData.destination_type === 'category' && formData.linked_category) {
        payload.append('linked_category', String(formData.linked_category));
      } else {
        payload.append('linked_category', '');
      }

      if (formData.destination_type === 'product' && formData.linked_product) {
        payload.append('linked_product', String(formData.linked_product));
      } else {
        payload.append('linked_product', '');
      }

      if (editingBanner) {
        await adminService.updateBanner(editingBanner.id, payload);
        setSuccessMessage(`Banner "${cleanedTitle}" updated successfully.`);
      } else {
        await adminService.createBanner(payload);
        setSuccessMessage(`Banner "${cleanedTitle}" created successfully.`);
      }

      setIsModalOpen(false);
      fetchBanners();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      const parsed = parseApiError(err, 'Failed to save banner.');
      if (parsed.fieldErrors && Object.keys(parsed.fieldErrors).length > 0) {
        setFormErrors(parsed.fieldErrors);
      } else {
        setFormErrors({ general: parsed.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Status Handler
  const handleToggleStatus = async (banner) => {
    try {
      const res = await adminService.toggleBannerStatus(banner.id);
      const isNowActive = res?.banner?.is_active ?? !banner.is_active;
      setBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, is_active: isNowActive, status: res?.banner?.status || (isNowActive ? 'active' : 'inactive') } : b))
      );
      setSuccessMessage(res.message || `Banner "${banner.title}" status updated.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      adminService.getBannerSummary().then(setSummary).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to toggle banner status.');
    }
  };

  // Delete Handlers
  const handleDeleteClick = (banner) => {
    setBannerToDelete(banner);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!bannerToDelete) return;
    setSubmitting(true);
    try {
      await adminService.deleteBanner(bannerToDelete.id);
      setIsDeleteModalOpen(false);
      setSuccessMessage(`Banner "${bannerToDelete.title}" deleted.`);
      fetchBanners();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete banner.');
    } finally {
      setSubmitting(false);
      setBannerToDelete(null);
    }
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return 'Indefinite';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Indefinite';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (banner) => {
    const st = banner.status || (banner.is_active ? 'active' : 'inactive');
    switch (st) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800">
            <CheckCircle2 size={10} />
            <span>Active</span>
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800">
            <Clock size={10} />
            <span>Scheduled</span>
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-800">
            <AlertCircle size={10} />
            <span>Expired</span>
          </span>
        );
      case 'inactive':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 bg-[#161D19] text-gray-400 border border-[#1E2922]">
            <XCircle size={10} />
            <span>Inactive</span>
          </span>
        );
    }
  };

  const getTypeLabel = (val) => {
    const t = availableTypes.find((x) => x.value === val);
    return t ? t.label : val ? val.toUpperCase() : 'HERO';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E2922]">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            HOMEPAGE & MARKETING
          </span>
          <h2 className="font-serif text-2xl font-bold text-[#F3F4F6]">
            Banner Management
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Manage storefront hero headers, promotional highlights, and scheduled campaigns with targeted destination links.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBanners}
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
            Create Banner
          </Button>
        </div>
      </div>

      {/* 2. Quick Summary Metrics Bar */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-[#131915] border border-[#1E2922] flex items-center justify-between">
            <span className="text-xs text-gray-400">Total Banners</span>
            <span className="font-serif text-lg font-bold text-white">{summary.total}</span>
          </div>
          <div className="p-3 bg-[#131915] border border-[#1E2922] flex items-center justify-between">
            <span className="text-xs text-emerald-400">Active</span>
            <span className="font-serif text-lg font-bold text-emerald-400">{summary.active}</span>
          </div>
          <div className="p-3 bg-[#131915] border border-[#1E2922] flex items-center justify-between">
            <span className="text-xs text-amber-400">Scheduled</span>
            <span className="font-serif text-lg font-bold text-amber-400">{summary.scheduled}</span>
          </div>
          <div className="p-3 bg-[#131915] border border-[#1E2922] flex items-center justify-between">
            <span className="text-xs text-rose-400">Expired</span>
            <span className="font-serif text-lg font-bold text-rose-400">{summary.expired}</span>
          </div>
          <div className="p-3 bg-[#131915] border border-[#1E2922] flex items-center justify-between col-span-2 sm:col-span-1">
            <span className="text-xs text-gray-400">Inactive</span>
            <span className="font-serif text-lg font-bold text-gray-400">{summary.inactive}</span>
          </div>
        </div>
      )}

      {/* 3. Notifications */}
      {successMessage && (
        <div className="p-3.5 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-gray-400 hover:text-white cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-gray-400 hover:text-white cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 4. Filter & Search Controls Bar */}
      <div className="bg-[#131915] border border-[#1E2922] p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Banner Type Filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <Layers size={13} className="text-[#10B981]" />
                <span>Type:</span>
              </span>
              <select
                value={bannerTypeFilter}
                onChange={handleTypeChange}
                className="bg-[#161D19] border border-[#1E2922] text-white px-3 py-1.5 text-xs focus:outline-none focus:border-[#10B981] transition-colors cursor-pointer"
              >
                <option value="">All Types</option>
                {availableTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                <Filter size={13} className="text-[#10B981]" />
                <span>Status:</span>
              </span>
              <select
                value={statusFilter}
                onChange={handleStatusChange}
                className="bg-[#161D19] border border-[#1E2922] text-white px-3 py-1.5 text-xs focus:outline-none focus:border-[#10B981] transition-colors cursor-pointer"
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by title, tagline..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#161D19] border border-[#1E2922] text-white pl-8 pr-8 py-1.5 text-xs focus:outline-none focus:border-[#10B981] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Right Controls: View Toggle & Clear Filters */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-2.5 py-1.5 bg-[#161D19] hover:bg-rose-950/40 border border-[#1E2922] hover:border-rose-900 text-gray-300 hover:text-rose-400 text-xs flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Clear Filters</span>
              </button>
            )}

            <div className="flex bg-[#161D19] border border-[#1E2922] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-[#10B981] text-black' : 'text-gray-400 hover:text-white'
                }`}
                title="Grid Card View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 transition-colors cursor-pointer ${
                  viewMode === 'table' ? 'bg-[#10B981] text-black' : 'text-gray-400 hover:text-white'
                }`}
                title="Table View"
              >
                <TableIcon size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Optional Date Range Sub-Bar */}
        <div className="pt-2 border-t border-[#1E2922]/60 flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span className="text-[11px] uppercase font-semibold flex items-center gap-1">
            <Calendar size={12} />
            <span>Date Range:</span>
          </span>
          <input
            type="date"
            value={startDateFilter}
            onChange={(e) => {
              setStartDateFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-[#161D19] border border-[#1E2922] text-white px-2 py-1 text-xs focus:outline-none focus:border-[#10B981]"
          />
          <span>to</span>
          <input
            type="date"
            value={endDateFilter}
            onChange={(e) => {
              setEndDateFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-[#161D19] border border-[#1E2922] text-white px-2 py-1 text-xs focus:outline-none focus:border-[#10B981]"
          />
        </div>
      </div>

      {/* 5. Banner Listing (Grid or Table) */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 text-xs animate-pulse">
          Loading storefront marketing banners...
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-[#131915] border border-[#1E2922] p-16 text-center text-gray-400 text-xs space-y-3">
          <ImageIcon size={32} className="mx-auto text-gray-600" />
          <p className="font-medium text-gray-300">No banners found matching the selected criteria.</p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-[#10B981] hover:underline uppercase text-[11px] font-bold"
            >
              Reset all filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID / CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="bg-[#131915] border border-[#1E2922] overflow-hidden flex flex-col group hover:border-[#10B981]/50 transition-all shadow-md"
            >
              {/* Visual Preview */}
              <div
                className="relative aspect-16/9 bg-[#0B0F0D] overflow-hidden cursor-pointer"
                onClick={() => setPreviewBanner(banner)}
                title="Click to view full preview"
              >
                <img
                  src={banner.image || banner.image_url}
                  alt={banner.title}
                  onError={(e) => {
                    e.currentTarget.src =
                      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80';
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#131915] via-transparent to-black/30" />

                {/* Badges Overlay */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 bg-[#0B0F0D]/90 text-[#10B981] border border-[#10B981]/30">
                    {getTypeLabel(banner.placement)}
                  </span>
                  {getStatusBadge(banner)}
                </div>

                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 p-1.5 text-white">
                  <Eye size={14} />
                </div>
              </div>

              {/* Banner Details */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  {banner.tagline && (
                    <span className="text-[10px] uppercase tracking-widest text-[#10B981] font-semibold block mb-1">
                      {banner.tagline}
                    </span>
                  )}
                  <h3 className="font-serif text-lg font-bold text-white mb-1.5">{banner.title}</h3>
                  <p className="text-xs text-gray-400 font-light line-clamp-2 leading-relaxed">
                    {banner.subtitle || 'No subtitle provided.'}
                  </p>
                </div>

                {/* Linked Category / Product Indicator */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-300">
                  {banner.linked_category_details ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#161D19] border border-[#1E2922] text-[#10B981]">
                      <Tag size={11} />
                      <span>Category: {banner.linked_category_details.name}</span>
                    </span>
                  ) : banner.linked_product_details ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#161D19] border border-[#1E2922] text-blue-400">
                      <Package size={11} />
                      <span>Product: {banner.linked_product_details.name}</span>
                    </span>
                  ) : null}

                  <span className="inline-flex items-center gap-1 text-gray-400 text-[10px]">
                    <Clock size={10} />
                    <span>{formatDateDisplay(banner.start_date)} – {formatDateDisplay(banner.end_date)}</span>
                  </span>
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-[#1E2922] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[11px] truncate max-w-[200px]">
                    <span className="text-white font-medium">{banner.button_text}</span>
                    <span>→</span>
                    <span className="text-gray-400 truncate">{banner.button_link}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Toggle Active Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(banner)}
                      className={`p-1.5 transition-colors cursor-pointer ${
                        banner.is_active
                          ? 'text-[#10B981] hover:text-emerald-300'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                      title={banner.is_active ? 'Deactivate Banner' : 'Activate Banner'}
                    >
                      {banner.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>

                    {/* View Preview */}
                    <button
                      type="button"
                      onClick={() => setPreviewBanner(banner)}
                      className="p-1.5 hover:bg-[#161D19] text-gray-400 hover:text-white transition-colors rounded cursor-pointer"
                      title="Preview Banner"
                    >
                      <Eye size={14} />
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(banner)}
                      className="p-1.5 hover:bg-[#10B981]/15 text-gray-400 hover:text-[#10B981] transition-colors rounded cursor-pointer"
                      title="Edit Banner"
                    >
                      <Edit2 size={14} />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(banner)}
                      className="p-1.5 hover:bg-rose-500/15 text-gray-400 hover:text-rose-400 transition-colors rounded cursor-pointer"
                      title="Delete Banner"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-[#131915] border border-[#1E2922] overflow-x-auto shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E2922] text-[10px] uppercase tracking-wider text-gray-400">
                <th className="p-3 font-semibold">Preview & Title</th>
                <th className="p-3 font-semibold">Type</th>
                <th className="p-3 font-semibold hidden md:table-cell">Target Destination</th>
                <th className="p-3 font-semibold hidden lg:table-cell">Schedule Period</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-center hidden sm:table-cell">Order</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2922]/50">
              {banners.map((banner) => (
                <tr key={banner.id} className="hover:bg-[#161D19]/60 transition-colors">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-16 h-10 bg-[#0B0F0D] border border-[#1E2922] shrink-0 overflow-hidden cursor-pointer relative group"
                        onClick={() => setPreviewBanner(banner)}
                        title="Click to view full preview"
                      >
                        <img
                          src={banner.image || banner.image_url}
                          alt={banner.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            e.currentTarget.src =
                              'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80';
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate max-w-xs">{banner.title}</p>
                        {banner.tagline && (
                          <p className="text-[10px] text-[#10B981] font-mono truncate">{banner.tagline}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="p-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-[#161D19] border border-[#1E2922] text-[#10B981]">
                      {getTypeLabel(banner.placement)}
                    </span>
                  </td>

                  <td className="p-3 hidden md:table-cell text-gray-300">
                    {banner.linked_category_details ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#10B981]">
                        <Tag size={11} />
                        <span>Category: {banner.linked_category_details.name}</span>
                      </span>
                    ) : banner.linked_product_details ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-400">
                        <Package size={11} />
                        <span>Product: {banner.linked_product_details.name}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400 font-mono truncate max-w-[150px] inline-block">
                        {banner.button_link}
                      </span>
                    )}
                  </td>

                  <td className="p-3 hidden lg:table-cell text-gray-400 text-[11px]">
                    {formatDateDisplay(banner.start_date)} – {formatDateDisplay(banner.end_date)}
                  </td>

                  <td className="p-3">
                    {getStatusBadge(banner)}
                  </td>

                  <td className="p-3 text-center hidden sm:table-cell font-mono text-gray-400">
                    {banner.display_order ?? 0}
                  </td>

                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(banner)}
                        className={`p-1.5 transition-colors cursor-pointer ${
                          banner.is_active ? 'text-[#10B981]' : 'text-gray-500'
                        }`}
                        title={banner.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {banner.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewBanner(banner)}
                        className="p-1.5 hover:bg-[#161D19] text-gray-400 hover:text-white transition-colors rounded cursor-pointer"
                        title="Preview Banner"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(banner)}
                        className="p-1.5 hover:bg-[#10B981]/15 text-gray-400 hover:text-[#10B981] transition-colors rounded cursor-pointer"
                        title="Edit Banner"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(banner)}
                        className="p-1.5 hover:bg-rose-500/15 text-gray-400 hover:text-rose-400 transition-colors rounded cursor-pointer"
                        title="Delete Banner"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Pagination */}
      <AdminPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
        loading={loading}
        itemName="banners"
      />

      {/* 7. Modal: Create or Edit Banner */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#131915] border border-[#1E2922] w-full max-w-xl p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>

            <span className="text-xs uppercase tracking-widest text-[#10B981] font-bold block mb-1">
              {editingBanner ? 'MODIFY BANNER' : 'NEW BANNER'}
            </span>
            <h3 className="font-serif text-xl font-bold text-white mb-6">
              {editingBanner ? `Edit "${editingBanner.title}"` : 'Create Store Banner'}
            </h3>

            {formErrors.general && (
              <div className="mb-4 p-3 bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{formErrors.general}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              {/* Title & Placement */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-gray-300 font-semibold mb-1">
                    Banner Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="e.g. Carry Your Style"
                    required
                    className={`w-full px-3 py-2 bg-[#0B0F0D] border text-white focus:outline-none ${
                      formErrors.title ? 'border-rose-500' : 'border-[#1E2922] focus:border-[#10B981]'
                    }`}
                  />
                  {formErrors.title && <p className="text-rose-400 text-[11px] mt-1">{formErrors.title}</p>}
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">
                    Banner Type <span className="text-rose-400">*</span>
                  </label>
                  <select
                    name="placement"
                    value={formData.placement}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none cursor-pointer"
                  >
                    {availableTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tagline & Subtitle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Tagline</label>
                  <input
                    type="text"
                    name="tagline"
                    value={formData.tagline}
                    onChange={handleInputChange}
                    placeholder="e.g. HERITAGE EDITION 2026"
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Display Order</label>
                  <input
                    type="number"
                    name="display_order"
                    value={formData.display_order}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Subtitle / Description</label>
                <textarea
                  name="subtitle"
                  rows={2}
                  value={formData.subtitle}
                  onChange={handleInputChange}
                  placeholder="Discover handcrafted luxury leather bags designed for enduring prestige..."
                  className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                />
              </div>

              {/* Image Upload & Preview */}
              <div className="p-3 bg-[#0B0F0D] border border-[#1E2922] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-[#10B981]" />
                    <span>Banner Image</span>
                  </span>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview('');
                        setFormData((p) => ({ ...p, image_url: '' }));
                      }}
                      className="text-xs text-rose-400 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Preview Box */}
                {imagePreview ? (
                  <div className="relative aspect-16/9 w-full bg-[#131915] border border-[#1E2922] overflow-hidden">
                    <img
                      src={imagePreview}
                      alt="Banner Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="border border-dashed border-[#1E2922] p-4 text-center text-gray-500 space-y-1">
                    <Upload size={20} className="mx-auto text-gray-600" />
                    <p className="text-[11px]">Upload an image file or provide an external image URL</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Upload File (JPEG, PNG, WebP &lt; 5MB)</label>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp, image/avif"
                      onChange={handleImageFileChange}
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-2.5 file:border-0 file:text-xs file:font-semibold file:bg-[#161D19] file:text-[#10B981] hover:file:bg-[#1E2922] cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Or Image URL</label>
                    <input
                      type="url"
                      name="image_url"
                      value={formData.image_url}
                      onChange={(e) => {
                        handleInputChange(e);
                        if (!imageFile && e.target.value) {
                          setImagePreview(e.target.value);
                        }
                      }}
                      placeholder="https://..."
                      className="w-full px-2.5 py-1.5 bg-[#161D19] border border-[#1E2922] text-white text-xs font-mono focus:border-[#10B981] focus:outline-none"
                    />
                  </div>
                </div>
                {formErrors.image && <p className="text-rose-400 text-[11px] mt-1">{formErrors.image}</p>}
              </div>

              {/* Destination Linking (Category, Product, or Custom) */}
              <div className="p-3 bg-[#0B0F0D] border border-[#1E2922] space-y-3">
                <span className="text-gray-300 font-semibold block flex items-center gap-1.5">
                  <LinkIcon size={14} className="text-[#10B981]" />
                  <span>Destination Target</span>
                </span>

                <div className="flex gap-2">
                  {[
                    { id: 'custom', label: 'Custom URL' },
                    { id: 'category', label: 'Category' },
                    { id: 'product', label: 'Product' }
                  ].map((dest) => (
                    <button
                      key={dest.id}
                      type="button"
                      onClick={() => handleDestinationTypeChange(dest.id)}
                      className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer border ${
                        formData.destination_type === dest.id
                          ? 'bg-[#10B981] text-black border-[#10B981]'
                          : 'bg-[#161D19] text-gray-300 border-[#1E2922] hover:border-[#10B981]/50'
                      }`}
                    >
                      {dest.label}
                    </button>
                  ))}
                </div>

                {formData.destination_type === 'category' && (
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Select Category</label>
                    <select
                      value={formData.linked_category}
                      onChange={handleCategorySelect}
                      className="w-full px-3 py-2 bg-[#161D19] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Choose Category --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.destination_type === 'product' && (
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Select Product</label>
                    <select
                      value={formData.linked_product}
                      onChange={handleProductSelect}
                      className="w-full px-3 py-2 bg-[#161D19] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Button Text</label>
                    <input
                      type="text"
                      name="button_text"
                      value={formData.button_text}
                      onChange={handleInputChange}
                      className="w-full px-2.5 py-1.5 bg-[#161D19] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Button Link</label>
                    <input
                      type="text"
                      name="button_link"
                      value={formData.button_link}
                      onChange={handleInputChange}
                      className="w-full px-2.5 py-1.5 bg-[#161D19] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Start & End Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Start Date & Time (Optional)</label>
                  <input
                    type="datetime-local"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Expiry Date & Time (Optional)</label>
                  <input
                    type="datetime-local"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 bg-[#0B0F0D] border text-white focus:outline-none ${
                      formErrors.end_date ? 'border-rose-500' : 'border-[#1E2922] focus:border-[#10B981]'
                    }`}
                  />
                  {formErrors.end_date && <p className="text-rose-400 text-[11px] mt-1">{formErrors.end_date}</p>}
                </div>
              </div>

              {/* Status Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="accent-[#10B981] w-4 h-4 cursor-pointer"
                  />
                  <span className="text-gray-200 font-medium">Banner is Active</span>
                </label>
              </div>

              {/* Modal Buttons */}
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
                  {submitting ? 'Saving...' : editingBanner ? 'Update Banner' : 'Create Banner'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Modal: Delete Confirmation */}
      {isDeleteModalOpen && bannerToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#131915] border border-rose-500/30 w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="font-serif text-lg font-bold text-white mb-2">Delete Store Banner</h3>
            <p className="text-xs text-gray-300 leading-relaxed mb-6 font-light">
              Are you sure you want to permanently delete banner{' '}
              <strong className="text-white">"{bannerToDelete.title}"</strong>?
              This action cannot be undone and will immediately unpublish it from the storefront.
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
                className="bg-rose-600 hover:bg-rose-700 text-white border-rose-600 cursor-pointer"
              >
                {submitting ? 'Deleting...' : 'Delete Banner'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal: Live Visual Preview */}
      {previewBanner && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131915] border border-[#1E2922] w-full max-w-4xl overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setPreviewBanner(null)}
              className="absolute top-4 right-4 z-20 text-white bg-black/60 p-2 rounded-full hover:bg-black cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Simulated Banner Container */}
            <div className="relative aspect-16/9 md:aspect-21/9 w-full bg-[#0B0F0D] flex items-center justify-center overflow-hidden">
              <img
                src={previewBanner.image || previewBanner.image_url}
                alt={previewBanner.title}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src =
                    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />

              <div className="relative z-10 p-6 md:p-12 max-w-xl text-left space-y-3">
                {previewBanner.tagline && (
                  <span className="text-xs uppercase font-bold tracking-[0.25em] text-[#10B981] block">
                    {previewBanner.tagline}
                  </span>
                )}
                <h2 className="font-serif text-2xl md:text-4xl font-bold text-white leading-tight">
                  {previewBanner.title}
                </h2>
                {previewBanner.subtitle && (
                  <p className="text-xs md:text-sm text-gray-300 font-light leading-relaxed">
                    {previewBanner.subtitle}
                  </p>
                )}
                <div className="pt-2 flex flex-wrap gap-3">
                  <span className="px-5 py-2.5 bg-[#10B981] text-black font-bold text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
                    <span>{previewBanner.button_text || 'Shop Collection'}</span>
                    <ExternalLink size={13} />
                  </span>
                  {previewBanner.secondary_button_text && (
                    <span className="px-5 py-2.5 bg-transparent border border-white text-white font-bold text-xs uppercase tracking-wider">
                      {previewBanner.secondary_button_text}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Metadata Footer */}
            <div className="p-4 bg-[#0B0F0D] border-t border-[#1E2922] flex flex-wrap items-center justify-between text-xs text-gray-400 gap-3">
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 bg-[#161D19] border border-[#1E2922] text-[#10B981] font-mono text-[10px] uppercase">
                  {getTypeLabel(previewBanner.placement)}
                </span>
                <span>Destination: <strong className="text-white font-mono">{previewBanner.button_link}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span>Validity:</span>
                <strong className="text-white">
                  {formatDateDisplay(previewBanner.start_date)} – {formatDateDisplay(previewBanner.end_date)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBannersPage;
