from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, VerifyEmailView, ResendOTPView, OTPStatusView, LoginView, AdminLoginView,
    AdminDashboardStatsView, AdminUserListView, AdminUserDetailView,
    AdminUserToggleBlockView, LogoutView, CurrentUserView, GoogleAuthView,
    GoogleConfigView, ChangePasswordView,
    TwoFactorVerifyView, ToggleTwoFactorView, ForgotPasswordRequestView,
    ForgotPasswordResetView, RequestEmailChangeView, VerifyEmailChangeView
)

urlpatterns = [
    path('signup/', RegisterView.as_view(), name='signup'),
    path('register/', RegisterView.as_view(), name='register'),
    path('verify-email/', VerifyEmailView.as_view(), name='verify_email'),
    path('verify-otp/', VerifyEmailView.as_view(), name='verify_otp'),
    path('otp-status/', OTPStatusView.as_view(), name='otp_status'),
    path('resend-otp/', ResendOTPView.as_view(), name='resend_otp'),
    path('login/', LoginView.as_view(), name='login'),
    path('admin/login/', AdminLoginView.as_view(), name='admin_login'),
    path('admin/stats/', AdminDashboardStatsView.as_view(), name='admin_stats'),
    path('admin/users/', AdminUserListView.as_view(), name='admin_user_list'),
    path('admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin_user_detail'),
    path('admin/users/<int:pk>/toggle-block/', AdminUserToggleBlockView.as_view(), name='admin_user_toggle_block'),
    path('google/', GoogleAuthView.as_view(), name='google_auth'),
    path('google/config/', GoogleConfigView.as_view(), name='google_config'),
    path('two-factor/verify/', TwoFactorVerifyView.as_view(), name='two_factor_verify'),
    path('two-factor/toggle/', ToggleTwoFactorView.as_view(), name='two_factor_toggle'),
    path('forgot-password/', ForgotPasswordRequestView.as_view(), name='forgot_password'),
    path('reset-password/', ForgotPasswordResetView.as_view(), name='reset_password'),
    path('email-change/request/', RequestEmailChangeView.as_view(), name='email_change_request'),
    path('email-change/verify/', VerifyEmailChangeView.as_view(), name='email_change_verify'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', CurrentUserView.as_view(), name='current_user'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
]

