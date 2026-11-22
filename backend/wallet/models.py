import uuid
from decimal import Decimal
from django.db import models, transaction
from django.conf import settings
from django.db.models import Q, Sum


class Wallet(models.Model):
    """
    User digital wallet model for storing customer store credits,
    refunds, and wallet payments.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='wallet'
    )
    balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User Wallet'
        verbose_name_plural = 'User Wallets'
        constraints = [
            models.CheckConstraint(
                check=Q(balance__gte=Decimal('0.00')),
                name='wallet_balance_non_negative'
            )
        ]

    def __str__(self):
        user_ident = self.user.email if self.user else 'Unknown'
        return f"Wallet ({user_ident}) - ₹{self.balance}"

    @classmethod
    def get_or_create_wallet(cls, user):
        """Safely retrieve or initialize a user's wallet."""
        wallet, _ = cls.objects.get_or_create(user=user)
        return wallet

    def can_debit(self, amount):
        """Check if sufficient funds exist for debit."""
        try:
            amt = Decimal(str(amount)).quantize(Decimal('0.01'))
            return amt > Decimal('0.00') and self.balance >= amt
        except Exception:
            return False

    def credit(self, amount, transaction_type='credit', description='', reference_id='', performed_by=None):
        """
        Atomically credits funds to the wallet with row-level locking.
        Generates an immutable WalletTransaction entry.
        """
        amt = Decimal(str(amount)).quantize(Decimal('0.01'))
        if amt <= Decimal('0.00'):
            raise ValueError("Credit amount must be strictly greater than zero.")

        with transaction.atomic():
            locked_wallet = Wallet.objects.select_for_update().get(pk=self.pk)
            locked_wallet.balance = (locked_wallet.balance + amt).quantize(Decimal('0.01'))
            locked_wallet.save(update_fields=['balance', 'updated_at'])

            tx_ref = reference_id or f"WAL-CR-{uuid.uuid4().hex[:10].upper()}"
            tx = WalletTransaction.objects.create(
                wallet=locked_wallet,
                transaction_type=transaction_type,
                amount=amt,
                balance_after_transaction=locked_wallet.balance,
                description=description or f"Wallet credited by ₹{amt}",
                reference_id=tx_ref,
                status='completed',
                performed_by=performed_by
            )
            self.balance = locked_wallet.balance
            return tx

    def debit(self, amount, transaction_type='debit', description='', reference_id='', performed_by=None):
        """
        Atomically debits funds from the wallet with row-level locking.
        Ensures balance never falls below zero.
        Generates an immutable WalletTransaction entry.
        """
        amt = Decimal(str(amount)).quantize(Decimal('0.01'))
        if amt <= Decimal('0.00'):
            raise ValueError("Debit amount must be strictly greater than zero.")

        with transaction.atomic():
            locked_wallet = Wallet.objects.select_for_update().get(pk=self.pk)
            if locked_wallet.balance < amt:
                raise ValueError(
                    f"Insufficient wallet balance. Available: ₹{locked_wallet.balance}, requested: ₹{amt}"
                )

            locked_wallet.balance = (locked_wallet.balance - amt).quantize(Decimal('0.01'))
            locked_wallet.save(update_fields=['balance', 'updated_at'])

            tx_ref = reference_id or f"WAL-DB-{uuid.uuid4().hex[:10].upper()}"
            tx = WalletTransaction.objects.create(
                wallet=locked_wallet,
                transaction_type=transaction_type,
                amount=amt,
                balance_after_transaction=locked_wallet.balance,
                description=description or f"Wallet debited by ₹{amt}",
                reference_id=tx_ref,
                status='completed',
                performed_by=performed_by
            )
            self.balance = locked_wallet.balance
            return tx

    def get_total_credited(self):
        """Sum of all completed incoming transactions."""
        credit_types = ['credit', 'cancellation_refund', 'return_refund', 'admin_credit']
        data = self.transactions.filter(
            transaction_type__in=credit_types,
            status='completed'
        ).aggregate(total=Sum('amount'))
        return data['total'] or Decimal('0.00')

    def get_total_debited(self):
        """Sum of all completed outgoing transactions."""
        debit_types = ['debit', 'order_payment', 'admin_debit']
        data = self.transactions.filter(
            transaction_type__in=debit_types,
            status='completed'
        ).aggregate(total=Sum('amount'))
        return data['total'] or Decimal('0.00')


class WalletTransaction(models.Model):
    """
    Immutable ledger of all wallet transactions (credits, debits,
    order payments, refunds, and admin adjustments).
    """
    TRANSACTION_TYPES = (
        ('credit', 'Wallet Credit'),
        ('debit', 'Wallet Debit'),
        ('order_payment', 'Order Payment'),
        ('cancellation_refund', 'Order Cancellation Refund'),
        ('return_refund', 'Payment Refund'),
        ('admin_credit', 'Admin Credit'),
        ('admin_debit', 'Admin Debit'),
    )

    STATUS_CHOICES = (
        ('completed', 'Completed'),
        ('pending', 'Pending'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    )

    wallet = models.ForeignKey(
        Wallet,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    transaction_type = models.CharField(
        max_length=50,
        choices=TRANSACTION_TYPES,
        db_index=True
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )
    balance_after_transaction = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )
    description = models.CharField(
        max_length=255
    )
    reference_id = models.CharField(
        max_length=100,
        db_index=True,
        blank=True
    )
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='completed',
        db_index=True
    )
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='wallet_actions_performed'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True
    )
    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        verbose_name = 'Wallet Transaction'
        verbose_name_plural = 'Wallet Transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['wallet', '-created_at']),
            models.Index(fields=['reference_id']),
            models.Index(fields=['transaction_type', 'status']),
        ]

    def __str__(self):
        sign = '+' if self.is_credit else '-'
        return f"{self.get_transaction_type_display()} | {sign}₹{self.amount} ({self.status}) [{self.reference_id}]"

    @property
    def is_credit(self):
        """Returns True if the transaction adds funds to the wallet."""
        return self.transaction_type in ['credit', 'cancellation_refund', 'return_refund', 'admin_credit']

    @property
    def is_debit(self):
        """Returns True if the transaction removes funds from the wallet."""
        return self.transaction_type in ['debit', 'order_payment', 'admin_debit']

