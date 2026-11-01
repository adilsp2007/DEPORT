/**
 * Frontend Coupon Management and Calculation Utilities
 * DEPORT E-Commerce Platform
 */

/**
 * Normalizes coupon code to uppercase and removes leading/trailing whitespace.
 */
export function normalizeCouponCode(code) {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

/**
 * Validates the admin coupon creation/edit form.
 * Returns an object with `isValid` (boolean) and `errors` (dictionary of field errors).
 */
export function validateCouponForm(formData) {
  const errors = {};

  // Code
  const normalizedCode = normalizeCouponCode(formData.code);
  if (!normalizedCode) {
    errors.code = 'Coupon code is required.';
  } else if (normalizedCode.length < 3) {
    errors.code = 'Coupon code must be at least 3 characters.';
  } else if (!/^[A-Z0-9_-]+$/.test(normalizedCode)) {
    errors.code = 'Coupon code can only contain letters, numbers, hyphens, and underscores.';
  }

  // Discount Type
  const discountType = formData.discount_type;
  if (!discountType || !['percentage', 'fixed'].includes(discountType)) {
    errors.discount_type = 'Please select a valid discount type (Fixed or Percentage).';
  }

  // Discount Value
  const discountVal = Number(formData.discount_value);
  if (isNaN(discountVal) || formData.discount_value === '' || formData.discount_value === null) {
    errors.discount_value = 'Discount value is required.';
  } else if (discountVal <= 0) {
    errors.discount_value = 'Discount value must be greater than zero.';
  } else if (discountType === 'percentage' && discountVal > 100) {
    errors.discount_value = 'Percentage discount cannot exceed 100%.';
  }

  // Minimum Order Amount
  if (formData.min_order_amount !== undefined && formData.min_order_amount !== null && formData.min_order_amount !== '') {
    const minOrder = Number(formData.min_order_amount);
    if (isNaN(minOrder) || minOrder < 0) {
      errors.min_order_amount = 'Minimum order amount must be a positive number or zero.';
    }
  }

  // Maximum Discount Amount
  if (formData.max_discount_amount !== undefined && formData.max_discount_amount !== null && formData.max_discount_amount !== '') {
    const maxDiscount = Number(formData.max_discount_amount);
    if (isNaN(maxDiscount) || maxDiscount < 0) {
      errors.max_discount_amount = 'Maximum discount amount cannot be negative.';
    }
  }

  // Dates
  if (formData.start_date && formData.expiration_date) {
    const start = new Date(formData.start_date);
    const end = new Date(formData.expiration_date);
    if (isNaN(start.getTime())) {
      errors.start_date = 'Invalid start date format.';
    }
    if (isNaN(end.getTime())) {
      errors.expiration_date = 'Invalid expiration date format.';
    }
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
      errors.expiration_date = 'Expiration date must be after start date.';
    }
  }

  // Limits
  if (formData.usage_limit !== undefined && formData.usage_limit !== null && formData.usage_limit !== '') {
    const limit = Number(formData.usage_limit);
    if (isNaN(limit) || limit < 0 || !Number.isInteger(limit)) {
      errors.usage_limit = 'Total usage limit must be a non-negative whole number.';
    }
  }

  if (formData.per_user_limit !== undefined && formData.per_user_limit !== null && formData.per_user_limit !== '') {
    const perUser = Number(formData.per_user_limit);
    if (isNaN(perUser) || perUser < 1 || !Number.isInteger(perUser)) {
      errors.per_user_limit = 'Per-user usage limit must be at least 1.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Calculates discount amount based on coupon configuration and current order subtotal.
 * Never exceeds eligible subtotal or maximum discount amount.
 */
export function calculateCouponDiscount(coupon, subtotal) {
  if (!coupon || !subtotal || subtotal <= 0) return 0;

  const minOrder = Number(coupon.min_order_amount) || 0;
  if (subtotal < minOrder) {
    return 0;
  }

  const discountVal = Number(coupon.discount_value) || 0;
  let discount = 0;

  if (coupon.discount_type === 'percentage') {
    discount = (subtotal * discountVal) / 100;
    if (coupon.max_discount_amount && Number(coupon.max_discount_amount) > 0) {
      discount = Math.min(discount, Number(coupon.max_discount_amount));
    }
  } else if (coupon.discount_type === 'fixed') {
    discount = Math.min(discountVal, subtotal);
  }

  // Never exceed the order subtotal
  return Math.min(Math.max(0, Math.round(discount * 100) / 100), subtotal);
}

/**
 * Calculates complete order totals including subtotal, discount, shipping, and taxes.
 */
export function calculateOrderTotals({ subtotal = 0, discount = 0, shippingCost = 0, tax = 0 }) {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const safeDiscount = Math.min(Math.max(0, Number(discount) || 0), safeSubtotal);
  const safeShipping = Math.max(0, Number(shippingCost) || 0);
  const safeTax = Math.max(0, Number(tax) || 0);

  const finalTotal = Math.max(0, safeSubtotal - safeDiscount + safeShipping + safeTax);

  return {
    subtotal: safeSubtotal,
    discount: safeDiscount,
    shippingCost: safeShipping,
    tax: safeTax,
    finalTotal: Math.round(finalTotal * 100) / 100,
  };
}

/**
 * Parses and formats backend validation errors from DRF responses.
 */
export function extractBackendErrors(error) {
  if (!error) return { general: 'An unexpected error occurred.', fieldErrors: {} };

  const data = error.response?.data || error.data || error;

  if (typeof data === 'string') {
    return { general: data, fieldErrors: {} };
  }

  const fieldErrors = {};
  let general = '';

  if (data.detail && typeof data.detail === 'string') {
    general = data.detail;
  }

  if (data.error && typeof data.error === 'string') {
    general = data.error;
  }

  for (const [key, value] of Object.entries(data)) {
    if (['detail', 'error', 'status'].includes(key)) continue;

    if (Array.isArray(value)) {
      fieldErrors[key] = value.join(' ');
    } else if (typeof value === 'string') {
      fieldErrors[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      fieldErrors[key] = Object.values(value).flat().join(' ');
    }
  }

  return { general, fieldErrors };
}
