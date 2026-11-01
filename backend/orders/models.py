import uuid
import datetime
from django.db import models
from django.conf import settings
from products.models import Product


def generate_order_number():
    date_str = datetime.date.today().strftime('%Y%m%d')
    short_uuid = uuid.uuid4().hex[:5].upper()
    return f"LUX-{date_str}-{short_uuid}"


class Coupon(models.Model):
    DISCOUNT_TYPE_CHOICES = (
        ('percentage', 'Percentage Discount (%)'),
        ('fixed', 'Fixed Amount Discount (₹)'),
    )

    code = models.CharField(max_length=50, unique=True, db_index=True)
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES, default='percentage')
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    min_order_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    max_discount_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    start_date = models.DateTimeField(null=True, blank=True)
    expiration_date = models.DateTimeField(null=True, blank=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True, help_text="Total maximum redemptions across all users")
    per_user_limit = models.PositiveIntegerField(default=1, help_text="Maximum redemptions per user")
    used_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Coupon'
        verbose_name_plural = 'Coupons'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} ({self.discount_value}{'%' if self.discount_type == 'percentage' else '₹'})"

    def clean(self):
        from django.core.exceptions import ValidationError
        from decimal import Decimal
        if self.code:
            self.code = self.code.strip().upper()
        if self.discount_value is not None:
            if Decimal(str(self.discount_value)) <= Decimal('0.00'):
                raise ValidationError({'discount_value': 'Discount value must be greater than zero.'})
            if self.discount_type == 'percentage' and Decimal(str(self.discount_value)) > Decimal('100.00'):
                raise ValidationError({'discount_value': 'Percentage discount cannot exceed 100%.'})
        if self.min_order_amount is not None and Decimal(str(self.min_order_amount)) < Decimal('0.00'):
            raise ValidationError({'min_order_amount': 'Minimum order amount cannot be negative.'})
        if self.max_discount_amount is not None and Decimal(str(self.max_discount_amount)) <= Decimal('0.00'):
            raise ValidationError({'max_discount_amount': 'Maximum discount amount must be greater than zero.'})
        if self.start_date and self.expiration_date and self.start_date > self.expiration_date:
            raise ValidationError({'expiration_date': 'Expiration date must be after start date.'})
        if self.usage_limit is not None and self.usage_limit <= 0:
            raise ValidationError({'usage_limit': 'Total usage limit must be at least 1.'})
        if self.per_user_limit is not None and self.per_user_limit <= 0:
            raise ValidationError({'per_user_limit': 'Per-user limit must be at least 1.'})

    def save(self, *args, **kwargs):
        if self.code:
            self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def is_valid_for_cart(self, user, subtotal):
        from django.utils import timezone
        from decimal import Decimal
        now = timezone.now()
        subtotal_dec = Decimal(str(subtotal or '0.00'))

        if not self.is_active:
            return False, "This promo code is currently inactive."
        if self.discount_value is None or Decimal(str(self.discount_value)) <= Decimal('0.00'):
            return False, "This coupon has an invalid discount value."
        if self.discount_type == 'percentage' and Decimal(str(self.discount_value)) > Decimal('100.00'):
            return False, "Percentage discount cannot exceed 100%."
        if self.start_date and now < self.start_date:
            return False, "This promo code is not active yet."
        if self.expiration_date and now > self.expiration_date:
            return False, "This promo code has expired."
        actual_used = max(self.used_count, self.usages.count())
        if self.usage_limit is not None and actual_used >= self.usage_limit:
            return False, "This promo code has reached its maximum global usage limit."
        if subtotal_dec <= Decimal('0.00'):
            return False, "Eligible order subtotal must be greater than zero."
        if self.min_order_amount and subtotal_dec < Decimal(str(self.min_order_amount)):
            return False, f"Minimum order subtotal of ₹{float(self.min_order_amount):,.2f} is required for this code."
        if user and user.is_authenticated:
            user_uses = CouponUsage.objects.filter(coupon=self, user=user).count()
            if self.per_user_limit and user_uses >= self.per_user_limit:
                return False, f"You have already redeemed this promo code the maximum allowed number of times ({self.per_user_limit})."
        return True, "Coupon is valid."

    def calculate_discount(self, subtotal):
        from decimal import Decimal
        subtotal_dec = Decimal(str(subtotal or '0.00'))
        if subtotal_dec <= Decimal('0.00'):
            return Decimal('0.00')

        if self.discount_type == 'percentage':
            disc = (subtotal_dec * (Decimal(str(self.discount_value)) / Decimal('100.00'))).quantize(Decimal('0.01'))
            if self.max_discount_amount and disc > Decimal(str(self.max_discount_amount)):
                disc = Decimal(str(self.max_discount_amount))
        else:
            disc = min(Decimal(str(self.discount_value)), subtotal_dec)
            if self.max_discount_amount and disc > Decimal(str(self.max_discount_amount)):
                disc = Decimal(str(self.max_discount_amount))

        disc = max(Decimal('0.00'), disc)
        return min(disc, subtotal_dec)


