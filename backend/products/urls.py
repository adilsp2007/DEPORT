from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, BannerViewSet

app_name = 'products'

router = DefaultRouter()
router.register(r'banners', BannerViewSet, basename='banner')
router.register(r'', ProductViewSet, basename='product')

urlpatterns = [
    path('', include(router.urls)),
]
