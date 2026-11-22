import axios from 'axios';
import { parseApiError, logError } from '../utils/errorHandler';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Access Token if available
api.interceptors.request.use(
  (config) => {
    const publicEndpoints = [
      '/admin/login/',
      '/auth/admin/login/',
      '/auth/login/',
      '/auth/register/',
      '/auth/signup/',
      '/auth/verify-email/',
      '/auth/verify-otp/',
      '/auth/otp-status/',
      '/auth/resend-otp/',
      '/auth/forgot-password/',
      '/auth/reset-password/',
      '/auth/google/',
      '/auth/google/config/'
    ];

    const isPublic = publicEndpoints.some((ep) => config.url && config.url.includes(ep));

    if (!isPublic) {
      const token = localStorage.getItem('deport_access_token') || localStorage.getItem('luxora_access_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } else {
      delete config.headers['Authorization'];
    }
    return config;
  },
  (error) => {
    const parsed = parseApiError(error);
    error.userMessage = parsed.message;
    error.fieldErrors = parsed.fieldErrors;
    error.parsed = parsed;
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401, Refresh Token & Centralized Error Parsing
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and request hasn't been retried yet
    if (error.response && error.response.status === 401 && originalRequest && !originalRequest._retry) {
      const authEndpoints = ['/login/', '/register/', '/signup/', '/verify-email/', '/verify-otp/', '/resend-otp/', '/admin/login/'];
      const isAuthEndpoint = authEndpoints.some((ep) => originalRequest.url && originalRequest.url.includes(ep));

      if (!isAuthEndpoint) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = localStorage.getItem('deport_refresh_token') || localStorage.getItem('luxora_refresh_token');

        if (!refreshToken) {
          isRefreshing = false;
          localStorage.removeItem('deport_access_token');
          localStorage.removeItem('deport_refresh_token');
          localStorage.removeItem('luxora_access_token');
          localStorage.removeItem('luxora_refresh_token');

          const parsed = parseApiError(error, 'Your session has expired. Please log in again.');
          error.userMessage = parsed.message;
          error.fieldErrors = parsed.fieldErrors;
          error.parsed = parsed;
          return Promise.reject(error);
        }

        try {
          const response = await axios.post(`${API_URL}/auth/refresh/`, {
            refresh: refreshToken,
          }, { timeout: 10000 });

          const newAccessToken = response.data.access;
          const newRefreshToken = response.data.refresh || refreshToken;

          localStorage.setItem('deport_access_token', newAccessToken);
          localStorage.setItem('deport_refresh_token', newRefreshToken);
          localStorage.removeItem('luxora_access_token');
          localStorage.removeItem('luxora_refresh_token');

          api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

          processQueue(null, newAccessToken);
          isRefreshing = false;

          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          isRefreshing = false;
          localStorage.removeItem('deport_access_token');
          localStorage.removeItem('deport_refresh_token');
          localStorage.removeItem('luxora_access_token');
          localStorage.removeItem('luxora_refresh_token');
          window.dispatchEvent(new Event('deport_auth_logout'));
          window.dispatchEvent(new Event('luxora_auth_logout'));

          const parsedRefresh = parseApiError(refreshError, 'Your session has expired. Please log in again.');
          refreshError.userMessage = parsedRefresh.message;
          refreshError.fieldErrors = parsedRefresh.fieldErrors;
          refreshError.parsed = parsedRefresh;
          return Promise.reject(refreshError);
        }
      }
    }

    // Attach parsed error details to rejected error
    const parsed = parseApiError(error);
    error.userMessage = parsed.message;
    error.fieldErrors = parsed.fieldErrors;
    error.parsed = parsed;

    // Secure logging in development
    logError(originalRequest?.url || 'API Request', error);

    return Promise.reject(error);
  }
);

export default api;
