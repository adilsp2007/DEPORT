from django.contrib import admin
from .models import Wallet, WalletTransaction


class WalletTransactionInline(admin.TabularInline):
    model = WalletTransaction
    extra = 0
    readonly_fields = (
        'transaction_type', 'amount', 'balance_after_transaction',
        'description', 'reference_id', 'status', 'performed_by', 'created_at'
    )
    can_delete = False


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('id', 'user_email', 'user_full_name', 'balance', 'updated_at')
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'user__phone')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [WalletTransactionInline]

    def user_email(self, obj):
        return obj.user.email if obj.user else 'No User'
    user_email.short_description = 'User Email'

    def user_full_name(self, obj):
        return obj.user.full_name if obj.user else '—'
    user_full_name.short_description = 'Customer'


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
    list_display = (
        'reference_id', 'user_email', 'transaction_type', 'amount',
        'balance_after_transaction', 'status', 'created_at'
    )
    list_filter = ('transaction_type', 'status', 'created_at')
    search_fields = ('reference_id', 'description', 'wallet__user__email')
    readonly_fields = (
        'wallet', 'transaction_type', 'amount', 'balance_after_transaction',
        'description', 'reference_id', 'status', 'performed_by', 'created_at', 'updated_at'
    )

    def user_email(self, obj):
        return obj.wallet.user.email if obj.wallet and obj.wallet.user else '—'
    user_email.short_description = 'User Email'

