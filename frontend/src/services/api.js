import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Access Token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('deport_access_token') || localStorage.getItem('luxora_access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 & Refresh Token
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
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (originalRequest.url.includes('/auth/login/') || originalRequest.url.includes('/auth/register/')) {
        return Promise.reject(error);
      }

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
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh/`, {
          refresh: refreshToken,
        });

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
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
