from decimal import Decimal
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Wallet, WalletTransaction

User = get_user_model()


class WalletTransactionSerializer(serializers.ModelSerializer):
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_credit = serializers.BooleanField(read_only=True)
    is_debit = serializers.BooleanField(read_only=True)
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WalletTransaction
        fields = (
            'id',
            'transaction_type',
            'transaction_type_display',
            'amount',
            'balance_after_transaction',
            'description',
            'reference_id',
            'status',
            'status_display',
            'is_credit',
            'is_debit',
            'performed_by',
            'performed_by_name',
            'created_at',
            'updated_at'
        )
        read_only_fields = fields

    def get_performed_by_name(self, obj):
        if obj.performed_by:
            name = f"{obj.performed_by.first_name} {obj.performed_by.last_name}".strip()
            return name or obj.performed_by.email
        return 'System'


class WalletSerializer(serializers.ModelSerializer):
    total_credited = serializers.SerializerMethodField()
    total_debited = serializers.SerializerMethodField()
    currency = serializers.CharField(default='INR', read_only=True)
    currency_symbol = serializers.CharField(default='₹', read_only=True)
    recent_transactions = serializers.SerializerMethodField()

    class Meta:
        model = Wallet
        fields = (
            'id',
            'balance',
            'currency',
            'currency_symbol',
            'total_credited',
            'total_debited',
            'recent_transactions',
            'created_at',
            'updated_at'
        )
        read_only_fields = fields

    def get_total_credited(self, obj):
        return str(obj.get_total_credited())

    def get_total_debited(self, obj):
        return str(obj.get_total_debited())

    def get_recent_transactions(self, obj):
        recent = obj.transactions.order_by('-created_at')[:5]
        return WalletTransactionSerializer(recent, many=True).data


class AdminWalletListSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_name = serializers.SerializerMethodField()
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_phone = serializers.CharField(source='user.phone', read_only=True)
    total_credited = serializers.SerializerMethodField()
    total_debited = serializers.SerializerMethodField()
    transaction_count = serializers.SerializerMethodField()
    last_transaction_at = serializers.SerializerMethodField()

    class Meta:
        model = Wallet
        fields = (
            'id',
            'user_id',
            'user_name',
            'user_email',
            'user_phone',
            'balance',
            'total_credited',
            'total_debited',
            'transaction_count',
            'last_transaction_at',
            'created_at',
            'updated_at'
        )
        read_only_fields = fields

    def get_user_name(self, obj):
        if obj.user:
            name = f"{obj.user.first_name} {obj.user.last_name}".strip()
            return name or obj.user.email.split('@')[0]
        return 'Guest / Deleted'

    def get_total_credited(self, obj):
        return str(obj.get_total_credited())

    def get_total_debited(self, obj):
        return str(obj.get_total_debited())

    def get_transaction_count(self, obj):
        return obj.transactions.count()

    def get_last_transaction_at(self, obj):
        last = obj.transactions.order_by('-created_at').first()
        return last.created_at if last else None


class AdminWalletActionSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal('0.01'),
        required=True,
        error_messages={
            'required': 'Please specify an amount.',
            'min_value': 'Amount must be greater than zero.',
            'invalid': 'Please enter a valid numeric currency amount.'
        }
    )
    reason = serializers.CharField(
        required=True,
        min_length=3,
        max_length=255,
        error_messages={
            'required': 'A reason is required for administrative wallet adjustments.',
            'blank': 'Reason cannot be blank.',
            'min_length': 'Reason must be at least 3 characters.'
        }
    )
    reference_id = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=100
    )

