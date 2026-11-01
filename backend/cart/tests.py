from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from decimal import Decimal
from categories.models import Category
from products.models import Product
from wishlist.models import Wishlist
from cart.models import Cart, CartItem

User = get_user_model()


class CartAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='shopper@deport.test',
            password='TestPassword123!',
            first_name='Jane',
            last_name='Shopper'
        )
        self.client.force_authenticate(user=self.user)

        self.category = Category.objects.create(
            name='Totes',
            slug='totes',
            is_active=True
        )

        self.in_stock_product = Product.objects.create(
            name='Classic Leather Bag',
            slug='classic-leather-bag',
            description='Handmade leather bag.',
            price=Decimal('120.00'),
            category=self.category,
            sku='BAG-101',
            stock_quantity=5,
            is_active=True
        )

        self.out_of_stock_product = Product.objects.create(
            name='Sold Out Clutch',
            slug='sold-out-clutch',
            description='Sold out clutch.',
            price=Decimal('80.00'),
            category=self.category,
            sku='CLU-202',
            stock_quantity=0,
            is_active=True
        )

        self.unlisted_product = Product.objects.create(
            name='Unlisted Duffle',
            slug='unlisted-duffle',
            description='Unlisted duffle.',
            price=Decimal('200.00'),
            category=self.category,
            sku='DUF-303',
            stock_quantity=10,
            is_active=False
        )

    def test_add_to_cart_and_increment_existing(self):
        # 1. Add to cart
        resp = self.client.post('/api/cart/add/', {
            'product_id': self.in_stock_product.id,
            'quantity': 1
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        cart_data = resp.data['cart']
        self.assertEqual(len(cart_data['items']), 1)
        self.assertEqual(cart_data['items'][0]['quantity'], 1)

        # 2. Add same product again -> quantity should increment to 2
        resp2 = self.client.post('/api/cart/add/', {
            'product_id': self.in_stock_product.id,
            'quantity': 2
        })
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        cart_data2 = resp2.data['cart']
        self.assertEqual(len(cart_data2['items']), 1)
        self.assertEqual(cart_data2['items'][0]['quantity'], 3)

    def test_prevent_adding_unlisted_product(self):
        resp = self.client.post('/api/cart/add/', {
            'product_id': self.unlisted_product.id,
            'quantity': 1
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('unlisted or unavailable', resp.data['detail'])

    def test_prevent_adding_out_of_stock_product(self):
        resp = self.client.post('/api/cart/add/', {
            'product_id': self.out_of_stock_product.id,
            'quantity': 1
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('out of stock', resp.data['detail'])

    def test_remove_product_from_wishlist_when_added_to_cart(self):
        # Wishlist product first
        Wishlist.objects.create(user=self.user, product=self.in_stock_product)
        self.assertTrue(Wishlist.objects.filter(user=self.user, product=self.in_stock_product).exists())

        # Add to cart
        resp = self.client.post('/api/cart/add/', {
            'product_id': self.in_stock_product.id,
            'quantity': 1
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data['removed_from_wishlist'])
        # Verify removed from wishlist
        self.assertFalse(Wishlist.objects.filter(user=self.user, product=self.in_stock_product).exists())

    def test_stock_validation_and_max_quantity_limit(self):
        # Cannot add more than stock (stock is 5)
        resp = self.client.post('/api/cart/add/', {
            'product_id': self.in_stock_product.id,
            'quantity': 6
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Insufficient stock', resp.data['detail'])

        # Cannot exceed max limit (10)
        self.in_stock_product.stock_quantity = 50
        self.in_stock_product.save()

        resp_limit = self.client.post('/api/cart/add/', {
            'product_id': self.in_stock_product.id,
            'quantity': 11
        })
        self.assertEqual(resp_limit.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Maximum order limit', resp_limit.data['detail'])

    def test_update_quantity_and_remove_item(self):
        self.client.post('/api/cart/add/', {
            'product_id': self.in_stock_product.id,
            'quantity': 2
        })

        # Update quantity
        resp = self.client.patch('/api/cart/update-quantity/', {
            'product_id': self.in_stock_product.id,
            'quantity': 4
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['cart']['items'][0]['quantity'], 4)

        # Remove item
        resp_del = self.client.delete('/api/cart/remove/', {
            'product_id': self.in_stock_product.id
        })
        self.assertEqual(resp_del.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_del.data['cart']['items']), 0)

    def test_out_of_stock_restricts_checkout(self):
        # Add product with 1 stock
        self.in_stock_product.stock_quantity = 1
        self.in_stock_product.save()

        self.client.post('/api/cart/add/', {
            'product_id': self.in_stock_product.id,
            'quantity': 1
        })

        # Check cart status -> can checkout is True
        resp_valid = self.client.get('/api/cart/validate/')
        self.assertTrue(resp_valid.data['can_checkout'])

        # Suddenly stock becomes 0
        self.in_stock_product.stock_quantity = 0
        self.in_stock_product.save()

        # Check cart status -> can checkout is False
        resp_invalid = self.client.get('/api/cart/validate/')
        self.assertFalse(resp_invalid.data['can_checkout'])
        self.assertIn('out of stock', resp_invalid.data['reason'])
