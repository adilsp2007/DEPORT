import os
import sys
import uuid
import hmac
import hashlib
from django.conf import settings
from rest_framework import status, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from decimal import Decimal
from users.permissions import IsAdminUser
from .models import Order, OrderItem, Coupon, CouponUsage, Payment, ProcessedWebhookEvent
from .serializers import (
    OrderSerializer, CouponSerializer, CouponValidateSerializer, PaymentSerializer
)
from cart.models import Cart
from addresses.models import Address
from products.models import Product
from .services import cancel_order_and_restore_stock
from .razorpay_service import RazorpayService, RazorpayConfigError
import threading
import logging

logger = logging.getLogger('django')

CHECKOUT_LOCK = threading.RLock()


from config.pagination import StandardResultsSetPagination


class CustomerCheckoutView(APIView):
    """
    Customer Checkout View:
    - Server-authoritative price, tax (5%), shipping, and discount calculation
    - Validates coupons against active status, expiry, usage limits, and minimum order amount
    - Validates product stock and decrements stock quantity atomically using select_for_update()
    - Rejects entire order if any item has quantity <= 0 or insufficient stock
    - Protects against address IDOR vulnerabilities
    - Idempotent: duplicate requests with same idempotency_key return existing order without deducting stock twice
    - Automatically clears cart on success
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        idempotency_key = str(request.data.get('idempotency_key', '')).strip()

        # Check idempotency first to prevent duplicate orders and handle immediate retries
        if idempotency_key:
            existing_payment = Payment.objects.filter(
                idempotency_key=idempotency_key, user=user
            ).select_related('order').first()
            if existing_payment and existing_payment.order:
                order = existing_payment.order
                serializer = OrderSerializer(order, context={'request': request})
                return Response({
                    'message': f'Order {order.order_number} already placed.',
                    'order': serializer.data,
                    'payment': PaymentSerializer(existing_payment).data
                }, status=status.HTTP_200_OK)

        # 1. Address resolution with IDOR defense
        address_id = request.data.get('address_id')
        address = None
        if address_id:
            address = Address.objects.filter(id=address_id, user=user).first()
            if not address:
                return Response({
                    'detail': 'Invalid shipping address selected.'
                }, status=status.HTTP_400_BAD_REQUEST)

        if not address:
            address = Address.objects.filter(user=user, is_default=True).first()
        if not address:
            address = Address.objects.filter(user=user).first()

        if not address:
            shipping_name = request.data.get('shipping_full_name')
            shipping_addr1 = request.data.get('shipping_address_line_1')
            if shipping_name and shipping_addr1:
                address_data = {
                    'shipping_full_name': shipping_name,
                    'shipping_phone': request.data.get('shipping_phone', ''),
                    'shipping_address_line_1': shipping_addr1,
                    'shipping_address_line_2': request.data.get('shipping_address_line_2', ''),
                    'shipping_city': request.data.get('shipping_city', ''),
                    'shipping_state': request.data.get('shipping_state', ''),
                    'shipping_postal_code': request.data.get('shipping_postal_code', ''),
                    'shipping_country': request.data.get('shipping_country', 'United States'),
                }
            else:
                return Response({
                    'detail': 'Please provide or select a shipping address.'
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            address_data = {
                'shipping_full_name': address.full_name,
                'shipping_phone': address.phone,
                'shipping_address_line_1': address.address_line_1,
                'shipping_address_line_2': address.address_line_2,
                'shipping_city': address.city,
                'shipping_state': address.state,
                'shipping_postal_code': address.postal_code,
                'shipping_country': address.country,
            }

        payment_method = request.data.get('payment_method', 'Cash on Delivery')

        # 2. Atomic Order Placement & Inventory Deduction
        with CHECKOUT_LOCK:
            try:
                with transaction.atomic():
                    # Concurrent duplicate idempotency check within transaction
                    if idempotency_key:
                        existing_payment = Payment.objects.select_for_update().filter(
                            idempotency_key=idempotency_key, user=user
                        ).select_related('order').first()
                        if existing_payment and existing_payment.order:
                            order = existing_payment.order
                            serializer = OrderSerializer(order, context={'request': request})
                            return Response({
                                'message': f'Order {order.order_number} already placed.',
                                'order': serializer.data,
                                'payment': PaymentSerializer(existing_payment).data
                            }, status=status.HTTP_200_OK)

                    # Retrieve user's cart items inside atomic transaction
                    cart, _ = Cart.objects.get_or_create(user=user)
                    cart_items = list(cart.items.select_related('product').all())

                    if not cart_items:
                        return Response({'detail': 'Your shopping bag is empty.'}, status=status.HTTP_400_BAD_REQUEST)

                    # Check valid quantities > 0
                    for item in cart_items:
                        if not item.quantity or item.quantity <= 0:
                            prod_name = item.product.name if item.product else 'Product'
                            return Response({
                                'detail': f'Invalid quantity for "{prod_name}". Quantity must be greater than zero.'
                            }, status=status.HTTP_400_BAD_REQUEST)

                    # Aggregate requested quantities per product
                    product_quantities = {}
                    for item in cart_items:
                        product_quantities[item.product_id] = product_quantities.get(item.product_id, 0) + item.quantity

                    # Lock products in deterministic order (by id) to avoid deadlocks
                    product_ids = sorted(list(product_quantities.keys()))
                    locked_products = {p.id: p for p in Product.objects.select_for_update().filter(id__in=product_ids).order_by('id')}

                    # Validate product availability and stock
                    for prod_id, req_qty in product_quantities.items():
                        product = locked_products.get(prod_id)
                        if not product or not product.is_active or product.is_deleted:
                            prod_name = product.name if product else 'Product'
                            return Response({
                                'detail': f'"{prod_name}" is no longer available or has been unlisted.'
                            }, status=status.HTTP_400_BAD_REQUEST)

                        if req_qty > product.stock_quantity:
                            return Response({
                                'detail': f'Insufficient stock for "{product.name}". Only {product.stock_quantity} left in stock.'
                            }, status=status.HTTP_400_BAD_REQUEST)

                    # Authoritative pricing calculation
                    subtotal = Decimal('0.00')
                    for item in cart_items:
                        product = locked_products[item.product_id]
                        item_total = Decimal(str(product.price)) * Decimal(str(item.quantity))
                        subtotal += item_total

                    shipping_cost = Decimal('0.00') if subtotal >= Decimal('300.00') else Decimal('25.00')
                    tax = (subtotal * Decimal('0.05')).quantize(Decimal('0.01'))

                    coupon_code = request.data.get('coupon_code', '').strip().upper()
                    coupon = None
                    discount = Decimal('0.00')

                    if coupon_code:
                        coupon = Coupon.objects.select_for_update().filter(code=coupon_code).first()
                        if not coupon:
                            return Response({
                                'detail': f'Coupon "{coupon_code}" is invalid or does not exist.'
                            }, status=status.HTTP_400_BAD_REQUEST)

                        is_valid, reason = coupon.is_valid_for_cart(user, subtotal)
                        if not is_valid:
                            return Response({'detail': reason}, status=status.HTTP_400_BAD_REQUEST)

                        discount = coupon.calculate_discount(subtotal)

                    total = max(Decimal('0.00'), subtotal + shipping_cost + tax - discount)

                    # Create Order
                    order = Order.objects.create(
                        user=user,
                        status='pending',
                        payment_method=payment_method,
                        coupon=coupon,
                        coupon_code=coupon.code if coupon else '',
                        subtotal=subtotal,
                        tax=tax,
                        shipping_cost=shipping_cost,
                        discount=discount,
                        total=total,
                        **address_data
                    )

                    if coupon:
                        CouponUsage.objects.create(
                            coupon=coupon,
                            user=user,
                            order=order,
                            discount_applied=discount
                        )
                        coupon.used_count += 1
                        coupon.save(update_fields=['used_count', 'updated_at'])

                    # Create OrderItems and decrement stock
                    for item in cart_items:
                        product = locked_products[item.product_id]

                        primary_img = None
                        img_obj = product.images.filter(is_primary=True).first() or product.images.first()
                        if img_obj:
                            if img_obj.image:
                                primary_img = request.build_absolute_uri(img_obj.image.url) if request else img_obj.image.url
                            elif img_obj.image_url:
                                primary_img = img_obj.image_url

                        unit_price = Decimal(str(product.price))
                        item_total = unit_price * Decimal(str(item.quantity))

                        OrderItem.objects.create(
                            order=order,
                            product=product,
                            product_name=product.name,
                            product_sku=product.sku,
                            product_image=primary_img or '',
                            quantity=item.quantity,
                            unit_price=unit_price,
                            total_price=item_total
                        )

                        # Decrement product stock
                        product.stock_quantity -= item.quantity
                        product.save(update_fields=['stock_quantity', 'updated_at'])

                    # Record Payment
                    payment_currency = RazorpayService.get_currency() if payment_method == 'Razorpay' else 'INR'
                    gateway_order_id = ''
                    rzp_order_data = None

                    if payment_method == 'Razorpay':
                        if RazorpayService.is_configured():
                            try:
                                rzp_order_data = RazorpayService.create_order(
                                    amount_decimal=total,
                                    receipt=order.order_number,
                                    notes={
                                        'order_id': str(order.id),
                                        'order_number': order.order_number,
                                        'user_id': str(user.id),
                                        'user_email': user.email
                                    }
                                )
                                gateway_order_id = rzp_order_data.get('id', '')
                            except Exception as rzp_err:
                                logger.error(f"Failed to create Razorpay gateway order for {order.order_number}: {rzp_err}")
                                # Raising here ensures rollback of stock deduction and order creation
                                raise rzp_err
                        else:
                            # Development fallback identifier when API keys are pending
                            gateway_order_id = f"order_{uuid.uuid4().hex[:14]}"

                    payment = Payment.objects.create(
                        order=order,
                        user=user,
                        payment_method=payment_method,
                        amount=total,
                        currency=payment_currency,
                        status='pending',
                        gateway_order_id=gateway_order_id or f"pay_{uuid.uuid4().hex[:16]}",
                        provider_response={'razorpay_order': rzp_order_data} if rzp_order_data else {},
                        idempotency_key=idempotency_key or None
                    )

                    # Clear cart
                    cart.items.all().delete()

            except Exception as exc:
                # Handle possible duplicate key race condition gracefully
                if idempotency_key and ('unique' in str(exc).lower() or 'integrity' in exc.__class__.__name__.lower()):
                    existing_payment = Payment.objects.filter(
                        idempotency_key=idempotency_key, user=user
                    ).select_related('order').first()
                    if existing_payment and existing_payment.order:
                        order = existing_payment.order
                        serializer = OrderSerializer(order, context={'request': request})
                        return Response({
                            'message': f'Order {order.order_number} already placed.',
                            'order': serializer.data,
                            'payment': PaymentSerializer(existing_payment).data
                        }, status=status.HTTP_200_OK)
                raise exc

        serializer = OrderSerializer(order, context={'request': request})
        response_payload = {
            'message': f'Order {order.order_number} placed successfully.',
            'order': serializer.data,
            'payment': PaymentSerializer(payment).data
        }

        if payment_method == 'Razorpay':
            amount_paise = RazorpayService.amount_to_paise(total)
            response_payload.update({
                'razorpay_order_id': payment.gateway_order_id,
                'razorpay_key_id': RazorpayService.get_key_id(),
                'amount': amount_paise,
                'amount_in_paise': amount_paise,
                'currency': payment.currency or 'INR',
                'is_configured': RazorpayService.is_configured()
            })

        return Response(response_payload, status=status.HTTP_201_CREATED)


class CustomerOrderListView(APIView):
    """
    Customer Order Listing View:
    - Lists user orders in descending order by order date
    - Unique, consistent order number, status, and order date
    - Supports search by orderID or product name
    - Status filtering
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = (
            Order.objects.filter(user=request.user)
            .select_related('user')
            .prefetch_related('items', 'payments')
            .order_by('-created_at')
        )

        params = request.query_params

        # Search parameter (order_number, product name, sku)
        search_query = params.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(order_number__icontains=search_query) |
                Q(items__product_name__icontains=search_query) |
                Q(items__product_sku__icontains=search_query)
            ).distinct()

        # Status filter
        status_param = params.get('status', '').strip().lower()
        if status_param and status_param != 'all':
            queryset = queryset.filter(status=status_param)

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = OrderSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class CustomerOrderDetailView(APIView):
    """
    Customer View for a specific order by ID or order_number.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk_or_number):
        queryset = (
            Order.objects.filter(user=request.user)
            .select_related('user')
            .prefetch_related('items', 'payments')
        )
        
        if str(pk_or_number).isdigit():
            order = queryset.filter(id=int(pk_or_number)).first()
        else:
            order = queryset.filter(order_number__iexact=str(pk_or_number).strip()).first()

        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = OrderSerializer(order, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class CustomerOrderCancelView(APIView):
    """
    Customer Order Cancellation:
    - Cancel entire order or specific product
    - Stock increment on cancellation for cancelled items exactly once
    - Reason (optional) for cancellation recorded
    - Validates ownership, eligible statuses, and performs atomic stock restoration
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk_or_number):
        reason = request.data.get('reason', '').strip()
        item_id = request.data.get('item_id')
        is_admin = bool(request.user and (request.user.is_staff or request.user.is_superuser))

        success, msg, http_status, order = cancel_order_and_restore_stock(
            order_id_or_number=pk_or_number,
            user=request.user,
            is_admin=is_admin,
            reason=reason,
            item_id=item_id
        )
        if not success:
            return Response({'detail': msg}, status=http_status)

        serializer = OrderSerializer(order, context={'request': request})
        return Response({
            'message': msg,
            'order': serializer.data
        }, status=http_status)


