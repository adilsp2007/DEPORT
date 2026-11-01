from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from categories.models import Category
from products.models import Product, ProductImage
from decimal import Decimal

User = get_user_model()


class ProductAndCategoryAPITests(APITestCase):
    def setUp(self):
        # Create categories
        self.cat_handbags = Category.objects.create(
            name='Handbags',
            slug='handbags',
            description='Handbags category',
            is_active=True
        )
        self.cat_inactive = Category.objects.create(
            name='Archived Category',
            slug='archived-category',
            description='Inactive category',
            is_active=False
        )

        # Create products
        self.prod1 = Product.objects.create(
            name='Aurelia Leather Tote',
            slug='aurelia-leather-tote',
            description='Full description for tote.',
            short_description='Short desc tote.',
            price=Decimal('150.00'),
            compare_at_price=Decimal('200.00'),
            category=self.cat_handbags,
            brand='DEPORT',
            sku='DEP-TEST-001',
            stock_quantity=10,
            is_active=True,
            is_featured=True,
            is_new=True,
            is_best_seller=True
        )

        self.prod2 = Product.objects.create(
            name='Verona Wallet',
            slug='verona-wallet',
            description='Full description for wallet.',
            short_description='Short desc wallet.',
            price=Decimal('50.00'),
            category=self.cat_handbags,
            brand='DEPORT',
            sku='DEP-TEST-002',
            stock_quantity=0, # Out of stock
            is_active=True,
            is_featured=False,
            is_new=False,
            is_best_seller=False
        )

        self.prod_inactive = Product.objects.create(
            name='Hidden Product',
            slug='hidden-product',
            description='Inactive product.',
            price=Decimal('100.00'),
            category=self.cat_handbags,
            sku='LUX-TEST-003',
            stock_quantity=5,
            is_active=False
        )

        # Users
        self.normal_user = User.objects.create_user(
            email='customer@example.com',
            password='password123',
            first_name='Customer'
        )
        self.admin_user = User.objects.create_superuser(
            email='admin@example.com',
            password='adminpassword123',
            first_name='Admin'
        )

    # --- CATEGORY TESTS ---
    def test_list_active_categories(self):
        url = '/api/categories/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only contain active categories
        slugs = [c['slug'] for c in response.data['results'] if 'results' in response.data] if isinstance(response.data, dict) else [c['slug'] for c in response.data]
        self.assertIn('handbags', slugs)
        self.assertNotIn('archived-category', slugs)

    def test_get_category_by_slug(self):
        url = f'/api/categories/{self.cat_handbags.slug}/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Handbags')

    def test_get_inactive_category_returns_404(self):
        url = f'/api/categories/{self.cat_inactive.slug}/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # --- PRODUCT TESTS ---
    def test_list_active_products(self):
        url = '/api/products/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results']
        slugs = [p['slug'] for p in results]
        self.assertIn('aurelia-leather-tote', slugs)
        self.assertIn('verona-wallet', slugs)
        self.assertNotIn('hidden-product', slugs)

    def test_get_product_by_slug(self):
        url = f'/api/products/{self.prod1.slug}/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Aurelia Leather Tote')
        self.assertEqual(response.data['is_available'], True)

    def test_get_inactive_product_returns_404(self):
        url = f'/api/products/{self.prod_inactive.slug}/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_product_out_of_stock_is_available_false(self):
        url = f'/api/products/{self.prod2.slug}/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['is_available'], False)

    def test_filter_by_category(self):
        url = '/api/products/?category=handbags'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data['results']), 0)

    def test_search_products(self):
        url = '/api/products/?search=tote'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p['slug'] for p in response.data['results']]
        self.assertIn('aurelia-leather-tote', slugs)
        self.assertNotIn('verona-wallet', slugs)

    def test_price_filter(self):
        url = '/api/products/?min_price=100&max_price=200'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p['slug'] for p in response.data['results']]
        self.assertIn('aurelia-leather-tote', slugs)
        self.assertNotIn('verona-wallet', slugs) # price 50

    def test_sorting_price_low(self):
        url = '/api/products/?sort=price_low'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        prices = [float(p['price']) for p in response.data['results']]
        self.assertEqual(prices, sorted(prices))

    def test_boolean_filters(self):
        url = '/api/products/?is_featured=true&is_new=true&is_best_seller=true'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        slugs = [p['slug'] for p in response.data['results']]
        self.assertIn('aurelia-leather-tote', slugs)

    # --- SECURITY TESTS ---
    def test_customer_cannot_post_to_public_product_endpoint(self):
        url = '/api/products/'
        response = self.client.post(url, {'name': 'Hacker Product'})
        self.assertEqual(response.status_code, status.HTTP_451_UNAVAILABLE_FOR_LEGAL_REASONS if response.status_code == 451 else status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_unauthorized_user_cannot_access_admin_api(self):
        url = '/api/admin/products/'
        # Anonymous
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Normal User
        self.client.force_authenticate(user=self.normal_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_user_can_access_admin_api(self):
        url = '/api/admin/products/'
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_sorting_alphabetical(self):
        # A to Z
        url = '/api/products/?sort=name_asc'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        names = [p['name'] for p in resp.data['results']]
        self.assertEqual(names, sorted(names))

        # Z to A
        url_desc = '/api/products/?sort=name_desc'
        resp_desc = self.client.get(url_desc)
        self.assertEqual(resp_desc.status_code, status.HTTP_200_OK)
        names_desc = [p['name'] for p in resp_desc.data['results']]
        self.assertEqual(names_desc, sorted(names, reverse=True))

    def test_brand_filter(self):
        url = '/api/products/?brand=DEPORT'
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreater(len(resp.data['results']), 0)
        for p in resp.data['results']:
            self.assertEqual(p['brand'], 'DEPORT')

    def test_product_soft_delete_and_restore(self):
        self.client.force_authenticate(user=self.admin_user)

        # Soft delete
        del_resp = self.client.delete(f'/api/admin/products/{self.prod1.id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        self.prod1.refresh_from_db()
        self.assertTrue(self.prod1.is_deleted)
        self.assertFalse(self.prod1.is_active)

        # Public listing hides soft deleted product
        self.client.force_authenticate(user=None)
        pub_resp = self.client.get('/api/products/')
        slugs = [p['slug'] for p in pub_resp.data['results']]
        self.assertNotIn(self.prod1.slug, slugs)

        # Admin restore
        self.client.force_authenticate(user=self.admin_user)
        restore_resp = self.client.post(f'/api/admin/products/{self.prod1.id}/restore/')
        self.assertEqual(restore_resp.status_code, status.HTTP_200_OK)
        self.prod1.refresh_from_db()
        self.assertFalse(self.prod1.is_deleted)
        self.assertTrue(self.prod1.is_active)
