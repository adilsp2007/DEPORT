/**
 * DEPORT E-Commerce — Razorpay Standard Checkout Script Loader
 * Dynamically loads the official Razorpay Checkout SDK (https://checkout.razorpay.com/v1/checkout.js)
 * Features:
 * - Singleton promise caching to avoid duplicate script tags
 * - 15-second network timeout with descriptive error
 * - Safe detection of existing window.Razorpay instance
 */

let razorpayScriptPromise = null;

export const loadRazorpayScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay Checkout can only be loaded in a browser environment.'));
  }

  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay);
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise;
  }

  razorpayScriptPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists in DOM
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      if (window.Razorpay) {
        resolve(window.Razorpay);
        return;
      }
      existingScript.addEventListener('load', () => resolve(window.Razorpay));
      existingScript.addEventListener('error', () => {
        razorpayScriptPromise = null;
        reject(new Error('Failed to load Razorpay Checkout SDK.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      razorpayScriptPromise = null;
      script.remove();
      reject(new Error('Razorpay Checkout SDK script loading timed out. Please check your internet connection.'));
    }, 15000);

    script.onload = () => {
      clearTimeout(timeout);
      if (window.Razorpay) {
        resolve(window.Razorpay);
      } else {
        razorpayScriptPromise = null;
        reject(new Error('Razorpay SDK loaded, but window.Razorpay was not found.'));
      }
    };

    script.onerror = () => {
      clearTimeout(timeout);
      razorpayScriptPromise = null;
      script.remove();
      reject(new Error('Failed to load official Razorpay Checkout script. Check your network connection or ad-blocker.'));
    };

    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
};
