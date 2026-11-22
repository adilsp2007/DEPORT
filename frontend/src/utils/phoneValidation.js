/**
 * Utility functions for Indian phone number validation across DEPORT client profile forms.
 * 
 * Rules:
 * - 10 digits for standard Indian mobile numbers.
 * - Must start with 6, 7, 8, or 9.
 * - Allows optional +91 or 91 country code prefix (e.g. +91 9876543210, +919876543210).
 * - Strips unnecessary spaces, dashes, and parentheses before validation.
 * - Rejects alphabets, special characters, incomplete numbers, and invalid mobile numbers.
 * - Rejects dummy repeating numbers (e.g., 0000000000).
 */

export const validateIndianPhoneNumber = (value, isMandatory = true) => {
  if (value === null || value === undefined || String(value).trim() === '') {
    if (isMandatory) {
      return { isValid: false, error: 'Phone number is required.', cleaned: '' };
    }
    return { isValid: true, error: '', cleaned: '' };
  }

  const raw = String(value).trim();

  // Reject alphabets
  if (/[a-zA-Z]/.test(raw)) {
    return { isValid: false, error: 'Phone number cannot contain alphabets.', cleaned: '' };
  }

  // Reject invalid special characters (allow optional +, digits, spaces, hyphens, parentheses)
  if (!/^\+?[0-9\s\-()]+$/.test(raw)) {
    return { isValid: false, error: 'Phone number contains invalid special characters.', cleaned: '' };
  }

  // Extract pure digits
  const digits = raw.replace(/\D/g, '');

  let mobileDigits = '';
  let hasPlus91 = false;

  if (raw.startsWith('+91')) {
    hasPlus91 = true;
    if (digits.length < 12) {
      return { isValid: false, error: 'Phone number must contain exactly 10 digits after +91.', cleaned: '' };
    }
    if (digits.length > 12) {
      return { isValid: false, error: 'Phone number cannot exceed 10 digits after +91.', cleaned: '' };
    }
    mobileDigits = digits.slice(2);
  } else if (raw.startsWith('91') && digits.length === 12) {
    hasPlus91 = true;
    mobileDigits = digits.slice(2);
  } else if (digits.length === 10) {
    mobileDigits = digits;
  } else if (digits.length < 10) {
    return { isValid: false, error: 'Phone number must contain exactly 10 digits.', cleaned: '' };
  } else {
    return { isValid: false, error: 'Phone number cannot exceed 10 digits (excluding +91 country code).', cleaned: '' };
  }

  // Mobile number must start with 6, 7, 8, or 9
  if (!['6', '7', '8', '9'].includes(mobileDigits[0])) {
    return { isValid: false, error: 'Indian mobile numbers must start with 6, 7, 8, or 9.', cleaned: '' };
  }

  // Reject all identical dummy digits (e.g., 0000000000, 1111111111)
  const uniqueDigits = new Set(mobileDigits);
  if (uniqueDigits.size <= 1) {
    return { isValid: false, error: 'Please enter a valid, active mobile number.', cleaned: '' };
  }

  const cleaned = hasPlus91 ? `+91${mobileDigits}` : mobileDigits;
  return { isValid: true, error: '', cleaned, mobileDigits };
};

