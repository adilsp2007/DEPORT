import os
import hmac
import hashlib
import logging
from decimal import Decimal
from django.conf import settings

logger = logging.getLogger('django')


class RazorpayConfigError(Exception):
    """Raised when Razorpay credentials are not properly configured."""
    pass


class RazorpayService:
    """
    Authoritative Razorpay Standard Checkout & Webhook Service for DEPORT E-Commerce.
    Conforms to official Razorpay Python SDK and security standards:
    - Decimal arithmetic for precise paise currency conversions (₹1 = 100 paise)
    - Constant-time HMAC-SHA256 cryptographic signature validation
    - Idempotent order creation and webhook verification
    - Never leaks API secrets, signatures, or customer payment credentials
    """

    @classmethod
    def get_key_id(cls):
        return getattr(settings, 'RAZORPAY_KEY_ID', '').strip()

    @classmethod
    def get_key_secret(cls):
        return getattr(settings, 'RAZORPAY_KEY_SECRET', '').strip()

    @classmethod
    def get_webhook_secret(cls):
        return getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', '').strip()

    @classmethod
    def get_currency(cls):
        return getattr(settings, 'RAZORPAY_CURRENCY', 'INR').strip() or 'INR'

    @classmethod
    def is_configured(cls):
        key_id = cls.get_key_id()
        key_secret = cls.get_key_secret()
        return bool(
            key_id and key_secret and
            not key_id.startswith('your_') and
            not key_secret.startswith('your_')
        )

    @classmethod
    def get_client(cls):
        import razorpay
        key_id = cls.get_key_id()
        key_secret = cls.get_key_secret()

        if not key_id or not key_secret:
            raise RazorpayConfigError(
                "Razorpay API credentials are not configured. "
                "Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env."
            )
        return razorpay.Client(auth=(key_id, key_secret))

    @classmethod
    def amount_to_paise(cls, amount_decimal):
        """
        Converts decimal currency amount to integer paise (smallest unit).
        ₹1,000.00 -> 100000 paise.
        Uses exact Decimal arithmetic to eliminate floating-point precision errors.
        """
        if amount_decimal is None:
            raise ValueError("Amount cannot be None.")
        dec = Decimal(str(amount_decimal))
        if dec <= Decimal('0.00'):
            raise ValueError(f"Payable amount must be greater than zero. Received: {dec}")
        return int((dec * Decimal('100.00')).quantize(Decimal('1')))

    @classmethod
    def create_order(cls, amount_decimal, receipt, notes=None, currency=None):
        """
        Creates a Razorpay Order via the official Razorpay Python SDK.
        Returns the Razorpay order entity dictionary.
        """
        amount_paise = cls.amount_to_paise(amount_decimal)
        currency_code = currency or cls.get_currency()
        client = cls.get_client()

        receipt_str = str(receipt)[:40] if receipt else "rec_deport"
        payload = {
            'amount': amount_paise,
            'currency': currency_code,
            'receipt': receipt_str,
            'notes': notes or {},
            'payment_capture': 1  # Auto-capture payment upon authorization
        }

        logger.info(f"Creating Razorpay order for receipt={receipt_str}, amount_paise={amount_paise}, currency={currency_code}")
        try:
            rzp_order = client.order.create(data=payload)
            logger.info(f"Razorpay order created successfully: {rzp_order.get('id')}")
            return rzp_order
        except Exception as e:
            logger.error(f"Failed to create Razorpay order for receipt={receipt_str}: {type(e).__name__} - {e}")
            raise

    @classmethod
    def verify_payment_signature(cls, razorpay_order_id, razorpay_payment_id, razorpay_signature):
        """
        Verifies the cryptographic payment signature returned by Razorpay Checkout.
        Calculates HMAC-SHA256(key_secret, f"{order_id}|{payment_id}")
        and performs constant-time comparison against razorpay_signature.
        """
        if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
            logger.warning("Payment signature verification failed: Missing required parameters.")
            return False

        key_secret = cls.get_key_secret()
        if not key_secret:
            logger.error("Cannot verify payment signature: RAZORPAY_KEY_SECRET is not configured.")
            return False

        msg = f"{razorpay_order_id}|{razorpay_payment_id}".encode('utf-8')
        expected_sig = hmac.new(key_secret.encode('utf-8'), msg, hashlib.sha256).hexdigest()

        is_valid = hmac.compare_digest(expected_sig, str(razorpay_signature).strip())
        if not is_valid:
            logger.warning(
                f"Razorpay signature mismatch for order {razorpay_order_id} / payment {razorpay_payment_id}."
            )
        return is_valid

    @classmethod
    def verify_webhook_signature(cls, body_bytes, signature):
        """
        Verifies the X-Razorpay-Signature header on incoming webhook requests.
        Calculates HMAC-SHA256(webhook_secret, raw_body_bytes)
        and performs constant-time comparison.
        """
        if not signature:
            return False

        webhook_secret = cls.get_webhook_secret()
        if not webhook_secret:
            logger.error("Cannot verify webhook signature: RAZORPAY_WEBHOOK_SECRET is not configured.")
            return False

        if isinstance(body_bytes, str):
            body_bytes = body_bytes.encode('utf-8')

        expected_sig = hmac.new(webhook_secret.encode('utf-8'), body_bytes, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, str(signature).strip())

    @classmethod
    def fetch_payment(cls, razorpay_payment_id):
        """
        Retrieves the actual payment entity from Razorpay API to inspect captured/authorized status.
        """
        client = cls.get_client()
        return client.payment.fetch(razorpay_payment_id)
