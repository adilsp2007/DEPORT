import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import Button from '../../components/Button';
import Input from '../../components/Input';
import ImageCropperModal from '../../components/ImageCropperModal';
import PriceDisplay from '../../components/PriceDisplay';
import AdminPagination from '../../components/admin/AdminPagination';
import { formatINR } from '../../utils/currencyUtils';
import {
  Package,
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
  RotateCcw,
  Crop
} from 'lucide-react';

export const AdminProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('newest'); // Descending order default
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  // Image Cropping & Resizing Modal state
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [pendingCropFile, setPendingCropFile] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    compare_at_price: '',
    discount_percentage: '',
    category: '',
    sku: '',
    brand: 'DEPORT',
    stock_quantity: '10',
    short_description: '',
    description: '',
    is_active: true
  });

  // Multiple Images State (minimum 3 required)
  // Each item: { file: File, preview: string, id?: number }
  const [productImages, setProductImages] = useState([]);
  const [deletedImageIds, setDeletedImageIds] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleClearSearch = () => {
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  };

  // Load category list for dropdown
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const catData = await adminService.getCategories({ status: 'active' });
        setCategories(catData.results || catData || []);
      } catch (e) {}
    };
    loadCategories();
  }, []);

  // Fetch product list
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getProducts({
        page,
        pageSize,
        search: debouncedSearch,
        category: categoryFilter,
        status: statusFilter,
        sort
      });
      setProducts(data.results || []);
      setTotalProducts(data.count || 0);
      setTotalPages(data.total_pages || Math.ceil((data.count || 0) / pageSize) || 1);
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to load product catalog.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, categoryFilter, statusFilter, sort]);

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      price: '',
      compare_at_price: '',
      discount_percentage: '',
      category: categories[0]?.id || '',
      sku: `DP-${Math.floor(1000 + Math.random() * 9000)}`,
      brand: 'DEPORT',
      stock_quantity: '10',
      short_description: '',
      description: '',
      is_active: true
    });
    setProductImages([]);
    setDeletedImageIds([]);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (prod) => {
    setEditingProduct(prod);
    const numPrice = parseFloat(prod.price || 0);
    const numCompare = parseFloat(prod.compare_at_price || 0);
    const discountPct =
      numCompare > numPrice && numPrice > 0
        ? Math.round(((numCompare - numPrice) / numCompare) * 100).toString()
        : prod.discount_percentage ? prod.discount_percentage.toString() : '';

    setFormData({
      name: prod.name,
      price: prod.price,
      compare_at_price: prod.compare_at_price || '',
      discount_percentage: discountPct,
      category: prod.category?.id || '',
      sku: prod.sku || '',
      brand: prod.brand || 'DEPORT',
      stock_quantity: prod.stock_quantity ?? 0,
      short_description: prod.short_description || '',
      description: prod.description || '',
      is_active: prod.is_active
    });

    // Populate existing images
    const existingImgs = (prod.images || []).map((imgObj) => ({
      id: imgObj.id,
      preview: typeof imgObj === 'string' ? imgObj : imgObj.image,
      is_primary: imgObj.is_primary,
      existing: true
    }));

    if (existingImgs.length === 0 && prod.primary_image) {
      existingImgs.push({
        preview: prod.primary_image,
        is_primary: true,
        existing: true
      });
    }

    setProductImages(existingImgs);
    setDeletedImageIds([]);
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Image Selection & Cropping Workflow
  const handleFileSelectForCrop = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setFormErrors((prev) => ({ ...prev, images: 'File size cannot exceed 10 MB.' }));
        return;
      }
      setPendingCropFile(file);
      setIsCropperOpen(true);
    }
    e.target.value = '';
  };

  const handleCropComplete = (croppedFile, previewUrl) => {
    setProductImages((prev) => [
      ...prev,
      {
        file: croppedFile,
        preview: previewUrl,
        is_primary: prev.length === 0,
        existing: false
      }
    ]);
    setFormErrors((prev) => {
      const copy = { ...prev };
      delete copy.images;
      return copy;
    });
  };

  const handleRemoveImage = (indexToRemove) => {
    const itemToRemove = productImages[indexToRemove];
    if (itemToRemove && itemToRemove.existing && itemToRemove.id) {
      setDeletedImageIds((prev) => [...prev, itemToRemove.id]);
    }
    setProductImages((prev) => {
      const filtered = prev.filter((_, idx) => idx !== indexToRemove);
      if (filtered.length > 0 && !filtered.some((img) => img.is_primary)) {
        filtered[0].is_primary = true;
      }
      return filtered;
    });
  };

  const handleSetPrimary = (indexToPrimary) => {
    setProductImages((prev) =>
      prev.map((img, idx) => ({
        ...img,
        is_primary: idx === indexToPrimary
      }))
    );
  };

  const handlePriceChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      const orig = parseFloat(field === 'compare_at_price' ? value : next.compare_at_price);
      const sell = parseFloat(field === 'price' ? value : next.price);
      const pct = parseFloat(field === 'discount_percentage' ? value : next.discount_percentage);

      if (field === 'compare_at_price') {
        if (!isNaN(orig) && orig > 0 && !isNaN(pct) && pct > 0 && pct < 100) {
          next.price = (orig * (1 - pct / 100)).toFixed(2);
        } else if (!isNaN(orig) && orig > 0 && !isNaN(sell) && sell > 0 && sell < orig) {
          next.discount_percentage = Math.round(((orig - sell) / orig) * 100).toString();
        } else if (isNaN(orig) || orig <= sell) {
          next.discount_percentage = '';
        }
      } else if (field === 'price') {
        if (!isNaN(orig) && orig > 0 && !isNaN(sell) && sell > 0 && sell < orig) {
          next.discount_percentage = Math.round(((orig - sell) / orig) * 100).toString();
        } else {
          next.discount_percentage = '';
        }
      } else if (field === 'discount_percentage') {
        if (!isNaN(orig) && orig > 0 && !isNaN(pct) && pct >= 0 && pct < 100) {
          next.price = (orig * (1 - pct / 100)).toFixed(2);
        }
      }
      return next;
    });

    setFormErrors((prev) => {
      const copy = { ...prev };
      delete copy.price;
      delete copy.compare_at_price;
      delete copy.discount_percentage;
      return copy;
    });
  };

  const renderPriceHelper = () => {
    const orig = parseFloat(formData.compare_at_price);
    const sell = parseFloat(formData.price);
    if (!isNaN(orig) && !isNaN(sell) && orig > 0 && sell > 0) {
      if (sell > orig) {
        return (
          <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-400" />
            <span>Discounted selling price ({formatINR(sell)}) cannot exceed original price ({formatINR(orig)}).</span>
          </div>
        );
      }
      if (orig > sell) {
        const pct = Math.round(((orig - sell) / orig) * 100);
        const diff = orig - sell;
        return (
          <div className="p-2.5 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>
              Discount Active: Original {formatINR(orig)} → Selling {formatINR(sell)} (
              <strong className="underline">{pct}% OFF</strong> — Customers save {formatINR(diff)})
            </span>
          </div>
        );
      }
    }
    if (!isNaN(sell) && sell > 0 && (!orig || isNaN(orig))) {
      return (
        <div className="p-2 bg-[#161D19] border border-[#1E2922] text-gray-400 text-xs">
          Regular Price: <strong className="text-white">{formatINR(sell)}</strong> (No discount applied)
        </div>
      );
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    const errs = {};
    if (!formData.name.trim()) errs.name = 'Product name is required.';

    const numPrice = parseFloat(formData.price);
    const numCompare = formData.compare_at_price ? parseFloat(formData.compare_at_price) : null;

    if (!formData.price || isNaN(numPrice) || numPrice <= 0) {
      errs.price = 'Price must be greater than zero.';
    }

    if (numCompare !== null && (isNaN(numCompare) || numCompare < 0)) {
      errs.compare_at_price = 'Original price cannot be negative.';
    }

    if (numCompare !== null && numPrice > 0 && numCompare > 0 && numPrice > numCompare) {
      errs.price = 'Discounted price cannot exceed original price.';
    }

    if (parseInt(formData.stock_quantity, 10) < 0) {
      errs.stock_quantity = 'Stock cannot be negative.';
    }

    // Minimum 3 images validation
    if (productImages.length < 3) {
      errs.images = `At least 3 images are required for every product (currently selected: ${productImages.length}).`;
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        price: parseFloat(formData.price),
        compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
        category: formData.category ? parseInt(formData.category, 10) : null,
        sku: formData.sku.trim(),
        brand: formData.brand.trim() || 'DEPORT',
        stock_quantity: parseInt(formData.stock_quantity, 10),
        short_description: formData.short_description.trim(),
        description: formData.description.trim() || formData.name.trim(),
        is_active: formData.is_active
      };

      let savedProduct;
      if (editingProduct) {
        savedProduct = await adminService.updateProduct(editingProduct.id, payload);
        setSuccessMessage(`Product "${formData.name}" updated successfully.`);
      } else {
        savedProduct = await adminService.createProduct(payload);
        setSuccessMessage(`Product "${formData.name}" created successfully.`);
      }

      // Delete removed existing images
      for (const imgId of deletedImageIds) {
        try {
          await adminService.deleteProductImage(imgId);
        } catch (e) {}
      }

      // Check if primary image of existing images changed
      const primaryExisting = productImages.find((img) => img.existing && img.is_primary && img.id);
      if (primaryExisting && editingProduct) {
        try {
          await adminService.setPrimaryProductImage(primaryExisting.id);
        } catch (e) {}
      }

      // Upload new cropped images
      const newImagesToUpload = productImages.filter((img) => img.file && !img.existing);
      if (newImagesToUpload.length > 0 && savedProduct?.id) {
        try {
          const files = newImagesToUpload.map((img) => img.file);
          await adminService.uploadProductImages(savedProduct.id, files);
        } catch (imgErr) {
          // If bulk failed, fallback to sequential upload
          for (const img of newImagesToUpload) {
            try {
              await adminService.uploadProductImage(savedProduct.id, img.file, img.is_primary);
            } catch (e) {}
          }
        }
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      if (err.response && err.response.data) {
        setFormErrors(err.response.data);
      } else {
        setFormErrors({ general: 'Failed to save product.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Soft Delete Handler
  const handleSoftDelete = async () => {
    if (!productToDelete) return;
    setSubmitting(true);
    try {
      await adminService.deleteProduct(productToDelete.id);
      setSuccessMessage(`Product "${productToDelete.name}" soft deleted successfully.`);
      setIsDeleteModalOpen(false);
      setProductToDelete(null);
      fetchProducts();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to soft delete product.');
      }
      setIsDeleteModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Restore Soft-Deleted Product
  const handleRestore = async (prod) => {
    try {
      await adminService.restoreProduct(prod.id);
      setSuccessMessage(`Product "${prod.name}" restored successfully.`);
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to restore product.');
    }
  };

  // Toggle Listed/Unlisted (Active/Inactive)
  const handleToggleStatus = async (prod) => {
    try {
      await adminService.toggleProductStatus(prod.id);
      setSuccessMessage(`Product "${prod.name}" status updated.`);
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status.');
    }
  };

  const formatCurrency = (amount) => formatINR(amount);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-[#131915] border border-[#1E2922] p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            PRODUCT MANAGEMENT
          </span>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#F3F4F6]">
            Bag Catalog ({totalProducts})
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Manage product pricing, stock inventory, multi-image upload with cropping, and soft delete safeguarding.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchProducts}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981]/50 text-xs font-semibold uppercase tracking-wider text-gray-300 hover:text-[#10B981] transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#10B981]' : ''} />
            <span>Refresh</span>
          </button>

          <Button
            type="button"
            variant="primary"
            size="md"
            icon={Plus}
            onClick={handleOpenAddModal}
          >
            Add Product
          </Button>
        </div>
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

      {/* Error Alert */}
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

      {/* Filter and Search Bar with Clear Button */}
      <div className="bg-[#131915] border border-[#1E2922] p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center">
        {/* Search Input */}
        <div className="relative lg:col-span-5">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search by product name, SKU, or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 pl-11 pr-20 border border-[#1E2922] focus:border-[#10B981] focus:outline-none placeholder-[#9CA3AF]/50"
          />
          {search && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-xs text-gray-400 hover:text-[#10B981] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#131915] border border-[#1E2922] cursor-pointer"
                title="Cancel search"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-gray-400 hover:text-white cursor-pointer"
                title="Cancel search"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 border border-[#1E2922] focus:border-[#10B981] focus:outline-none cursor-pointer lg:col-span-3"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 border border-[#1E2922] focus:border-[#10B981] focus:outline-none cursor-pointer lg:col-span-2"
        >
          <option value="">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
          <option value="deleted">Soft Deleted Only</option>
        </select>

        {/* Sort Selector (Descending default) */}
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 border border-[#1E2922] focus:border-[#10B981] focus:outline-none cursor-pointer lg:col-span-2"
        >
          <option value="newest">Descending: Newest</option>
          <option value="oldest">Ascending: Oldest</option>
          <option value="name_asc">Alphabetical: A-Z</option>
          <option value="name_desc">Alphabetical: Z-A</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
          <option value="stock_low">Stock: Low to High</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-[#131915] border border-[#1E2922] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#161D19] border-b border-[#1E2922] text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <th className="py-4 px-6">Product</th>
                <th className="py-4 px-6">SKU</th>
                <th className="py-4 px-6">Category</th>
                <th className="py-4 px-6">Price</th>
                <th className="py-4 px-6">Stock</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2922] text-xs">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#161D19] rounded" />
                        <div>
                          <div className="h-4 bg-[#161D19] w-36 mb-1" />
                          <div className="h-3 bg-[#161D19] w-20" />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-20" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-24" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-16" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-12" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-16" /></td>
                    <td className="py-4 px-6 text-right"><div className="h-8 bg-[#161D19] w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 space-y-2">
                    <Package size={32} className="mx-auto text-gray-600 mb-2" />
                    <p className="font-serif text-lg text-[#F3F4F6]">No products found.</p>
                    <p className="text-xs text-gray-500">
                      {search ? 'Adjust or clear your search query.' : 'Add your first luxury bag product.'}
                    </p>
                    {search && (
                      <Button variant="outline" size="sm" onClick={handleClearSearch} className="mt-2 mx-auto">
                        Clear Search
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-[#161D19]/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        {prod.primary_image ? (
                          <img
                            src={prod.primary_image}
                            alt={prod.name}
                            className="w-12 h-12 rounded object-cover border border-[#1E2922] bg-[#161D19]"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-[#161D19] border border-[#1E2922] text-[#10B981] flex items-center justify-center font-bold font-serif">
                            {prod.name[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-[#F3F4F6]">{prod.name}</p>
                          <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                            Brand: {prod.brand || 'DEPORT'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6 font-mono text-gray-400 text-[11px]">
                      {prod.sku}
                    </td>

                    <td className="py-4 px-6 text-gray-300">
                      {prod.category?.name || 'Uncategorized'}
                    </td>

                    <td className="py-4 px-6">
                      <PriceDisplay
                        price={prod.price}
                        oldPrice={prod.compare_at_price || prod.original_price}
                        discountPercentage={prod.discount_percentage}
                        size="sm"
                      />
                    </td>

                    <td className="py-4 px-6 font-semibold">
                      <span className={prod.stock_quantity > 0 ? 'text-[#F3F4F6]' : 'text-rose-400'}>
                        {prod.stock_quantity} in stock
                      </span>
                    </td>

                    <td className="py-4 px-6">
                      {prod.is_deleted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2.5 py-0.5 border text-rose-400 bg-rose-950/60 border-rose-800/50">
                          <XCircle size={10} /> Soft Deleted
                        </span>
                      ) : prod.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2.5 py-0.5 border text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30">
                          <CheckCircle2 size={10} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2.5 py-0.5 border text-amber-400 bg-amber-950/60 border-amber-800/50">
                          <XCircle size={10} /> Inactive
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-right space-x-2">
                      {prod.is_deleted ? (
                        <button
                          type="button"
                          onClick={() => handleRestore(prod)}
                          className="px-3 py-1.5 bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/30 text-[#10B981] text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Restore soft deleted product"
                        >
                          <RotateCcw size={13} />
                          <span>Restore</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(prod)}
                            className="px-2.5 py-1.5 bg-[#161D19] border border-[#1E2922] hover:border-gray-500 text-gray-300 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title={prod.is_active ? 'Unlist product' : 'List product'}
                          >
                            <span>{prod.is_active ? 'Unlist' : 'List'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(prod)}
                            className="px-3 py-1.5 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981]/50 text-gray-300 hover:text-[#10B981] text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setProductToDelete(prod);
                              setIsDeleteModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 text-rose-400 text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Soft Delete Product"
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                        </>
                      )}
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
          totalCount={totalProducts}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[10, 20, 50]}
          itemName="products"
          loading={loading}
        />
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-3xl bg-[#131915] border border-[#1E2922] p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
              <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Product Name"
                  name="name"
                  placeholder="e.g. Executive Leather Briefcase"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  error={formErrors.name?.[0] || formErrors.name}
                  required
                />

                <Input
                  label="SKU Code"
                  name="sku"
                  placeholder="e.g. LX-1002"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  error={formErrors.sku?.[0] || formErrors.sku}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Original Price (₹)"
                  type="number"
                  step="0.01"
                  name="compare_at_price"
                  placeholder="e.g. 3499.00"
                  value={formData.compare_at_price}
                  onChange={(e) => handlePriceChange('compare_at_price', e.target.value)}
                  error={formErrors.compare_at_price?.[0] || formErrors.compare_at_price}
                />

                <Input
                  label="Discounted Selling Price (₹) *"
                  type="number"
                  step="0.01"
                  name="price"
                  placeholder="e.g. 2499.00"
                  value={formData.price}
                  onChange={(e) => handlePriceChange('price', e.target.value)}
                  error={formErrors.price?.[0] || formErrors.price}
                  required
                />

                <Input
                  label="Discount Percentage (%)"
                  type="number"
                  step="1"
                  min="0"
                  max="99"
                  name="discount_percentage"
                  placeholder="e.g. 29"
                  value={formData.discount_percentage}
                  onChange={(e) => handlePriceChange('discount_percentage', e.target.value)}
                  error={formErrors.discount_percentage}
                />
              </div>

              {renderPriceHelper()}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Stock Quantity *"
                  type="number"
                  name="stock_quantity"
                  placeholder="15"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  error={formErrors.stock_quantity?.[0] || formErrors.stock_quantity}
                  required
                />

                <div className="w-full flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[#E5E7EB]/90">
                    Category <span className="text-[#10B981]">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 border border-[#10B981]/30 focus:border-[#10B981] focus:outline-none cursor-pointer"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Brand Name"
                  name="brand"
                  placeholder="DEPORT"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
              </div>

              <div className="w-full flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-wider font-semibold text-[#E5E7EB]/90">
                  Short Description
                </label>
                <input
                  type="text"
                  placeholder="Single line summary of the luxury bag..."
                  value={formData.short_description}
                  onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                  className="w-full bg-[#161D19] text-[#F3F4F6] text-xs p-3 border border-[#10B981]/30 focus:border-[#10B981] focus:outline-none placeholder-[#9CA3AF]/50"
                />
              </div>

              <div className="w-full flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-wider font-semibold text-[#E5E7EB]/90">
                  Full Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Detailed craftsmanship, materials, dimensions, and features..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#161D19] text-[#F3F4F6] text-xs p-3 border border-[#10B981]/30 focus:border-[#10B981] focus:outline-none placeholder-[#9CA3AF]/50"
                />
              </div>

              {/* Multiple Images Upload & Cropping Section (Minimum 3 images) */}
              <div className="w-full p-4 bg-[#161D19] border border-[#1E2922] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs uppercase tracking-wider font-bold text-[#F3F4F6] block">
                      Product Images Gallery
                    </label>
                    <span className="text-[11px] text-gray-400">
                      Minimum <strong>3 images</strong> required. Each image can be cropped and resized.
                    </span>
                  </div>

                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 border ${
                    productImages.length >= 3
                      ? 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30'
                      : 'text-amber-400 bg-amber-950/50 border-amber-800/50'
                  }`}>
                    {productImages.length >= 3 ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    <span>{productImages.length} / 3 minimum</span>
                  </span>
                </div>

                {formErrors.images && (
                  <div className="p-2.5 bg-rose-950/70 border border-rose-500 text-rose-300 text-xs">
                    {Array.isArray(formErrors.images) ? formErrors.images[0] : formErrors.images}
                  </div>
                )}

                {/* Image Thumbnails Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2">
                  {productImages.map((img, idx) => (
                    <div
                      key={idx}
                      className={`relative aspect-4/5 rounded overflow-hidden border group bg-black/40 ${
                        img.is_primary
                          ? 'border-[#10B981] ring-2 ring-[#10B981]/50'
                          : 'border-[#1E2922]'
                      }`}
                    >
                      <img
                        src={img.preview}
                        alt={`Product slot ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />

                      {/* Primary Badge */}
                      {img.is_primary && (
                        <span className="absolute top-1 left-1 bg-[#10B981] text-black text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wider rounded-xs">
                          Primary
                        </span>
                      )}

                      {/* Controls Overlay */}
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                        {!img.is_primary && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(idx)}
                            className="text-[10px] uppercase font-bold text-gray-200 hover:text-[#10B981] bg-[#161D19] px-2 py-1 rounded border border-[#1E2922] cursor-pointer"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="text-[10px] uppercase font-bold text-rose-400 hover:text-white bg-rose-950/80 px-2 py-1 rounded border border-rose-800 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add New Image Slot with Cropper Trigger */}
                  <label className="aspect-4/5 rounded border-2 border-dashed border-[#10B981]/40 hover:border-[#10B981] bg-[#131915] flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-colors group">
                    <Crop size={20} className="text-[#10B981] group-hover:scale-110 transition-transform mb-1" />
                    <span className="text-[11px] font-bold text-[#F3F4F6]">Crop & Add Image</span>
                    <span className="text-[9px] text-gray-400 mt-0.5">JPEG, PNG, WebP</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelectForCrop}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-3 pt-2 cursor-pointer text-xs font-semibold text-[#F3F4F6]">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded accent-[#10B981] cursor-pointer"
                />
                <span>Active product (listed and available for customer orders)</span>
              </label>

              <div className="pt-4 border-t border-[#1E2922] flex justify-end gap-3">
                <Button type="button" variant="outline" size="md" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" loading={submitting}>
                  {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      <ImageCropperModal
        isOpen={isCropperOpen}
        imageFile={pendingCropFile}
        onClose={() => {
          setIsCropperOpen(false);
          setPendingCropFile(null);
        }}
        onCropComplete={handleCropComplete}
      />

      {/* Soft Delete Modal */}
      {isDeleteModalOpen && productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#131915] border border-[#1E2922] p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="w-14 h-14 rounded-full bg-rose-950/60 text-rose-400 border border-rose-800/50 flex items-center justify-center mx-auto">
              <Trash2 size={28} />
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">
                Soft Delete Product "{productToDelete.name}"?
              </h3>
              <p className="text-xs text-gray-400 mt-2 font-light leading-relaxed">
                Soft deleting marks this bag as unlisted. Past orders and sales logs will be safely retained in the database. You can restore this product at any time.
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4 border-t border-[#1E2922]">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setProductToDelete(null);
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                loading={submitting}
                onClick={handleSoftDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Soft Delete Product
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductsPage;
