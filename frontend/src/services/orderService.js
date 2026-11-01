import api from './api';

export const orderService = {
  /**
   * Place an order from current cart (Cash on Delivery)
   */
  async checkout(payload) {
    const response = await api.post('/orders/checkout/', payload);
    return response.data;
  },

  /**
   * Get user's order list with pagination, search, and status filter
   */
  async getOrders({ page = 1, search = '', status = '' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (search) params.append('search', search);
    if (status) params.append('status', status);

    const response = await api.get(`/orders/?${params.toString()}`);
    return response.data;
  },

  /**
   * Get single order detail by ID or order_number
   */
  async getOrderDetail(idOrNumber) {
    const response = await api.get(`/orders/${idOrNumber}/`);
    return response.data;
  },

  /**
   * Cancel entire order or specific item with optional reason
   */
  async cancelOrder(idOrNumber, { reason = '', item_id = null } = {}) {
    const payload = {};
    if (reason) payload.reason = reason;
    if (item_id) payload.item_id = item_id;

    const response = await api.post(`/orders/${idOrNumber}/cancel/`, payload);
    return response.data;
  },

  /**
   * Request return for a delivered order with mandatory reason
   */
  async returnOrder(idOrNumber, { reason }) {
    const response = await api.post(`/orders/${idOrNumber}/return/`, { reason });
    return response.data;
  },

  /**
   * Fetch invoice details for printing/PDF
   */
  async getInvoice(idOrNumber) {
    const response = await api.get(`/orders/${idOrNumber}/invoice/`);
    return response.data;
  },

  /**
   * Validate coupon code before order submission
   */
  async validateCoupon(code, subtotal = 0.00) {
    const response = await api.post('/orders/coupons/validate/', { code, subtotal });
    return response.data;
  },

  /**
   * Remove applied coupon and recalculate
   */
  async removeCoupon(subtotal = 0.00) {
    const response = await api.post('/orders/coupons/remove/', { subtotal });
    return response.data;
  },

  /**
   * Fetch public Razorpay payment gateway configuration (key ID, currency)
   */
  async getPaymentConfig() {
    const response = await api.get('/payments/config/');
    return response.data;
  },

  /**
   * Create payment intent/gateway order
   */
  async createPayment(idOrNumber, paymentMethod = 'Razorpay') {
    const response = await api.post(`/orders/${idOrNumber}/payment/create/`, {
      payment_method: paymentMethod
    });
    return response.data;
  },

  /**
   * Direct Razorpay order creation endpoint
   */
  async createRazorpayOrder(payload) {
    const response = await api.post('/payments/create-order/', payload);
    return response.data;
  },

  /**
   * Verify Razorpay payment signature
   */
  async verifyPayment(idOrNumber, paymentData) {
    if (idOrNumber) {
      const response = await api.post(`/orders/${idOrNumber}/payment/verify/`, paymentData);
      return response.data;
    }
    const response = await api.post('/payments/verify/', paymentData);
    return response.data;
  },

  /**
   * Record payment failure or cancellation
   */
  async failPayment(idOrNumber, failData = {}) {
    if (idOrNumber) {
      const response = await api.post(`/orders/${idOrNumber}/payment/fail/`, failData);
      return response.data;
    }
    const response = await api.post('/payments/fail/', failData);
    return response.data;
  }
};

export default orderService;
