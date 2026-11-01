from django.urls import path
from .views import (
    CustomerCheckoutView,
    CustomerOrderListView,
    CustomerOrderDetailView,
    CustomerOrderCancelView,
    CustomerOrderReturnView,
    OrderInvoiceView,
    CouponValidateView,
    CouponRemoveView,
    PaymentConfigView,
    OrderPaymentCreateView,
    OrderPaymentVerifyView,
    OrderPaymentFailView,
    PaymentWebhookView,
    AdminOrderListView,
    AdminOrderDetailView,
    AdminOrderUpdateStatusView
)

app_name = 'orders'

urlpatterns = [
    # Customer Endpoints
    path('', CustomerOrderListView.as_view(), name='customer_order_list'),
    path('checkout/', CustomerCheckoutView.as_view(), name='customer_checkout'),
    path('coupons/validate/', CouponValidateView.as_view(), name='coupon_validate'),
    path('coupons/remove/', CouponRemoveView.as_view(), name='coupon_remove'),
    path('payment/config/', PaymentConfigView.as_view(), name='payment_config'),
    path('payment/create-order/', OrderPaymentCreateView.as_view(), name='payment_create_order'),
    path('payment/verify/', OrderPaymentVerifyView.as_view(), name='payment_verify'),
    path('payment/fail/', OrderPaymentFailView.as_view(), name='payment_fail'),
    path('payment/webhook/', PaymentWebhookView.as_view(), name='payment_webhook'),
    path('<str:pk_or_number>/', CustomerOrderDetailView.as_view(), name='customer_order_detail'),
    path('<str:pk_or_number>/cancel/', CustomerOrderCancelView.as_view(), name='customer_order_cancel'),
    path('<str:pk_or_number>/return/', CustomerOrderReturnView.as_view(), name='customer_order_return'),
    path('<str:pk_or_number>/invoice/', OrderInvoiceView.as_view(), name='order_invoice'),
    path('<str:pk_or_number>/payment/create/', OrderPaymentCreateView.as_view(), name='order_payment_create'),
    path('<str:pk_or_number>/payment/verify/', OrderPaymentVerifyView.as_view(), name='order_payment_verify'),
    path('<str:pk_or_number>/payment/fail/', OrderPaymentFailView.as_view(), name='order_payment_fail'),

    # Admin Endpoints
    path('admin/orders/', AdminOrderListView.as_view(), name='admin_order_list'),
    path('admin/orders/<int:pk>/', AdminOrderDetailView.as_view(), name='admin_order_detail'),
    path('admin/orders/<int:pk>/status/', AdminOrderUpdateStatusView.as_view(), name='admin_order_update_status'),
]
