from django.contrib import admin
from .models import Order, OrderItem, Coupon, CouponUsage, Payment


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('created_at',)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'user', 'status', 'total', 'currency', 'created_at')
    list_filter = ('status', 'currency', 'created_at')
    search_fields = ('order_number', 'user__email', 'shipping_full_name')
    readonly_fields = ('order_number', 'created_at', 'updated_at')
    inlines = [OrderItemInline]


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_type', 'discount_value', 'min_order_amount', 'used_count', 'is_active', 'created_at')
    list_filter = ('discount_type', 'is_active')
    search_fields = ('code',)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'payment_method', 'amount', 'currency', 'status', 'created_at')
    list_filter = ('payment_method', 'currency', 'status')
    search_fields = ('transaction_id', 'gateway_order_id', 'order__order_number')

