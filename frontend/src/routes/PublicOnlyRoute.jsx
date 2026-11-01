import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from '../components/AuthLoadingScreen';

export const PublicOnlyRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/profile" replace />;
  }

  return <Outlet />;
};

export default PublicOnlyRoute;
