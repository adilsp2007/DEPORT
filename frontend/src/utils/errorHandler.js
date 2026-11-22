/**
 * Centralized Error Handling & Message Normalization Utility - DEPORT Atelier
 *
 * Normalizes Axios errors, Django REST Framework payloads, network timeouts,
 * and client-side exceptions into clean, user-friendly messages and field error mappings.
 *
 * Never exposes raw stack traces, database internals, or technical jargon to users.
 */

// User-friendly message dictionary corresponding to DEPORT UX standards
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  SERVER_ERROR: 'Something went wrong on our server. Please try again later.',
  INVALID_LOGIN: 'Invalid email or password. Please try again.',
  INVALID_OTP: 'The OTP you entered is incorrect. Please try again.',
  EXPIRED_OTP: 'Your OTP has expired. Please request a new OTP.',
  INVALID_FORM_INPUT: 'Please check the entered information.',
  PRODUCT_UNAVAILABLE: 'This product is currently unavailable.',
  INSUFFICIENT_WALLET_BALANCE: 'Your wallet balance is insufficient for this payment.',
  COUPON_INVALID: 'This coupon is invalid or expired.',
  PAYMENT_FAILED: 'Payment failed. Please try again.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested information could not be found.',
  TIMEOUT: 'The request took too long. Please try again.',
  TOO_MANY_REQUESTS: 'Too many attempts. Please wait a moment and try again.',
  CONFLICT: 'A record with this information already exists.',
  DEFAULT_ERROR: 'An unexpected issue occurred. Please try again.'
};

/**
 * Translates raw technical messages into polished user-friendly sentences
 */
export const humanizeErrorMessage = (rawMsg, statusCode = null) => {
  if (!rawMsg || typeof rawMsg !== 'string') {
    return ERROR_MESSAGES.DEFAULT_ERROR;
  }

  const clean = rawMsg.trim();
  const lower = clean.toLowerCase();

  // Network & Connectivity
  if (
    lower.includes('network') ||
    lower.includes('econnrefused') ||
    lower.includes('failed to fetch') ||
    lower.includes('unable to connect')
  ) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  // Timeout
  if (lower.includes('timeout') || lower.includes('econnaborted')) {
    return ERROR_MESSAGES.TIMEOUT;
  }

  // Authentication & SimpleJWT
  if (
    lower.includes('given token not valid') ||
    lower.includes('token is invalid') ||
    lower.includes('token_not_valid') ||
    lower.includes('authentication credentials were not provided')
  ) {
    return ERROR_MESSAGES.UNAUTHORIZED;
  }

  if (
    lower.includes('no active account found with the given credentials') ||
    lower.includes('invalid email or password') ||
    lower.includes('invalid credentials') ||
    (statusCode === 401 && lower.includes('credentials'))
  ) {
    return ERROR_MESSAGES.INVALID_LOGIN;
  }

  // OTP Verification
  if (lower.includes('otp has expired') || lower.includes('code has expired') || lower.includes('verification code expired')) {
    return ERROR_MESSAGES.EXPIRED_OTP;
  }
  if (lower.includes('invalid otp') || lower.includes('invalid verification code') || lower.includes('incorrect otp')) {
    return ERROR_MESSAGES.INVALID_OTP;
  }

  // Wallet
  if (lower.includes('insufficient wallet balance') || lower.includes('insufficient balance') || lower.includes('insufficient funds')) {
    return ERROR_MESSAGES.INSUFFICIENT_WALLET_BALANCE;
  }

  // Coupon
  if (lower.includes('coupon') && (lower.includes('invalid') || lower.includes('expired') || lower.includes('not found') || lower.includes('inactive'))) {
    return ERROR_MESSAGES.COUPON_INVALID;
  }

  // Payment
  if (lower.includes('payment failed') || lower.includes('payment could not be verified') || lower.includes('transaction failed')) {
    return ERROR_MESSAGES.PAYMENT_FAILED;
  }

  // Product availability
  if (lower.includes('out of stock') || lower.includes('product is currently unavailable') || lower.includes('insufficient stock')) {
    return ERROR_MESSAGES.PRODUCT_UNAVAILABLE;
  }

  // Status-code specific fallbacks for generic DRF messages
  if (statusCode === 404 && (lower.includes('not found') || lower.includes('does not exist'))) {
    return ERROR_MESSAGES.NOT_FOUND;
  }
  if (statusCode === 403 && (lower.includes('permission') || lower.includes('forbidden') || lower.includes('access denied'))) {
    return ERROR_MESSAGES.FORBIDDEN;
  }
  if (statusCode === 409) {
    return ERROR_MESSAGES.CONFLICT;
  }
  if (statusCode === 429) {
    return ERROR_MESSAGES.TOO_MANY_REQUESTS;
  }
  if (statusCode >= 500) {
    return ERROR_MESSAGES.SERVER_ERROR;
  }

  return clean;
};

/**
 * Parses any API error (Axios error, Error instance, or plain string)
 * into a structured object containing human-friendly primary message and field-specific errors.
 */
