import threading
import datetime
import json
import hmac
import hashlib
from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase, TransactionTestCase
from django.db import connections
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from products.models import Product
from categories.models import Category
from orders.models import Order, OrderItem, Coupon, CouponUsage, Payment, ProcessedWebhookEvent

User = get_user_model()


class OrderManagementTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Admin
        self.admin = User.objects.create_superuser(
            email='admin@deport.com',
            password='AdminPassword123!',
            first_name='Admin',
            last_name='User'
        )

        # Create Customer
        self.customer = User.objects.create_user(
            email='customer@deport.com',
            password='CustomerPassword123!',
            first_name='Customer',
            last_name='User',
            is_email_verified=True,
            is_active=True
        )

        # Create Category & Product
        self.category = Category.objects.create(name='Leather Bags', description='Luxury leather bags')
        self.product = Product.objects.create(
            name='Executive Tote',
            price=199.99,
            sku='TEST-SKU-001',
            stock_quantity=10,
            category=self.category
        )

        # Create Sample Order
        self.order = Order.objects.create(
            user=self.customer,
            subtotal=199.99,
            shipping_cost=0.00,
            discount=0.00,
            total=199.99,
            shipping_full_name='Customer User',
            shipping_phone='+1 (555) 234-5678',
            shipping_address_line_1='123 Luxury Ave',
            shipping_city='New York',
            shipping_state='NY',
            shipping_postal_code='10001',
            shipping_country='United States',
            status='pending'
        )

        self.order_item = OrderItem.objects.create(
            order=self.order,
            product=self.product,
            product_name=self.product.name,
            product_sku=self.product.sku,
            quantity=1,
            unit_price=199.99,
            total_price=199.99
        )

    def test_admin_order_list(self):
        # 1. Unauthenticated request rejected
        res1 = self.client.get('/api/admin/orders/')
        self.assertEqual(res1.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Customer request rejected
        self.client.force_authenticate(user=self.customer)
        res2 = self.client.get('/api/admin/orders/')
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Admin request succeeds
        self.client.force_authenticate(user=self.admin)
        res3 = self.client.get('/api/admin/orders/')
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        self.assertIn('results', res3.data)
        self.assertEqual(res3.data['count'], 1)

    def test_admin_order_detail(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f'/api/admin/orders/{self.order.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['order_number'], self.order.order_number)
        self.assertEqual(len(response.data['items']), 1)

    def test_admin_update_order_status(self):
        self.client.force_authenticate(user=self.admin)
        payload = {'status': 'shipped'}
        response = self.client.patch(f'/api/admin/orders/{self.order.id}/status/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['order']['status'], 'shipped')
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'shipped')

    def test_checkout_server_authoritative_calculations(self):
        from cart.models import Cart, CartItem
        from addresses.models import Address

        # Create address
        address = Address.objects.create(
            user=self.customer,
            label='Home',
            full_name='Customer User',
            phone='+1 (555) 234-5678',
            address_line_1='123 Test St',
            city='New York',
            state='NY',
            postal_code='10001',
            country='United States',
            is_default=True
        )

        # Add item to cart: 2 x $199.99 = $399.98 (>= $300, so free shipping!)
        cart, _ = Cart.objects.get_or_create(user=self.customer)
        CartItem.objects.create(cart=cart, product=self.product, quantity=2)

        self.client.force_authenticate(user=self.customer)
        # Attempt to manipulate tax and discount in request payload
        payload = {
            'address_id': address.id,
            'payment_method': 'Cash on Delivery',
            'tax': '0.00',
            'discount': '100.00'
        }
        initial_stock = self.product.stock_quantity
        response = self.client.post('/api/orders/checkout/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        order_data = response.data['order']
        # Subtotal: 2 * 199.99 = 399.98
        self.assertEqual(float(order_data['subtotal']), 399.98)
        # Free shipping since >= 300
        self.assertEqual(float(order_data['shipping_cost']), 0.00)
        # Client injected discount must be ignored!
        self.assertEqual(float(order_data['discount']), 0.00)
        # Authoritative tax: 5% of 399.98 = 20.00
        self.assertEqual(float(order_data['tax']), 20.00)
        # Total: 399.98 + 0.00 + 20.00 = 419.98
        self.assertEqual(float(order_data['total']), 419.98)

        # Stock must be decremented atomically
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, initial_stock - 2)

    def test_checkout_address_idor_prevention(self):
        from cart.models import Cart, CartItem
        from addresses.models import Address

        # Address belonging to Admin / Victim
        victim_address = Address.objects.create(
            user=self.admin,
            label='Office',
            full_name='Admin Target',
            phone='+1 (555) 000-0000',
            address_line_1='999 Secret Penthouse',
            city='New York',
            state='NY',
            postal_code='10001',
            country='United States'
        )

        cart, _ = Cart.objects.get_or_create(user=self.customer)
        CartItem.objects.create(cart=cart, product=self.product, quantity=1)

        self.client.force_authenticate(user=self.customer)
        # Attacker attempts to checkout with victim's address ID
        payload = {
            'address_id': victim_address.id,
            'payment_method': 'Cash on Delivery'
        }
        response = self.client.post('/api/orders/checkout/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid shipping address selected', response.data['detail'])

    def test_coupon_validation_and_checkout_redemption(self):
        from cart.models import Cart, CartItem
        from addresses.models import Address
        from orders.models import Coupon, CouponUsage

        address = Address.objects.create(
            user=self.customer,
            label='Home',
            full_name='Customer User',
            phone='+1 (555) 234-5678',
            address_line_1='123 Test St',
            city='New York',
            state='NY',
            postal_code='10001',
            country='United States',
            is_default=True
        )

        # Create active 10% coupon with min purchase $100 and user limit 1
        coupon = Coupon.objects.create(
            code='SAVE10',
            discount_type='percentage',
            discount_value=10.00,
            min_order_amount=100.00,
            per_user_limit=1,
            is_active=True
        )

        cart, _ = Cart.objects.get_or_create(user=self.customer)
        CartItem.objects.create(cart=cart, product=self.product, quantity=1) # $199.99

        self.client.force_authenticate(user=self.customer)

        # 1. Validate coupon endpoint
        val_resp = self.client.post('/api/orders/coupons/validate/', {'code': 'save10'}, format='json')
        self.assertEqual(val_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(val_resp.data['valid'])
        # 10% of 199.99 = 20.00
        self.assertEqual(float(val_resp.data['discount_amount']), 20.00)

        # 2. Checkout with coupon
        payload = {
            'address_id': address.id,
            'payment_method': 'Cash on Delivery',
            'coupon_code': 'SAVE10'
        }
        chk_resp = self.client.post('/api/orders/checkout/', payload, format='json')
        self.assertEqual(chk_resp.status_code, status.HTTP_201_CREATED)
        order_data = chk_resp.data['order']
        self.assertEqual(order_data['coupon_code'], 'SAVE10')
        self.assertEqual(float(order_data['discount']), 20.00)

        # Verify CouponUsage was recorded
        self.assertEqual(CouponUsage.objects.filter(coupon=coupon, user=self.customer).count(), 1)
        coupon.refresh_from_db()
        self.assertEqual(coupon.used_count, 1)

        # 3. Subsequent checkout with same coupon should be rejected because user_limit is 1
        CartItem.objects.create(cart=cart, product=self.product, quantity=1)
        chk_resp2 = self.client.post('/api/orders/checkout/', payload, format='json')
        self.assertEqual(chk_resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already redeemed', chk_resp2.data['detail'])

    def test_payment_creation_and_verification(self):
        self.client.force_authenticate(user=self.customer)

        # 1. Create payment intent
        create_resp = self.client.post(
            f'/api/orders/{self.order.id}/payment/create/',
            {'payment_method': 'Sandbox'},
            format='json'
        )
        self.assertEqual(create_resp.status_code, status.HTTP_200_OK)
        gateway_order_id = create_resp.data['gateway_order_id']
        self.assertTrue(gateway_order_id)

        # 2. Verify payment
        verify_payload = {
            'gateway_order_id': gateway_order_id,
            'transaction_id': 'txn_test_123456',
            'signature': 'test_signature'
        }
        verify_resp = self.client.post(
            f'/api/orders/{self.order.id}/payment/verify/',
            verify_payload,
            format='json'
        )
        self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'confirmed')
        self.assertEqual(self.order.payments.first().status, 'completed')

    def test_order_cancellation_restores_stock(self):
        initial_stock = self.product.stock_quantity
        self.client.force_authenticate(user=self.customer)

        cancel_resp = self.client.post(
            f'/api/orders/{self.order.id}/cancel/',
            {'reason': 'Ordered by mistake'},
            format='json'
        )
        self.assertEqual(cancel_resp.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'cancelled')

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, initial_stock + self.order_item.quantity)

    def test_checkout_idempotency(self):
        from cart.models import Cart, CartItem
        from addresses.models import Address

        address = Address.objects.create(
            user=self.customer,
            label='Home',
            full_name='Customer User',
            phone='+1 (555) 234-5678',
            address_line_1='123 Test St',
            city='New York',
            state='NY',
            postal_code='10001',
            country='United States',
            is_default=True
        )

        cart, _ = Cart.objects.get_or_create(user=self.customer)
        CartItem.objects.create(cart=cart, product=self.product, quantity=1)
        initial_stock = self.product.stock_quantity

        self.client.force_authenticate(user=self.customer)
        idempotency_key = 'idem_test_key_999'

        payload = {
            'address_id': address.id,
            'payment_method': 'Cash on Delivery',
            'idempotency_key': idempotency_key
        }

        # First checkout attempt
        res1 = self.client.post('/api/orders/checkout/', payload, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        order_number_1 = res1.data['order']['order_number']

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, initial_stock - 1)

        # Immediate duplicate click with identical idempotency key
        res2 = self.client.post('/api/orders/checkout/', payload, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['order']['order_number'], order_number_1)

        # Ensure stock was not decremented twice
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, initial_stock - 1)

    def test_payment_fail_endpoint(self):
        from orders.models import Payment

        self.client.force_authenticate(user=self.customer)
        # Create a pending payment
        payment = Payment.objects.create(
            order=self.order,
            user=self.customer,
            payment_method='Sandbox',
            amount=self.order.total,
            status='pending',
            gateway_order_id='gw_order_123'
        )

        fail_payload = {
            'reason': 'Customer cancelled transaction on gateway modal',
            'transaction_id': 'txn_failed_abc'
        }
        res = self.client.post(
            f'/api/orders/{self.order.id}/payment/fail/',
            fail_payload,
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        self.assertEqual(payment.status, 'failed')
        self.assertEqual(payment.transaction_id, 'txn_failed_abc')
        # Order is not cancelled, so user can retry payment
        self.order.refresh_from_db()
        self.assertNotEqual(self.order.status, 'cancelled')

    def test_admin_status_transition_rules(self):
        from orders.models import Payment

        self.client.force_authenticate(user=self.admin)

        # 1. Delivered automatically marks COD payment completed
        cod_payment = Payment.objects.create(
            order=self.order,
            user=self.customer,
            payment_method='Cash on Delivery',
            amount=self.order.total,
            status='pending'
        )

        res = self.client.patch(
            f'/api/admin/orders/{self.order.id}/status/',
            {'status': 'delivered'},
            format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        cod_payment.refresh_from_db()
        self.assertEqual(cod_payment.status, 'completed')

        # 2. Cannot revert delivered order to processing
        res_revert = self.client.patch(
            f'/api/admin/orders/{self.order.id}/status/',
            {'status': 'processing'},
            format='json'
        )
        self.assertEqual(res_revert.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Delivered orders cannot be reverted', res_revert.data['detail'])

        # 3. Create a cancelled order and attempt to transition
        self.order.status = 'cancelled'
        self.order.save()

        res_invalid = self.client.patch(
            f'/api/admin/orders/{self.order.id}/status/',
            {'status': 'shipped'},
            format='json'
        )
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Cancelled orders cannot change status', res_invalid.data['detail'])

    def test_coupon_serializer_alias_support(self):
        from orders.serializers import CouponSerializer

        data = {
            'code': 'SUMMER25',
            'discount_type': 'percentage',
            'discount_value': 25.00,
            'min_purchase_amount': 75.00,  # alias for min_order_amount
            'end_date': '2028-12-31T23:59:59Z',  # alias for expiration_date
            'user_limit': 3,  # alias for per_user_limit
            'is_active': True
        }
        serializer = CouponSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        coupon = serializer.save()

        self.assertEqual(coupon.code, 'SUMMER25')
        self.assertEqual(float(coupon.min_order_amount), 75.00)
        self.assertEqual(coupon.per_user_limit, 3)
        self.assertIsNotNone(coupon.expiration_date)

    def test_admin_dashboard_realized_revenue(self):
        from orders.models import Payment

        # Clear existing payments or create a controlled environment
        Payment.objects.all().delete()

        # Create 1 completed payment ($100), 1 pending payment ($200), 1 failed payment ($500)
        Payment.objects.create(
            order=self.order,
            user=self.customer,
            payment_method='Sandbox',
            amount=100.00,
            status='completed',
            transaction_id='txn_paid_1'
        )
        Payment.objects.create(
            order=self.order,
            user=self.customer,
            payment_method='Sandbox',
            amount=200.00,
            status='pending'
        )
        Payment.objects.create(
            order=self.order,
            user=self.customer,
            payment_method='Credit Card',
            amount=500.00,
            status='failed'
        )

        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/admin/dashboard/stats/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Revenue should strictly equal 100.00 (from verified completed payments)
        self.assertEqual(float(res.data['total_revenue']), 100.00)


class InventoryStockManagementTestCase(TransactionTestCase):
    """
    Automated DRF Test Suite for DEPORT Inventory Management:
    1. Placing an order decreases stock by the exact ordered quantity.
    2. Cancelling an eligible order restores the exact quantity.
    3. Repeated cancellation does not restore stock twice.
    4. A user cannot cancel another user's order.
    5. Insufficient stock prevents the entire order from being created.
    6. A failed order transaction leaves all stock quantities unchanged.
    7. Multiple products have their quantities updated correctly.
    8. Duplicate checkout requests do not deduct stock twice.
    9. Concurrent orders cannot reduce stock below zero.
    10. Payment retries and callbacks do not cause duplicate inventory changes.
    11. An order that cannot be cancelled does not restore stock.
    12. Admin cancellation follows the same inventory rules.
    """
    reset_sequences = True

    def setUp(self):
        self.client = APIClient()

        # Admin
        self.admin = User.objects.create_superuser(
            email='admin_inv@deport.com',
            password='AdminPassword123!',
            first_name='Admin',
            last_name='User'
        )

        # Customer 1
        self.customer1 = User.objects.create_user(
            email='customer1_inv@deport.com',
            password='CustomerPassword123!',
            first_name='Customer',
            last_name='One',
            is_email_verified=True,
            is_active=True
        )

        # Customer 2
        self.customer2 = User.objects.create_user(
            email='customer2_inv@deport.com',
            password='CustomerPassword123!',
            first_name='Customer',
            last_name='Two',
            is_email_verified=True,
            is_active=True
        )

        # Category
        self.category = Category.objects.create(name='Leather Bags', description='Luxury bags')

        # Products
        self.product_a = Product.objects.create(
            name='Bag A',
            sku='BAG-A-001',
            price=100.00,
            stock_quantity=10,
            category=self.category
        )
        self.product_b = Product.objects.create(
            name='Bag B',
            sku='BAG-B-002',
            price=150.00,
            stock_quantity=5,
            category=self.category
        )
        self.product_c = Product.objects.create(
            name='Bag C',
            sku='BAG-C-003',
            price=200.00,
            stock_quantity=8,
            category=self.category
        )

        # Default Address for Customer 1
        from addresses.models import Address
        self.address1 = Address.objects.create(
            user=self.customer1,
            label='Home',
            full_name='Customer One',
            phone='+1 (555) 111-2222',
            address_line_1='100 Atelier Way',
            city='New York',
            state='NY',
            postal_code='10001',
            country='United States',
            is_default=True
        )

        # Default Address for Customer 2
        self.address2 = Address.objects.create(
            user=self.customer2,
            label='Home',
            full_name='Customer Two',
            phone='+1 (555) 333-4444',
            address_line_1='200 Fifth Ave',
            city='New York',
            state='NY',
            postal_code='10002',
            country='United States',
            is_default=True
        )

    def _setup_cart(self, user, items_dict):
        """Helper to populate user cart with {product: quantity}"""
        from cart.models import Cart, CartItem
        cart, _ = Cart.objects.get_or_create(user=user)
        cart.items.all().delete()
        for prod, qty in items_dict.items():
            CartItem.objects.create(cart=cart, product=prod, quantity=qty)
        return cart

    def test_01_placing_order_decreases_stock_by_exact_quantity(self):
        """1. Placing an order decreases stock by the exact ordered quantity."""
        initial_stock = self.product_a.stock_quantity  # 10
        ordered_qty = 2
        self._setup_cart(self.customer1, {self.product_a: ordered_qty})

        self.client.force_authenticate(user=self.customer1)
        res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, initial_stock - ordered_qty)
        self.assertEqual(self.product_a.stock_quantity, 8)

        # Verify OrderItem record
        order_id = res.data['order']['id']
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.first().quantity, ordered_qty)

    def test_02_cancelling_eligible_order_restores_exact_quantity(self):
        """2. Cancelling an eligible order restores the exact quantity."""
        # Initial stock: 10 bags. Customer orders 3 -> stock becomes 7.
        self._setup_cart(self.customer1, {self.product_a: 3})
        self.client.force_authenticate(user=self.customer1)
        chk_res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery'
        }, format='json')
        self.assertEqual(chk_res.status_code, status.HTTP_201_CREATED)
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 7)

        order_id = chk_res.data['order']['id']
        cancel_res = self.client.post(f'/api/orders/{order_id}/cancel/', {
            'reason': 'Customer requested cancellation'
        }, format='json')
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)

        # Stock returns to 10
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 10)

        # Order status is Cancelled
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'cancelled')
        self.assertIsNotNone(order.cancelled_at)

    def test_03_repeated_cancellation_does_not_restore_stock_twice(self):
        """3. Repeated cancellation does not restore stock twice."""
        # Initial stock: 10 bags. Order 3 -> stock becomes 7.
        self._setup_cart(self.customer1, {self.product_a: 3})
        self.client.force_authenticate(user=self.customer1)
        chk_res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery'
        }, format='json')
        order_id = chk_res.data['order']['id']
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 7)

        # First cancellation restores stock to 10
        res1 = self.client.post(f'/api/orders/{order_id}/cancel/', format='json')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 10)

        # Repeated cancellation request: must reject and NOT increase stock to 13!
        res2 = self.client.post(f'/api/orders/{order_id}/cancel/', format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been cancelled', res2.data['detail'])

        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 10)

        # Third attempt via admin status update: must also reject and keep stock 10
        self.client.force_authenticate(user=self.admin)
        res3 = self.client.patch(f'/api/orders/admin/orders/{order_id}/status/', {
            'status': 'cancelled'
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 10)

    def test_04_user_cannot_cancel_another_users_order(self):
        """4. A user cannot cancel another user's order."""
        self._setup_cart(self.customer1, {self.product_a: 2})
        self.client.force_authenticate(user=self.customer1)
        chk_res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery'
        }, format='json')
        order_id = chk_res.data['order']['id']
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)

        # Customer 2 attempts to cancel Customer 1's order
        self.client.force_authenticate(user=self.customer2)
        res = self.client.post(f'/api/orders/{order_id}/cancel/', format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('permission', res.data['detail'].lower())

        # Stock must remain unchanged at 8
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)

        # Order status must remain pending
        order = Order.objects.get(id=order_id)
        self.assertEqual(order.status, 'pending')

    def test_05_insufficient_stock_prevents_entire_order_from_being_created(self):
        """5. Insufficient stock prevents the entire order from being created."""
        self.product_b.stock_quantity = 2
        self.product_b.save()

        # Customer requests 5 bags of Product B (only 2 available)
        self._setup_cart(self.customer1, {self.product_b: 5})
        self.client.force_authenticate(user=self.customer1)
        initial_order_count = Order.objects.count()

        res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Insufficient stock', res.data['detail'])

        # No order created
        self.assertEqual(Order.objects.count(), initial_order_count)
        # Stock untouched
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.stock_quantity, 2)

    def test_06_failed_order_transaction_leaves_all_stock_quantities_unchanged(self):
        """6. A failed order transaction leaves all stock quantities unchanged."""
        initial_stock = self.product_a.stock_quantity
        self._setup_cart(self.customer1, {self.product_a: 2})
        self.client.force_authenticate(user=self.customer1)

        initial_order_count = Order.objects.count()

        # Simulate unexpected DB error during payment record creation
        with patch('orders.models.Payment.objects.create', side_effect=RuntimeError('Database simulated failure')):
            with self.assertRaises(RuntimeError):
                self.client.post('/api/orders/checkout/', {
                    'address_id': self.address1.id,
                    'payment_method': 'Cash on Delivery'
                }, format='json')

        # Stock must be completely unchanged due to transaction rollback
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, initial_stock)
        self.assertEqual(Order.objects.count(), initial_order_count)

    def test_07_multiple_products_quantities_updated_correctly(self):
        """7. Multiple products have their quantities updated correctly."""
        # Initial stock: Bag A: 10, Bag B: 5, Bag C: 8
        self._setup_cart(self.customer1, {
            self.product_a: 2,
            self.product_b: 1,
            self.product_c: 3
        })
        self.client.force_authenticate(user=self.customer1)
        chk_res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery'
        }, format='json')
        self.assertEqual(chk_res.status_code, status.HTTP_201_CREATED)

        # Expected stock after ordering: Bag A: 8, Bag B: 4, Bag C: 5
        self.product_a.refresh_from_db()
        self.product_b.refresh_from_db()
        self.product_c.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)
        self.assertEqual(self.product_b.stock_quantity, 4)
        self.assertEqual(self.product_c.stock_quantity, 5)

        # Cancel order -> restore original quantities: Bag A: 10, Bag B: 5, Bag C: 8
        order_id = chk_res.data['order']['id']
        cancel_res = self.client.post(f'/api/orders/{order_id}/cancel/', format='json')
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)

        self.product_a.refresh_from_db()
        self.product_b.refresh_from_db()
        self.product_c.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 10)
        self.assertEqual(self.product_b.stock_quantity, 5)
        self.assertEqual(self.product_c.stock_quantity, 8)

        # Test partial failure: 1 item has insufficient stock
        # Bag A: 2 (avail 10), Bag B: 10 (avail 5 -> FAILS), Bag C: 3 (avail 8)
        self._setup_cart(self.customer1, {
            self.product_a: 2,
            self.product_b: 10,
            self.product_c: 3
        })
        fail_res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery'
        }, format='json')
        self.assertEqual(fail_res.status_code, status.HTTP_400_BAD_REQUEST)

        # All stock quantities must remain completely untouched
        self.product_a.refresh_from_db()
        self.product_b.refresh_from_db()
        self.product_c.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 10)
        self.assertEqual(self.product_b.stock_quantity, 5)
        self.assertEqual(self.product_c.stock_quantity, 8)

    def test_08_duplicate_checkout_requests_do_not_deduct_stock_twice(self):
        """8. Duplicate checkout requests do not deduct stock twice."""
        initial_stock = self.product_a.stock_quantity  # 10
        self._setup_cart(self.customer1, {self.product_a: 2})
        self.client.force_authenticate(user=self.customer1)
        idempotency_key = 'idem_checkout_unique_777'

        # First checkout
        res1 = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery',
            'idempotency_key': idempotency_key
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        order_number = res1.data['order']['order_number']

        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)

        # Immediate duplicate submission with the same idempotency key
        res2 = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery',
            'idempotency_key': idempotency_key
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['order']['order_number'], order_number)

        # Stock must remain 8 (NOT 6!)
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)

    def test_09_concurrent_orders_cannot_reduce_stock_below_zero(self):
        """9. Concurrent orders cannot reduce stock below zero."""
        self.product_a.stock_quantity = 1
        self.product_a.save()

        # Both customers attempt to buy 1 unit of product A simultaneously
        self._setup_cart(self.customer1, {self.product_a: 1})
        self._setup_cart(self.customer2, {self.product_a: 1})

        results = []

        def place_order(user, address):
            client = APIClient()
            client.force_authenticate(user=user)
            connections.close_all()
            res = client.post('/api/orders/checkout/', {
                'address_id': address.id,
                'payment_method': 'Cash on Delivery'
            }, format='json')
            results.append(res.status_code)
            connections.close_all()

        t1 = threading.Thread(target=place_order, args=(self.customer1, self.address1))
        t2 = threading.Thread(target=place_order, args=(self.customer2, self.address2))

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Check final stock: must be 0 and never below zero!
        self.product_a.refresh_from_db()
        self.assertGreaterEqual(self.product_a.stock_quantity, 0)
        self.assertEqual(self.product_a.stock_quantity, 0)

        # Exactly 1 order should succeed (201 Created)
        success_count = results.count(status.HTTP_201_CREATED)
        self.assertEqual(success_count, 1)

    def test_10_payment_retries_and_callbacks_do_not_cause_duplicate_inventory_changes(self):
        """10. Payment retries and callbacks do not cause duplicate inventory changes."""
        # Initial stock: 10. Order 2 bags -> stock: 8
        self._setup_cart(self.customer1, {self.product_a: 2})
        self.client.force_authenticate(user=self.customer1)
        chk_res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Sandbox'
        }, format='json')
        self.assertEqual(chk_res.status_code, status.HTTP_201_CREATED)
        order_id = chk_res.data['order']['id']

        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)

        # 1. Payment failure callback
        fail_res = self.client.post(f'/api/orders/{order_id}/payment/fail/', {
            'reason': 'Payment authorization timed out'
        }, format='json')
        self.assertEqual(fail_res.status_code, status.HTTP_200_OK)
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)

        # 2. Payment retry session creation
        create_res = self.client.post(f'/api/orders/{order_id}/payment/create/', {
            'payment_method': 'Sandbox'
        }, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_200_OK)
        gateway_order_id = create_res.data['gateway_order_id']
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)

        # 3. Payment verification
        verify_res = self.client.post(f'/api/orders/{order_id}/payment/verify/', {
            'gateway_order_id': gateway_order_id,
            'transaction_id': 'txn_verified_123',
            'signature': 'sandbox_sig'
        }, format='json')
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)

        # 4. Asynchronous gateway webhook callback
        webhook_client = APIClient()
        wh_payload = {
            'event': 'payment.captured',
            'payload': {
                'payment': {
                    'entity': {
                        'order_id': gateway_order_id,
                        'id': 'txn_webhook_456'
                    }
                }
            }
        }
        wh_res = webhook_client.post('/api/orders/payment/webhook/', wh_payload, format='json')
        self.assertEqual(wh_res.status_code, status.HTTP_200_OK)
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)

        # 5. Subsequent payment verify attempt
        verify_res2 = self.client.post(f'/api/orders/{order_id}/payment/verify/', {
            'gateway_order_id': gateway_order_id,
            'transaction_id': 'txn_verified_123'
        }, format='json')
        self.assertEqual(verify_res2.status_code, status.HTTP_200_OK)
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)

    def test_11_order_that_cannot_be_cancelled_does_not_restore_stock(self):
        """11. An order that cannot be cancelled does not restore stock."""
        # Order 2 bags -> stock becomes 8
        self._setup_cart(self.customer1, {self.product_a: 2})
        self.client.force_authenticate(user=self.customer1)
        chk_res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery'
        }, format='json')
        order_id = chk_res.data['order']['id']
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)

        # Admin transitions order to 'shipped'
        self.client.force_authenticate(user=self.admin)
        shipped_res = self.client.patch(f'/api/orders/admin/orders/{order_id}/status/', {
            'status': 'shipped'
        }, format='json')
        self.assertEqual(shipped_res.status_code, status.HTTP_200_OK)

        # Customer attempts to cancel shipped order -> rejected
        self.client.force_authenticate(user=self.customer1)
        cancel_res = self.client.post(f'/api/orders/{order_id}/cancel/', format='json')
        self.assertEqual(cancel_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot be cancelled', cancel_res.data['detail'])

        # Stock must NOT be restored
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)

        # Admin attempts to cancel delivered order -> rejected
        self.client.force_authenticate(user=self.admin)
        self.client.patch(f'/api/orders/admin/orders/{order_id}/status/', {
            'status': 'delivered'
        }, format='json')

        cancel_admin_res = self.client.patch(f'/api/orders/admin/orders/{order_id}/status/', {
            'status': 'cancelled'
        }, format='json')
        self.assertEqual(cancel_admin_res.status_code, status.HTTP_400_BAD_REQUEST)

        # Stock must NOT be restored
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 8)

    def test_12_admin_cancellation_follows_same_inventory_rules(self):
        """12. Admin cancellation follows the same inventory rules."""
        # Initial stock: 10. Order 3 bags -> stock: 7
        self._setup_cart(self.customer1, {self.product_a: 3})
        self.client.force_authenticate(user=self.customer1)
        chk_res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery'
        }, format='json')
        order_id = chk_res.data['order']['id']
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 7)

        # Admin cancels via status endpoint
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(f'/api/orders/admin/orders/{order_id}/status/', {
            'status': 'cancelled',
            'reason': 'Customer requested cancellation via phone'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Stock is restored to 10
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 10)

        # Admin calls cancel again -> rejected
        res2 = self.client.patch(f'/api/orders/admin/orders/{order_id}/status/', {
            'status': 'cancelled'
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # Stock remains 10 (not 13)
        self.product_a.refresh_from_db()
        self.assertEqual(self.product_a.stock_quantity, 10)


class CouponManagementTestCase(TransactionTestCase):
    """
    Automated test suite verifying the complete Coupon Management System:
    1. Fixed coupon with a valid minimum subtotal.
    2. Fixed coupon when subtotal is below the minimum.
    3. Percentage coupon with a maximum discount cap.
    4. Percentage coupon when the calculated discount is below the cap.
    5. Coupon expiry and future start dates.
    6. Inactive and invalid coupon codes.
    7. Total usage and per-user usage limits.
    8. Invalid percentage values and negative discount values.
    9. Coupon removal and subtotal recalculation.
    10. Coupon applied to an order and saved correctly.
    11. Duplicate checkout requests and payment callbacks.
    12. Unauthorized admin coupon operations.
    13. Concurrent coupon usage at the limit.
    14. Correct final total after coupon, shipping, and applicable taxes.
    """

    def setUp(self):
        self.client = APIClient()

        # Admin user
        self.admin = User.objects.create_superuser(
            email='admin_coupon@deport.com',
            password='AdminPassword123!',
            first_name='Admin',
            last_name='Coupon'
        )

        # Customers
        self.customer1 = User.objects.create_user(
            email='customer1_coupon@deport.com',
            password='CustomerPassword123!',
            first_name='Customer1',
            last_name='User',
            is_email_verified=True,
            is_active=True
        )

        self.customer2 = User.objects.create_user(
            email='customer2_coupon@deport.com',
            password='CustomerPassword123!',
            first_name='Customer2',
            last_name='User',
            is_email_verified=True,
            is_active=True
        )

        # Category and Products
        self.category = Category.objects.create(name='Coupon Luxury Bags', description='Coupons Test')
        self.product_100 = Product.objects.create(
            name='Luxury Cardholder',
            price=Decimal('100.00'),
            sku='CARD-100',
            stock_quantity=100,
            category=self.category,
            is_active=True
        )
        self.product_1000 = Product.objects.create(
            name='Heritage Briefcase',
            price=Decimal('1000.00'),
            sku='BRIEF-1000',
            stock_quantity=100,
            category=self.category,
            is_active=True
        )

        # Addresses
        from addresses.models import Address
        self.address1 = Address.objects.create(
            user=self.customer1,
            label='Home',
            full_name='Customer 1',
            phone='+1 555-111-2222',
            address_line_1='100 Atelier Ave',
            city='New York',
            state='NY',
            postal_code='10001',
            country='United States',
            is_default=True
        )
        self.address2 = Address.objects.create(
            user=self.customer2,
            label='Home',
            full_name='Customer 2',
            phone='+1 555-333-4444',
            address_line_1='200 Fifth Ave',
            city='New York',
            state='NY',
            postal_code='10002',
            country='United States',
            is_default=True
        )

    def _setup_cart(self, user, items_dict):
        from cart.models import Cart, CartItem
        cart, _ = Cart.objects.get_or_create(user=user)
        cart.items.all().delete()
        for prod, qty in items_dict.items():
            CartItem.objects.create(cart=cart, product=prod, quantity=qty)

    def test_01_fixed_coupon_with_valid_minimum_subtotal(self):
        """1. Fixed coupon with a valid minimum subtotal."""
        coupon = Coupon.objects.create(
            code='SAVE200',
            discount_type='fixed',
            discount_value=Decimal('200.00'),
            min_order_amount=Decimal('1000.00'),
            is_active=True
        )

        self.client.force_authenticate(user=self.customer1)
        self._setup_cart(self.customer1, {self.product_1000: 1})  # Subtotal = 1000

        # Validate endpoint
        val_res = self.client.post('/api/orders/coupons/validate/', {
            'code': 'SAVE200',
            'subtotal': '1000.00'
        }, format='json')
        self.assertEqual(val_res.status_code, status.HTTP_200_OK)
        self.assertTrue(val_res.data['valid'])
        self.assertEqual(val_res.data['discount_amount'], '200.00')

        # Checkout
        chk_res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery',
            'coupon_code': 'SAVE200'
        }, format='json')
        self.assertEqual(chk_res.status_code, status.HTTP_201_CREATED)
        order_data = chk_res.data['order']
        self.assertEqual(Decimal(str(order_data['discount'])), Decimal('200.00'))
        self.assertEqual(Decimal(str(order_data['subtotal'])), Decimal('1000.00'))

    def test_02_fixed_coupon_when_subtotal_is_below_minimum(self):
        """2. Fixed coupon when subtotal is below the minimum."""
        Coupon.objects.create(
            code='SAVE200',
            discount_type='fixed',
            discount_value=Decimal('200.00'),
            min_order_amount=Decimal('1000.00'),
            is_active=True
        )

        self.client.force_authenticate(user=self.customer1)
        self._setup_cart(self.customer1, {self.product_100: 8})  # Subtotal = 800 < 1000

        # Validate endpoint rejects
        val_res = self.client.post('/api/orders/coupons/validate/', {
            'code': 'SAVE200',
            'subtotal': '800.00'
        }, format='json')
        self.assertEqual(val_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Minimum order subtotal', val_res.data.get('detail', ''))

        # Checkout rejects without creating order
        chk_res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery',
            'coupon_code': 'SAVE200'
        }, format='json')
        self.assertEqual(chk_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Order.objects.filter(coupon_code='SAVE200').exists())

    def test_03_percentage_coupon_with_maximum_discount_cap(self):
        """3. Percentage coupon with a maximum discount cap."""
        Coupon.objects.create(
            code='SAVE20',
            discount_type='percentage',
            discount_value=Decimal('20.00'),
            min_order_amount=Decimal('1000.00'),
            max_discount_amount=Decimal('500.00'),
            is_active=True
        )

        self.client.force_authenticate(user=self.customer1)

        # Subtotal 3,000 -> 20% = 600 -> capped at 500
        val_res = self.client.post('/api/orders/coupons/validate/', {
            'code': 'SAVE20',
            'subtotal': '3000.00'
        }, format='json')
        self.assertEqual(val_res.status_code, status.HTTP_200_OK)
        self.assertEqual(val_res.data['discount_amount'], '500.00')

        # Subtotal 5,000 -> 20% = 1,000 -> capped at 500
        val_res2 = self.client.post('/api/orders/coupons/validate/', {
            'code': 'SAVE20',
            'subtotal': '5000.00'
        }, format='json')
        self.assertEqual(val_res2.status_code, status.HTTP_200_OK)
        self.assertEqual(val_res2.data['discount_amount'], '500.00')

        # Checkout with subtotal 3,000
        self._setup_cart(self.customer1, {self.product_1000: 3})
        chk_res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery',
            'coupon_code': 'SAVE20'
        }, format='json')
        self.assertEqual(chk_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(str(chk_res.data['order']['discount'])), Decimal('500.00'))

    def test_04_percentage_coupon_when_calculated_discount_below_cap(self):
        """4. Percentage coupon when the calculated discount is below the cap."""
        Coupon.objects.create(
            code='SAVE20',
            discount_type='percentage',
            discount_value=Decimal('20.00'),
            min_order_amount=Decimal('1000.00'),
            max_discount_amount=Decimal('500.00'),
            is_active=True
        )

        self.client.force_authenticate(user=self.customer1)

        # Subtotal 1,000 -> 20% = 200 (< 500 cap)
        val_res1 = self.client.post('/api/orders/coupons/validate/', {
            'code': 'SAVE20',
            'subtotal': '1000.00'
        }, format='json')
        self.assertEqual(val_res1.status_code, status.HTTP_200_OK)
        self.assertEqual(val_res1.data['discount_amount'], '200.00')

        # Subtotal 2,000 -> 20% = 400 (< 500 cap)
        val_res2 = self.client.post('/api/orders/coupons/validate/', {
            'code': 'SAVE20',
            'subtotal': '2000.00'
        }, format='json')
        self.assertEqual(val_res2.status_code, status.HTTP_200_OK)
        self.assertEqual(val_res2.data['discount_amount'], '400.00')

    def test_05_coupon_expiry_and_future_start_dates(self):
        """5. Coupon expiry and future start dates."""
        # Expired coupon
        Coupon.objects.create(
            code='EXPIRED10',
            discount_type='fixed',
            discount_value=Decimal('10.00'),
            expiration_date=timezone.now() - datetime.timedelta(days=1),
            is_active=True
        )
        # Future coupon
        Coupon.objects.create(
            code='FUTURE10',
            discount_type='fixed',
            discount_value=Decimal('10.00'),
            start_date=timezone.now() + datetime.timedelta(days=2),
            is_active=True
        )

        self.client.force_authenticate(user=self.customer1)

        res_exp = self.client.post('/api/orders/coupons/validate/', {
            'code': 'EXPIRED10',
            'subtotal': '500.00'
        }, format='json')
        self.assertEqual(res_exp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('expired', res_exp.data.get('detail', '').lower())

        res_fut = self.client.post('/api/orders/coupons/validate/', {
            'code': 'FUTURE10',
            'subtotal': '500.00'
        }, format='json')
        self.assertEqual(res_fut.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('not active yet', res_fut.data.get('detail', '').lower())

    def test_06_inactive_and_invalid_coupon_codes(self):
        """6. Inactive and invalid coupon codes."""
        Coupon.objects.create(
            code='INACTIVE25',
            discount_type='fixed',
            discount_value=Decimal('25.00'),
            is_active=False
        )

        self.client.force_authenticate(user=self.customer1)

        # Inactive code
        res_inact = self.client.post('/api/orders/coupons/validate/', {
            'code': 'INACTIVE25',
            'subtotal': '500.00'
        }, format='json')
        self.assertEqual(res_inact.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('inactive', res_inact.data.get('detail', '').lower())

        # Non-existent code
        res_none = self.client.post('/api/orders/coupons/validate/', {
            'code': 'NOSUCHCOUPON',
            'subtotal': '500.00'
        }, format='json')
        self.assertEqual(res_none.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('invalid or does not exist', res_none.data.get('detail', '').lower())

    def test_07_total_usage_and_per_user_usage_limits(self):
        """7. Total usage and per-user usage limits."""
        # Total global usage limit
        c_global = Coupon.objects.create(
            code='MAXGLOBAL',
            discount_type='fixed',
            discount_value=Decimal('50.00'),
            usage_limit=1,
            used_count=1,
            is_active=True
        )

        self.client.force_authenticate(user=self.customer1)
        res_g = self.client.post('/api/orders/coupons/validate/', {
            'code': 'MAXGLOBAL',
            'subtotal': '500.00'
        }, format='json')
        self.assertEqual(res_g.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('global usage limit', res_g.data.get('detail', '').lower())

        # Per-user usage limit
        c_user = Coupon.objects.create(
            code='ONCEPERUSER',
            discount_type='fixed',
            discount_value=Decimal('50.00'),
            per_user_limit=1,
            usage_limit=10,
            is_active=True
        )

        # Customer 1 uses the coupon once
        self._setup_cart(self.customer1, {self.product_1000: 1})
        chk1 = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery',
            'coupon_code': 'ONCEPERUSER'
        }, format='json')
        self.assertEqual(chk1.status_code, status.HTTP_201_CREATED)

        # Customer 1 tries again -> rejected
        self._setup_cart(self.customer1, {self.product_1000: 1})
        val_rep = self.client.post('/api/orders/coupons/validate/', {
            'code': 'ONCEPERUSER',
            'subtotal': '1000.00'
        }, format='json')
        self.assertEqual(val_rep.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('maximum allowed number of times', val_rep.data.get('detail', ''))

        # Customer 2 (who hasn't used it) -> allowed!
        self.client.force_authenticate(user=self.customer2)
        val_c2 = self.client.post('/api/orders/coupons/validate/', {
            'code': 'ONCEPERUSER',
            'subtotal': '1000.00'
        }, format='json')
        self.assertEqual(val_c2.status_code, status.HTTP_200_OK)
        self.assertTrue(val_c2.data['valid'])

    def test_08_invalid_percentage_values_and_negative_discount_values(self):
        """8. Invalid percentage values and negative discount values."""
        self.client.force_authenticate(user=self.admin)

        # Percentage > 100
        res1 = self.client.post('/api/admin/coupons/', {
            'code': 'BADPERCENT1',
            'discount_type': 'percentage',
            'discount_value': '125.00'
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('discount_value', res1.data)

        # Percentage <= 0
        res2 = self.client.post('/api/admin/coupons/', {
            'code': 'BADPERCENT2',
            'discount_type': 'percentage',
            'discount_value': '-10.00'
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # Negative fixed discount
        res3 = self.client.post('/api/admin/coupons/', {
            'code': 'BADFIXED',
            'discount_type': 'fixed',
            'discount_value': '-50.00'
        }, format='json')
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

        # Negative min_order_amount
        res4 = self.client.post('/api/admin/coupons/', {
            'code': 'BADMIN',
            'discount_type': 'fixed',
            'discount_value': '50.00',
            'min_order_amount': '-100.00'
        }, format='json')
        self.assertEqual(res4.status_code, status.HTTP_400_BAD_REQUEST)

        # Negative max_discount_amount
        res5 = self.client.post('/api/admin/coupons/', {
            'code': 'BADMAX',
            'discount_type': 'percentage',
            'discount_value': '15.00',
            'max_discount_amount': '-20.00'
        }, format='json')
        self.assertEqual(res5.status_code, status.HTTP_400_BAD_REQUEST)

    def test_09_coupon_removal_and_subtotal_recalculation(self):
        """9. Coupon removal and subtotal recalculation."""
        self.client.force_authenticate(user=self.customer1)
        self._setup_cart(self.customer1, {self.product_1000: 1})

        # Remove coupon endpoint
        res = self.client.post('/api/orders/coupons/remove/', {
            'subtotal': '1000.00'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(res.data['valid'])
        self.assertEqual(res.data['discount_amount'], '0.00')
        self.assertEqual(res.data['subtotal'], '1000.00')
        # Subtotal 1000 + 0 shipping + 50 tax = 1050
        self.assertEqual(Decimal(res.data['final_total']), Decimal('1050.00'))

    def test_10_coupon_applied_to_an_order_and_saved_correctly(self):
        """10. Coupon applied to an order and saved correctly, released on cancellation."""
        coupon = Coupon.objects.create(
            code='ORDERCOUPON',
            discount_type='fixed',
            discount_value=Decimal('200.00'),
            min_order_amount=Decimal('500.00'),
            usage_limit=5,
            per_user_limit=1,
            is_active=True
        )

        self.client.force_authenticate(user=self.customer1)
        self._setup_cart(self.customer1, {self.product_1000: 1})

        chk_res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery',
            'coupon_code': 'ORDERCOUPON'
        }, format='json')
        self.assertEqual(chk_res.status_code, status.HTTP_201_CREATED)
        order_num = chk_res.data['order']['order_number']

        order = Order.objects.get(order_number=order_num)
        self.assertEqual(order.coupon, coupon)
        self.assertEqual(order.coupon_code, 'ORDERCOUPON')
        self.assertEqual(order.discount, Decimal('200.00'))

        # Check CouponUsage recorded
        self.assertTrue(CouponUsage.objects.filter(order=order, user=self.customer1).exists())
        coupon.refresh_from_db()
        self.assertEqual(coupon.used_count, 1)

        # Cancel the order -> coupon usage released
        cancel_res = self.client.post(f'/api/orders/{order_num}/cancel/', {
            'reason': 'Found better alternative'
        }, format='json')
        self.assertEqual(cancel_res.status_code, status.HTTP_200_OK)

        order.refresh_from_db()
        self.assertEqual(order.status, 'cancelled')

        coupon.refresh_from_db()
        self.assertEqual(coupon.used_count, 0)
        self.assertFalse(CouponUsage.objects.filter(order=order).exists())

    def test_11_duplicate_checkout_requests_and_payment_callbacks(self):
        """11. Duplicate checkout requests and payment callbacks do not deduct coupon twice."""
        coupon = Coupon.objects.create(
            code='DUPCHECK',
            discount_type='fixed',
            discount_value=Decimal('100.00'),
            usage_limit=10,
            is_active=True
        )

        self.client.force_authenticate(user=self.customer1)
        self._setup_cart(self.customer1, {self.product_1000: 1})

        idempotency_key = 'idem_coupon_test_999'

        # First checkout
        res1 = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Credit Card',
            'coupon_code': 'DUPCHECK',
            'idempotency_key': idempotency_key
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        order_id = res1.data['order']['id']

        coupon.refresh_from_db()
        self.assertEqual(coupon.used_count, 1)

        # Replayed checkout with same idempotency key
        res2 = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Credit Card',
            'coupon_code': 'DUPCHECK',
            'idempotency_key': idempotency_key
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)

        # Usage count still 1
        coupon.refresh_from_db()
        self.assertEqual(coupon.used_count, 1)
        self.assertEqual(CouponUsage.objects.filter(coupon=coupon).count(), 1)

        # Payment verification callback
        payment_data = {
            'gateway_order_id': 'pay_order_test',
            'transaction_id': 'txn_test_123',
            'signature': 'sandbox_verified_signature'
        }
        pay_res = self.client.post(f'/api/orders/{order_id}/payment/verify/', payment_data, format='json')
        self.assertEqual(pay_res.status_code, status.HTTP_200_OK)

        # Total and coupon usage unchanged
        coupon.refresh_from_db()
        self.assertEqual(coupon.used_count, 1)

    def test_12_unauthorized_admin_coupon_operations(self):
        """12. Unauthorized admin coupon operations are rejected with 403 Forbidden."""
        coupon = Coupon.objects.create(
            code='ADMINPROTECTED',
            discount_type='fixed',
            discount_value=Decimal('50.00'),
            is_active=True
        )

        # Customer attempts admin actions
        self.client.force_authenticate(user=self.customer1)

        # Create
        c_res = self.client.post('/api/admin/coupons/', {
            'code': 'HACKCOUPON',
            'discount_type': 'fixed',
            'discount_value': '100.00'
        }, format='json')
        self.assertEqual(c_res.status_code, status.HTTP_403_FORBIDDEN)

        # Update
        u_res = self.client.patch(f'/api/admin/coupons/{coupon.id}/', {
            'discount_value': '500.00'
        }, format='json')
        self.assertEqual(u_res.status_code, status.HTTP_403_FORBIDDEN)

        # Toggle Active
        t_res = self.client.post(f'/api/admin/coupons/{coupon.id}/toggle-active/')
        self.assertEqual(t_res.status_code, status.HTTP_403_FORBIDDEN)

        # Delete
        d_res = self.client.delete(f'/api/admin/coupons/{coupon.id}/')
        self.assertEqual(d_res.status_code, status.HTTP_403_FORBIDDEN)

        # Admin user succeeds
        self.client.force_authenticate(user=self.admin)
        t_res_admin = self.client.post(f'/api/admin/coupons/{coupon.id}/toggle-active/')
        self.assertEqual(t_res_admin.status_code, status.HTTP_200_OK)
        coupon.refresh_from_db()
        self.assertFalse(coupon.is_active)

    def test_13_concurrent_coupon_usage_at_the_limit(self):
        """13. Concurrent coupon usage at the limit allows strictly up to the limit."""
        coupon = Coupon.objects.create(
            code='LIMITEDONE',
            discount_type='fixed',
            discount_value=Decimal('100.00'),
            min_order_amount=Decimal('100.00'),
            usage_limit=1,
            is_active=True
        )

        self._setup_cart(self.customer1, {self.product_1000: 1})
        self._setup_cart(self.customer2, {self.product_1000: 1})

        results = []

        def place_order(user, address_id):
            client = APIClient()
            client.force_authenticate(user=user)
            resp = client.post('/api/orders/checkout/', {
                'address_id': address_id,
                'payment_method': 'Cash on Delivery',
                'coupon_code': 'LIMITEDONE'
            }, format='json')
            results.append(resp.status_code)
            for conn in connections.all():
                conn.close()

        t1 = threading.Thread(target=place_order, args=(self.customer1, self.address1.id))
        t2 = threading.Thread(target=place_order, args=(self.customer2, self.address2.id))

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # Exactly 1 created (201), 1 rejected (400)
        self.assertEqual(results.count(status.HTTP_201_CREATED), 1)
        self.assertEqual(results.count(status.HTTP_400_BAD_REQUEST), 1)

        coupon.refresh_from_db()
        self.assertEqual(coupon.used_count, 1)

    def test_14_correct_final_total_after_coupon_shipping_and_applicable_taxes(self):
        """14. Correct final total after coupon, shipping, and applicable taxes."""
        coupon_fixed = Coupon.objects.create(
            code='TAXTEST200',
            discount_type='fixed',
            discount_value=Decimal('200.00'),
            min_order_amount=Decimal('500.00'),
            is_active=True
        )

        self.client.force_authenticate(user=self.customer1)

        # Scenario A: Subtotal >= 300 (Free Shipping)
        # Subtotal: 1000.00, Discount: 200.00, Shipping: 0.00, Tax: 5% of 1000 = 50.00
        # Final Total = 1000 - 200 + 0 + 50 = 850.00
        self._setup_cart(self.customer1, {self.product_1000: 1})
        res_a = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery',
            'coupon_code': 'TAXTEST200'
        }, format='json')
        self.assertEqual(res_a.status_code, status.HTTP_201_CREATED)
        order_a = res_a.data['order']
        self.assertEqual(Decimal(str(order_a['subtotal'])), Decimal('1000.00'))
        self.assertEqual(Decimal(str(order_a['discount'])), Decimal('200.00'))
        self.assertEqual(Decimal(str(order_a['shipping_cost'])), Decimal('0.00'))
        self.assertEqual(Decimal(str(order_a['tax'])), Decimal('50.00'))
        self.assertEqual(Decimal(str(order_a['total'])), Decimal('850.00'))

        # Scenario B: Subtotal < 300 (Standard Shipping 25.00)
        # Subtotal: 100.00, Discount: 20.00, Shipping: 25.00, Tax: 5% of 100 = 5.00
        # Final Total = 100 - 20 + 25 + 5 = 110.00
        coupon_small = Coupon.objects.create(
            code='SMALL20',
            discount_type='fixed',
            discount_value=Decimal('20.00'),
            min_order_amount=Decimal('50.00'),
            is_active=True
        )
        self._setup_cart(self.customer1, {self.product_100: 1})
        res_b = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Cash on Delivery',
            'coupon_code': 'SMALL20'
        }, format='json')
        self.assertEqual(res_b.status_code, status.HTTP_201_CREATED)
        order_b = res_b.data['order']
        self.assertEqual(Decimal(str(order_b['subtotal'])), Decimal('100.00'))
        self.assertEqual(Decimal(str(order_b['discount'])), Decimal('20.00'))
        self.assertEqual(Decimal(str(order_b['shipping_cost'])), Decimal('25.00'))
        self.assertEqual(Decimal(str(order_b['tax'])), Decimal('5.00'))
        self.assertEqual(Decimal(str(order_b['total'])), Decimal('110.00'))


class RazorpayPaymentIntegrationTestCase(TestCase):
    """
    Automated Unit & Integration Tests for Razorpay Standard Checkout in DEPORT:
    - Order & payment attempt creation with paise conversion
    - HMAC-SHA256 signature verification & tamper rejection
    - Webhook processing with signature check & deduplication
    - Stock consistency (atomic deduction, release on cancellation)
    - Anti-IDOR customer isolation & authorization checks
    - Idempotency on repeated callbacks
    """
    def setUp(self):
        self.client = APIClient()
        self.test_secret = 'test_razorpay_secret_key_12345'
        self.test_webhook_secret = 'test_webhook_secret_key_67890'

        # Customers
        self.customer1 = User.objects.create_user(
            email='alice@deport.com',
            password='Password123!',
            first_name='Alice',
            last_name='Atelier',
            is_email_verified=True
        )
        self.customer2 = User.objects.create_user(
            email='bob@deport.com',
            password='Password123!',
            first_name='Bob',
            last_name='Buyer',
            is_email_verified=True
        )

        # Products
        self.category = Category.objects.create(name='Tote Bags')
        self.product = Product.objects.create(
            name='Monogram Canvas Tote',
            price=Decimal('250.00'),
            sku='TOTE-MONO-01',
            stock_quantity=10,
            category=self.category,
            is_active=True
        )

        # Addresses
        from addresses.models import Address
        self.address1 = Address.objects.create(
            user=self.customer1,
            full_name='Alice Atelier',
            phone='+91 9876543210',
            address_line_1='456 Fashion Boulevard',
            city='Mumbai',
            state='MH',
            postal_code='400001',
            country='India',
            is_default=True
        )
        self.address2 = Address.objects.create(
            user=self.customer2,
            full_name='Bob Buyer',
            phone='+91 9123456780',
            address_line_1='789 Marine Drive',
            city='Mumbai',
            state='MH',
            postal_code='400020',
            country='India',
            is_default=True
        )

    def _setup_cart(self, user, items_dict):
        from cart.models import Cart, CartItem
        cart, _ = Cart.objects.get_or_create(user=user)
        cart.items.all().delete()
        for product, qty in items_dict.items():
            CartItem.objects.create(cart=cart, product=product, quantity=qty)

    def test_01_public_payment_config_endpoint(self):
        """1. GET /api/payments/config/ returns public key, currency, and store name safely."""
        with patch('orders.razorpay_service.RazorpayService.get_key_id', return_value='rzp_test_public_123'):
            res = self.client.get('/api/payments/config/')
            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data['razorpay_key_id'], 'rzp_test_public_123')
            self.assertEqual(res.data['currency'], 'INR')
            self.assertEqual(res.data['store_name'], 'DEPORT Atelier')
            # Verify secret is never returned
            self.assertNotIn('secret', str(res.data).lower())

    def test_02_create_razorpay_order_during_checkout(self):
        """2. Valid checkout with Razorpay creates local order, decrements stock, and creates Razorpay order in paise."""
        self._setup_cart(self.customer1, {self.product: 2})  # 2 * 250 = 500 subtotal (>= 300 so free shipping)
        # Tax: 5% of 500 = 25. Total = 525.00. Paise = 52500

        mock_rzp_order = {
            'id': 'order_rzp_test_12345',
            'amount': 52500,
            'currency': 'INR',
            'status': 'created',
            'receipt': 'rec_test'
        }

        self.client.force_authenticate(user=self.customer1)
        with patch('orders.razorpay_service.RazorpayService.is_configured', return_value=True), \
             patch('orders.razorpay_service.RazorpayService.create_order', return_value=mock_rzp_order), \
             patch('orders.razorpay_service.RazorpayService.get_key_id', return_value='rzp_test_pub_1'):

            res = self.client.post('/api/orders/checkout/', {
                'address_id': self.address1.id,
                'payment_method': 'Razorpay'
            }, format='json')

            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            self.assertEqual(res.data['razorpay_order_id'], 'order_rzp_test_12345')
            self.assertEqual(res.data['amount_in_paise'], 52500)
            self.assertEqual(res.data['currency'], 'INR')

            # Verify local Order & Payment records
            order_data = res.data['order']
            self.assertEqual(order_data['status'], 'pending')
            self.assertEqual(order_data['payment_method'], 'Razorpay')
            self.assertEqual(Decimal(str(order_data['total'])), Decimal('525.00'))

            payment_data = res.data['payment']
            self.assertEqual(payment_data['status'], 'pending')
            self.assertEqual(payment_data['gateway_order_id'], 'order_rzp_test_12345')

            # Verify stock decremented atomically: 10 - 2 = 8
            self.product.refresh_from_db()
            self.assertEqual(self.product.stock_quantity, 8)

    def test_03_tampered_price_is_rejected_and_server_price_is_authoritative(self):
        """3. Client-supplied tampered prices or totals cannot override server calculations."""
        self._setup_cart(self.customer1, {self.product: 1})  # 250 + 25 shipping + 12.50 tax = 287.50

        mock_rzp_order = {
            'id': 'order_rzp_tamper_test',
            'amount': 28750,
            'currency': 'INR',
            'status': 'created'
        }

        self.client.force_authenticate(user=self.customer1)
        with patch('orders.razorpay_service.RazorpayService.is_configured', return_value=True), \
             patch('orders.razorpay_service.RazorpayService.create_order', return_value=mock_rzp_order):

            res = self.client.post('/api/orders/checkout/', {
                'address_id': self.address1.id,
                'payment_method': 'Razorpay',
                'subtotal': '1.00',     # Client tampered attempt
                'total': '1.00',        # Client tampered attempt
                'price': '1.00'         # Client tampered attempt
            }, format='json')

            self.assertEqual(res.status_code, status.HTTP_201_CREATED)
            # Server authoritative total must be 287.50
            self.assertEqual(Decimal(str(res.data['order']['total'])), Decimal('287.50'))
            self.assertEqual(res.data['amount_in_paise'], 28750)

    def test_04_insufficient_stock_rejects_checkout(self):
        """4. Insufficient stock rejects checkout and does not create order or Razorpay intent."""
        self._setup_cart(self.customer1, {self.product: 99})  # only 10 in stock

        self.client.force_authenticate(user=self.customer1)
        res = self.client.post('/api/orders/checkout/', {
            'address_id': self.address1.id,
            'payment_method': 'Razorpay'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Insufficient stock', res.data['detail'])

        # Stock remained unchanged at 10
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 10)

    def test_05_create_payment_for_existing_order_endpoint(self):
        """5. POST /api/payments/create-order/ creates Razorpay order for an existing pending order."""
        order = Order.objects.create(
            user=self.customer1,
            subtotal=Decimal('250.00'),
            shipping_cost=Decimal('25.00'),
            tax=Decimal('12.50'),
            total=Decimal('287.50'),
            status='pending',
            payment_method='Razorpay'
        )

        mock_rzp_order = {
            'id': 'order_retry_99999',
            'amount': 28750,
            'currency': 'INR',
            'status': 'created'
        }

        self.client.force_authenticate(user=self.customer1)
        with patch('orders.razorpay_service.RazorpayService.is_configured', return_value=True), \
             patch('orders.razorpay_service.RazorpayService.create_order', return_value=mock_rzp_order), \
             patch('orders.razorpay_service.RazorpayService.get_key_id', return_value='rzp_test_pub_1'):

            res = self.client.post('/api/payments/create-order/', {
                'order_id': order.id,
                'payment_method': 'Razorpay'
            }, format='json')

            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data['razorpay_order_id'], 'order_retry_99999')
            self.assertEqual(res.data['amount'], 28750)

    def test_06_payment_signature_verification_succeeds(self):
        """6. Payment signature verification succeeds with correct HMAC-SHA256 signature."""
        order = Order.objects.create(
            user=self.customer1,
            subtotal=Decimal('250.00'),
            total=Decimal('287.50'),
            status='pending',
            payment_method='Razorpay'
        )
        payment = Payment.objects.create(
            order=order,
            user=self.customer1,
            payment_method='Razorpay',
            amount=Decimal('287.50'),
            currency='INR',
            status='pending',
            gateway_order_id='order_rzp_sig_valid'
        )

        # Generate genuine HMAC signature
        rzp_order_id = 'order_rzp_sig_valid'
        rzp_payment_id = 'pay_rzp_test_txn_777'
        msg = f"{rzp_order_id}|{rzp_payment_id}".encode('utf-8')
        valid_signature = hmac.new(self.test_secret.encode('utf-8'), msg, hashlib.sha256).hexdigest()

        self.client.force_authenticate(user=self.customer1)
        with patch('orders.razorpay_service.RazorpayService.get_key_secret', return_value=self.test_secret):
            res = self.client.post('/api/payments/verify/', {
                'razorpay_order_id': rzp_order_id,
                'razorpay_payment_id': rzp_payment_id,
                'razorpay_signature': valid_signature
            }, format='json')

            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertTrue(res.data['verified'])

            payment.refresh_from_db()
            order.refresh_from_db()
            self.assertEqual(payment.status, 'completed')
            self.assertEqual(payment.transaction_id, rzp_payment_id)
            self.assertEqual(order.status, 'confirmed')

    def test_07_invalid_payment_signature_is_rejected(self):
        """7. Invalid or tampered signature is rejected and does not confirm the order."""
        order = Order.objects.create(
            user=self.customer1,
            subtotal=Decimal('250.00'),
            total=Decimal('287.50'),
            status='pending',
            payment_method='Razorpay'
        )
        Payment.objects.create(
            order=order,
            user=self.customer1,
            payment_method='Razorpay',
            amount=Decimal('287.50'),
            currency='INR',
            status='pending',
            gateway_order_id='order_rzp_tamper_sig'
        )

        self.client.force_authenticate(user=self.customer1)
        with patch('orders.razorpay_service.RazorpayService.get_key_secret', return_value=self.test_secret):
            res = self.client.post('/api/payments/verify/', {
                'razorpay_order_id': 'order_rzp_tamper_sig',
                'razorpay_payment_id': 'pay_test_tampered',
                'razorpay_signature': 'invalid_forged_signature_hex'
            }, format='json')

            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('Invalid payment signature', res.data['detail'])

            order.refresh_from_db()
            self.assertEqual(order.status, 'pending')

    def test_08_mismatched_razorpay_order_id_rejected(self):
        """8. Submitting a different razorpay_order_id than the local payment record is rejected."""
        order = Order.objects.create(
            user=self.customer1,
            subtotal=Decimal('250.00'),
            total=Decimal('287.50'),
            status='pending',
            payment_method='Razorpay'
        )
        Payment.objects.create(
            order=order,
            user=self.customer1,
            payment_method='Razorpay',
            amount=Decimal('287.50'),
            status='pending',
            gateway_order_id='order_registered_on_server'
        )

        self.client.force_authenticate(user=self.customer1)
        res = self.client.post(f'/api/orders/{order.id}/payment/verify/', {
            'razorpay_order_id': 'order_different_from_client',
            'razorpay_payment_id': 'pay_123',
            'razorpay_signature': 'any_sig'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('does not match', res.data['detail'])

    def test_09_user_cannot_verify_another_users_order(self):
        """9. Customer A cannot verify or access Customer B's order (IDOR defense)."""
        order_b = Order.objects.create(
            user=self.customer2,
            subtotal=Decimal('250.00'),
            total=Decimal('287.50'),
            status='pending',
            payment_method='Razorpay'
        )
        Payment.objects.create(
            order=order_b,
            user=self.customer2,
            payment_method='Razorpay',
            amount=Decimal('287.50'),
            status='pending',
            gateway_order_id='order_customer_b'
        )

        # Authenticate Customer A (Alice)
        self.client.force_authenticate(user=self.customer1)
        res = self.client.post('/api/payments/verify/', {
            'razorpay_order_id': 'order_customer_b',
            'razorpay_payment_id': 'pay_b',
            'razorpay_signature': 'sig_b'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_10_duplicate_verification_is_idempotent(self):
        """10. Repeated verification calls do not duplicate order confirmations or stock deductions."""
        order = Order.objects.create(
            user=self.customer1,
            subtotal=Decimal('250.00'),
            total=Decimal('287.50'),
            status='confirmed',
            payment_method='Razorpay'
        )
        payment = Payment.objects.create(
            order=order,
            user=self.customer1,
            payment_method='Razorpay',
            amount=Decimal('287.50'),
            status='completed',
            gateway_order_id='order_already_paid',
            transaction_id='pay_already_recorded'
        )

        self.client.force_authenticate(user=self.customer1)
        res = self.client.post('/api/payments/verify/', {
            'razorpay_order_id': 'order_already_paid',
            'razorpay_payment_id': 'pay_already_recorded',
            'razorpay_signature': 'any_sig'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['verified'])
        self.assertEqual(res.data['status'], 'completed')

    def test_11_payment_failure_recording(self):
        """11. Payment failure updates payment status to failed without cancelling the order."""
        order = Order.objects.create(
            user=self.customer1,
            subtotal=Decimal('250.00'),
            total=Decimal('287.50'),
            status='pending',
            payment_method='Razorpay'
        )
        payment = Payment.objects.create(
            order=order,
            user=self.customer1,
            payment_method='Razorpay',
            amount=Decimal('287.50'),
            status='pending',
            gateway_order_id='order_rzp_fail_1'
        )

        self.client.force_authenticate(user=self.customer1)
        res = self.client.post('/api/payments/fail/', {
            'razorpay_order_id': 'order_rzp_fail_1',
            'reason': 'Card declined by issuing bank',
            'error_code': 'BAD_REQUEST_ERROR'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        order.refresh_from_db()

        self.assertEqual(payment.status, 'failed')
        self.assertEqual(payment.provider_response.get('error'), 'Card declined by issuing bank')
        # Order remains pending so customer can retry
        self.assertEqual(order.status, 'pending')

    def test_12_webhook_signature_verification_and_order_confirmation(self):
        """12. Valid Razorpay webhook processes payment.captured and marks order confirmed."""
        order = Order.objects.create(
            user=self.customer1,
            subtotal=Decimal('250.00'),
            total=Decimal('287.50'),
            status='pending',
            payment_method='Razorpay'
        )
        payment = Payment.objects.create(
            order=order,
            user=self.customer1,
            payment_method='Razorpay',
            amount=Decimal('287.50'),
            status='pending',
            gateway_order_id='order_webhook_capture_test'
        )

        webhook_body_str = json.dumps({
            'event': 'payment.captured',
            'event_id': 'evt_test_capture_1001',
            'payload': {
                'payment': {
                    'entity': {
                        'id': 'pay_webhook_txn_1001',
                        'order_id': 'order_webhook_capture_test',
                        'status': 'captured',
                        'amount': 28750
                    }
                }
            }
        })

        sig = hmac.new(self.test_webhook_secret.encode('utf-8'), webhook_body_str.encode('utf-8'), hashlib.sha256).hexdigest()

        with patch('orders.razorpay_service.RazorpayService.get_webhook_secret', return_value=self.test_webhook_secret):
            res = self.client.post(
                '/api/payments/webhook/',
                data=webhook_body_str,
                content_type='application/json',
                HTTP_X_RAZORPAY_SIGNATURE=sig
            )

            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data['status'], 'webhook processed')

            payment.refresh_from_db()
            order.refresh_from_db()
            self.assertEqual(payment.status, 'completed')
            self.assertEqual(payment.transaction_id, 'pay_webhook_txn_1001')
            self.assertEqual(order.status, 'confirmed')

    def test_13_webhook_invalid_signature_rejected(self):
        """13. Webhook with invalid signature is rejected with 400 Bad Request."""
        webhook_body = json.dumps({'event': 'payment.captured'})

        with patch('orders.razorpay_service.RazorpayService.get_webhook_secret', return_value=self.test_webhook_secret):
            res = self.client.post(
                '/api/payments/webhook/',
                data=webhook_body,
                content_type='application/json',
                HTTP_X_RAZORPAY_SIGNATURE='forged_webhook_signature'
            )

            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('Invalid webhook signature', res.data['detail'])

    def test_14_webhook_deduplication(self):
        """14. Duplicate webhook events are deduplicated safely without repeating execution."""
        ProcessedWebhookEvent.objects.create(
            event_id='evt_already_processed_555',
            event_type='payment.captured'
        )

        webhook_body = json.dumps({
            'event': 'payment.captured',
            'event_id': 'evt_already_processed_555'
        })
        sig = hmac.new(self.test_webhook_secret.encode('utf-8'), webhook_body.encode('utf-8'), hashlib.sha256).hexdigest()

        with patch('orders.razorpay_service.RazorpayService.get_webhook_secret', return_value=self.test_webhook_secret):
            res = self.client.post(
                '/api/payments/webhook/',
                data=webhook_body,
                content_type='application/json',
                HTTP_X_RAZORPAY_SIGNATURE=sig
            )

            self.assertEqual(res.status_code, status.HTTP_200_OK)
            self.assertEqual(res.data['status'], 'duplicate event ignored')

    def test_15_stock_restoration_on_order_cancellation(self):
        """15. Order cancellation restores product stock exactly once."""
        order = Order.objects.create(
            user=self.customer1,
            subtotal=Decimal('500.00'),
            total=Decimal('525.00'),
            status='pending',
            payment_method='Razorpay'
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            product_sku=self.product.sku,
            quantity=3,
            unit_price=Decimal('250.00'),
            total_price=Decimal('750.00')
        )
        # Deduct stock as happens on order creation: 10 - 3 = 7
        self.product.stock_quantity = 7
        self.product.save()

        self.client.force_authenticate(user=self.customer1)
        res = self.client.post(f'/api/orders/{order.id}/cancel/', {
            'reason': 'Ordered wrong size'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        self.assertEqual(order.status, 'cancelled')

        # Stock restored: 7 + 3 = 10
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 10)

        # Repeated cancellation is rejected and does not add stock again
        res_repeat = self.client.post(f'/api/orders/{order.id}/cancel/', {
            'reason': 'Cancelling again'
        }, format='json')
        self.assertEqual(res_repeat.status_code, status.HTTP_400_BAD_REQUEST)

        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 10)

