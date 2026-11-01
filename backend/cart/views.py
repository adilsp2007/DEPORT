from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Cart, CartItem
from .serializers import CartSerializer, CartItemSerializer, MAX_ITEM_QUANTITY
from products.models import Product
from wishlist.models import Wishlist


class CartViewSet(viewsets.GenericViewSet):
    """
    Customer Cart ViewSet:
    - Add to cart, remove products, list cart products
    - Prevent adding blocked/unlisted products
    - Increase the quantity if the product is already in the cart
    - Remove product from wishlist when added to cart
    - Increment/decrement quantity with stock validations
    - Maximum quantity limits
    - Disable out-of-stock products and restrict checkout
    
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CartSerializer

    def get_cart(self):
        cart, _ = Cart.objects.get_or_create(user=self.request.user)
        return cart

    def list(self, request, *args, **kwargs):
        """
        GET /api/cart/
        Retrieve current customer cart with items and checkout validations.
        """
        cart = self.get_cart()
        serializer = self.get_serializer(cart)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='add')
    def add_to_cart(self, request):
        """
        POST /api/cart/add/
        Add a product to cart or increase quantity if it already exists.
        Automatically removes product from wishlist.
        Validates unlisted status, stock availability, and maximum limits.
        """
        product_id = request.data.get('product_id') or request.data.get('product')
        quantity = int(request.data.get('quantity', 1))

        if not product_id:
            return Response({'detail': 'product_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if quantity < 1:
            return Response({'detail': 'Quantity must be at least 1.'}, status=status.HTTP_400_BAD_REQUEST)

        product = get_object_or_404(Product, pk=product_id)

        # 1. Prevent adding blocked / unlisted products
        if not product.is_active or product.is_deleted:
            return Response({
                'detail': f'"{product.name}" is currently unlisted or unavailable.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if product.category and (not product.category.is_active or product.category.is_deleted):
            return Response({
                'detail': f'Category for "{product.name}" is currently unlisted or inactive.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Check stock availability
        if product.stock_quantity <= 0:
            return Response({
                'detail': f'"{product.name}" is currently sold out / out of stock.'
            }, status=status.HTTP_400_BAD_REQUEST)

        cart = self.get_cart()
        cart_item = CartItem.objects.filter(cart=cart, product=product).first()
        current_quantity = cart_item.quantity if cart_item else 0
        new_quantity = current_quantity + quantity

        # 3. Maximum quantity limits
        if new_quantity > MAX_ITEM_QUANTITY:
            return Response({
                'detail': f'Maximum order limit is {MAX_ITEM_QUANTITY} units per customer. You currently have {current_quantity} in your cart.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Stock validation
        if new_quantity > product.stock_quantity:
            return Response({
                'detail': f'Insufficient stock: only {product.stock_quantity} available in stock. You currently have {current_quantity} in your cart.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if cart_item:
            cart_item.quantity = new_quantity
            cart_item.save()
        else:
            cart_item = CartItem.objects.create(
                cart=cart,
                product=product,
                quantity=new_quantity
            )

        # 5. Remove product from wishlist when added to cart
        removed_from_wishlist = False
        wishlist_deleted_count, _ = Wishlist.objects.filter(
            user=request.user,
            product=product
        ).delete()
        if wishlist_deleted_count > 0:
            removed_from_wishlist = True

        serializer = self.get_serializer(cart)
        return Response({
            'message': f'Added "{product.name}" to cart.',
            'removed_from_wishlist': removed_from_wishlist,
            'cart': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['patch', 'post'], url_path='update-quantity')
    def update_quantity(self, request):
        """
        PATCH /api/cart/update-quantity/
        Body: { "product_id": <id>, "quantity": <new_qty> } or { "item_id": <id>, "quantity": <new_qty> }
        Validates stock and maximum limits. If quantity <= 0, removes the item.
        """
        product_id = request.data.get('product_id')
        item_id = request.data.get('item_id')
        quantity = request.data.get('quantity')

        if quantity is None:
            return Response({'detail': 'quantity is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            quantity = int(quantity)
        except ValueError:
            return Response({'detail': 'Invalid quantity.'}, status=status.HTTP_400_BAD_REQUEST)

        cart = self.get_cart()

        if item_id:
            cart_item = get_object_or_404(CartItem, pk=item_id, cart=cart)
        elif product_id:
            cart_item = get_object_or_404(CartItem, product_id=product_id, cart=cart)
        else:
            return Response({'detail': 'product_id or item_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        if quantity <= 0:
            cart_item.delete()
            serializer = self.get_serializer(cart)
            return Response({
                'message': f'Removed "{cart_item.product.name}" from shopping bag.',
                'cart': serializer.data
            }, status=status.HTTP_200_OK)

        product = cart_item.product

        # Stock validations
        if quantity > product.stock_quantity:
            return Response({
                'detail': f'Cannot increase quantity: only {product.stock_quantity} available in stock.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Maximum quantity limits
        if quantity > MAX_ITEM_QUANTITY:
            return Response({
                'detail': f'Cannot exceed maximum limit of {MAX_ITEM_QUANTITY} units per item.'
            }, status=status.HTTP_400_BAD_REQUEST)

        cart_item.quantity = quantity
        cart_item.save()

        serializer = self.get_serializer(cart)
        return Response({
            'message': 'Cart updated successfully.',
            'cart': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['delete', 'post'], url_path='remove')
    def remove_item(self, request):
        """
        DELETE /api/cart/remove/
        Body: { "product_id": <id> } or { "item_id": <id> }
        """
        product_id = request.data.get('product_id')
        item_id = request.data.get('item_id')
        cart = self.get_cart()

        if item_id:
            CartItem.objects.filter(cart=cart, pk=item_id).delete()
        elif product_id:
            CartItem.objects.filter(cart=cart, product_id=product_id).delete()
        else:
            return Response({'detail': 'product_id or item_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(cart)
        return Response({
            'message': 'Item removed from shopping bag.',
            'cart': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='clear')
    def clear_cart(self, request):
        """
        POST /api/cart/clear/
        Clears all items in the user's cart.
        """
        cart = self.get_cart()
        cart.items.all().delete()
        serializer = self.get_serializer(cart)
        return Response({
            'message': 'Cart cleared.',
            'cart': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='validate')
    def validate_cart(self, request):
        """
        GET /api/cart/validate/
        Validates out-of-stock items and restricts checkout if any item is invalid.
        """
        cart = self.get_cart()
        serializer = self.get_serializer(cart)
        data = serializer.data
        return Response({
            'can_checkout': data.get('can_checkout'),
            'reason': data.get('checkout_block_reason'),
            'cart': data
        }, status=status.HTTP_200_OK)
