from decimal import Decimal
from django.db import transaction
from django.db.models import Q, Sum
from django.contrib.auth import get_user_model
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from config.pagination import StandardResultsSetPagination
from users.permissions import IsAdminUser
from .models import Wallet, WalletTransaction
from .serializers import (
    WalletSerializer,
    WalletTransactionSerializer,
    AdminWalletListSerializer,
    AdminWalletActionSerializer
)

User = get_user_model()


class UserWalletView(APIView):
    """
    GET /api/wallet/
    Retrieve current authenticated user's wallet overview, balance, and transaction totals.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        wallet = Wallet.get_or_create_wallet(request.user)
        serializer = WalletSerializer(wallet)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserWalletTransactionsView(APIView):
    """
    GET /api/wallet/transactions/
    Paginated and filterable transaction history for the authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        wallet = Wallet.get_or_create_wallet(request.user)
        queryset = wallet.transactions.all().order_by('-created_at')

        # Filter by category or specific transaction_type
        type_param = request.query_params.get('type', '').strip().lower()
        if type_param == 'credits':
            queryset = queryset.filter(transaction_type__in=['credit', 'cancellation_refund', 'return_refund', 'admin_credit'])
        elif type_param == 'debits':
            queryset = queryset.filter(transaction_type__in=['debit', 'order_payment', 'admin_debit'])
        elif type_param and type_param != 'all':
            queryset = queryset.filter(transaction_type=type_param)

        # Filter by status
        status_param = request.query_params.get('status', '').strip().lower()
        if status_param and status_param != 'all':
            queryset = queryset.filter(status=status_param)

        # Search by description or reference_id
        search_query = request.query_params.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(reference_id__icontains=search_query) |
                Q(description__icontains=search_query)
            )

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = WalletTransactionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


# =====================================================================
# ADMIN WALLET MANAGEMENT APIS
# =====================================================================

