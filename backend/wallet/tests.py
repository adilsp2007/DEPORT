from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from .models import Wallet, WalletTransaction

User = get_user_model()


class WalletManagementTestCase(TestCase):
    """
    Comprehensive test suite for Wallet Management:
    - User wallet creation and retrieval
    - Wallet credit and debit with atomic row locking
    - Non-negative balance constraint enforcement
    - Transaction history with pagination and filtering
    - Admin wallet management and stats
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='shopper@deport.com',
            password='Password123!',
            first_name='Luxury',
            last_name='Shopper',
            is_email_verified=True,
            is_active=True
        )
        self.admin = User.objects.create_superuser(
            email='admin@deport.com',
            password='AdminPassword123!',
            first_name='Admin',
            last_name='Staff',
            is_email_verified=True,
            is_active=True,
            is_staff=True
        )
        self.wallet = Wallet.get_or_create_wallet(self.user)

    def test_01_wallet_initial_balance_is_zero(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/wallet/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(resp.data['balance'])), Decimal('0.00'))

    def test_02_wallet_credit_increases_balance_and_creates_transaction(self):
        tx = self.wallet.credit(
            amount=Decimal('500.00'),
            transaction_type='credit',
            description='Gift voucher credit'
        )
        self.assertEqual(self.wallet.balance, Decimal('500.00'))
        self.assertEqual(tx.status, 'completed')
        self.assertEqual(tx.amount, Decimal('500.00'))
        self.assertEqual(tx.balance_after_transaction, Decimal('500.00'))

        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/wallet/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(str(resp.data['balance'])), Decimal('500.00'))

    def test_03_wallet_debit_decreases_balance(self):
        self.wallet.credit(Decimal('1000.00'), description='Initial Deposit')
        tx_debit = self.wallet.debit(Decimal('400.00'), description='Order LX-101 Payment')
        self.assertEqual(self.wallet.balance, Decimal('600.00'))
        self.assertEqual(tx_debit.amount, Decimal('400.00'))
        self.assertEqual(tx_debit.balance_after_transaction, Decimal('600.00'))

    def test_04_wallet_debit_fails_on_insufficient_balance(self):
        self.wallet.credit(Decimal('100.00'))
        with self.assertRaises(ValueError):
            self.wallet.debit(Decimal('200.00'))
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal('100.00'))

    def test_05_wallet_transactions_list_and_filters(self):
        self.wallet.credit(Decimal('500.00'), transaction_type='credit', description='Topup')
        self.wallet.debit(Decimal('100.00'), transaction_type='order_payment', description='Bag Purchase')

        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/wallet/transactions/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get('results', [])
        self.assertEqual(len(results), 2)

        # Filter credits
        resp_credits = self.client.get('/api/wallet/transactions/?type=credits')
        self.assertEqual(len(resp_credits.data.get('results', [])), 1)

        # Filter debits
        resp_debits = self.client.get('/api/wallet/transactions/?type=debits')
        self.assertEqual(len(resp_debits.data.get('results', [])), 1)

    def test_06_unauthenticated_wallet_access_rejected(self):
        resp = self.client.get('/api/wallet/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_07_admin_wallet_stats(self):
        self.wallet.credit(Decimal('750.00'), description='Refund')
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get('/api/admin/wallets/stats/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('total_wallet_balance', resp.data)

    def test_08_admin_credit_action(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(f'/api/admin/wallets/{self.user.id}/credit/', {
            'amount': '300.00',
            'reason': 'Customer goodwill gesture'
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal('300.00'))
