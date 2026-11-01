from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from categories.models import Category
from products.models import Product
from wishlist.models import Wishlist
from decimal import Decimal

User = get_user_model()


class WishlistAPITests(APITestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            email='usera@example.com',
            password='password123',
            first_name='UserA'
        )
        self.user_b = User.objects.create_user(
            email='userb@example.com',
            password='password123',
            first_name='UserB'
        )

        self.category = Category.objects.create(name='Tote Bags', slug='tote-bags')

        self.product1 = Product.objects.create(
            name='Classic Leather Tote',
            slug='classic-leather-tote',
            description='Leather tote description.',
            price=Decimal('150.00'),
            category=self.category,
            sku='LUX-WISH-001',
            stock_quantity=10,
            is_active=True
        )

        self.product2 = Product.objects.create(
            name='Luxury Crossbody',
            slug='luxury-crossbody',
            description='Crossbody description.',
            price=Decimal('200.00'),
            category=self.category,
            sku='LUX-WISH-002',
            stock_quantity=0, # Out of stock
            is_active=True
        )

        self.inactive_product = Product.objects.create(
            name='Archived Bag',
            slug='archived-bag',
            description='Inactive product.',
            price=Decimal('100.00'),
            category=self.category,
            sku='LUX-WISH-003',
            stock_quantity=5,
            is_active=False
        )

    def test_unauthenticated_request_fails(self):
        url = '/api/wishlist/'
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_add_and_list_wishlist(self):
        self.client.force_authenticate(user=self.user_a)

        # Add product1
        response = self.client.post('/api/wishlist/', {'product_id': self.product1.id})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # List wishlist
        response = self.client.get('/api/wishlist/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['product']['id'], self.product1.id)

    def test_duplicate_add_does_not_create_duplicate(self):
        self.client.force_authenticate(user=self.user_a)

        # Add twice
        self.client.post('/api/wishlist/', {'product_id': self.product1.id})
        res2 = self.client.post('/api/wishlist/', {'product_id': self.product1.id})

        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(Wishlist.objects.filter(user=self.user_a, product=self.product1).count(), 1)

    def test_toggle_wishlist(self):
        self.client.force_authenticate(user=self.user_a)
        url = f'/api/wishlist/{self.product1.id}/toggle/'

        # First toggle: Add
        res1 = self.client.post(url)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertTrue(res1.data['wishlisted'])
        self.assertEqual(res1.data['count'], 1)

        # Second toggle: Remove
        res2 = self.client.post(url)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertFalse(res2.data['wishlisted'])
        self.assertEqual(res2.data['count'], 0)

    def test_remove_from_wishlist(self):
        self.client.force_authenticate(user=self.user_a)
        Wishlist.objects.create(user=self.user_a, product=self.product1)

        response = self.client.delete(f'/api/wishlist/{self.product1.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Wishlist.objects.filter(user=self.user_a).count(), 0)

    def test_wishlist_count(self):
        self.client.force_authenticate(user=self.user_a)
        Wishlist.objects.create(user=self.user_a, product=self.product1)
        Wishlist.objects.create(user=self.user_a, product=self.product2)

        response = self.client.get('/api/wishlist/count/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

    def test_user_ownership_isolation(self):
        # User A adds product1 to wishlist
        Wishlist.objects.create(user=self.user_a, product=self.product1)

        # User B requests wishlist
        self.client.force_authenticate(user=self.user_b)
        response = self.client.get('/api/wishlist/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

        # User B attempts to delete User A's wishlist product
        del_response = self.client.delete(f'/api/wishlist/{self.product1.id}/')
        self.assertEqual(del_response.status_code, status.HTTP_200_OK)

        # Verify User A's wishlist item is still intact!
        self.assertTrue(Wishlist.objects.filter(user=self.user_a, product=self.product1).exists())

    def test_out_of_stock_product_remains_in_wishlist(self):
        self.client.force_authenticate(user=self.user_a)
        Wishlist.objects.create(user=self.user_a, product=self.product2) # stock 0

        response = self.client.get('/api/wishlist/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['product']['is_available'], False)

    def test_inactive_product_hidden_from_wishlist(self):
        self.client.force_authenticate(user=self.user_a)
        Wishlist.objects.create(user=self.user_a, product=self.inactive_product)

        response = self.client.get('/api/wishlist/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_nonexistent_product_returns_404(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post('/api/wishlist/9999/toggle/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
