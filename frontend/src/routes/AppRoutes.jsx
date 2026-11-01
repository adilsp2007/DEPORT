import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import HomePage from '../pages/HomePage';
import ShopPage from '../pages/ShopPage';
import ProductDetailsPage from '../pages/ProductDetailsPage';
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import VerifyPage from '../pages/VerifyPage';
import ProfilePage from '../pages/ProfilePage';
import EditProfilePage from '../pages/EditProfilePage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import AddressesPage from '../pages/AddressesPage';
import CartPage from '../pages/CartPage';
import WishlistPage from '../pages/WishlistPage';
import CheckoutPage from '../pages/CheckoutPage';
import OrderSuccessPage from '../pages/OrderSuccessPage';
import OrdersPage from '../pages/OrdersPage';
import OrderDetailPage from '../pages/OrderDetailPage';
import GoogleCallbackPage from '../pages/GoogleCallbackPage';
import AdminLayout from '../layouts/AdminLayout';
import AdminLoginPage from '../pages/admin/AdminLoginPage';
import AdminDashboardPage from '../pages/admin/AdminDashboardPage';
import AdminUsersPage from '../pages/admin/AdminUsersPage';
import AdminProductsPage from '../pages/admin/AdminProductsPage';
import AdminInventoryPage from '../pages/admin/AdminInventoryPage';
import AdminCategoriesPage from '../pages/admin/AdminCategoriesPage';
import AdminOrdersPage from '../pages/admin/AdminOrdersPage';
import AdminCouponsPage from '../pages/admin/AdminCouponsPage';
import AdminBannersPage from '../pages/admin/AdminBannersPage';
import AdminSettingsPlaceholderPage from '../pages/admin/AdminSettingsPlaceholderPage';
import AdminRoute from './AdminRoute';
import ProtectedRoute from './ProtectedRoute';
import PublicOnlyRoute from './PublicOnlyRoute';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Admin Standalone Routes */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/products" element={<AdminProductsPage />} />
          <Route path="/admin/inventory" element={<AdminInventoryPage />} />
          <Route path="/admin/categories" element={<AdminCategoriesPage />} />
          <Route path="/admin/orders" element={<AdminOrdersPage />} />
          <Route path="/admin/coupons" element={<AdminCouponsPage />} />
          <Route path="/admin/banners" element={<AdminBannersPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPlaceholderPage />} />
        </Route>
      </Route>

      {/* Customer Storefront Routes */}
      <Route path="/" element={<MainLayout />}>
        {/* Public Routes */}
        <Route index element={<HomePage />} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="product/:slug" element={<ProductDetailsPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="auth/google/callback" element={<GoogleCallbackPage />} />

        {/* Verification & Registration Routes */}
        <Route path="verify-email" element={<VerifyPage />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="verify-otp" element={<VerifyPage />} />
        <Route path="verification" element={<VerifyPage />} />
        <Route path="signup-verification" element={<VerifyPage />} />
        <Route path="signup" element={<SignupPage />} />

        {/* Guest Only Routes */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/edit" element={<EditProfilePage />} />
          <Route path="addresses" element={<AddressesPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="order-success/:orderId" element={<OrderSuccessPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:orderId" element={<OrderDetailPage />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
