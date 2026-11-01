import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import Button from '../../components/Button';
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
  Layers
} from 'lucide-react';

export const AdminBannersPage = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [placementFilter, setPlacementFilter] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bannerToDelete, setBannerToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    tagline: '',
    image_url: '',
    button_text: 'Shop Collection',
    button_link: '/shop',
    secondary_button_text: 'Explore Handbags',
    secondary_button_link: '/shop?category=handbags',
    placement: 'hero',
    display_order: 0,
    is_active: true
  });
  const [formErrors, setFormErrors] = useState({});

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getBanners({ placement: placementFilter });
      const items = data.results || (Array.isArray(data) ? data : []);
      setBanners(items);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load banners.');
    } finally {
      setLoading(false);
    }
  }, [placementFilter]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

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

  const handleOpenCreateModal = () => {
    setEditingBanner(null);
    setFormData({
      title: '',
      subtitle: '',
      tagline: 'NEW COLLECTION 2026',
      image_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80',
      button_text: 'Shop Collection',
      button_link: '/shop',
      secondary_button_text: 'Explore Handbags',
      secondary_button_link: '/shop?category=handbags',
      placement: 'hero',
      display_order: 0,
      is_active: true
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      subtitle: banner.subtitle || '',
      tagline: banner.tagline || '',
      image_url: banner.image || banner.image_url || '',
      button_text: banner.button_text || 'Shop Collection',
      button_link: banner.button_link || '/shop',
      secondary_button_text: banner.secondary_button_text || '',
      secondary_button_link: banner.secondary_button_link || '',
      placement: banner.placement || 'hero',
      display_order: banner.display_order ?? 0,
      is_active: banner.is_active
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});

    const payload = {
      title: formData.title.trim(),
      subtitle: formData.subtitle.trim(),
      tagline: formData.tagline.trim(),
      image_url: formData.image_url.trim(),
      button_text: formData.button_text.trim(),
      button_link: formData.button_link.trim(),
      secondary_button_text: formData.secondary_button_text.trim(),
      secondary_button_link: formData.secondary_button_link.trim(),
      placement: formData.placement,
      display_order: parseInt(formData.display_order, 10) || 0,
      is_active: formData.is_active
    };

    try {
      if (editingBanner) {
        await adminService.updateBanner(editingBanner.id, payload);
        setSuccessMessage(`Banner "${payload.title}" updated successfully.`);
      } else {
        await adminService.createBanner(payload);
        setSuccessMessage(`Banner "${payload.title}" created successfully.`);
      }
      setIsModalOpen(false);
      fetchBanners();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      if (err.response?.data) {
        setFormErrors(err.response.data);
      } else {
        setError('Failed to save banner.');
      }
    } finally {
      setSubmitting(false);
    }
  };

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
    } catch {
      setError('Failed to delete banner.');
    } finally {
      setSubmitting(false);
      setBannerToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E2922]">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            HOMEPAGE & MARKETING
          </span>
          <h2 className="font-serif text-2xl font-bold text-[#F3F4F6]">
            Banner Management
          </h2>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Manage hero headers, promotional highlights, and custom visual campaigns on the storefront.
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

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-gray-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

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

      {/* Placement Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#1E2922] pb-3 text-xs">
        {[
          { label: 'All Placements', value: '' },
          { label: 'Hero Header', value: 'hero' },
          { label: 'Promotional Section', value: 'promotional' },
          { label: 'Secondary Banner', value: 'secondary' }
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setPlacementFilter(tab.value)}
            className={`px-3 py-1.5 font-semibold uppercase tracking-wider transition-colors ${
              placementFilter === tab.value
                ? 'bg-[#10B981] text-black'
                : 'bg-[#131915] text-gray-400 hover:text-white hover:bg-[#1E2922]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Banners Grid */}
      {loading ? (
        <div className="py-16 text-center text-gray-500 text-xs animate-pulse">
          Loading storefront banners...
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-[#131915] border border-[#1E2922] p-12 text-center text-gray-400 text-xs font-light">
          No banners found for the selected placement.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="bg-[#131915] border border-[#1E2922] overflow-hidden flex flex-col group hover:border-[#10B981]/50 transition-all shadow-md"
            >
              {/* Visual Preview */}
              <div className="relative aspect-16/9 bg-[#0B0F0D] overflow-hidden">
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

                <div className="absolute top-3 left-3 flex gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 bg-[#0B0F0D]/90 text-[#10B981] border border-[#10B981]/30">
                    {banner.placement}
                  </span>
                  {banner.is_active ? (
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-800">
                      Inactive
                    </span>
                  )}
                </div>
              </div>

              {/* Banner Metadata Content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  {banner.tagline && (
                    <span className="text-[10px] uppercase tracking-widest text-[#10B981] font-semibold block mb-1">
                      {banner.tagline}
                    </span>
                  )}
                  <h3 className="font-serif text-lg font-bold text-white mb-2">{banner.title}</h3>
                  <p className="text-xs text-gray-400 font-light line-clamp-2 leading-relaxed">
                    {banner.subtitle || 'No subtitle provided.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#1E2922] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-gray-400 font-mono text-[11px]">
                    <span className="text-white font-medium">{banner.button_text}</span>
                    <span>→</span>
                    <span className="text-gray-500">{banner.button_link}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditModal(banner)}
                      className="p-1.5 hover:bg-[#10B981]/15 text-gray-400 hover:text-[#10B981] transition-colors rounded"
                      title="Edit Banner"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(banner)}
                      className="p-1.5 hover:bg-rose-500/15 text-gray-400 hover:text-rose-400 transition-colors rounded"
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
      )}

      {/* Modal: Create or Edit Banner */}
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
              {editingBanner ? 'MODIFY BANNER' : 'NEW BANNER'}
            </span>
            <h3 className="font-serif text-xl font-bold text-white mb-6">
              {editingBanner ? `Edit "${editingBanner.title}"` : 'Create Store Banner'}
            </h3>

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Banner Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g. Carry Your Style"
                  required
                  className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                />
                {formErrors.title && <p className="text-rose-400 mt-1">{formErrors.title}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Placement</label>
                  <select
                    name="placement"
                    value={formData.placement}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  >
                    <option value="hero">Hero Section</option>
                    <option value="promotional">Promotional Banner</option>
                    <option value="secondary">Secondary Banner</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Tagline</label>
                  <input
                    type="text"
                    name="tagline"
                    value={formData.tagline}
                    onChange={handleInputChange}
                    placeholder="e.g. NEW COLLECTION 2026"
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Image URL *</label>
                <input
                  type="url"
                  name="image_url"
                  value={formData.image_url}
                  onChange={handleInputChange}
                  placeholder="https://images.unsplash.com/..."
                  required
                  className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Subtitle / Description</label>
                <textarea
                  name="subtitle"
                  rows={2}
                  value={formData.subtitle}
                  onChange={handleInputChange}
                  placeholder="Discover timeless leather bags..."
                  className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Primary Button Text</label>
                  <input
                    type="text"
                    name="button_text"
                    value={formData.button_text}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Primary Button Link</label>
                  <input
                    type="text"
                    name="button_link"
                    value={formData.button_link}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Secondary Button Text</label>
                  <input
                    type="text"
                    name="secondary_button_text"
                    value={formData.secondary_button_text}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Secondary Button Link</label>
                  <input
                    type="text"
                    name="secondary_button_link"
                    value={formData.secondary_button_link}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0B0F0D] border border-[#1E2922] text-white focus:border-[#10B981] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center pt-2">
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

                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleInputChange}
                      className="accent-[#10B981] w-4 h-4"
                    />
                    <span className="text-gray-300 font-medium">Banner is Active</span>
                  </label>
                </div>
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
                  {submitting ? 'Saving...' : editingBanner ? 'Update Banner' : 'Create Banner'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {isDeleteModalOpen && bannerToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#131915] border border-rose-500/30 w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="font-serif text-lg font-bold text-white mb-2">Delete Banner</h3>
            <p className="text-xs text-gray-300 leading-relaxed mb-6 font-light">
              Are you sure you want to permanently delete banner{' '}
              <strong className="text-white">"{bannerToDelete.title}"</strong>?
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
                {submitting ? 'Deleting...' : 'Delete Banner'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBannersPage;
