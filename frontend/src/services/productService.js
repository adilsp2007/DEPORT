import api from './api';

export const productService = {
  async getProducts(params = {}) {
    const response = await api.get('/products/', { params });
    return response.data;
  },

  async getProduct(slug) {
    const response = await api.get(`/products/${slug}/`);
    return response.data;
  },

  async getCategories() {
    const response = await api.get('/categories/');
    return response.data;
  },

  async getCategory(slug) {
    const response = await api.get(`/categories/${slug}/`);
    return response.data;
  },

  async getBrands() {
    const response = await api.get('/products/brands/');
    return response.data;
  },

  async getBanners(params = {}) {
    const response = await api.get('/products/banners/', { params });
    return response.data;
  }
};

export default productService;
