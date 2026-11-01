from decimal import Decimal
from rest_framework import serializers
from .models import Cart, CartItem
from products.serializers import ProductListSerializer

MAX_ITEM_QUANTITY = 10


class CartItemSerializer(serializers.ModelSerializer):
    product_detail = ProductListSerializer(source='product', read_only=True)
    item_total = serializers.SerializerMethodField()
    is_in_stock = serializers.SerializerMethodField()
    has_sufficient_stock = serializers.SerializerMethodField()
    max_allowed_quantity = serializers.SerializerMethodField()

    class Meta:
        model = CartItem
        fields = (
            'id', 'cart', 'product', 'product_detail', 'quantity',
            'item_total', 'is_in_stock', 'has_sufficient_stock',
            'max_allowed_quantity', 'created_at', 'updated_at'
        )

    def get_item_total(self, obj):
        dec_price = Decimal(str(obj.product.price))
        return float((dec_price * Decimal(str(obj.quantity))).quantize(Decimal('0.01')))

    def get_is_in_stock(self, obj):
        p = obj.product
        cat_active = (not p.category) or (p.category.is_active and not p.category.is_deleted)
        return p.stock_quantity > 0 and p.is_active and not p.is_deleted and cat_active

    def get_has_sufficient_stock(self, obj):
        p = obj.product
        cat_active = (not p.category) or (p.category.is_active and not p.category.is_deleted)
        return p.stock_quantity >= obj.quantity and p.is_active and not p.is_deleted and cat_active

    def get_max_allowed_quantity(self, obj):
        return min(max(obj.product.stock_quantity, 0), MAX_ITEM_QUANTITY)


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    subtotal = serializers.SerializerMethodField()
    total_items = serializers.SerializerMethodField()
    can_checkout = serializers.SerializerMethodField()
    checkout_block_reason = serializers.SerializerMethodField()
    currency = serializers.CharField(default='INR', read_only=True)
    currency_symbol = serializers.CharField(default='₹', read_only=True)

    class Meta:
        model = Cart
        fields = (
            'id', 'user', 'items', 'subtotal', 'total_items',
            'currency', 'currency_symbol',
            'can_checkout', 'checkout_block_reason', 'created_at', 'updated_at'
        )

    def get_subtotal(self, obj):
        items = list(obj.items.select_related('product'))
        if not items:
            return 0.00
        total = sum(Decimal(str(i.product.price)) * Decimal(str(i.quantity)) for i in items)
        return float(total.quantize(Decimal('0.01')))

    def get_total_items(self, obj):
        return sum(i.quantity for i in obj.items.all())

    def get_can_checkout(self, obj):
        items = list(obj.items.select_related('product', 'product__category'))
        if not items:
            return False
        for item in items:
            p = item.product
            cat_active = (not p.category) or (p.category.is_active and not p.category.is_deleted)
            if p.stock_quantity < item.quantity or not p.is_active or p.is_deleted or not cat_active:
                return False
        return True

    def get_checkout_block_reason(self, obj):
        items = list(obj.items.select_related('product', 'product__category'))
        if not items:
            return "Your shopping bag is empty."
        for item in items:
            p = item.product
            cat_active = (not p.category) or (p.category.is_active and not p.category.is_deleted)
            if not p.is_active or p.is_deleted or not cat_active:
                return f'"{p.name}" is no longer available or unlisted.'
            if p.stock_quantity == 0:
                return f'"{p.name}" is currently out of stock.'
            if p.stock_quantity < item.quantity:
                return f'"{p.name}" only has {p.stock_quantity} item(s) in stock, but you requested {item.quantity}.'
        return None