class AdminWalletStatsView(APIView):
    """
    GET /api/admin/wallets/stats/
    Returns platform-wide wallet analytics and aggregate totals.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        total_balance_data = Wallet.objects.aggregate(total_sum=Sum('balance'))
        total_wallet_balance = float(total_balance_data['total_sum'] or 0.00)

        credit_types = ['credit', 'cancellation_refund', 'return_refund', 'admin_credit']
        debit_types = ['debit', 'order_payment', 'admin_debit']

        total_credits_data = WalletTransaction.objects.filter(
            transaction_type__in=credit_types,
            status='completed'
        ).aggregate(total=Sum('amount'))
        total_credits = float(total_credits_data['total'] or 0.00)

        total_debits_data = WalletTransaction.objects.filter(
            transaction_type__in=debit_types,
            status='completed'
        ).aggregate(total=Sum('amount'))
        total_debits = float(total_debits_data['total'] or 0.00)

        total_wallets = Wallet.objects.count()
        active_wallets = Wallet.objects.filter(balance__gt=Decimal('0.00')).count()

        return Response({
            'currency': 'INR',
            'currency_symbol': '₹',
            'total_wallet_balance': total_wallet_balance,
            'total_credits': total_credits,
            'total_debits': total_debits,
            'total_wallets': total_wallets,
            'active_wallets': active_wallets
        }, status=status.HTTP_200_OK)


class AdminWalletListView(APIView):
    """
    GET /api/admin/wallets/
    List user wallets with search, filtering, and pagination.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        # Ensure verified users have wallet records
        queryset = Wallet.objects.select_related('user').order_by('-updated_at')

        search_query = request.query_params.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(user__email__icontains=search_query) |
                Q(user__first_name__icontains=search_query) |
                Q(user__last_name__icontains=search_query) |
                Q(user__phone__icontains=search_query)
            )

        filter_param = request.query_params.get('filter', '').strip().lower()
        if filter_param == 'has_balance':
            queryset = queryset.filter(balance__gt=Decimal('0.00'))
        elif filter_param == 'zero_balance':
            queryset = queryset.filter(balance=Decimal('0.00'))

        sort_param = request.query_params.get('sort', '').strip()
        if sort_param == 'balance_desc':
            queryset = queryset.order_by('-balance')
        elif sort_param == 'balance_asc':
            queryset = queryset.order_by('balance')
        elif sort_param == 'created_desc':
            queryset = queryset.order_by('-created_at')

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = AdminWalletListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminWalletDetailView(APIView):
    """
    GET /api/admin/wallets/<int:user_id>/
    Get wallet details for a specific user.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request, user_id):
        target_user = User.objects.filter(pk=user_id).first()
        if not target_user:
            return Response({'detail': 'User account not found.'}, status=status.HTTP_404_NOT_FOUND)

        wallet = Wallet.get_or_create_wallet(target_user)
        list_data = AdminWalletListSerializer(wallet).data
        return Response(list_data, status=status.HTTP_200_OK)


class AdminWalletTransactionsView(APIView):
    """
    GET /api/admin/wallets/<int:user_id>/transactions/
    Paginated transactions for a specific user wallet.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request, user_id):
        target_user = User.objects.filter(pk=user_id).first()
        if not target_user:
            return Response({'detail': 'User account not found.'}, status=status.HTTP_404_NOT_FOUND)

        wallet = Wallet.get_or_create_wallet(target_user)
        queryset = wallet.transactions.all().order_by('-created_at')

        type_param = request.query_params.get('type', '').strip().lower()
        if type_param == 'credits':
            queryset = queryset.filter(transaction_type__in=['credit', 'cancellation_refund', 'return_refund', 'admin_credit'])
        elif type_param == 'debits':
            queryset = queryset.filter(transaction_type__in=['debit', 'order_payment', 'admin_debit'])
        elif type_param and type_param != 'all':
            queryset = queryset.filter(transaction_type=type_param)

        status_param = request.query_params.get('status', '').strip().lower()
        if status_param and status_param != 'all':
            queryset = queryset.filter(status=status_param)

        search_query = request.query_params.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(reference_id__icontains=search_query) |
                Q(description__icontains=search_query)
            )

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = WalletTransactionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AdminWalletCreditView(APIView):
    """
    POST /api/admin/wallets/<int:user_id>/credit/
    Admin manually credits a user's wallet.
    Requires: amount, reason.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request, user_id):
        target_user = User.objects.filter(pk=user_id).first()
        if not target_user:
            return Response({'detail': 'User account not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminWalletActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        amount = serializer.validated_data['amount']
        reason = serializer.validated_data['reason']
        ref_id = serializer.validated_data.get('reference_id')

        try:
            wallet = Wallet.get_or_create_wallet(target_user)
            tx = wallet.credit(
                amount=amount,
                transaction_type='admin_credit',
                description=f"Admin Credit: {reason}",
                reference_id=ref_id,
                performed_by=request.user
            )
            return Response({
                'message': f'Successfully credited ₹{amount} to {target_user.email}.',
                'new_balance': str(wallet.balance),
                'transaction': WalletTransactionSerializer(tx).data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class AdminWalletDebitView(APIView):
    """
    POST /api/admin/wallets/<int:user_id>/debit/
    Admin manually debits a user's wallet.
    Requires: amount, reason.
    Validates that user has sufficient balance.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request, user_id):
        target_user = User.objects.filter(pk=user_id).first()
        if not target_user:
            return Response({'detail': 'User account not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminWalletActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        amount = serializer.validated_data['amount']
        reason = serializer.validated_data['reason']
        ref_id = serializer.validated_data.get('reference_id')

        try:
            wallet = Wallet.get_or_create_wallet(target_user)
            if not wallet.can_debit(amount):
                return Response({
                    'detail': f'Cannot debit ₹{amount}. User only has ₹{wallet.balance} available in their wallet.'
                }, status=status.HTTP_400_BAD_REQUEST)

            tx = wallet.debit(
                amount=amount,
                transaction_type='admin_debit',
                description=f"Admin Debit: {reason}",
                reference_id=ref_id,
                performed_by=request.user
            )
            return Response({
                'message': f'Successfully debited ₹{amount} from {target_user.email}.',
                'new_balance': str(wallet.balance),
                'transaction': WalletTransactionSerializer(tx).data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

