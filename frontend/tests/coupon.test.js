import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeCouponCode,
  validateCouponForm,
  calculateCouponDiscount,
  calculateOrderTotals,
  extractBackendErrors,
} from '../src/utils/couponUtils.js';

describe('DEPORT E-Commerce Coupon System - Frontend Tests', () => {

  describe('1. Coupon Code Normalization and Sanitization', () => {
    it('should convert coupon codes to uppercase and strip surrounding whitespace', () => {
      assert.equal(normalizeCouponCode('  save20  '), 'SAVE20');
      assert.equal(normalizeCouponCode('diwali_2026'), 'DIWALI_2026');
      assert.equal(normalizeCouponCode('festive-50'), 'FESTIVE-50');
      assert.equal(normalizeCouponCode(''), '');
      assert.equal(normalizeCouponCode(null), '');
      assert.equal(normalizeCouponCode(undefined), '');
    });
  });

  describe('2. Admin Coupon Form Validation', () => {
    it('should pass validation with valid fixed coupon data', () => {
      const validFixed = {
        code: 'FLAT200',
        discount_type: 'fixed',
        discount_value: 200,
        min_order_amount: 1000,
        max_discount_amount: 200,
        start_date: '2026-10-01T00:00:00Z',
        expiration_date: '2026-12-31T23:59:59Z',
        usage_limit: 100,
        per_user_limit: 2,
        is_active: true,
      };
      const result = validateCouponForm(validFixed);
      assert.equal(result.isValid, true);
      assert.deepEqual(result.errors, {});
    });

    it('should pass validation with valid percentage coupon data', () => {
      const validPercentage = {
        code: 'SAVE20',
        discount_type: 'percentage',
        discount_value: 20,
        min_order_amount: 1000,
        max_discount_amount: 500,
        start_date: '2026-10-01T00:00:00Z',
        expiration_date: '2026-12-31T23:59:59Z',
        usage_limit: 50,
        per_user_limit: 1,
        is_active: true,
      };
      const result = validateCouponForm(validPercentage);
      assert.equal(result.isValid, true);
      assert.deepEqual(result.errors, {});
    });

    it('should reject missing or invalid coupon code', () => {
      const emptyCode = validateCouponForm({ code: '', discount_type: 'fixed', discount_value: 100 });
      assert.equal(emptyCode.isValid, false);
      assert.match(emptyCode.errors.code, /required/i);

      const shortCode = validateCouponForm({ code: 'AB', discount_type: 'fixed', discount_value: 100 });
      assert.equal(shortCode.isValid, false);
      assert.match(shortCode.errors.code, /at least 3 characters/i);

      const specialChars = validateCouponForm({ code: 'SAVE@20!', discount_type: 'fixed', discount_value: 100 });
      assert.equal(specialChars.isValid, false);
      assert.match(specialChars.errors.code, /letters, numbers/i);
    });

    it('should reject percentage discount exceeding 100%', () => {
      const result = validateCouponForm({
        code: 'BIGDISCOUNT',
        discount_type: 'percentage',
        discount_value: 150,
      });
      assert.equal(result.isValid, false);
      assert.match(result.errors.discount_value, /cannot exceed 100%/i);
    });

    it('should reject negative or zero discount values', () => {
      const zeroVal = validateCouponForm({
        code: 'ZERO',
        discount_type: 'fixed',
        discount_value: 0,
      });
      assert.equal(zeroVal.isValid, false);
      assert.match(zeroVal.errors.discount_value, /greater than zero/i);

      const negVal = validateCouponForm({
        code: 'NEGATIVE',
        discount_type: 'fixed',
        discount_value: -50,
      });
      assert.equal(negVal.isValid, false);
      assert.match(negVal.errors.discount_value, /greater than zero/i);
    });

    it('should reject expiration date that is before start date', () => {
      const invalidDates = validateCouponForm({
        code: 'DATEERR',
        discount_type: 'fixed',
        discount_value: 100,
        start_date: '2026-11-01T00:00:00Z',
        expiration_date: '2026-10-01T00:00:00Z',
      });
      assert.equal(invalidDates.isValid, false);
      assert.match(invalidDates.errors.expiration_date, /must be after start date/i);
    });

    it('should reject invalid usage limits', () => {
      const negUsage = validateCouponForm({
        code: 'LIMITS',
        discount_type: 'fixed',
        discount_value: 50,
        usage_limit: -5,
      });
      assert.equal(negUsage.isValid, false);
      assert.match(negUsage.errors.usage_limit, /non-negative/i);

      const zeroPerUser = validateCouponForm({
        code: 'PERUSER',
        discount_type: 'fixed',
        discount_value: 50,
        per_user_limit: 0,
      });
      assert.equal(zeroPerUser.isValid, false);
      assert.match(zeroPerUser.errors.per_user_limit, /at least 1/i);
    });
  });

  describe('3. Coupon Discount Calculation Rules (Fixed & Percentage)', () => {
    const fixedCoupon = {
      code: 'SAVE200',
      discount_type: 'fixed',
      discount_value: 200,
      min_order_amount: 1000,
      max_discount_amount: 200,
    };

    const percentCoupon = {
      code: 'SAVE20',
      discount_type: 'percentage',
      discount_value: 20,
      min_order_amount: 1000,
      max_discount_amount: 500,
    };

    it('Fixed: rejects discount when subtotal is below minimum order amount (₹800 < ₹1,000)', () => {
      const discount = calculateCouponDiscount(fixedCoupon, 800);
      assert.equal(discount, 0);
    });

    it('Fixed: applies exact ₹200 discount when subtotal is ₹1,000', () => {
      const discount = calculateCouponDiscount(fixedCoupon, 1000);
      assert.equal(discount, 200);
    });

    it('Fixed: discount remains ₹200 when subtotal is ₹2,000 or ₹5,000', () => {
      assert.equal(calculateCouponDiscount(fixedCoupon, 2000), 200);
      assert.equal(calculateCouponDiscount(fixedCoupon, 5000), 200);
    });

    it('Fixed: discount never exceeds subtotal even if fixed amount is higher', () => {
      const bigCoupon = { ...fixedCoupon, min_order_amount: 0, discount_value: 500 };
      const discount = calculateCouponDiscount(bigCoupon, 350);
      assert.equal(discount, 350);
    });

    it('Percentage: rejects discount when subtotal is below minimum (₹800 < ₹1,000)', () => {
      const discount = calculateCouponDiscount(percentCoupon, 800);
      assert.equal(discount, 0);
    });

    it('Percentage: calculates 20% on ₹1,000 = ₹200', () => {
      const discount = calculateCouponDiscount(percentCoupon, 1000);
      assert.equal(discount, 200);
    });

    it('Percentage: calculates 20% on ₹2,000 = ₹400', () => {
      const discount = calculateCouponDiscount(percentCoupon, 2000);
      assert.equal(discount, 400);
    });

    it('Percentage: caps discount at ₹500 on ₹3,000 subtotal (20% of ₹3000 = ₹600 -> capped at ₹500)', () => {
      const discount = calculateCouponDiscount(percentCoupon, 3000);
      assert.equal(discount, 500);
    });

    it('Percentage: caps discount at ₹500 on ₹5,000 subtotal (20% of ₹5000 = ₹1,000 -> capped at ₹500)', () => {
      const discount = calculateCouponDiscount(percentCoupon, 5000);
      assert.equal(discount, 500);
    });

    it('Removal: returns 0 discount when coupon is removed (null/undefined)', () => {
      assert.equal(calculateCouponDiscount(null, 2000), 0);
      assert.equal(calculateCouponDiscount(undefined, 2000), 0);
    });
  });

  describe('4. Checkout Total Calculation with Shipping and Taxes', () => {
    it('calculates final total: subtotal - discount + shipping + tax', () => {
      const totals = calculateOrderTotals({
        subtotal: 2000,
        discount: 400,
        shippingCost: 50,
        tax: 96,
      });
      // 2000 - 400 + 50 + 96 = 1746
      assert.equal(totals.subtotal, 2000);
      assert.equal(totals.discount, 400);
      assert.equal(totals.shippingCost, 50);
      assert.equal(totals.tax, 96);
      assert.equal(totals.finalTotal, 1746);
    });

    it('recalculates total when coupon is removed, restoring undiscounted total', () => {
      const totalsWithCoupon = calculateOrderTotals({
        subtotal: 1000,
        discount: 200,
        shippingCost: 0,
        tax: 80,
      });
      assert.equal(totalsWithCoupon.finalTotal, 880);

      const totalsAfterRemoval = calculateOrderTotals({
        subtotal: 1000,
        discount: 0,
        shippingCost: 0,
        tax: 80,
      });
      assert.equal(totalsAfterRemoval.finalTotal, 1080);
    });

    it('prevents negative final total if discount were hypothetically equal to subtotal', () => {
      const totals = calculateOrderTotals({
        subtotal: 500,
        discount: 500,
        shippingCost: 0,
        tax: 0,
      });
      assert.equal(totals.finalTotal, 0);
    });
  });

  describe('5. Backend Error Parsing and Display', () => {
    it('parses detail error message from API response', () => {
      const errorObj = {
        response: {
          data: {
            detail: 'This coupon has expired on 2026-10-01.',
          },
        },
      };
      const parsed = extractBackendErrors(errorObj);
      assert.equal(parsed.general, 'This coupon has expired on 2026-10-01.');
      assert.deepEqual(parsed.fieldErrors, {});
    });

    it('parses field-specific validation errors for admin modal form', () => {
      const errorObj = {
        response: {
          data: {
            code: ['Coupon with this code already exists.'],
            discount_value: ['Percentage discount cannot exceed 100.'],
          },
        },
      };
      const parsed = extractBackendErrors(errorObj);
      assert.equal(parsed.fieldErrors.code, 'Coupon with this code already exists.');
      assert.equal(parsed.fieldErrors.discount_value, 'Percentage discount cannot exceed 100.');
    });

    it('gracefully handles raw string errors', () => {
      const parsed = extractBackendErrors('Network timeout');
      assert.equal(parsed.general, 'Network timeout');
    });
  });

});
