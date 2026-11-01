import api from './api';

export const userService = {
  async getMyProfile() {
    const response = await api.get('/users/me/');
    return response.data;
  },

  async updateMyProfile(profileData) {
    const isFormData = profileData instanceof FormData;
    const response = await api.patch('/users/me/', profileData, {
      headers: isFormData ? { 'Content-Type': undefined } : {}
    });
    return response.data;
  },

  async removeProfileImage() {
    const response = await api.patch('/users/me/', { remove_image: true });
    return response.data;
  },

  async changePassword(passwordData) {
    const response = await api.post('/users/change-password/', passwordData);
    return response.data;
  }
};

export default userService;