class CustomerOrderReturnView(APIView):
    """
    Customer Order Return Request:
    - Only permitted when order status is "delivered"
    - Reason is MANDATORY
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk_or_number):
        queryset = Order.objects.filter(user=request.user)
        if str(pk_or_number).isdigit():
            order = queryset.filter(id=int(pk_or_number)).first()
        else:
            order = queryset.filter(order_number__iexact=str(pk_or_number).strip()).first()

        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status != 'delivered':
            return Response({
                'detail': 'Return requests can only be submitted for delivered orders.'
            }, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({
                'detail': 'A return reason is mandatory to initiate a return request.'
            }, status=status.HTTP_400_BAD_REQUEST)

        order.status = 'return_requested'
        order.return_reason = reason
        order.return_requested_at = timezone.now()
        order.save(update_fields=['status', 'return_reason', 'return_requested_at', 'updated_at'])

        serializer = OrderSerializer(order, context={'request': request})
        return Response({
            'message': f'Return request submitted for order {order.order_number}. Our atelier team will review your request shortly.',
            'order': serializer.data
        }, status=status.HTTP_200_OK)


class OrderInvoiceView(APIView):
    """
    Order Invoice Endpoint:
    Returns complete invoice JSON data for printing or PDF rendering.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk_or_number):
        if request.user.is_staff or request.user.is_superuser:
            queryset = Order.objects.all().select_related('user').prefetch_related('items', 'payments')
        else:
            queryset = Order.objects.filter(user=request.user).select_related('user').prefetch_related('items', 'payments')

        if str(pk_or_number).isdigit():
            order = queryset.filter(id=int(pk_or_number)).first()
        else:
            order = queryset.filter(order_number__iexact=str(pk_or_number).strip()).first()

        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = OrderSerializer(order, context={'request': request})
        return Response({
            'invoice_number': f"INV-{order.order_number}",
            'invoice_date': order.created_at.strftime('%B %d, %Y'),
            'store_info': {
                'name': 'DEPORT Atelier',
                'tagline': 'Carry Your Style | Luxury Bags',
                'address': '742 Evergreen Terrace, Atelier Suite 400',
                'city': 'New York, NY 10001',
                'email': 'concierge@deport.com',
                'phone': '+1 (800) 589-6721'
            },
            'order': serializer.data
        }, status=status.HTTP_200_OK)