class Order(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('processing', 'Processing'),
        ('shipped', 'Shipped'),
        ('out_for_delivery', 'Out for Delivery'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
        ('return_requested', 'Return Requested'),
        ('returned', 'Returned'),
    )

    order_number = models.CharField(max_length=50, unique=True, default=generate_order_number, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending', db_index=True)
    payment_method = models.CharField(max_length=50, default='Cash on Delivery')
    coupon = models.ForeignKey(Coupon, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    coupon_code = models.CharField(max_length=50, blank=True)
    
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    shipping_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='INR')

    shipping_full_name = models.CharField(max_length=200)
    shipping_phone = models.CharField(max_length=30)
    shipping_address_line_1 = models.CharField(max_length=255)
    shipping_address_line_2 = models.CharField(max_length=255, blank=True)
    shipping_city = models.CharField(max_length=100)
    shipping_state = models.CharField(max_length=100)
    shipping_postal_code = models.CharField(max_length=20)
    shipping_country = models.CharField(max_length=100, default='India')

    cancellation_reason = models.TextField(blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    return_reason = models.TextField(blank=True)
    return_requested_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Order'
        verbose_name_plural = 'Orders'
        ordering = ['-created_at']

    def __str__(self):
        return f"Order {self.order_number} ({self.get_status_display()})"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    product_name = models.CharField(max_length=255)
    product_sku = models.CharField(max_length=100)
    product_image = models.CharField(max_length=500, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    is_cancelled = models.BooleanField(default=False)
    cancellation_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Order Item'
        verbose_name_plural = 'Order Items'

    def __str__(self):
        return f"{self.quantity} x {self.product_name} in {self.order.order_number}"


class CouponUsage(models.Model):
    coupon = models.ForeignKey(Coupon, on_delete=models.CASCADE, related_name='usages')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='coupon_usages')
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='coupon_usages', null=True, blank=True)
    discount_applied = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Coupon Usage'
        verbose_name_plural = 'Coupon Usages'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} used {self.coupon.code} (Saved ₹{self.discount_applied})"


class Payment(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
        ('cancelled', 'Cancelled'),
    )

    METHOD_CHOICES = (
        ('Cash on Delivery', 'Cash on Delivery (COD)'),
        ('Razorpay', 'Razorpay'),
        ('Stripe', 'Stripe'),
        ('Credit Card', 'Credit / Debit Card'),
        ('Sandbox', 'Sandbox Test Gateway'),
    )

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payments')
    payment_method = models.CharField(max_length=50, choices=METHOD_CHOICES, default='Cash on Delivery')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='INR')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending', db_index=True)
    transaction_id = models.CharField(max_length=150, blank=True, db_index=True)
    gateway_order_id = models.CharField(max_length=150, blank=True, db_index=True)
    gateway_signature = models.CharField(max_length=255, blank=True)
    idempotency_key = models.CharField(max_length=100, blank=True, null=True, unique=True, db_index=True)
    provider_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'
        ordering = ['-created_at']

    def __str__(self):
        return f"Payment {self.transaction_id or self.id} ({self.status}) for Order {self.order.order_number}"

    @property
    def razorpay_order_id(self):
        return self.gateway_order_id or ''

    @property
    def razorpay_payment_id(self):
        return self.transaction_id or ''

    @property
    def razorpay_signature(self):
        return self.gateway_signature or ''


class ProcessedWebhookEvent(models.Model):
    """
    Tracks successfully processed Razorpay webhook event IDs to guarantee idempotency.
    Prevents replay attacks, duplicate fulfillment, and out-of-order execution.
    """
    event_id = models.CharField(max_length=150, unique=True, db_index=True)
    event_type = models.CharField(max_length=100, db_index=True)
    payload_summary = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Processed Webhook Event'
        verbose_name_plural = 'Processed Webhook Events'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.event_type} ({self.event_id})"
