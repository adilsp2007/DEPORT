from django.urls import path
from .views import (
    PaymentConfigView,
    OrderPaymentCreateView,
    OrderPaymentVerifyView,
    OrderPaymentFailView,
    PaymentWebhookView
)

app_name = 'payments'

urlpatterns = [
    path('config/', PaymentConfigView.as_view(), name='payment_config'),
    path('create-order/', OrderPaymentCreateView.as_view(), name='payment_create_order'),
    path('verify/', OrderPaymentVerifyView.as_view(), name='payment_verify'),
    path('fail/', OrderPaymentFailView.as_view(), name='payment_fail'),
    path('webhook/', PaymentWebhookView.as_view(), name='payment_webhook'),
]
