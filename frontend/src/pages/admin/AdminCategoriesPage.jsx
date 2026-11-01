import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import Button from '../../components/Button';
import Input from '../../components/Input';
import AdminPagination from '../../components/admin/AdminPagination';
import {
  FolderTree,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  X,
  Package,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Image as ImageIcon
} from 'lucide-react';

export const AdminCategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('newest'); // Descending order by default

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Notification Banners
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

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getCategories({
        page,
        pageSize,
        search: debouncedSearch,
        status: statusFilter,
        sort
      });

      if (data && data.results) {
        setCategories(data.results);
        setTotalCount(data.count || 0);
        setTotalPages(data.total_pages || Math.ceil((data.count || 0) / pageSize) || 1);
      } else {
        setCategories(Array.isArray(data) ? data : []);
        setTotalCount(Array.isArray(data) ? data.length : 0);
        setTotalPages(1);
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to load category records.');
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
    fetchCategories();
  }, [fetchCategories]);

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '', is_active: true });
    setImageFile(null);
    setImagePreview(null);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      description: cat.description || '',
      is_active: cat.is_active
    });
    setImageFile(null);
    setImagePreview(cat.image || null);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFormErrors({ image: 'Image file size cannot exceed 5 MB.' });
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Clean whitespace: collapse multiple internal spaces and strip
    const cleanedName = formData.name.replace(/\s+/g, ' ').trim();
    if (!cleanedName) {
      setFormErrors({ name: 'Category name is required.' });
      return;
    }

    // Client-side instant case-insensitive duplicate check
    const currentId = editingCategory ? editingCategory.id : null;
    const isDuplicate = categories.some((c) => {
      const matchName = c.name.replace(/\s+/g, ' ').trim().toLowerCase();
      return c.id !== currentId && matchName === cleanedName.toLowerCase();
    });

    if (isDuplicate) {
      setFormErrors({ name: 'Category already exists.' });
      return;
    }

    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append('name', cleanedName);
      payload.append('description', formData.description.trim());
      payload.append('is_active', formData.is_active ? 'true' : 'false');

      if (imageFile) {
        payload.append('image', imageFile);
      }

      if (editingCategory) {
        await adminService.updateCategory(editingCategory.id, payload);
        setSuccessMessage(`Category "${formData.name}" updated successfully.`);
      } else {
        await adminService.createCategory(payload);
        setSuccessMessage(`Category "${formData.name}" created successfully.`);
      }

      setIsModalOpen(false);
      fetchCategories();
    } catch (err) {
      if (err.response && err.response.data) {
        if (typeof err.response.data === 'object') {
          setFormErrors(err.response.data);
        } else {
          setFormErrors({ general: 'Failed to save category.' });
        }
      } else {
        setFormErrors({ general: 'Network error. Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Soft Delete Handler
  const handleSoftDelete = async () => {
    if (!categoryToDelete) return;
    setSubmitting(true);
    try {
      await adminService.deleteCategory(categoryToDelete.id);
      setSuccessMessage(`Category "${categoryToDelete.name}" soft deleted successfully.`);
      setIsDeleteModalOpen(false);
      setCategoryToDelete(null);
      fetchCategories();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to soft delete category.');
      }
      setIsDeleteModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Restore Soft-Deleted Category
  const handleRestore = async (cat) => {
    try {
      await adminService.restoreCategory(cat.id);
      setSuccessMessage(`Category "${cat.name}" restored successfully.`);
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to restore category.');
    }
  };

  // Toggle Active/Inactive Status
  const handleToggleStatus = async (cat) => {
    try {
      await adminService.toggleCategoryStatus(cat.id);
      setSuccessMessage(`Category "${cat.name}" status updated.`);
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-[#131915] border border-[#1E2922] p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            CATEGORY MANAGEMENT
          </span>
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-[#F3F4F6]">
            Store Categories ({totalCount})
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Organize products into luxury bag categories with soft delete safeguards and descending sorting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchCategories}
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
            Add Category
          </Button>
        </div>
      </div>

      {/* Success Notification Banner */}
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

      {/* Filter, Search & Sorting Bar */}
      <div className="bg-[#131915] border border-[#1E2922] p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center">
        {/* Search Input with Clear Button */}
        <div className="relative lg:col-span-6">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search categories by name or description..."
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

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 border border-[#1E2922] focus:border-[#10B981] focus:outline-none cursor-pointer lg:col-span-3"
        >
          <option value="">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
          <option value="deleted">Soft Deleted Only</option>
        </select>

        {/* Sort in Descending Order selector */}
        <div className="relative lg:col-span-3">
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="w-full bg-[#161D19] text-[#F3F4F6] text-xs px-4 py-3 border border-[#1E2922] focus:border-[#10B981] focus:outline-none cursor-pointer"
          >
            <option value="newest">Descending: Newest First</option>
            <option value="oldest">Ascending: Oldest First</option>
            <option value="name_asc">Alphabetical: A to Z</option>
            <option value="name_desc">Alphabetical: Z to A</option>
          </select>
        </div>
      </div>

      {/* Categories Table (Descending order default) */}
      <div className="bg-[#131915] border border-[#1E2922] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#161D19] border-b border-[#1E2922] text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <th className="py-4 px-6">Image</th>
                <th className="py-4 px-6">Category Info</th>
                <th className="py-4 px-6">Slug</th>
                <th className="py-4 px-6">Products</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">
                  <div className="inline-flex items-center gap-1.5 text-[#10B981]">
                    <span>Created Date</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2922] text-xs">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-6"><div className="w-10 h-10 bg-[#161D19] rounded" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-32 mb-1" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-24" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-12" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-16" /></td>
                    <td className="py-4 px-6"><div className="h-4 bg-[#161D19] w-20" /></td>
                    <td className="py-4 px-6 text-right"><div className="h-8 bg-[#161D19] w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 space-y-2">
                    <FolderTree size={32} className="mx-auto text-gray-600 mb-2" />
                    <p className="font-serif text-lg text-[#F3F4F6]">No categories found.</p>
                    <p className="text-xs text-gray-500">
                      {search ? 'Try clearing your search query.' : 'Create your first category.'}
                    </p>
                    {search && (
                      <Button variant="outline" size="sm" onClick={handleClearSearch} className="mt-2 mx-auto">
                        Clear Search
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-[#161D19]/50 transition-colors">
                    <td className="py-4 px-6">
                      {cat.image ? (
                        <img
                          src={cat.image}
                          alt={cat.name}
                          className="w-10 h-10 rounded object-cover border border-[#1E2922]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-[#161D19] border border-[#1E2922] text-[#10B981] flex items-center justify-center font-bold">
                          {cat.name[0]}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-6">
                      <p className="font-bold text-[#F3F4F6]">{cat.name}</p>
                      <p className="text-[11px] text-gray-400 truncate max-w-xs font-light">
                        {cat.description || 'No description'}
                      </p>
                    </td>

                    <td className="py-4 px-6 font-mono text-gray-400 text-[11px]">
                      {cat.slug}
                    </td>

                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 border border-amber-500/20">
                        <Package size={12} /> {cat.product_count ?? 0}
                      </span>
                    </td>

                    <td className="py-4 px-6">
                      {cat.is_deleted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2.5 py-0.5 border text-rose-400 bg-rose-950/60 border-rose-800/50">
                          <XCircle size={10} /> Soft Deleted
                        </span>
                      ) : cat.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2.5 py-0.5 border text-[#10B981] bg-[#10B981]/10 border-[#10B981]/30">
                          <CheckCircle2 size={10} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2.5 py-0.5 border text-amber-400 bg-amber-950/60 border-amber-800/50">
                          <XCircle size={10} /> Inactive
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-gray-400 text-[11px]">
                      {formatDate(cat.created_at)}
                    </td>

                    <td className="py-4 px-6 text-right space-x-2">
                      {cat.is_deleted ? (
                        <button
                          type="button"
                          onClick={() => handleRestore(cat)}
                          className="px-3 py-1.5 bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/30 text-[#10B981] text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Restore soft-deleted category"
                        >
                          <RotateCcw size={13} />
                          <span>Restore</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(cat)}
                            className="px-2.5 py-1.5 bg-[#161D19] border border-[#1E2922] hover:border-gray-500 text-gray-300 hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title={cat.is_active ? 'Unlist / Deactivate' : 'List / Activate'}
                          >
                            <span>{cat.is_active ? 'Deactivate' : 'Activate'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(cat)}
                            className="px-3 py-1.5 bg-[#161D19] border border-[#1E2922] hover:border-[#10B981]/50 text-gray-300 hover:text-[#10B981] text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Edit Category"
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setCategoryToDelete(cat);
                              setIsDeleteModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 text-rose-400 text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Soft Delete Category"
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

        {/* Backend Pagination Bar */}
        <AdminPagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[10, 20, 50]}
          itemName="categories"
          loading={loading}
        />
      </div>

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-[#131915] border border-[#1E2922] p-6 sm:p-8 shadow-2xl space-y-6 relative">
            <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
              <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
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
              <Input
                label="Category Name"
                name="name"
                placeholder="e.g. Leather Backpacks"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name?.[0] || formErrors.name}
                required
              />

              <div className="w-full flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-wider font-semibold text-[#E5E7EB]/90">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Short overview of bags in this category..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#161D19] text-[#F3F4F6] text-xs p-3 border border-[#10B981]/30 focus:border-[#10B981] focus:outline-none placeholder-[#9CA3AF]/50"
                />
              </div>

              {/* Image Upload */}
              <div className="w-full flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-wider font-semibold text-[#E5E7EB]/90">
                  Category Image
                </label>
                <div className="flex items-center gap-4">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-14 h-14 rounded object-cover border border-[#10B981]" />
                  ) : (
                    <div className="w-14 h-14 rounded bg-[#161D19] border border-[#1E2922] text-gray-500 flex items-center justify-center">
                      <ImageIcon size={24} />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="text-xs text-gray-400 file:mr-3 file:py-2 file:px-3 file:border-0 file:text-xs file:font-semibold file:bg-[#161D19] file:text-[#10B981] cursor-pointer"
                  />
                </div>
                {formErrors.image && (
                  <span className="text-xs text-rose-500 font-medium">{formErrors.image}</span>
                )}
              </div>

              {/* Active Checkbox */}
              <label className="flex items-center gap-3 pt-2 cursor-pointer text-xs font-semibold text-[#F3F4F6]">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded accent-[#10B981]"
                />
                <span>Active category (visible on customer shop page)</span>
              </label>

              <div className="pt-4 border-t border-[#1E2922] flex justify-end gap-3">
                <Button type="button" variant="outline" size="md" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" loading={submitting}>
                  {submitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft Delete Confirmation Modal */}
      {isDeleteModalOpen && categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#131915] border border-[#1E2922] p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="w-14 h-14 rounded-full bg-rose-950/60 text-rose-400 border border-rose-800/50 flex items-center justify-center mx-auto">
              <Trash2 size={28} />
            </div>

            <div>
              <h3 className="font-serif text-xl font-bold text-[#F3F4F6]">
                Soft Delete Category "{categoryToDelete.name}"?
              </h3>
              <p className="text-xs text-gray-400 mt-2 font-light leading-relaxed">
                This category will be marked as unlisted and soft-deleted. All products assigned to this category will be preserved in the database and customer catalog integrity remains safe. You can restore it anytime.
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 pt-4 border-t border-[#1E2922]">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setCategoryToDelete(null);
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
                Soft Delete Category
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategoriesPage;
