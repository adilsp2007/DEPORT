from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from .views import health_check
from categories.views import CategoryAdminViewSet
from products.views import ProductAdminViewSet, ProductImageAdminViewSet, BannerAdminViewSet
from orders.views import (
    AdminOrderListView, AdminOrderDetailView, AdminOrderUpdateStatusView,
    CouponAdminViewSet
)

admin_router = DefaultRouter()
admin_router.register(r'categories', CategoryAdminViewSet, basename='admin-categories')
admin_router.register(r'products', ProductAdminViewSet, basename='admin-products')
admin_router.register(r'product-images', ProductImageAdminViewSet, basename='admin-product-images')
admin_router.register(r'banners', BannerAdminViewSet, basename='admin-banners')
admin_router.register(r'coupons', CouponAdminViewSet, basename='admin-coupons')

from users.views import (
    AdminLoginView, AdminDashboardStatsView, AdminUserListView,
    AdminUserDetailView, AdminUserToggleBlockView
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='api-health'),
    path('api/auth/', include('users.urls')),
    path('api/users/', include('users.urls')),
    path('api/admin/login/', AdminLoginView.as_view(), name='admin_login_direct'),
    path('api/admin/stats/', AdminDashboardStatsView.as_view(), name='admin_stats_direct'),
    path('api/admin/dashboard/stats/', AdminDashboardStatsView.as_view(), name='admin_dashboard_stats_direct'),
    path('api/admin/users/', AdminUserListView.as_view(), name='admin_users_direct'),
    path('api/admin/users/<int:pk>/', AdminUserDetailView.as_view(), name='admin_user_detail_direct'),
    path('api/admin/users/<int:pk>/toggle-block/', AdminUserToggleBlockView.as_view(), name='admin_user_toggle_block_direct'),
    path('api/admin/orders/', AdminOrderListView.as_view(), name='admin_orders_direct'),
    path('api/admin/orders/<int:pk>/', AdminOrderDetailView.as_view(), name='admin_order_detail_direct'),
    path('api/admin/orders/<int:pk>/status/', AdminOrderUpdateStatusView.as_view(), name='admin_order_status_direct'),
    path('api/products/', include('products.urls')),
    path('api/categories/', include('categories.urls')),
    path('api/addresses/', include('addresses.urls')),
    path('api/cart/', include('cart.urls')),
    path('api/wishlist/', include('wishlist.urls')),
    path('api/orders/', include('orders.urls')),
    path('api/payments/', include('orders.payment_urls')),
    path('api/admin/', include(admin_router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
