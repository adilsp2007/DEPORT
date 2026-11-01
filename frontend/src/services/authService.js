import api from './api';

const setTokens = (access, refresh) => {
  if (access) {
    localStorage.setItem('deport_access_token', access);
    localStorage.removeItem('luxora_access_token');
  }
  if (refresh) {
    localStorage.setItem('deport_refresh_token', refresh);
    localStorage.removeItem('luxora_refresh_token');
  }
};

const clearTokens = () => {
  localStorage.removeItem('deport_access_token');
  localStorage.removeItem('deport_refresh_token');
  localStorage.removeItem('luxora_access_token');
  localStorage.removeItem('luxora_refresh_token');
};

const getRefreshToken = () => {
  return localStorage.getItem('deport_refresh_token') || localStorage.getItem('luxora_refresh_token');
};

export const authService = {
  async register(data) {
    const response = await api.post('/auth/register/', data);
    return response.data;
  },

  async verifyEmail(email, code) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = String(code || '').trim();
    const response = await api.post('/auth/verify-email/', {
      email: cleanEmail,
      code: cleanCode,
      otp: cleanCode
    });
    if (response.data.access) {
      setTokens(response.data.access, response.data.refresh);
    }
    return response.data;
  },

  async resendOTP(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const response = await api.post('/auth/resend-otp/', { email: cleanEmail });
    return response.data;
  },

  async getOTPStatus(email) {
    const response = await api.get(`/auth/otp-status/?email=${encodeURIComponent(email)}`);
    return response.data;
  },

  async login(credentials) {
    const response = await api.post('/auth/login/', credentials);
    if (response.data.access) {
      setTokens(response.data.access, response.data.refresh);
    }
    return response.data;
  },

  async adminLogin(credentials) {
    const response = await api.post('/admin/login/', credentials);
    if (response.data.access) {
      setTokens(response.data.access, response.data.refresh);
    }
    return response.data;
  },

  async loginWithGoogle(googleData) {
    const response = await api.post('/auth/google/', googleData);
    if (response.data.access) {
      setTokens(response.data.access, response.data.refresh);
    }
    return response.data;
  },

  async getGoogleConfig() {
    const response = await api.get('/auth/google/config/');
    return response.data;
  },

  async logout() {
    const refresh = getRefreshToken();
    try {
      if (refresh) {
        await api.post('/auth/logout/', { refresh });
      }
    } catch (e) {
      // Ignore network errors during logout
    } finally {
      clearTokens();
    }
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me/');
    return response.data;
  },

  async verifyTwoFactor(email, code) {
    const response = await api.post('/auth/two-factor/verify/', { email, code });
    if (response.data.access) {
      setTokens(response.data.access, response.data.refresh);
    }
    return response.data;
  },

  async toggleTwoFactor(is_two_factor_enabled) {
    const response = await api.post('/auth/two-factor/toggle/', { is_two_factor_enabled });
    return response.data;
  },

  async forgotPassword(email) {
    const response = await api.post('/auth/forgot-password/', { email });
    return response.data;
  },

  async resetPassword(data) {
    const response = await api.post('/auth/reset-password/', data);
    return response.data;
  },

  async requestEmailChange(new_email) {
    const response = await api.post('/auth/email-change/request/', { new_email });
    return response.data;
  },

  async verifyEmailChange(code) {
    const response = await api.post('/auth/email-change/verify/', { code });
    return response.data;
  },

  async refreshToken() {
    const refresh = getRefreshToken();
    if (!refresh) throw new Error('No refresh token');
    const response = await api.post('/auth/refresh/', { refresh });
    if (response.data.access) {
      setTokens(response.data.access, response.data.refresh);
    }
    return response.data;
  }
};

export default authService;
