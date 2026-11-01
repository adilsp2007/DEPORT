/**
 * DEPORT E-Commerce Platform
 * Centralized Currency Formatting Utility (INR / ₹ / en-IN)
 */

export const CURRENCY_CODE = 'INR';
export const CURRENCY_SYMBOL = '₹';
export const CURRENCY_LOCALE = 'en-IN';

/**
 * Formats a given monetary value into Indian Rupee format with standard 2 decimal places.
 * Example: 1499.00 -> ₹1,499.00, 149999.00 -> ₹1,49,999.00
 *
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted INR currency string, or empty string if input is invalid/empty
 */
export const formatINR = (amount) => {
  if (amount === undefined || amount === null || amount === '') {
    return '';
  }

  const num = Number(amount);
  if (isNaN(num)) {
    return '';
  }

  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: 'currency',
    currency: CURRENCY_CODE,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Formats a given monetary value in Indian number grouping without the currency symbol.
 * Example: 149999.00 -> 1,49,999.00
 *
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted number string in en-IN format
 */
export const formatINRWithoutSymbol = (amount) => {
  if (amount === undefined || amount === null || amount === '') {
    return '';
  }

  const num = Number(amount);
  if (isNaN(num)) {
    return '';
  }

  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export default formatINR;
