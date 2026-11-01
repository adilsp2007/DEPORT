from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, CategoryAdminViewSet

app_name = 'categories'

router = DefaultRouter()
router.register(r'', CategoryViewSet, basename='category')

admin_router = DefaultRouter()
admin_router.register(r'', CategoryAdminViewSet, basename='admin-category')

urlpatterns = [
    path('', include(router.urls)),
]
