from rest_framework import serializers
from .models import Order, OrderItem, Coupon, CouponUsage, Payment


class CouponSerializer(serializers.ModelSerializer):
    min_purchase_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, write_only=True)
    end_date = serializers.DateTimeField(required=False, write_only=True, allow_null=True)
    user_limit = serializers.IntegerField(required=False, write_only=True)

    class Meta:
        model = Coupon
        fields = (
            'id', 'code', 'discount_type', 'discount_value',
            'min_order_amount', 'min_purchase_amount', 'max_discount_amount',
            'start_date', 'expiration_date', 'end_date', 'usage_limit', 'used_count',
            'per_user_limit', 'user_limit', 'is_active', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'used_count', 'created_at', 'updated_at')

    def to_internal_value(self, data):
        ret = super().to_internal_value(data)
        if 'min_purchase_amount' in ret and 'min_order_amount' not in ret:
            ret['min_order_amount'] = ret.pop('min_purchase_amount')
        elif 'min_purchase_amount' in ret:
            ret.pop('min_purchase_amount')

        if 'end_date' in ret and 'expiration_date' not in ret:
            ret['expiration_date'] = ret.pop('end_date')
        elif 'end_date' in ret:
            ret.pop('end_date')

        if 'user_limit' in ret and 'per_user_limit' not in ret:
            ret['per_user_limit'] = ret.pop('user_limit')
        elif 'user_limit' in ret:
            ret.pop('user_limit')

        return ret

    def validate_code(self, value):
        val = value.strip().upper()
        if not val:
            raise serializers.ValidationError('Coupon code cannot be empty.')
        return val

    def validate_discount_value(self, value):
        if value <= 0:
            raise serializers.ValidationError('Discount value must be greater than zero.')
        return value

    def validate_min_order_amount(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Minimum order amount cannot be negative.')
        return value

    def validate_max_discount_amount(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError('Maximum discount amount must be greater than zero.')
        return value

    def validate_usage_limit(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError('Total usage limit must be at least 1.')
        return value

    def validate_per_user_limit(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError('Per-user usage limit must be at least 1.')
        return value

    def validate(self, attrs):
        discount_type = attrs.get('discount_type') or (self.instance.discount_type if self.instance else 'percentage')
        discount_value = attrs.get('discount_value') or (self.instance.discount_value if self.instance else 0)

        if discount_type == 'percentage' and (discount_value <= 0 or discount_value > 100):
            raise serializers.ValidationError({'discount_value': 'Percentage discount must be between 1 and 100%.'})
        elif discount_type == 'fixed' and discount_value <= 0:
            raise serializers.ValidationError({'discount_value': 'Fixed discount must be greater than 0.'})

        start = attrs.get('start_date') or (self.instance.start_date if self.instance else None)
        expiration = attrs.get('expiration_date') or (self.instance.expiration_date if self.instance else None)
        if start and expiration and start > expiration:
            raise serializers.ValidationError({'expiration_date': 'Expiration date must be after start date.'})

        return attrs


class CouponValidateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0.00)


class PaymentSerializer(serializers.ModelSerializer):
    razorpay_order_id = serializers.CharField(source='gateway_order_id', read_only=True)
    razorpay_payment_id = serializers.CharField(source='transaction_id', read_only=True)
    razorpay_signature = serializers.CharField(source='gateway_signature', read_only=True)

    class Meta:
        model = Payment
        fields = (
            'id', 'order', 'user', 'payment_method', 'amount',
            'currency', 'status', 'transaction_id', 'gateway_order_id',
            'gateway_signature', 'razorpay_order_id', 'razorpay_payment_id',
            'razorpay_signature', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'created_at', 'updated_at')


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = (
            'id', 'order', 'product', 'product_name', 'product_sku',
            'product_image', 'quantity', 'unit_price', 'total_price',
            'is_cancelled', 'cancellation_reason', 'created_at'
        )


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    user_email = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    latest_payment = serializers.SerializerMethodField()
    currency = serializers.CharField(default='INR', read_only=True)
    currency_symbol = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            'id', 'order_number', 'user', 'user_email', 'user_name',
            'status', 'status_display', 'payment_method', 'coupon', 'coupon_code',
            'subtotal', 'tax', 'shipping_cost', 'discount', 'total',
            'currency', 'currency_symbol',
            'shipping_full_name', 'shipping_phone', 'shipping_address_line_1',
            'shipping_address_line_2', 'shipping_city', 'shipping_state',
            'shipping_postal_code', 'shipping_country',
            'cancellation_reason', 'cancelled_at',
            'return_reason', 'return_requested_at',
            'items', 'payments', 'payment_status', 'latest_payment',
            'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'order_number', 'coupon', 'created_at', 'updated_at')

    def get_currency_symbol(self, obj):
        return '₹'

    def get_user_email(self, obj):
        return obj.user.email if obj.user else 'Guest'

    def get_user_name(self, obj):
        if obj.user:
            name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return name or obj.user.email.split('@')[0]
        return obj.shipping_full_name

    def _get_latest_payment(self, obj):
        payments = list(obj.payments.all())
        if not payments:
            return None
        return sorted(payments, key=lambda p: p.created_at, reverse=True)[0]

    def get_payment_status(self, obj):
        latest = self._get_latest_payment(obj)
        if latest:
            return latest.status
        if obj.payment_method == 'Cash on Delivery':
            return 'completed' if obj.status == 'delivered' else 'pending'
        return 'pending'

    def get_latest_payment(self, obj):
        latest = self._get_latest_payment(obj)
        if latest:
            return PaymentSerializer(latest).data
        return None
