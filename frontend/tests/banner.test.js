import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Admin Banner Management Frontend Tests', () => {
  describe('1. Banner Filter Query Parameter Building', () => {
    test('builds query parameters with banner type and status', () => {
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('page_size', '10');
      params.append('banner_type', 'hero');
      params.append('status', 'active');
      params.append('search', 'autumn');

      assert.strictEqual(
        params.toString(),
        'page=1&page_size=10&banner_type=hero&status=active&search=autumn'
      );
    });

    test('ignores "all" or empty type filter', () => {
      const buildBannerParams = ({ bannerType, status, page = 1 } = {}) => {
        const params = new URLSearchParams();
        if (page) params.append('page', page);
        if (bannerType && bannerType.toLowerCase() !== 'all') {
          params.append('banner_type', bannerType);
        }
        if (status && status.toLowerCase() !== 'all') {
          params.append('status', status);
        }
        return params.toString();
      };

      assert.strictEqual(buildBannerParams({ bannerType: 'all', status: 'all' }), 'page=1');
      assert.strictEqual(buildBannerParams({ bannerType: 'promotional', status: 'active' }), 'page=1&banner_type=promotional&status=active');
    });
  });

  describe('2. Banner Form Validations', () => {
    const validateBannerForm = (form, isEditing = false, hasImageFile = false) => {
      const errors = {};
      const title = (form.title || '').trim();
      if (!title) {
        errors.title = 'Banner title is required.';
      }

      if (!isEditing && !hasImageFile && !form.image_url?.trim()) {
        errors.image = 'Banner image or image URL is required.';
      }

      if (form.start_date && form.end_date) {
        if (new Date(form.start_date) > new Date(form.end_date)) {
          errors.end_date = 'Expiry date must be later than start date.';
        }
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors
      };
    };

    test('validates correct banner form data', () => {
      const res = validateBannerForm({
        title: 'Valid Banner',
        placement: 'hero',
        image_url: 'https://example.com/banner.jpg',
        start_date: '2026-11-01T10:00',
        end_date: '2026-11-30T10:00'
      });
      assert.strictEqual(res.isValid, true);
      assert.deepStrictEqual(res.errors, {});
    });

    test('rejects missing title', () => {
      const res = validateBannerForm({
        title: '   ',
        image_url: 'https://example.com/banner.jpg'
      });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.title, 'Banner title is required.');
    });

    test('rejects end date earlier than start date', () => {
      const res = validateBannerForm({
        title: 'Date Test',
        image_url: 'https://example.com/banner.jpg',
        start_date: '2026-11-30T10:00',
        end_date: '2026-11-01T10:00'
      });
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(res.errors.end_date, 'Expiry date must be later than start date.');
    });

    test('allows editing without providing a new image', () => {
      const res = validateBannerForm(
        { title: 'Editing Title' },
        true, // isEditing
        false // no new image file
      );
      assert.strictEqual(res.isValid, true);
    });
  });

  describe('3. Computed Status Resolution', () => {
    const resolveStatus = (isActive, startDate, endDate, currentTime) => {
      if (!isActive) return 'inactive';
      const now = new Date(currentTime);
      if (startDate && now < new Date(startDate)) return 'scheduled';
      if (endDate && now > new Date(endDate)) return 'expired';
      return 'active';
    };

    const now = '2026-11-22T14:00:00Z';

    test('returns active for valid current banner', () => {
      assert.strictEqual(resolveStatus(true, '2026-11-01T00:00:00Z', '2026-11-30T00:00:00Z', now), 'active');
      assert.strictEqual(resolveStatus(true, null, null, now), 'active');
    });

    test('returns inactive when is_active is false', () => {
      assert.strictEqual(resolveStatus(false, '2026-11-01T00:00:00Z', '2026-11-30T00:00:00Z', now), 'inactive');
    });

    test('returns scheduled for future banner', () => {
      assert.strictEqual(resolveStatus(true, '2026-12-01T00:00:00Z', '2026-12-31T00:00:00Z', now), 'scheduled');
    });

    test('returns expired for past banner', () => {
      assert.strictEqual(resolveStatus(true, '2026-10-01T00:00:00Z', '2026-10-31T00:00:00Z', now), 'expired');
    });
  });
});

