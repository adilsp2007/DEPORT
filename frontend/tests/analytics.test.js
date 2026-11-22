import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Admin Analytics Dashboard Frontend Tests', () => {
  describe('1. Analytics Query Parameter Serialization', () => {
    test('serializes default period query parameters', () => {
      const params = new URLSearchParams();
      const period = 'this_month';
      params.append('period', period);
      assert.strictEqual(params.toString(), 'period=this_month');
    });

    test('serializes custom date range with start_date and end_date', () => {
      const params = new URLSearchParams();
      params.append('period', 'custom');
      params.append('start_date', '2026-11-01');
      params.append('end_date', '2026-11-22');
      params.append('top_products_sort', 'revenue_desc');
      params.append('order_status', 'delivered');

      assert.strictEqual(
        params.toString(),
        'period=custom&start_date=2026-11-01&end_date=2026-11-22&top_products_sort=revenue_desc&order_status=delivered'
      );
    });
  });

  describe('2. Custom Date Range Validation Logic', () => {
    const validateCustomRange = (start, end) => {
      if (!start || !end) return { valid: false, error: 'Please select both start and end dates.' };
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (isNaN(startDate.getTime())) return { valid: false, error: 'Invalid start date.' };
      if (isNaN(endDate.getTime())) return { valid: false, error: 'Invalid end date.' };
      if (startDate > endDate) return { valid: false, error: 'End date cannot be earlier than start date.' };
      return { valid: true, error: null };
    };

    test('validates valid custom range', () => {
      const res = validateCustomRange('2026-11-01', '2026-11-22');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.error, null);
    });

    test('rejects end date earlier than start date', () => {
      const res = validateCustomRange('2026-11-22', '2026-11-01');
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'End date cannot be earlier than start date.');
    });

    test('rejects missing start or end dates', () => {
      const res = validateCustomRange('', '2026-11-01');
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Please select both start and end dates.');
    });
  });

  describe('3. Percentage Delta Calculation', () => {
    const calcChangePct = (curr, prev) => {
      const c = Number(curr || 0);
      const p = Number(prev || 0);
      if (p === 0) return c > 0 ? 100.0 : 0.0;
      return Math.round(((c - p) / p) * 1000) / 10;
    };

    test('calculates positive growth accurately', () => {
      assert.strictEqual(calcChangePct(120, 100), 20.0);
    });

    test('calculates negative decline accurately', () => {
      assert.strictEqual(calcChangePct(80, 100), -20.0);
    });

    test('handles zero previous value safely without NaN or Infinity', () => {
      assert.strictEqual(calcChangePct(50, 0), 100.0);
      assert.strictEqual(calcChangePct(0, 0), 0.0);
    });
  });
});

