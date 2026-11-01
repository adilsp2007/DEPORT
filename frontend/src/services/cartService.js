import api from './api';

export const cartService = {
  /**
   * Fetch current user's cart from backend
   */
  async getCart() {
    const response = await api.get('/cart/');
    return response.data;
  },

  /**
   * Add a product to cart (or increment existing quantity)
   * Also automatically removes the product from wishlist on backend
   */
  async addToCart(productId, quantity = 1) {
    const response = await api.post('/cart/add/', {
      product_id: productId,
      quantity
    });
    return response.data;
  },

  /**
   * Update quantity of an item with stock & limit validation
   */
  async updateQuantity(productId, quantity) {
    const response = await api.patch('/cart/update-quantity/', {
      product_id: productId,
      quantity
    });
    return response.data;
  },

  /**
   * Remove product from cart
   */
  async removeItem(productId) {
    const response = await api.delete('/cart/remove/', {
      data: { product_id: productId }
    });
    return response.data;
  },

  /**
   * Clear all items from cart
   */
  async clearCart() {
    const response = await api.post('/cart/clear/');
    return response.data;
  },

  /**
   * Validate out of stock items and restrict checkout
   */
  async validateCart() {
    const response = await api.get('/cart/validate/');
    return response.data;
  }
};

export default cartService;
