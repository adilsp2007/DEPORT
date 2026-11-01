import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from '../components/AuthLoadingScreen';

export const AdminRoute = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!user.is_staff && !user.is_superuser) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
