import logging
import threading
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from products.models import Product
from .models import Order, OrderItem, Payment, Coupon, CouponUsage

logger = logging.getLogger(__name__)

CANCELLATION_LOCK = threading.RLock()


def cancel_order_and_restore_stock(order_id_or_number, user=None, is_admin=False, reason='', item_id=None):
    """
    Atomically cancels an eligible order (or specific item) and restores product inventory exactly once.
    Uses select_for_update() locking on Order, OrderItem, and Product rows to prevent race conditions.
    Also replenishes coupon usage limits and releases user redemption records if order is cancelled.

    Returns:
        tuple: (success: bool, message: str, http_status: int, order: Order or None)
    """
    # 1. Resolve order instance
    if isinstance(order_id_or_number, int) or str(order_id_or_number).isdigit():
        order = Order.objects.filter(id=int(order_id_or_number)).first()
    else:
        order = Order.objects.filter(order_number__iexact=str(order_id_or_number).strip()).first()

    if not order:
        return False, 'Order not found.', status.HTTP_404_NOT_FOUND, None

    # 2. Authorization / Ownership check
    # If not admin, the user must be authenticated and own the order
    if not is_admin:
        if not user or not user.is_authenticated:
            return False, 'Authentication credentials were not provided.', status.HTTP_401_UNAUTHORIZED, None
        if order.user_id != user.id and not (user.is_staff or user.is_superuser):
            return False, 'You do not have permission to cancel this order.', status.HTTP_403_FORBIDDEN, None

    cancel_reason = str(reason).strip() if reason else ('Cancelled by administrator' if is_admin else 'Cancelled by customer')

    # 3. Atomic stock restoration and cancellation with row locking
    with transaction.atomic():
        # Lock the order row to serialize concurrent cancellation requests
        locked_order = Order.objects.select_for_update().filter(pk=order.pk).first()
        if not locked_order:
            return False, 'Order not found.', status.HTTP_404_NOT_FOUND, None

        # Check if already cancelled
        if locked_order.status == 'cancelled':
            return False, 'This order has already been cancelled.', status.HTTP_400_BAD_REQUEST, locked_order

        # Business rules: eligible statuses for cancellation are only pending, confirmed, processing
        ineligible_for_cancellation = ['shipped', 'out_for_delivery', 'delivered', 'returned', 'return_requested']
        if locked_order.status in ineligible_for_cancellation:
            return (
                False,
                f'Orders that are "{locked_order.get_status_display()}" cannot be cancelled. You may request a return once delivered.',
                status.HTTP_400_BAD_REQUEST,
                locked_order
            )

        if locked_order.status not in ['pending', 'confirmed', 'processing']:
            return (
                False,
                f'Orders that are "{locked_order.get_status_display()}" cannot be cancelled.',
                status.HTTP_400_BAD_REQUEST,
                locked_order
            )

        # Case A: Item-specific cancellation
        if item_id:
            item = locked_order.items.filter(id=item_id).first()
            if not item:
                return False, 'Order item not found.', status.HTTP_404_NOT_FOUND, locked_order

            if item.is_cancelled:
                return False, 'This item has already been cancelled.', status.HTTP_400_BAD_REQUEST, locked_order

            item.is_cancelled = True
            item.cancellation_reason = cancel_reason
            item.save(update_fields=['is_cancelled', 'cancellation_reason'])

            # Restore inventory for this specific item
            if item.product_id:
                product = Product.objects.select_for_update().filter(id=item.product_id).first()
                if product:
                    product.stock_quantity += item.quantity
                    product.save(update_fields=['stock_quantity', 'updated_at'])

            active_items = locked_order.items.filter(is_cancelled=False)
            if not active_items.exists():
                locked_order.status = 'cancelled'
                locked_order.cancellation_reason = cancel_reason
                locked_order.cancelled_at = timezone.now()
                locked_order.save(update_fields=['status', 'cancellation_reason', 'cancelled_at', 'updated_at'])

                # Cancel any pending payments
                for p in locked_order.payments.select_for_update().filter(status='pending'):
                    p.status = 'cancelled'
                    p.save(update_fields=['status', 'updated_at'])

                # Release coupon usage and decrement used_count
                if locked_order.coupon_id:
                    coupon = Coupon.objects.select_for_update().filter(id=locked_order.coupon_id).first()
                    if coupon and coupon.used_count > 0:
                        coupon.used_count -= 1
                        coupon.save(update_fields=['used_count', 'updated_at'])
                    CouponUsage.objects.filter(order=locked_order).delete()
            else:
                new_subtotal = sum(i.total_price for i in active_items)
                locked_order.subtotal = new_subtotal
                if locked_order.coupon:
                    if new_subtotal < locked_order.coupon.min_order_amount:
                        locked_order.discount = Decimal('0.00')
                    else:
                        locked_order.discount = locked_order.coupon.calculate_discount(new_subtotal)
                    # Update CouponUsage record if exists
                    CouponUsage.objects.filter(order=locked_order).update(discount_applied=locked_order.discount)
                else:
                    locked_order.discount = min(locked_order.discount, new_subtotal)

                locked_order.total = max(Decimal('0.00'), new_subtotal + locked_order.shipping_cost + locked_order.tax - locked_order.discount)
                locked_order.save(update_fields=['subtotal', 'discount', 'total', 'updated_at'])

            msg = f'Item "{item.product_name}" has been cancelled and stock restored.'
            return True, msg, status.HTTP_200_OK, locked_order

        # Case B: Entire order cancellation
        # Select active items
        items_to_cancel = list(locked_order.items.filter(is_cancelled=False))
        if not items_to_cancel and locked_order.status == 'cancelled':
            return False, 'This order has already been cancelled.', status.HTTP_400_BAD_REQUEST, locked_order

        # Lock products in deterministic order (by id) to avoid deadlocks
        product_ids = sorted([i.product_id for i in items_to_cancel if i.product_id])
        locked_products = {p.id: p for p in Product.objects.select_for_update().filter(id__in=product_ids).order_by('id')}

        for item in items_to_cancel:
            item.is_cancelled = True
            item.cancellation_reason = cancel_reason
            item.save(update_fields=['is_cancelled', 'cancellation_reason'])

            if item.product_id and item.product_id in locked_products:
                prod = locked_products[item.product_id]
                prod.stock_quantity += item.quantity
                prod.save(update_fields=['stock_quantity', 'updated_at'])

        locked_order.status = 'cancelled'
        locked_order.cancellation_reason = cancel_reason
        locked_order.cancelled_at = timezone.now()
        locked_order.save(update_fields=['status', 'cancellation_reason', 'cancelled_at', 'updated_at'])

        # Cancel any pending payments
        for p in locked_order.payments.select_for_update().filter(status='pending'):
            p.status = 'cancelled'
            p.save(update_fields=['status', 'updated_at'])

        # Release coupon usage and decrement used_count
        if locked_order.coupon_id:
            coupon = Coupon.objects.select_for_update().filter(id=locked_order.coupon_id).first()
            if coupon and coupon.used_count > 0:
                coupon.used_count -= 1
                coupon.save(update_fields=['used_count', 'updated_at'])
            CouponUsage.objects.filter(order=locked_order).delete()

        msg = f'Order {locked_order.order_number} has been cancelled successfully and stock restored.'
        return True, msg, status.HTTP_200_OK, locked_order
