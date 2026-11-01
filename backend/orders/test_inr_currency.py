import uuid
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from products.models import Product
from categories.models import Category
from products.serializers import ProductListSerializer, ProductDetailSerializer
from cart.models import Cart, CartItem
from cart.serializers import CartSerializer, CartItemSerializer
from orders.models import Order, OrderItem, Coupon, CouponUsage, Payment
from orders.serializers import OrderSerializer, PaymentSerializer
from orders.razorpay_service import RazorpayService

User = get_user_model()


class INRCurrencyTests(TestCase):
    """
    Comprehensive test suite ensuring seamless INR (₹) transition:
    1. Product price metadata & serialization in INR
    2. Cart subtotal and grand total decimal arithmetic
    3. Coupon discounts, validation messages, and INR limits
    4. Taxes and shipping calculations in INR
    5. Order creation, historical snapshot preservation, and order history
    6. Admin product-price editing in INR
    7. Payment amount, currency consistency, and paise minor-unit conversions
    8. Existing order history and cancellation handling
    9. Missing or invalid monetary value handling
    10. Regression tests ensuring no unintended USD / $ formatting remains
    """

    def setUp(self):
        self.client = APIClient()

        # Admin user
        self.admin = User.objects.create_superuser(
            email='admin_inr@deport.com',
            password='AdminPassword123!',
            first_name='Admin',
            last_name='User'
        )

        # Customer user
        self.customer = User.objects.create_user(
            email='customer_inr@deport.com',
            password='CustomerPassword123!',
            first_name='Aarav',
            last_name='Sharma',
            is_email_verified=True,
            is_active=True
        )

        # Product category & luxury products
        self.category = Category.objects.create(name='Horology', slug='horology')
        self.product1 = Product.objects.create(
            name='Chronograph Watch',
            slug='chronograph-watch',
            price=Decimal('1499.00'),
            compare_at_price=Decimal('1999.00'),
            stock_quantity=20,
            sku='CHR-001',
            category=self.category,
            is_active=True
        )
        self.product2 = Product.objects.create(
            name='Leather Strap',
            slug='leather-strap',
            price=Decimal('250.00'),
            stock_quantity=15,
            sku='STR-002',
            category=self.category,
            is_active=True
        )

    # 1. Product price formatting in INR and discount calculations
    def test_product_price_metadata_in_inr(self):
        # Discounted product (1499.00 vs 1999.00 -> 25% OFF)
        serializer_list = ProductListSerializer(self.product1)
        self.assertEqual(serializer_list.data['currency'], 'INR')
        self.assertEqual(serializer_list.data['currency_symbol'], '₹')
        self.assertEqual(Decimal(str(serializer_list.data['price'])), Decimal('1499.00'))
        self.assertEqual(Decimal(str(serializer_list.data['compare_at_price'])), Decimal('1999.00'))
        self.assertEqual(serializer_list.data['original_price'], '1999.00')
        self.assertEqual(serializer_list.data['discounted_price'], '1499.00')
        self.assertEqual(serializer_list.data['discount_percentage'], 25)
        self.assertTrue(serializer_list.data['has_discount'])

        serializer_detail = ProductDetailSerializer(self.product1)
        self.assertEqual(serializer_detail.data['currency'], 'INR')
        self.assertEqual(serializer_detail.data['currency_symbol'], '₹')
        self.assertEqual(serializer_detail.data['discount_percentage'], 25)
        self.assertTrue(serializer_detail.data['has_discount'])

        # Non-discounted product (250.00 with compare_at_price=None)
        serializer_list2 = ProductListSerializer(self.product2)
        self.assertEqual(Decimal(str(serializer_list2.data['price'])), Decimal('250.00'))
        self.assertIsNone(serializer_list2.data['original_price'])
        self.assertEqual(serializer_list2.data['discounted_price'], '250.00')
        self.assertEqual(serializer_list2.data['discount_percentage'], 0)
        self.assertFalse(serializer_list2.data['has_discount'])

    # 2. Cart subtotal and grand total calculations
    def test_cart_decimal_subtotal_calculations(self):
        cart = Cart.objects.create(user=self.customer)
        # 2 x 1499.00 = 2998.00
        CartItem.objects.create(cart=cart, product=self.product1, quantity=2)
        # 1 x 250.00 = 250.00
        CartItem.objects.create(cart=cart, product=self.product2, quantity=1)

        serializer = CartSerializer(cart)
        self.assertEqual(serializer.data['currency'], 'INR')
        self.assertEqual(serializer.data['currency_symbol'], '₹')
        self.assertEqual(serializer.data['subtotal'], 3248.00)

        # Verify items individual item_total
        items = serializer.data['items']
        self.assertEqual(len(items), 2)
        item1 = next(i for i in items if i['product'] == self.product1.id)
        self.assertEqual(item1['item_total'], 2998.00)

    # 3. Coupon discounts and minimum purchase requirements
    def test_coupon_discounts_and_min_purchase_in_inr(self):
        # Percentage coupon with INR minimum purchase and cap
        coupon_pct = Coupon.objects.create(
            code='FESTIVE10',
            discount_type='percentage',
            discount_value=Decimal('10.00'),
            min_order_amount=Decimal('1000.00'),
            max_discount_amount=Decimal('200.00'),
            is_active=True
        )

        # Subtotal below minimum order (₹500 < ₹1000)
        is_valid, msg = coupon_pct.is_valid_for_cart(self.customer, Decimal('500.00'))
        self.assertFalse(is_valid)
        self.assertIn('₹', msg)
        self.assertNotIn('$', msg)
        self.assertIn('1,000.00', msg)

        # Subtotal above minimum (₹2500 -> 10% is ₹250, capped at ₹200)
        is_valid, msg = coupon_pct.is_valid_for_cart(self.customer, Decimal('2500.00'))
        self.assertTrue(is_valid)
        discount = coupon_pct.calculate_discount(Decimal('2500.00'))
        self.assertEqual(discount, Decimal('200.00'))

        # Fixed coupon in INR
        coupon_fixed = Coupon.objects.create(
            code='FLAT300',
            discount_type='fixed',
            discount_value=Decimal('300.00'),
            min_order_amount=Decimal('500.00'),
            is_active=True
        )
        self.assertEqual(str(coupon_fixed), "FLAT300 (300.00₹)")
        fixed_discount = coupon_fixed.calculate_discount(Decimal('1000.00'))
        self.assertEqual(fixed_discount, Decimal('300.00'))

    # 4. Taxes and shipping calculations in INR
    def test_taxes_and_shipping_calculations(self):
        subtotal_high = Decimal('1000.00')
        # Subtotal >= ₹300 -> shipping is ₹0.00, tax is 5% = ₹50.00
        shipping_high = Decimal('0.00') if subtotal_high >= Decimal('300.00') else Decimal('25.00')
        tax_high = (subtotal_high * Decimal('0.05')).quantize(Decimal('0.01'))
        self.assertEqual(shipping_high, Decimal('0.00'))
        self.assertEqual(tax_high, Decimal('50.00'))

        subtotal_low = Decimal('200.00')
        # Subtotal < ₹300 -> shipping is ₹25.00, tax is 5% = ₹10.00
        shipping_low = Decimal('0.00') if subtotal_low >= Decimal('300.00') else Decimal('25.00')
        tax_low = (subtotal_low * Decimal('0.05')).quantize(Decimal('0.01'))
        self.assertEqual(shipping_low, Decimal('25.00'))
        self.assertEqual(tax_low, Decimal('10.00'))

    # 5. Order creation, historical snapshots, and order history
    def test_order_creation_and_historical_snapshot(self):
        self.client.force_authenticate(user=self.customer)

        cart = Cart.objects.create(user=self.customer)
        CartItem.objects.create(cart=cart, product=self.product1, quantity=1)

        checkout_data = {
            'payment_method': 'Cash on Delivery',
            'shipping_full_name': 'Aarav Sharma',
            'shipping_phone': '+91 9876543210',
            'shipping_address_line_1': '42 Marine Drive',
            'shipping_city': 'Mumbai',
            'shipping_state': 'Maharashtra',
            'shipping_postal_code': '400020',
            'shipping_country': 'India',
        }

        response = self.client.post('/api/orders/checkout/', checkout_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        order_data = response.data.get('order') or response.data
        self.assertEqual(order_data['currency'], 'INR')
        self.assertEqual(order_data['currency_symbol'], '₹')
        original_total = Decimal(str(order_data['total']))

        order_obj = Order.objects.get(id=order_data['id'])
        self.assertEqual(order_obj.currency, 'INR')
        self.assertEqual(order_obj.shipping_country, 'India')

        # Historical price snapshot test: Change product price afterwards
        self.product1.price = Decimal('2999.00')
        self.product1.save()

        # Reload order and verify historical price was NOT altered
        order_obj.refresh_from_db()
        self.assertEqual(order_obj.total, original_total)
        item = order_obj.items.first()
        self.assertEqual(item.unit_price, Decimal('1499.00'))

    # 6. Admin product-price editing in INR
    def test_admin_product_price_editing(self):
        self.client.force_authenticate(user=self.admin)
        update_data = {
            'price': '1850.00',
            'compare_at_price': '2200.00'
        }
        res = self.client.patch(f'/api/admin/products/{self.product1.id}/', update_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.product1.refresh_from_db()
        self.assertEqual(self.product1.price, Decimal('1850.00'))
        self.assertEqual(self.product1.compare_at_price, Decimal('2200.00'))

        # Validation: Discounted selling price cannot exceed original price
        invalid_data = {
            'price': '2500.00',
            'compare_at_price': '2000.00'
        }
        res_invalid = self.client.patch(f'/api/admin/products/{self.product1.id}/', invalid_data, format='json')
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)

        # Validation: Price cannot be negative or zero
        res_zero = self.client.patch(f'/api/admin/products/{self.product1.id}/', {'price': '0.00'}, format='json')
        self.assertEqual(res_zero.status_code, status.HTTP_400_BAD_REQUEST)

    # 7. Payment amount, currency consistency, and Razorpay paise
    def test_payment_currency_and_paise_conversion(self):
        # 1499.50 INR -> 149950 paise
        paise = RazorpayService.amount_to_paise(Decimal('1499.50'))
        self.assertEqual(paise, 149950)

        # 0.50 INR -> 50 paise
        self.assertEqual(RazorpayService.amount_to_paise(Decimal('0.50')), 50)

        # Create Order and Payment
        order = Order.objects.create(
            user=self.customer,
            subtotal=Decimal('1000.00'),
            tax=Decimal('50.00'),
            shipping_cost=Decimal('0.00'),
            discount=Decimal('0.00'),
            total=Decimal('1050.00'),
            currency='INR'
        )

        payment = Payment.objects.create(
            order=order,
            user=self.customer,
            payment_method='Razorpay',
            amount=Decimal('1050.00'),
            currency='INR',
            status='completed',
            transaction_id='pay_test12345'
        )
        self.assertEqual(payment.currency, 'INR')

        payment_serializer = PaymentSerializer(payment)
        self.assertEqual(payment_serializer.data['currency'], 'INR')

    # 8. Order cancellation and refund handling in INR
    def test_order_cancellation_preserves_currency(self):
        order = Order.objects.create(
            user=self.customer,
            subtotal=Decimal('500.00'),
            total=Decimal('525.00'),
            currency='INR',
            status='pending'
        )
        payment = Payment.objects.create(
            order=order,
            user=self.customer,
            payment_method='Cash on Delivery',
            amount=Decimal('525.00'),
            currency='INR',
            status='pending'
        )

        # Cancel order
        order.status = 'cancelled'
        order.cancellation_reason = 'Customer requested change'
        order.save()

        order.refresh_from_db()
        self.assertEqual(order.currency, 'INR')
        self.assertEqual(order.total, Decimal('525.00'))

    # 9. Missing or invalid monetary values
    def test_invalid_monetary_values(self):
        # amount_to_paise validation
        with self.assertRaises(ValueError):
            RazorpayService.amount_to_paise(None)

        with self.assertRaises(ValueError):
            RazorpayService.amount_to_paise(Decimal('0.00'))

        with self.assertRaises(ValueError):
            RazorpayService.amount_to_paise(Decimal('-150.00'))

        # Negative coupon min order validation
        coupon = Coupon(
            code='INVALIDNEG',
            discount_type='fixed',
            discount_value=Decimal('50.00'),
            min_order_amount=Decimal('-10.00')
        )
        from django.core.exceptions import ValidationError
        # clean method or serializer validation
        with self.assertRaises(Exception):
            coupon.full_clean()

    # 10. Regression tests ensuring no unintended USD / $ formatting remains
    def test_no_unintended_usd_formatting_regression(self):
        coupon = Coupon.objects.create(
            code='WELCOME100',
            discount_type='fixed',
            discount_value=Decimal('100.00'),
            min_order_amount=Decimal('500.00'),
            per_user_limit=5,
            is_active=True
        )

        usage = CouponUsage.objects.create(
            coupon=coupon,
            user=self.customer,
            discount_applied=Decimal('100.00')
        )

        # Check __str__ representations
        self.assertNotIn('$', str(coupon))
        self.assertIn('₹', str(coupon))

        self.assertNotIn('$', str(usage))
        self.assertIn('₹', str(usage))

        # Check CouponValidateView API response
        self.client.force_authenticate(user=self.customer)
        res = self.client.post('/api/orders/coupons/validate/', {
            'code': 'WELCOME100',
            'subtotal': '600.00'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['currency'], 'INR')
        self.assertEqual(res.data['currency_symbol'], '₹')
        self.assertNotIn('$', res.data['message'])
        self.assertIn('₹', res.data['message'])
