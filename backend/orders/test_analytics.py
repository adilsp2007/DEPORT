import datetime
from decimal import Decimal
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import User
from products.models import Product
from categories.models import Category
from orders.models import Order, OrderItem, Payment, Coupon


class AdminDashboardAnalyticsTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # 1. Admin user
        cls.admin_user = User.objects.create_superuser(
            email='admin_analytics@deport.com',
            password='AdminPassword123!',
            first_name='Admin',
            last_name='Tester'
        )
        cls.admin_user.is_email_verified = True
        cls.admin_user.save()

        # 2. Regular customer user
        cls.customer_user = User.objects.create_user(
            email='customer_analytics@deport.com',
            password='CustomerPassword123!',
            first_name='Customer',
            last_name='Tester'
        )
        cls.customer_user.is_email_verified = True
        cls.customer_user.save()

        # 3. Category & Products
        cls.category_bags = Category.objects.create(
            name='Analytics Bags',
            slug='analytics-bags',
            is_active=True
        )
        cls.category_luggage = Category.objects.create(
            name='Analytics Luggage',
            slug='analytics-luggage',
            is_active=True
        )

        cls.product_a = Product.objects.create(
            name='Analytics Duffle Bag',
            sku='ANL-DUF-001',
            category=cls.category_bags,
            price=Decimal('1000.00'),
            stock_quantity=50,
            is_active=True
        )
        cls.product_b = Product.objects.create(
            name='Analytics Suitcase',
            sku='ANL-SUI-002',
            category=cls.category_luggage,
            price=Decimal('2000.00'),
            stock_quantity=30,
            is_active=True
        )

        # 4. Coupon
        cls.coupon = Coupon.objects.create(
            code='ANLPROMO',
            discount_type='percentage',
            discount_value=Decimal('10.00'),
            is_active=True
        )

        # 5. Fixed dates for predictable testing
        tz = timezone.get_current_timezone()
        now = timezone.now().astimezone(tz)

        # Completed Order 1 (This Month, Product A)
        cls.order_1 = Order.objects.create(
            order_number='LUX-TEST-001',
            user=cls.customer_user,
            status='delivered',
            subtotal=Decimal('2000.00'),
            total=Decimal('2000.00'),
            shipping_full_name='Customer Tester',
            shipping_address_line_1='Street 1',
            shipping_city='Mumbai',
            shipping_state='MH',
            shipping_postal_code='400001'
        )
        OrderItem.objects.create(
            order=cls.order_1,
            product=cls.product_a,
            product_name=cls.product_a.name,
            product_sku=cls.product_a.sku,
            quantity=2,
            unit_price=Decimal('1000.00'),
            total_price=Decimal('2000.00')
        )
        Payment.objects.create(
            order=cls.order_1,
            user=cls.customer_user,
            amount=Decimal('2000.00'),
            status='completed',
            payment_method='Razorpay'
        )

        # Cancelled Order 2 (Should NOT contribute to revenue)
        cls.order_2 = Order.objects.create(
            order_number='LUX-TEST-002',
            user=cls.customer_user,
            status='cancelled',
            subtotal=Decimal('1000.00'),
            total=Decimal('1000.00'),
            shipping_full_name='Customer Tester',
            shipping_address_line_1='Street 2',
            shipping_city='Mumbai',
            shipping_state='MH',
            shipping_postal_code='400001'
        )
        OrderItem.objects.create(
            order=cls.order_2,
            product=cls.product_a,
            product_name=cls.product_a.name,
            product_sku=cls.product_a.sku,
            quantity=1,
            unit_price=Decimal('1000.00'),
            total_price=Decimal('1000.00'),
            is_cancelled=True
        )
        Payment.objects.create(
            order=cls.order_2,
            user=cls.customer_user,
            amount=Decimal('1000.00'),
            status='cancelled',
            payment_method='Razorpay'
        )

        # Refunded Order 3 (Should NOT contribute to revenue)
        cls.order_3 = Order.objects.create(
            order_number='LUX-TEST-003',
            user=cls.customer_user,
            status='returned',
            subtotal=Decimal('2000.00'),
            total=Decimal('2000.00'),
            shipping_full_name='Customer Tester',
            shipping_address_line_1='Street 3',
            shipping_city='Mumbai',
            shipping_state='MH',
            shipping_postal_code='400001'
        )
        OrderItem.objects.create(
            order=cls.order_3,
            product=cls.product_b,
            product_name=cls.product_b.name,
            product_sku=cls.product_b.sku,
            quantity=1,
            unit_price=Decimal('2000.00'),
            total_price=Decimal('2000.00')
        )
        Payment.objects.create(
            order=cls.order_3,
            user=cls.customer_user,
            amount=Decimal('2000.00'),
            status='refunded',
            payment_method='Razorpay'
        )

    def test_01_admin_authorization(self):
        """15. Admin authorization strictly enforced (401/403)."""
        # Unauthenticated request rejected
        res = self.client.get('/api/admin/dashboard/analytics/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Regular customer user forbidden
        self.client.force_authenticate(user=self.customer_user)
        res = self.client.get('/api/admin/dashboard/analytics/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # Admin user succeeds
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/admin/dashboard/analytics/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_02_today_filter(self):
        """1. Today filter returns valid structure and cards."""
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/admin/dashboard/analytics/?period=today')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['period'], 'today')
        self.assertEqual(res.data['grouping'], 'hour')
        self.assertIn('cards', res.data)
        self.assertIn('revenue_chart', res.data)
        self.assertIn('orders_chart', res.data)

    def test_03_yesterday_filter(self):
        """2. Yesterday filter."""
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/admin/dashboard/analytics/?period=yesterday')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['period'], 'yesterday')

    def test_04_this_month_and_last_month_filters(self):
        """3 & 4. This month and last month filters."""
        self.client.force_authenticate(user=self.admin_user)
        res_tm = self.client.get('/api/admin/dashboard/analytics/?period=this_month')
        self.assertEqual(res_tm.status_code, status.HTTP_200_OK)
        self.assertEqual(res_tm.data['period'], 'this_month')

        res_lm = self.client.get('/api/admin/dashboard/analytics/?period=last_month')
        self.assertEqual(res_lm.status_code, status.HTTP_200_OK)
        self.assertEqual(res_lm.data['period'], 'last_month')

    def test_05_this_year_and_last_year_filters(self):
        """5 & 6. This year and last year filters."""
        self.client.force_authenticate(user=self.admin_user)
        res_ty = self.client.get('/api/admin/dashboard/analytics/?period=this_year')
        self.assertEqual(res_ty.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ty.data['period'], 'this_year')

        res_ly = self.client.get('/api/admin/dashboard/analytics/?period=last_year')
        self.assertEqual(res_ly.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ly.data['period'], 'last_year')

    def test_06_custom_date_range(self):
        """7. Custom date range filter."""
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/admin/dashboard/analytics/?period=custom&start_date=2026-01-01&end_date=2026-12-31')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['period'], 'custom')
        self.assertTrue(len(res.data['revenue_chart']) > 0)

    def test_07_invalid_date_ranges(self):
        """8. Invalid date ranges return HTTP 400 with helpful errors."""
        self.client.force_authenticate(user=self.admin_user)

        # End date earlier than start date
        res = self.client.get('/api/admin/dashboard/analytics/?period=custom&start_date=2026-12-31&end_date=2026-01-01')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('end_date', res.data)

        # Malformed date string
        res2 = self.client.get('/api/admin/dashboard/analytics/?period=custom&start_date=invalid-date&end_date=2026-12-31')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

        # Missing date strings for custom
        res3 = self.client.get('/api/admin/dashboard/analytics/?period=custom')
        self.assertEqual(res3.status_code, status.HTTP_400_BAD_REQUEST)

    def test_08_empty_date_range_safely_handled(self):
        """9. Empty date range with zero orders handled safely without crashing."""
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/admin/dashboard/analytics/?period=custom&start_date=2020-01-01&end_date=2020-01-05')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['cards']['total_orders']['value'], 0)
        self.assertEqual(res.data['cards']['total_revenue']['value'], 0.0)
        self.assertEqual(res.data['cards']['total_delivered_orders']['value'], 0)
        self.assertEqual(res.data['sales_performance']['average_order_value']['current'], 0.0)
        self.assertEqual(len(res.data['top_selling_products']), 0)
        self.assertEqual(len(res.data['category_sales']), 0)

    def test_09_revenue_calculations_and_exclusions(self):
        """10, 11, 12. Revenue accurately includes paid orders and excludes cancelled/refunded."""
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/admin/dashboard/analytics/?period=this_year')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Order 1 (2000.00, delivered, payment completed) -> INCLUDED
        # Order 2 (1000.00, cancelled) -> EXCLUDED
        # Order 3 (2000.00, returned/refunded) -> EXCLUDED
        total_rev = res.data['cards']['total_revenue']['value']
        self.assertEqual(total_rev, 2000.00)

        # Delivered orders count = 1
        self.assertEqual(res.data['cards']['total_delivered_orders']['value'], 1)
        # Cancelled orders count = 1
        self.assertEqual(res.data['cards']['cancelled_orders']['value'], 1)

    def test_10_top_selling_products_calculation(self):
        """13. Top-selling products accurately aggregates units sold and revenue."""
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/admin/dashboard/analytics/?period=this_year')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        top_prods = res.data['top_selling_products']
        self.assertTrue(len(top_prods) >= 1)
        first_prod = top_prods[0]
        # Product A had 2 units sold in Order 1
        self.assertEqual(first_prod['name'], self.product_a.name)
        self.assertEqual(first_prod['units_sold'], 2)
        self.assertEqual(first_prod['total_revenue'], 2000.00)

    def test_11_category_wise_sales_calculation(self):
        """14. Category-wise sales calculates revenue and percentage contribution."""
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/admin/dashboard/analytics/?period=this_year')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        cat_sales = res.data['category_sales']
        self.assertTrue(len(cat_sales) >= 1)
        bags_entry = next((c for c in cat_sales if c['category_name'] == self.category_bags.name), None)
        self.assertIsNotNone(bags_entry)
        self.assertEqual(bags_entry['units_sold'], 2)
        self.assertEqual(bags_entry['total_revenue'], 2000.00)
        self.assertEqual(bags_entry['percentage'], 100.0)

    def test_12_chart_updates_and_recent_orders_search(self):
        """16. Search and filter on recent orders table."""
        self.client.force_authenticate(user=self.admin_user)
        # Search by order number LUX-TEST-001
        res = self.client.get('/api/admin/dashboard/analytics/?period=this_year&order_search=LUX-TEST-001')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        orders = res.data['recent_orders']
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]['order_number'], 'LUX-TEST-001')

        # Filter by status cancelled
        res_cancelled = self.client.get('/api/admin/dashboard/analytics/?period=this_year&order_status=cancelled')
        self.assertEqual(res_cancelled.status_code, status.HTTP_200_OK)
        canc_orders = res_cancelled.data['recent_orders']
        self.assertEqual(len(canc_orders), 1)
        self.assertEqual(canc_orders[0]['order_number'], 'LUX-TEST-002')

