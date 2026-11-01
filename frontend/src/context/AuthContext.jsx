import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on app start
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('deport_access_token') || localStorage.getItem('luxora_access_token');
      if (token) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData);
        } catch (error) {
          localStorage.removeItem('deport_access_token');
          localStorage.removeItem('deport_refresh_token');
          localStorage.removeItem('luxora_access_token');
          localStorage.removeItem('luxora_refresh_token');
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();

    // Event listener for force logout triggered by API interceptor
    const handleLogoutEvent = () => {
      setUser(null);
    };

    window.addEventListener('deport_auth_logout', handleLogoutEvent);
    window.addEventListener('luxora_auth_logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('deport_auth_logout', handleLogoutEvent);
      window.removeEventListener('luxora_auth_logout', handleLogoutEvent);
    };
  }, []);

  const login = async (credentials) => {
    setIsLoading(true);
    try {
      const data = await authService.login(credentials);
      if (data.user) {
        setUser(data.user);
      }
      setIsLoading(false);
      return data;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const verifyTwoFactor = async (email, code) => {
    setIsLoading(true);
    try {
      const data = await authService.verifyTwoFactor(email, code);
      if (data.user) {
        setUser(data.user);
      }
      setIsLoading(false);
      return data;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const adminLogin = async (credentials) => {
    setIsLoading(true);
    try {
      const data = await authService.adminLogin(credentials);
      setUser(data.user);
      setIsLoading(false);
      return data;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const loginWithGoogle = async (googleData) => {
    setIsLoading(true);
    try {
      const data = await authService.loginWithGoogle(googleData);
      if (data.user) {
        setUser(data.user);
      }
      setIsLoading(false);
      return data;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };


  const register = async (userData) => {
    setIsLoading(true);
    try {
      const data = await authService.register(userData);
      setIsLoading(false);
      return data;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const verifyEmail = async (email, code) => {
    setIsLoading(true);
    try {
      const data = await authService.verifyEmail(email, code);
      if (data.user) {
        setUser(data.user);
      }
      setIsLoading(false);
      return data;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const resendOTP = async (email) => {
    try {
      const data = await authService.resendOTP(email);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const getOTPStatus = async (email) => {
    try {
      const data = await authService.getOTPStatus(email);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authService.getCurrentUser();
      setUser(userData);
      return userData;
    } catch (error) {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        adminLogin,
        loginWithGoogle,
        verifyTwoFactor,
        register,
        verifyEmail,
        resendOTP,
        getOTPStatus,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