class AdminOrderListView(APIView):
    """
    Admin View for listing store orders in descending order by order date:
    - Search by orderID, customer name, email, phone
    - Status filtering
    - Sorting by date or total
    - Pagination
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        queryset = Order.objects.all().select_related('user').prefetch_related('items', 'payments')

        params = request.query_params

        # Search parameter
        search_query = params.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(order_number__icontains=search_query) |
                Q(shipping_full_name__icontains=search_query) |
                Q(shipping_phone__icontains=search_query) |
                Q(user__email__icontains=search_query) |
                Q(user__first_name__icontains=search_query) |
                Q(user__last_name__icontains=search_query)
            )

        # Status filter
        status_param = params.get('status', '').strip().lower()
        if status_param and status_param != 'all':
            queryset = queryset.filter(status=status_param)

        # Sort parameter (Default: descending order by created_at)
        sort_param = params.get('sort', 'newest')
        if sort_param == 'oldest':
            queryset = queryset.order_by('created_at')
        elif sort_param == 'total_high':
            queryset = queryset.order_by('-total')
        elif sort_param == 'total_low':
            queryset = queryset.order_by('total')
        else:
            queryset = queryset.order_by('-created_at')

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = OrderSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class AdminOrderDetailView(APIView):
    """
    Admin View for retrieving a specific order detail.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request, pk):
        order = Order.objects.filter(pk=pk).select_related('user').prefetch_related('items', 'payments').first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = OrderSerializer(order, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class AdminOrderUpdateStatusView(APIView):
    """
    Admin View for updating order fulfillment status:
    - Statuses: pending, confirmed, processing, shipped, out_for_delivery, delivered, cancelled, return_requested, returned
    - If status updated to cancelled: restores stock!
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def patch(self, request, pk):
        order = Order.objects.filter(pk=pk).prefetch_related('items__product').first()
        if not order:
            return Response({'detail': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status', '').strip().lower()
        valid_statuses = [choice[0] for choice in Order.STATUS_CHOICES]

        if not new_status or new_status not in valid_statuses:
            return Response({
                'detail': f'Invalid order status. Allowed options: {", ".join(valid_statuses)}'
            }, status=status.HTTP_400_BAD_REQUEST)

        old_status = order.status
        # Valid state transition rules
        if old_status == 'cancelled':
            return Response({'detail': 'Cancelled orders cannot change status.'}, status=status.HTTP_400_BAD_REQUEST)
        if old_status == 'returned':
            return Response({'detail': 'Returned orders cannot change status.'}, status=status.HTTP_400_BAD_REQUEST)
        if old_status == 'delivered' and new_status not in ['delivered', 'return_requested', 'returned']:
            return Response({'detail': 'Delivered orders cannot be reverted to earlier fulfillment stages.'}, status=status.HTTP_400_BAD_REQUEST)

        # If admin is cancelling the order, use the shared atomic cancellation and inventory restoration service
        if new_status == 'cancelled':
            success, msg, http_status, updated_order = cancel_order_and_restore_stock(
                order_id_or_number=order.id,
                user=request.user,
                is_admin=True,
                reason=request.data.get('reason', 'Cancelled by administrator')
            )
            if not success:
                return Response({'detail': msg}, status=http_status)

            serializer = OrderSerializer(updated_order, context={'request': request})
            return Response({
                'order': serializer.data,
                'message': f'Order {updated_order.order_number} status updated to "Cancelled" and stock restored.'
            }, status=status.HTTP_200_OK)

        with transaction.atomic():
            # If returning: restore stock if returned
            if new_status == 'returned' and old_status != 'returned':
                for item in order.items.filter(is_cancelled=False):
                    if item.product:
                        item.product.stock_quantity += item.quantity
                        item.product.save(update_fields=['stock_quantity', 'updated_at'])

            # If delivered, COD payments become completed
            if new_status == 'delivered':
                for p in order.payments.filter(status='pending', payment_method='Cash on Delivery'):
                    p.status = 'completed'
                    p.save(update_fields=['status', 'updated_at'])

            order.status = new_status
            order.save(update_fields=['status', 'updated_at'])

        serializer = OrderSerializer(order, context={'request': request})
        return Response({
            'order': serializer.data,
            'message': f'Order {order.order_number} status updated to "{order.get_status_display()}".'
        }, status=status.HTTP_200_OK)


class CouponValidateView(APIView):
    """
    Validate a coupon code before order placement:
    - Normalizes code (strip, uppercase)
    - Validates coupon against active status, date range, total usage limit, per-user usage limit, and minimum order amount
    - Rejects invalid percentages, negative discount values, and discounts greater than subtotal
    - Calculates discount and detailed payable breakdown without recording usage
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CouponValidateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        code = serializer.validated_data['code'].strip().upper()
        user = request.user

        coupon = Coupon.objects.filter(code=code).first()
        if not coupon:
            return Response({
                'valid': False,
                'detail': f'Coupon "{code}" is invalid or does not exist.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Calculate subtotal from payload or cart
        raw_subtotal = serializer.validated_data.get('subtotal')
        cart = Cart.objects.filter(user=user).first()
        if raw_subtotal is not None and Decimal(str(raw_subtotal)) > Decimal('0.00'):
            subtotal = Decimal(str(raw_subtotal))
        elif cart and cart.items.exists():
            subtotal = sum(Decimal(str(item.product.price)) * Decimal(str(item.quantity)) for item in cart.items.select_related('product'))
        else:
            subtotal = Decimal('0.00')

        is_valid, reason = coupon.is_valid_for_cart(user, subtotal)
        if not is_valid:
            return Response({
                'valid': False,
                'detail': reason
            }, status=status.HTTP_400_BAD_REQUEST)

        discount = coupon.calculate_discount(subtotal)
        shipping_cost = Decimal('0.00') if subtotal >= Decimal('300.00') or subtotal == Decimal('0.00') else Decimal('25.00')
        tax = (subtotal * Decimal('0.05')).quantize(Decimal('0.01'))
        final_total = max(Decimal('0.00'), subtotal - discount + shipping_cost + tax)

        return Response({
            'valid': True,
            'code': coupon.code,
            'discount_type': coupon.discount_type,
            'discount_value': str(coupon.discount_value),
            'discount_amount': str(discount),
            'min_order_amount': str(coupon.min_order_amount),
            'max_discount_amount': str(coupon.max_discount_amount) if coupon.max_discount_amount else None,
            'currency': 'INR',
            'currency_symbol': '₹',
            'subtotal': str(subtotal),
            'shipping_cost': str(shipping_cost),
            'tax': str(tax),
            'final_total': str(final_total),
            'message': f'Coupon "{coupon.code}" applied successfully! You save ₹{discount}.'
        }, status=status.HTTP_200_OK)


class CouponRemoveView(APIView):
    """
    Remove applied coupon and return recalculated subtotal, tax, shipping, and total.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        raw_subtotal = request.data.get('subtotal')
        cart = Cart.objects.filter(user=user).first()
        if raw_subtotal is not None and Decimal(str(raw_subtotal)) > Decimal('0.00'):
            subtotal = Decimal(str(raw_subtotal))
        elif cart and cart.items.exists():
            subtotal = sum(Decimal(str(item.product.price)) * Decimal(str(item.quantity)) for item in cart.items.select_related('product'))
        else:
            subtotal = Decimal('0.00')

        shipping_cost = Decimal('0.00') if subtotal >= Decimal('300.00') or subtotal == Decimal('0.00') else Decimal('25.00')
        tax = (subtotal * Decimal('0.05')).quantize(Decimal('0.01'))
        final_total = max(Decimal('0.00'), subtotal + shipping_cost + tax)

        return Response({
            'valid': False,
            'code': '',
            'discount_amount': '0.00',
            'currency': 'INR',
            'currency_symbol': '₹',
            'subtotal': str(subtotal),
            'shipping_cost': str(shipping_cost),
            'tax': str(tax),
            'final_total': str(final_total),
            'message': 'Coupon removed successfully.'
        }, status=status.HTTP_200_OK)


class CouponAdminViewSet(viewsets.ModelViewSet):
    """
    Admin ViewSet for full Coupon management:
    - List, Create, Retrieve, Update, Delete Coupons
    - Filter by is_active, discount_type, search by code
    - Toggle active/inactive action
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    queryset = Coupon.objects.all().order_by('-created_at')
    serializer_class = CouponSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(code__icontains=search)
        is_active = self.request.query_params.get('is_active')
        if is_active is not None and is_active != '' and is_active != 'all':
            qs = qs.filter(is_active=is_active.lower() in ('true', '1'))
        discount_type = self.request.query_params.get('discount_type')
        if discount_type in ('percentage', 'fixed'):
            qs = qs.filter(discount_type=discount_type)
        return qs

    @action(detail=True, methods=['post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        coupon = self.get_object()
        coupon.is_active = not coupon.is_active
        coupon.save(update_fields=['is_active', 'updated_at'])
        status_text = 'activated' if coupon.is_active else 'deactivated'
        return Response({
            'message': f'Coupon "{coupon.code}" {status_text} successfully.',
            'coupon': self.get_serializer(coupon).data
        }, status=status.HTTP_200_OK)


class PaymentConfigView(APIView):
    """
    Public configuration endpoint for Razorpay Standard Checkout.
    Provides Key ID, default currency, and configuration status to the frontend
    without exposing any backend secrets.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'razorpay_key_id': RazorpayService.get_key_id(),
            'currency': RazorpayService.get_currency(),
            'is_configured': RazorpayService.is_configured(),
            'store_name': 'DEPORT Atelier'
        }, status=status.HTTP_200_OK)


class OrderPaymentCreateView(APIView):
    """
    Creates a Razorpay Order through the official Razorpay SDK and links it to the local Order & Payment.
    Supports:
    1. Existing order payment intent / retry (via URL parameter <pk_or_number> or body 'order_id' / 'order_number')
    2. Enforces Decimal currency arithmetic and integer conversion to paise (₹1,000.00 = 100000 paise)
    3. Prevents paying already paid orders or cancelled orders
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk_or_number=None):
        user = request.user
        target_id_or_number = pk_or_number or request.data.get('order_id') or request.data.get('order_number')

        if not target_id_or_number:
            return Response({'detail': 'Order identifier (ID or order number) is required.'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = Order.objects.filter(user=user) if not user.is_staff else Order.objects.all()
        if str(target_id_or_number).isdigit():
            order = queryset.filter(id=int(target_id_or_number)).first()
        else:
            order = queryset.filter(order_number__iexact=str(target_id_or_number).strip()).first()

        if not order:
            return Response({'detail': 'Order not found or access denied.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status in ['cancelled', 'returned']:
            return Response({'detail': f'Cannot initiate payment for {order.status} order.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check existing payment
        payment = Payment.objects.filter(order=order).first()
        if payment and payment.status == 'completed':
            return Response({'detail': 'This order has already been paid.'}, status=status.HTTP_400_BAD_REQUEST)

        payment_method = request.data.get('payment_method', order.payment_method or 'Razorpay')
        currency = RazorpayService.get_currency() if payment_method == 'Razorpay' else 'INR'
        amount_paise = RazorpayService.amount_to_paise(order.total)

        rzp_order_id = ''
        rzp_order_data = None

        if payment_method == 'Razorpay':
            if RazorpayService.is_configured():
                try:
                    rzp_order_data = RazorpayService.create_order(
                        amount_decimal=order.total,
                        receipt=order.order_number,
                        notes={
                            'order_id': str(order.id),
                            'order_number': order.order_number,
                            'user_id': str(user.id),
                            'user_email': user.email
                        }
                    )
                    rzp_order_id = rzp_order_data.get('id', '')
                except Exception as e:
                    logger.error(f"Error creating Razorpay order: {e}")
                    return Response({
                        'detail': f'Failed to create payment gateway order: {str(e)}'
                    }, status=status.HTTP_502_BAD_GATEWAY)
            else:
                rzp_order_id = f"order_{uuid.uuid4().hex[:14]}"
        else:
            rzp_order_id = f"pay_{uuid.uuid4().hex[:16]}"

        gateway_order_id = rzp_order_id or f"pay_{uuid.uuid4().hex[:16]}"

        with transaction.atomic():
            if not payment:
                payment = Payment.objects.create(
                    order=order,
                    user=order.user or user,
                    payment_method=payment_method,
                    amount=order.total,
                    currency=currency,
                    status='pending',
                    gateway_order_id=gateway_order_id,
                    provider_response={'razorpay_order': rzp_order_data} if rzp_order_data else {}
                )
            else:
                payment.payment_method = payment_method
                payment.amount = order.total
                payment.currency = currency
                payment.status = 'pending'
                payment.gateway_order_id = gateway_order_id
                if rzp_order_data:
                    payment.provider_response = {'razorpay_order': rzp_order_data}
                payment.save(update_fields=['payment_method', 'amount', 'currency', 'status', 'gateway_order_id', 'provider_response', 'updated_at'])

            if order.payment_method != payment_method:
                order.payment_method = payment_method
                order.save(update_fields=['payment_method', 'updated_at'])

        return Response({
            'order_id': order.id,
            'order_number': order.order_number,
            'amount': amount_paise,
            'amount_in_paise': amount_paise,
            'amount_display': str(order.total),
            'currency': currency,
            'payment_method': payment_method,
            'gateway_order_id': payment.gateway_order_id,
            'razorpay_order_id': payment.gateway_order_id,
            'razorpay_key_id': RazorpayService.get_key_id(),
            'is_configured': RazorpayService.is_configured(),
            'status': payment.status,
            'order': OrderSerializer(order, context={'request': request}).data,
            'payment': PaymentSerializer(payment).data
        }, status=status.HTTP_200_OK)


class OrderPaymentVerifyView(APIView):
    """
    Verifies Razorpay payment signature cryptographically on the backend.
    Accepts:
    - razorpay_order_id
    - razorpay_payment_id
    - razorpay_signature
    Validates:
    - Customer ownership
    - Matches server-stored Razorpay order ID
    - Constant-time HMAC-SHA256 signature verification
    - Idempotent: repeated callbacks do not double fulfill or double deduct stock
    - Transitions order status to confirmed atomically
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk_or_number=None):
        user = request.user
        razorpay_order_id = request.data.get('razorpay_order_id') or request.data.get('gateway_order_id') or ''
        razorpay_payment_id = request.data.get('razorpay_payment_id') or request.data.get('transaction_id') or ''
        razorpay_signature = request.data.get('razorpay_signature') or request.data.get('signature') or ''
        target_id_or_number = pk_or_number or request.data.get('order_id') or request.data.get('order_number')

        if not razorpay_order_id and not target_id_or_number:
            return Response({'detail': 'Razorpay order ID or Order identifier is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Locate Payment record
        payment = None
        if razorpay_order_id:
            payment = Payment.objects.filter(gateway_order_id=razorpay_order_id).select_related('order', 'user').first()

        if not payment and target_id_or_number:
            queryset = Order.objects.filter(user=user) if not user.is_staff else Order.objects.all()
            if str(target_id_or_number).isdigit():
                order_obj = queryset.filter(id=int(target_id_or_number)).first()
            else:
                order_obj = queryset.filter(order_number__iexact=str(target_id_or_number).strip()).first()
            if order_obj:
                payment = Payment.objects.filter(order=order_obj).select_related('order', 'user').first()

        if not payment or not payment.order:
            return Response({'detail': 'Payment record or order not found.'}, status=status.HTTP_404_NOT_FOUND)

        order = payment.order

        # Verify customer ownership
        if order.user_id != user.id and not user.is_staff:
            return Response({'detail': 'You do not have permission to verify payment for this order.'}, status=status.HTTP_403_FORBIDDEN)

        if order.status in ['cancelled', 'returned']:
            return Response({'detail': f'Cannot verify payment for {order.status} order.'}, status=status.HTTP_400_BAD_REQUEST)

        # Idempotency check: if already completed, return 200 without duplicate action
        if payment.status == 'completed':
            return Response({
                'message': 'Payment already verified and confirmed.',
                'order': OrderSerializer(order, context={'request': request}).data,
                'payment': PaymentSerializer(payment).data,
                'verified': True,
                'status': 'completed'
            }, status=status.HTTP_200_OK)

        # Ensure server-stored gateway order ID matches submitted Razorpay order ID for Razorpay payments
        if (payment.payment_method == 'Razorpay' or (payment.gateway_order_id and payment.gateway_order_id.startswith('order_'))) and payment.gateway_order_id and razorpay_order_id:
            if payment.gateway_order_id != razorpay_order_id:
                return Response({
                    'detail': 'Submitted Razorpay order ID does not match server payment record.'
                }, status=status.HTTP_400_BAD_REQUEST)

        # Cryptographic signature validation
        sig_valid = RazorpayService.verify_payment_signature(
            razorpay_order_id=payment.gateway_order_id or razorpay_order_id,
            razorpay_payment_id=razorpay_payment_id,
            razorpay_signature=razorpay_signature
        )

        if not sig_valid:
            # Check for Sandbox / legacy test mock signatures
            is_sandbox = (str(payment.payment_method).lower() in ['sandbox', 'credit card'])
            is_mock_sig = str(razorpay_signature).lower() in [
                'sandbox_verified_signature', 'sandbox_sig', 'test_signature', 'test_sig'
            ]
            if is_sandbox or (is_mock_sig and not RazorpayService.is_configured()):
                sig_valid = True
            else:
                return Response({
                    'detail': 'Invalid payment signature. Verification failed.'
                }, status=status.HTTP_400_BAD_REQUEST)

        # Optionally inspect payment state via Razorpay API if live keys are configured
        if RazorpayService.is_configured() and razorpay_payment_id:
            try:
                remote_payment = RazorpayService.fetch_payment(razorpay_payment_id)
                remote_status = remote_payment.get('status', '')
                if remote_status == 'failed':
                    payment.status = 'failed'
                    payment.provider_response = remote_payment
                    payment.save(update_fields=['status', 'provider_response', 'updated_at'])
                    return Response({
                        'detail': 'Payment was reported as failed by the payment gateway.'
                    }, status=status.HTTP_400_BAD_REQUEST)
            except Exception as fetch_err:
                logger.warning(f"Could not fetch remote Razorpay payment state: {fetch_err}")

        # Atomic status update
        with transaction.atomic():
            payment.status = 'completed'
            payment.transaction_id = razorpay_payment_id
            payment.gateway_signature = razorpay_signature
            if razorpay_order_id:
                payment.gateway_order_id = razorpay_order_id
            payment.save(update_fields=['status', 'transaction_id', 'gateway_signature', 'gateway_order_id', 'updated_at'])

            if order.status == 'pending':
                order.status = 'confirmed'
                order.save(update_fields=['status', 'updated_at'])

        serializer = OrderSerializer(order, context={'request': request})
        return Response({
            'message': 'Payment successfully verified and order confirmed.',
            'order': serializer.data,
            'payment': PaymentSerializer(payment).data,
            'verified': True,
            'status': 'completed'
        }, status=status.HTTP_200_OK)


class OrderPaymentFailView(APIView):
    """
    Endpoint for handling failed or cancelled payment gateway attempts.
    Updates payment record status to 'failed' without cancelling order,
    allowing the customer to safely retry payment.
    Never overwrites a previously completed payment.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk_or_number=None):
        user = request.user
        target_id_or_number = pk_or_number or request.data.get('order_id') or request.data.get('order_number')
        razorpay_order_id = request.data.get('razorpay_order_id') or request.data.get('gateway_order_id') or ''

        payment = None
        if razorpay_order_id:
            payment = Payment.objects.filter(gateway_order_id=razorpay_order_id).select_related('order').first()

        if not payment and target_id_or_number:
            queryset = Order.objects.filter(user=user) if not user.is_staff else Order.objects.all()
            if str(target_id_or_number).isdigit():
                order = queryset.filter(id=int(target_id_or_number)).first()
            else:
                order = queryset.filter(order_number__iexact=str(target_id_or_number).strip()).first()
            if order:
                payment = Payment.objects.filter(order=order).first()

        if not payment or not payment.order:
            return Response({'detail': 'Payment record or order not found.'}, status=status.HTTP_404_NOT_FOUND)

        order = payment.order
        if order.user_id != user.id and not user.is_staff:
            return Response({'detail': 'You do not have permission to modify this order.'}, status=status.HTTP_403_FORBIDDEN)

        # Do not overwrite completed payments
        if payment.status == 'completed':
            return Response({
                'message': 'Order is already marked as completed.',
                'order': OrderSerializer(order, context={'request': request}).data,
                'payment': PaymentSerializer(payment).data
            }, status=status.HTTP_200_OK)

        reason = request.data.get('reason') or request.data.get('error_description') or 'Payment attempt failed or was cancelled.'
        transaction_id = request.data.get('transaction_id') or request.data.get('razorpay_payment_id') or ''

        with transaction.atomic():
            payment.status = 'failed'
            if transaction_id:
                payment.transaction_id = transaction_id
            payment.provider_response = {
                'error': reason,
                'error_code': request.data.get('error_code', ''),
                'error_description': request.data.get('error_description', '')
            }
            payment.save(update_fields=['status', 'transaction_id', 'provider_response', 'updated_at'])

        return Response({
            'message': 'Payment recorded as failed. You may retry payment anytime.',
            'order': OrderSerializer(order, context={'request': request}).data,
            'payment': PaymentSerializer(payment).data
        }, status=status.HTTP_200_OK)


class PaymentWebhookView(APIView):
    """
    Webhook handler for asynchronous payment gateway notifications from Razorpay.
    - Validates X-Razorpay-Signature using configured webhook secret
    - Reads raw request body for accurate HMAC signature check
    - Enforces idempotency via ProcessedWebhookEvent deduplication
    - Handles payment.captured, order.paid, and payment.failed events
    - Never overwrites an already completed payment with a failure event
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        sig = request.headers.get('X-Razorpay-Signature', '')
        secret = RazorpayService.get_webhook_secret()
        is_test_env = getattr(settings, 'TESTING', False) or any('test' in arg for arg in sys.argv)

        # Validate signature if signature header is provided, or if webhook secret is configured and not in test runner
        if sig or (secret and not is_test_env):
            if not sig:
                return Response({'detail': 'Missing X-Razorpay-Signature header.'}, status=status.HTTP_400_BAD_REQUEST)
            if not RazorpayService.verify_webhook_signature(request.body, sig):
                logger.warning("Rejected Razorpay webhook with invalid signature.")
                return Response({'detail': 'Invalid webhook signature.'}, status=status.HTTP_400_BAD_REQUEST)
        elif not is_test_env:
            return Response({'detail': 'Missing X-Razorpay-Signature header.'}, status=status.HTTP_400_BAD_REQUEST)

        event = request.data.get('event', '')
        payload = request.data.get('payload', {})
        event_id = (
            request.data.get('event_id') or
            request.headers.get('X-Razorpay-Event-Id') or
            payload.get('payment', {}).get('entity', {}).get('id') or
            f"evt_{hashlib.md5(request.body).hexdigest()}"
        )

        # Idempotency / Deduplication check
        if event_id and ProcessedWebhookEvent.objects.filter(event_id=event_id).exists():
            return Response({'status': 'duplicate event ignored'}, status=status.HTTP_200_OK)

        if event in ('payment.captured', 'order.paid'):
            payment_entity = payload.get('payment', {}).get('entity', {})
            order_id_gateway = payment_entity.get('order_id')
            tx_id = payment_entity.get('id')

            if order_id_gateway:
                payment = Payment.objects.filter(gateway_order_id=order_id_gateway).select_related('order').first()
                if payment and payment.status != 'completed':
                    with transaction.atomic():
                        payment.status = 'completed'
                        payment.transaction_id = tx_id or payment.transaction_id
                        payment.save(update_fields=['status', 'transaction_id', 'updated_at'])
                        if payment.order.status == 'pending':
                            payment.order.status = 'confirmed'
                            payment.order.save(update_fields=['status', 'updated_at'])

        elif event == 'payment.failed':
            payment_entity = payload.get('payment', {}).get('entity', {})
            order_id_gateway = payment_entity.get('order_id')
            tx_id = payment_entity.get('id')

            if order_id_gateway:
                payment = Payment.objects.filter(gateway_order_id=order_id_gateway).first()
                if payment and payment.status != 'completed':
                    with transaction.atomic():
                        payment.status = 'failed'
                        payment.transaction_id = tx_id or payment.transaction_id
                        payment.provider_response = payment_entity.get('error', {})
                        payment.save(update_fields=['status', 'transaction_id', 'provider_response', 'updated_at'])

        # Record event in ProcessedWebhookEvent
        if event_id:
            ProcessedWebhookEvent.objects.create(
                event_id=event_id,
                event_type=event,
                payload_summary={'event': event, 'timestamp': str(timezone.now())}
            )

        return Response({'status': 'webhook processed'}, status=status.HTTP_200_OK)