export const parseApiError = (error, fallbackMessage = null) => {
  // 1. Plain String
  if (typeof error === 'string') {
    return {
      message: humanizeErrorMessage(error),
      fieldErrors: {},
      statusCode: null,
      isNetworkError: false,
      isTimeout: false,
      isAuthError: false,
      isForbidden: false,
      isServerError: false,
      isValidationError: false
    };
  }

  // 2. Null or undefined
  if (!error) {
    return {
      message: fallbackMessage || ERROR_MESSAGES.DEFAULT_ERROR,
      fieldErrors: {},
      statusCode: null,
      isNetworkError: false,
      isTimeout: false,
      isAuthError: false,
      isForbidden: false,
      isServerError: false,
      isValidationError: false
    };
  }

  // 3. Network Failure or Timeout (No HTTP response from server)
  if (!error.response) {
    const isTimeout =
      error.code === 'ECONNABORTED' ||
      (error.message && error.message.toLowerCase().includes('timeout'));

    const message = isTimeout ? ERROR_MESSAGES.TIMEOUT : ERROR_MESSAGES.NETWORK_ERROR;

    return {
      message,
      fieldErrors: {},
      statusCode: null,
      isNetworkError: !isTimeout,
      isTimeout,
      isAuthError: false,
      isForbidden: false,
      isServerError: false,
      isValidationError: false
    };
  }

  // 4. HTTP Response from server
  const status = error.response.status;
  const data = error.response.data;
  const fieldErrors = {};
  let primaryMessage = fallbackMessage;

  // Extract field errors and primary detail from DRF response data
  if (typeof data === 'string') {
    primaryMessage = humanizeErrorMessage(data, status);
  } else if (Array.isArray(data) && data.length > 0) {
    primaryMessage = humanizeErrorMessage(String(data[0]), status);
  } else if (data && typeof data === 'object') {
    // Process detail field
    if (data.detail && typeof data.detail === 'string') {
      primaryMessage = humanizeErrorMessage(data.detail, status);
    } else if (data.message && typeof data.message === 'string') {
      primaryMessage = humanizeErrorMessage(data.message, status);
    }

    // Process non_field_errors
    if (data.non_field_errors) {
      const nfe = Array.isArray(data.non_field_errors)
        ? data.non_field_errors.join(' ')
        : String(data.non_field_errors);
      if (!primaryMessage) {
        primaryMessage = humanizeErrorMessage(nfe, status);
      }
    }

    // Process nested errors dictionary (from custom_exception_handler)
    const errorSource = (data.errors && typeof data.errors === 'object') ? data.errors : data;

    Object.entries(errorSource).forEach(([field, val]) => {
      if (['detail', 'code', 'messages', 'message'].includes(field)) return;

      let msg = '';
      if (Array.isArray(val)) {
        msg = val.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ');
      } else if (val && typeof val === 'object') {
        // Nested object error
        msg = Object.values(val)
          .flat()
          .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
          .join(' ');
      } else if (val !== null && val !== undefined) {
        msg = String(val);
      }

      if (msg) {
        // Save both exact key and camelCase/snake_case aliases for easy component consumption
        fieldErrors[field] = msg;
        const camelField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        const snakeField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        fieldErrors[camelField] = msg;
        fieldErrors[snakeField] = msg;

        // If no primary message yet, set first field error as primary
        if (!primaryMessage) {
          primaryMessage = msg;
        }
      }
    });
  }

  // Fallbacks based on status code if no message was extracted
  if (!primaryMessage) {
    switch (status) {
      case 400:
        primaryMessage = Object.keys(fieldErrors).length > 0
          ? ERROR_MESSAGES.INVALID_FORM_INPUT
          : 'Invalid request. Please verify the information entered.';
        break;
      case 401:
        primaryMessage = ERROR_MESSAGES.UNAUTHORIZED;
        break;
      case 403:
        primaryMessage = ERROR_MESSAGES.FORBIDDEN;
        break;
      case 404:
        primaryMessage = ERROR_MESSAGES.NOT_FOUND;
        break;
      case 409:
        primaryMessage = ERROR_MESSAGES.CONFLICT;
        break;
      case 422:
        primaryMessage = ERROR_MESSAGES.INVALID_FORM_INPUT;
        break;
      case 429:
        primaryMessage = ERROR_MESSAGES.TOO_MANY_REQUESTS;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        primaryMessage = ERROR_MESSAGES.SERVER_ERROR;
        break;
      default:
        primaryMessage = fallbackMessage || ERROR_MESSAGES.DEFAULT_ERROR;
    }
  }

  return {
    message: primaryMessage,
    fieldErrors,
    statusCode: status,
    isNetworkError: false,
    isTimeout: false,
    isAuthError: status === 401,
    isForbidden: status === 403,
    isServerError: status >= 500,
    isValidationError: status === 400 || status === 422
  };
};

/**
 * Convenient helper to retrieve a field error safely, checking
 * both camelCase and snake_case variants.
 */
export const getFieldError = (fieldErrors, fieldName) => {
  if (!fieldErrors || typeof fieldErrors !== 'object') return null;

  const direct = fieldErrors[fieldName];
  if (direct) return direct;

  const camel = fieldName.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
  if (fieldErrors[camel]) return fieldErrors[camel];

  const snake = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
  if (fieldErrors[snake]) return fieldErrors[snake];

  return null;
};

/**
 * Sanitized logger that avoids leaking passwords, OTPs, or tokens in logs.
 * Active in development environment only.
 */
export const logError = (context, error) => {
  if (!import.meta.env.DEV) return;

  const sanitized = {
    message: error?.message,
    status: error?.response?.status,
    url: error?.config?.url,
    method: error?.config?.method
  };

  console.error(`[DEPORT Error] [${context}]`, sanitized);
};

export default {
  ERROR_MESSAGES,
  humanizeErrorMessage,
  parseApiError,
  getFieldError,
  logError
};
