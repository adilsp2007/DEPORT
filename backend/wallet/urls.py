from django.urls import path
from .views import (
    UserWalletView,
    UserWalletTransactionsView,
    AdminWalletStatsView,
    AdminWalletListView,
    AdminWalletDetailView,
    AdminWalletTransactionsView,
    AdminWalletCreditView,
    AdminWalletDebitView
)

urlpatterns = [
    # Customer APIs
    path('', UserWalletView.as_view(), name='user-wallet'),
    path('transactions/', UserWalletTransactionsView.as_view(), name='user-wallet-transactions'),

    # Admin Management APIs
    path('admin/stats/', AdminWalletStatsView.as_view(), name='admin-wallet-stats'),
    path('admin/', AdminWalletListView.as_view(), name='admin-wallet-list'),
    path('admin/<int:user_id>/', AdminWalletDetailView.as_view(), name='admin-wallet-detail'),
    path('admin/<int:user_id>/transactions/', AdminWalletTransactionsView.as_view(), name='admin-wallet-transactions'),
    path('admin/<int:user_id>/credit/', AdminWalletCreditView.as_view(), name='admin-wallet-credit'),
    path('admin/<int:user_id>/debit/', AdminWalletDebitView.as_view(), name='admin-wallet-debit'),
]

