import api from './api';

export const adminService = {
  /**
   * Fetch Real-time Admin Dashboard Statistics
   * Includes total_users, active_users, blocked_users, total_products, total_orders, total_revenue, recent_users, recent_orders
   */
  async getDashboardStats() {
    const response = await api.get('/admin/dashboard/stats/');
    return response.data;
  },

  /**
   * Fetch Paginated User List with search and status filter
   */
  async getUsers({ page = 1, pageSize = 10, search = '', status = '' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (pageSize) params.append('page_size', pageSize);
    if (search) params.append('search', search);
    if (status) params.append('status', status);

    const response = await api.get(`/admin/users/?${params.toString()}`);
    return response.data;
  },

  /**
   * Fetch User Detail by ID
   */
  async getUserDetail(id) {
    const response = await api.get(`/admin/users/${id}/`);
    return response.data;
  },

  /**
   * Toggle Block/Unblock Account Status
   */
  async toggleBlockUser(id) {
    const response = await api.post(`/admin/users/${id}/toggle-block/`);
    return response.data;
  },

  /**
   * Permanently Delete User Account
   */
  async deleteUser(id) {
    const response = await api.delete(`/admin/users/${id}/`);
    return response.data;
  },

  /* ==========================================================================
     CATEGORY MANAGEMENT APIS
     ========================================================================== */

  async getCategories({ page = 1, pageSize = 10, search = '', status = '', sort = '' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (pageSize) params.append('page_size', pageSize);
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (sort) params.append('sort', sort);

    const response = await api.get(`/admin/categories/?${params.toString()}`);
    return response.data;
  },

  async getCategoryDetail(id) {
    const response = await api.get(`/admin/categories/${id}/`);
    return response.data;
  },

  async createCategory(data) {
    const isFormData = data instanceof FormData;
    const response = await api.post('/admin/categories/', data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {}
    });
    return response.data;
  },

  async updateCategory(id, data) {
    const isFormData = data instanceof FormData;
    const response = await api.patch(`/admin/categories/${id}/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {}
    });
    return response.data;
  },

  async deleteCategory(id) {
    // Soft delete category
    const response = await api.delete(`/admin/categories/${id}/`);
    return response.data;
  },

  async restoreCategory(id) {
    const response = await api.post(`/admin/categories/${id}/restore/`);
    return response.data;
  },

  async toggleCategoryStatus(id) {
    const response = await api.post(`/admin/categories/${id}/toggle-status/`);
    return response.data;
  },

  /* ==========================================================================
     PRODUCT MANAGEMENT APIS
     ========================================================================== */

  async getProducts({ page = 1, pageSize = 10, search = '', category = '', status = '', brand = '', sort = '' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (pageSize) params.append('page_size', pageSize);
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (status) params.append('status', status);
    if (brand) params.append('brand', brand);
    if (sort) params.append('sort', sort);

    const response = await api.get(`/admin/products/?${params.toString()}`);
    return response.data;
  },

  async getProductDetail(id) {
    const response = await api.get(`/admin/products/${id}/`);
    return response.data;
  },

  async createProduct(data) {
    const isFormData = data instanceof FormData;
    const response = await api.post('/admin/products/', data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {}
    });
    return response.data;
  },

  async updateProduct(id, data) {
    const isFormData = data instanceof FormData;
    const response = await api.patch(`/admin/products/${id}/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {}
    });
    return response.data;
  },

  async deleteProduct(id) {
    // Soft delete product
    const response = await api.delete(`/admin/products/${id}/`);
    return response.data;
  },

  async restoreProduct(id) {
    const response = await api.post(`/admin/products/${id}/restore/`);
    return response.data;
  },

  async toggleProductStatus(id) {
    const response = await api.post(`/admin/products/${id}/toggle-status/`);
    return response.data;
  },

  async uploadProductImages(productId, files) {
    const formData = new FormData();
    if (Array.isArray(files)) {
      files.forEach((file) => formData.append('images', file));
    } else {
      formData.append('images', files);
    }
    const response = await api.post(`/admin/products/${productId}/upload-images/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async uploadProductImage(productId, file, isPrimary = false) {
    const formData = new FormData();
    formData.append('product', productId);
    formData.append('image', file);
    if (isPrimary) formData.append('is_primary', 'true');

    const response = await api.post('/admin/product-images/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async setPrimaryProductImage(imageId) {
    const response = await api.post(`/admin/product-images/${imageId}/set-primary/`);
    return response.data;
  },

  async deleteProductImage(imageId) {
    const response = await api.delete(`/admin/product-images/${imageId}/`);
    return response.data;
  },

  /* ==========================================================================
     ORDER MANAGEMENT APIS
     ========================================================================== */

  async getOrders({ page = 1, pageSize = 10, search = '', status = '', sort = 'newest' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (pageSize) params.append('page_size', pageSize);
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (sort) params.append('sort', sort);

    const response = await api.get(`/admin/orders/?${params.toString()}`);
    return response.data;
  },

  async getOrderDetail(id) {
    const response = await api.get(`/admin/orders/${id}/`);
    return response.data;
  },

  async updateOrderStatus(id, status) {
    const response = await api.patch(`/admin/orders/${id}/status/`, { status });
    return response.data;
  },

  async getOrderInvoice(id) {
    const response = await api.get(`/orders/${id}/invoice/`);
    return response.data;
  },

  /* ==========================================================================
     INVENTORY / STOCK MANAGEMENT APIS
     ========================================================================== */

  async getInventory({ page = 1, pageSize = 10, search = '', stock_status = '', sort = 'stock_low' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (pageSize) params.append('page_size', pageSize);
    if (search) params.append('search', search);
    if (stock_status) params.append('stock_status', stock_status);
    if (sort) params.append('sort', sort);

    const response = await api.get(`/admin/products/?${params.toString()}`);
    return response.data;
  },

  async updateProductStock(id, { stock_quantity, adjustment } = {}) {
    const payload = {};
    if (stock_quantity !== undefined) payload.stock_quantity = stock_quantity;
    if (adjustment !== undefined) payload.adjustment = adjustment;

    const response = await api.post(`/admin/products/${id}/update-stock/`, payload);
    return response.data;
  },

  /* ==========================================================================
     COUPON MANAGEMENT APIS
     ========================================================================== */

  async getCoupons({ page = 1, pageSize = 10, search = '', is_active = '', discount_type = '' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (pageSize) params.append('page_size', pageSize);
    if (search) params.append('search', search);
    if (is_active !== '') params.append('is_active', is_active);
    if (discount_type) params.append('discount_type', discount_type);

    const response = await api.get(`/admin/coupons/?${params.toString()}`);
    return response.data;
  },

  async getCoupon(id) {
    const response = await api.get(`/admin/coupons/${id}/`);
    return response.data;
  },

  async createCoupon(data) {
    const response = await api.post('/admin/coupons/', data);
    return response.data;
  },

  async updateCoupon(id, data) {
    const response = await api.patch(`/admin/coupons/${id}/`, data);
    return response.data;
  },

  async toggleCouponActive(id) {
    const response = await api.post(`/admin/coupons/${id}/toggle-active/`);
    return response.data;
  },

  async deleteCoupon(id) {
    const response = await api.delete(`/admin/coupons/${id}/`);
    return response.data;
  },

  /* ==========================================================================
     BANNER MANAGEMENT APIS
     ========================================================================== */

  async getBanners({ page = 1, search = '', placement = '' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (search) params.append('search', search);
    if (placement) params.append('placement', placement);

    const response = await api.get(`/admin/banners/?${params.toString()}`);
    return response.data;
  },

  async getBanner(id) {
    const response = await api.get(`/admin/banners/${id}/`);
    return response.data;
  },

  async createBanner(data) {
    const response = await api.post('/admin/banners/', data);
    return response.data;
  },

  async updateBanner(id, data) {
    const response = await api.patch(`/admin/banners/${id}/`, data);
    return response.data;
  },

  async deleteBanner(id) {
    const response = await api.delete(`/admin/banners/${id}/`);
    return response.data;
  }
};

export default adminService;
