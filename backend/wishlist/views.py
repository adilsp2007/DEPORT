from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Wishlist
from .serializers import WishlistSerializer
from products.models import Product


class WishlistViewSet(viewsets.GenericViewSet):
    """
    ViewSet for managing customer wishlists.
    All operations are strictly scoped to request.user.
    Endpoints:
      GET    /api/wishlist/
      POST   /api/wishlist/
      DELETE /api/wishlist/<product_id>/
      POST   /api/wishlist/<product_id>/toggle/
      GET    /api/wishlist/count/
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WishlistSerializer

    def get_queryset(self):
        return Wishlist.objects.filter(
            user=self.request.user,
            product__is_active=True
        ).select_related('product', 'product__category').prefetch_related('product__images')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        product_id = request.data.get('product_id') or request.data.get('product')
        if not product_id:
            return Response({'detail': 'product_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        product = get_object_or_404(Product, pk=product_id, is_active=True)
        wishlist_item, created = Wishlist.objects.get_or_create(
            user=request.user,
            product=product
        )
        serializer = self.get_serializer(wishlist_item)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=status_code)

    def destroy(self, request, pk=None, *args, **kwargs):
        """
        DELETE /api/wishlist/<product_id>/
        Deletes the wishlist item matching request.user and product_id (pk).
        """
        wishlist_item = Wishlist.objects.filter(user=request.user, product_id=pk).first()
        if wishlist_item:
            wishlist_item.delete()
        count = self.get_queryset().count()
        return Response({'message': 'Removed from wishlist.', 'count': count}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='toggle')
    def toggle(self, request, pk=None):
        """
        POST /api/wishlist/<product_id>/toggle/
        Toggles product in request.user's wishlist.
        Returns {"wishlisted": boolean, "count": number}.
        """
        product = get_object_or_404(Product, pk=pk, is_active=True)
        existing = Wishlist.objects.filter(user=request.user, product=product).first()

        if existing:
            existing.delete()
            wishlisted = False
        else:
            Wishlist.objects.create(user=request.user, product=product)
            wishlisted = True

        count = self.get_queryset().count()
        return Response({
            'wishlisted': wishlisted,
            'count': count,
            'message': 'Added to wishlist.' if wishlisted else 'Removed from wishlist.'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='count')
    def count(self, request):
        """
        GET /api/wishlist/count/
        Returns {"count": number}.
        """
        count = self.get_queryset().count()
        return Response({'count': count}, status=status.HTTP_200_OK)
