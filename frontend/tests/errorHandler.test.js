import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  parseApiError,
  humanizeErrorMessage,
  getFieldError,
  ERROR_MESSAGES
} from '../src/utils/errorHandler.js';

describe('Centralized Frontend Error Handler Tests', () => {
  test('handles network unavailable error without response', () => {
    const error = new Error('Network Error');
    error.code = 'ERR_NETWORK';
    const parsed = parseApiError(error);

    assert.strictEqual(parsed.message, ERROR_MESSAGES.NETWORK_ERROR);
    assert.strictEqual(parsed.isNetworkError, true);
    assert.strictEqual(parsed.isTimeout, false);
    assert.strictEqual(parsed.statusCode, null);
  });

  test('handles connection timeout error', () => {
    const error = new Error('timeout of 15000ms exceeded');
    error.code = 'ECONNABORTED';
    const parsed = parseApiError(error);

    assert.strictEqual(parsed.message, ERROR_MESSAGES.TIMEOUT);
    assert.strictEqual(parsed.isTimeout, true);
    assert.strictEqual(parsed.isNetworkError, false);
  });

  test('normalizes raw SimpleJWT token expiration message', () => {
    const error = {
      response: {
        status: 401,
        data: {
          detail: 'Given token not valid for any token type',
          code: 'token_not_valid'
        }
      }
    };
    const parsed = parseApiError(error);

    assert.strictEqual(parsed.message, ERROR_MESSAGES.UNAUTHORIZED);
    assert.strictEqual(parsed.isAuthError, true);
    assert.strictEqual(parsed.statusCode, 401);
  });

  test('normalizes invalid login credentials', () => {
    const error = {
      response: {
        status: 401,
        data: {
          detail: 'No active account found with the given credentials'
        }
      }
    };
    const parsed = parseApiError(error);

    assert.strictEqual(parsed.message, ERROR_MESSAGES.INVALID_LOGIN);
    assert.strictEqual(parsed.isAuthError, true);
  });

  test('normalizes DRF field validation error dictionary', () => {
    const error = {
      response: {
        status: 400,
        data: {
          email: ['This email is already registered.'],
          phone_number: ['Enter a valid 10-digit mobile number.']
        }
      }
    };
    const parsed = parseApiError(error);

    assert.strictEqual(parsed.isValidationError, true);
    assert.strictEqual(parsed.statusCode, 400);
    assert.strictEqual(parsed.fieldErrors.email, 'This email is already registered.');
    assert.strictEqual(parsed.fieldErrors.phone_number, 'Enter a valid 10-digit mobile number.');
    // Check camelCase alias
    assert.strictEqual(parsed.fieldErrors.phoneNumber, 'Enter a valid 10-digit mobile number.');
    // Check getFieldError helper
    assert.strictEqual(getFieldError(parsed.fieldErrors, 'phone_number'), 'Enter a valid 10-digit mobile number.');
    assert.strictEqual(getFieldError(parsed.fieldErrors, 'phoneNumber'), 'Enter a valid 10-digit mobile number.');
  });

  test('normalizes DRF non_field_errors', () => {
    const error = {
      response: {
        status: 400,
        data: {
          non_field_errors: ['Passwords do not match.']
        }
      }
    };
    const parsed = parseApiError(error);

    assert.strictEqual(parsed.message, 'Passwords do not match.');
  });

  test('normalizes invalid and expired OTP messages', () => {
    const invalidOtpError = {
      response: {
        status: 400,
        data: { detail: 'Invalid OTP code entered.' }
      }
    };
    const parsedInvalid = parseApiError(invalidOtpError);
    assert.strictEqual(parsedInvalid.message, ERROR_MESSAGES.INVALID_OTP);

    const expiredOtpError = {
      response: {
        status: 400,
        data: { detail: 'Your verification code expired. Request a new one.' }
      }
    };
    const parsedExpired = parseApiError(expiredOtpError);
    assert.strictEqual(parsedExpired.message, ERROR_MESSAGES.EXPIRED_OTP);
  });

  test('normalizes insufficient wallet balance message', () => {
    const error = {
      response: {
        status: 400,
        data: { detail: 'Insufficient wallet balance for this transaction.' }
      }
    };
    const parsed = parseApiError(error);
    assert.strictEqual(parsed.message, ERROR_MESSAGES.INSUFFICIENT_WALLET_BALANCE);
  });

  test('normalizes invalid coupon message', () => {
    const error = {
      response: {
        status: 400,
        data: { detail: 'This coupon is expired or inactive.' }
      }
    };
    const parsed = parseApiError(error);
    assert.strictEqual(parsed.message, ERROR_MESSAGES.COUPON_INVALID);
  });

  test('normalizes 403 Forbidden error', () => {
    const error = {
      response: {
        status: 403,
        data: { detail: 'You do not have permission to perform this action.' }
      }
    };
    const parsed = parseApiError(error);
    assert.strictEqual(parsed.isForbidden, true);
    assert.strictEqual(parsed.message, ERROR_MESSAGES.FORBIDDEN);
  });

  test('normalizes 404 Not Found error', () => {
    const error = {
      response: {
        status: 404,
        data: { detail: 'Not found.' }
      }
    };
    const parsed = parseApiError(error);
    assert.strictEqual(parsed.message, ERROR_MESSAGES.NOT_FOUND);
  });

  test('normalizes 409 Conflict error', () => {
    const error = {
      response: {
        status: 409,
        data: { detail: 'A record with this information already exists.' }
      }
    };
    const parsed = parseApiError(error);
    assert.strictEqual(parsed.message, ERROR_MESSAGES.CONFLICT);
  });

  test('normalizes 500, 502, and 503 Server errors without leaking technical details', () => {
    const error500 = {
      response: {
        status: 500,
        data: { detail: 'Internal server error at /api/users/login line 42' }
      }
    };
    const parsed500 = parseApiError(error500);
    assert.strictEqual(parsed500.isServerError, true);
    assert.strictEqual(parsed500.message, ERROR_MESSAGES.SERVER_ERROR);

    const error503 = {
      response: {
        status: 503,
        data: 'Service Unavailable'
      }
    };
    const parsed503 = parseApiError(error503);
    assert.strictEqual(parsed503.isServerError, true);
    assert.strictEqual(parsed503.message, ERROR_MESSAGES.SERVER_ERROR);
  });

  test('handles plain string error input gracefully', () => {
    const parsed = parseApiError('Network Error');
    assert.strictEqual(parsed.message, ERROR_MESSAGES.NETWORK_ERROR);
  });

  test('handles null/undefined error gracefully with fallback', () => {
    const parsed = parseApiError(null, 'Custom fallback message');
    assert.strictEqual(parsed.message, 'Custom fallback message');
  });
});

