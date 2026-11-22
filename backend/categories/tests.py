from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from categories.models import Category, CategoryOffer
from products.models import Product
from cart.models import Cart, CartItem
from addresses.models import Address

User = get_user_model()


class CategoryAPITests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            email='admin@deport.test',
            password='AdminPassword123!',
            first_name='Admin',
            last_name='User'
        )
        self.client.force_authenticate(user=self.admin_user)

        self.cat1 = Category.objects.create(name='Backpacks', slug='backpacks', is_active=True)
        self.cat2 = Category.objects.create(name='Clutches', slug='clutches', is_active=True)

    def test_category_soft_delete_and_restore(self):
        # Soft delete cat1
        resp = self.client.delete(f'/api/admin/categories/{self.cat1.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.cat1.refresh_from_db()
        self.assertTrue(self.cat1.is_deleted)
        self.assertFalse(self.cat1.is_active)

        # Public listing should not include soft deleted category
        self.client.force_authenticate(user=None)
        public_resp = self.client.get('/api/categories/')
        self.assertEqual(public_resp.status_code, status.HTTP_200_OK)
        slugs = [c['slug'] for c in public_resp.data]
        self.assertNotIn('backpacks', slugs)
        self.assertIn('clutches', slugs)

        # Admin restore cat1
        self.client.force_authenticate(user=self.admin_user)
        restore_resp = self.client.post(f'/api/admin/categories/{self.cat1.id}/restore/')
        self.assertEqual(restore_resp.status_code, status.HTTP_200_OK)

        self.cat1.refresh_from_db()
        self.assertFalse(self.cat1.is_deleted)
        self.assertTrue(self.cat1.is_active)

    def test_category_search_and_pagination(self):
        resp = self.client.get('/api/admin/categories/?search=Backpack')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Check backend pagination response format
        self.assertIn('count', resp.data)
        self.assertIn('results', resp.data)
        self.assertEqual(resp.data['count'], 1)
        self.assertEqual(resp.data['results'][0]['name'], 'Backpacks')

    def test_case_insensitive_duplicate_creation_rejected(self):
        # 1. Exact lowercase: 'backpacks' (when 'Backpacks' exists)
        resp1 = self.client.post('/api/admin/categories/', {'name': 'backpacks'})
        self.assertEqual(resp1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Category with this name already exists.', str(resp1.data))

        # 2. Uppercase with leading/trailing whitespace: '  BACKPACKS  '
        resp2 = self.client.post('/api/admin/categories/', {'name': '  BACKPACKS  '})
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Category with this name already exists.', str(resp2.data))

        # 3. Multiple consecutive spaces inside: 'Clutches' already exists, try '  CLUTCHES  '
        resp3 = self.client.post('/api/admin/categories/', {'name': '  CLUTCHES  '})
        self.assertEqual(resp3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Category with this name already exists.', str(resp3.data))

    def test_case_insensitive_duplicate_editing_rejected(self):
        # Try to rename cat2 ('Clutches') to 'backpacks'
        resp = self.client.patch(f'/api/admin/categories/{self.cat2.id}/', {'name': 'backpacks'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Category with this name already exists.', str(resp.data))

        # Updating cat1 with its own name should succeed
        resp_self = self.client.patch(f'/api/admin/categories/{self.cat1.id}/', {'name': '  Backpacks  '})
        self.assertEqual(resp_self.status_code, status.HTTP_200_OK)
        self.cat1.refresh_from_db()
        self.assertEqual(self.cat1.name, 'Backpacks')

    def test_empty_category_name_rejected(self):
        resp = self.client.post('/api/admin/categories/', {'name': '   '})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('Category name' in str(resp.data))

    def test_whitespace_collapsing_on_creation(self):
        # Create a new category with irregular spacing: '  Travel    Duffel   Bags  '
        resp = self.client.post('/api/admin/categories/', {'name': '  Travel    Duffel   Bags  '})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['name'], 'Travel Duffel Bags')

        cat = Category.objects.get(id=resp.data['id'])
        self.assertEqual(cat.name, 'Travel Duffel Bags')
        self.assertEqual(cat.slug, 'travel-duffel-bags')


class CategoryOfferTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            email='admin_offer@deport.test',
            password='AdminPass123!',
            first_name='Admin',
            last_name='Offer'
        )
        self.customer = User.objects.create_user(
            email='customer_offer@deport.test',
            password='CustomerPass123!',
            first_name='Customer',
            last_name='User'
        )

        self.cat_handbags = Category.objects.create(name='Handbags Premium', slug='handbags-premium', is_active=True)
        self.cat_wallets = Category.objects.create(name='Wallets Leather', slug='wallets-leather', is_active=True)

        self.prod_bag = Product.objects.create(
            name='Luxury Handbag',
            slug='luxury-handbag',
            price=Decimal('2000.00'),
            category=self.cat_handbags,
            sku='HB-001',
            stock_quantity=10,
            is_active=True
        )

        self.prod_wallet = Product.objects.create(
            name='Classic Wallet',
            slug='classic-wallet',
            price=Decimal('1000.00'),
            category=self.cat_wallets,
            sku='WL-001',
            stock_quantity=10,
            is_active=True
        )

    # 1. Create a percentage category offer
    def test_01_create_percentage_category_offer(self):
        self.client.force_authenticate(user=self.admin)
        now = timezone.now()
        payload = {
            'category': self.cat_handbags.id,
            'offer_type': 'percentage',
            'offer_value': '20.00',
            'start_date': (now - timedelta(days=1)).isoformat(),
            'end_date': (now + timedelta(days=5)).isoformat(),
            'is_active': True
        }
        resp = self.client.post('/api/admin/category-offers/', payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['category'], self.cat_handbags.id)
        self.assertEqual(resp.data['offer_type'], 'percentage')
        self.assertEqual(resp.data['offer_value'], '20.00')
        self.assertEqual(resp.data['status'], 'active')

    # 2. Create a fixed amount category offer
    def test_02_create_fixed_amount_category_offer(self):
        self.client.force_authenticate(user=self.admin)
        now = timezone.now()
        payload = {
            'category': self.cat_wallets.id,
            'offer_type': 'fixed',
            'offer_value': '300.00',
            'start_date': (now - timedelta(days=1)).isoformat(),
            'end_date': (now + timedelta(days=10)).isoformat(),
            'is_active': True
        }
        resp = self.client.post('/api/admin/category-offers/', payload)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['offer_type'], 'fixed')
        self.assertEqual(resp.data['offer_value'], '300.00')

    # 3. Apply an offer to the correct category & 4. Verify products from other categories are unaffected
    def test_03_apply_offer_to_correct_category_and_verify_others_unaffected(self):
        now = timezone.now()
        CategoryOffer.objects.create(
            category=self.cat_handbags,
            offer_type='percentage',
            offer_value=Decimal('20.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            is_active=True
        )

        # Check Handbag product (should get 20% off on 2000 => 1600)
        resp_bag = self.client.get(f'/api/products/{self.prod_bag.slug}/')
        self.assertEqual(resp_bag.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_bag.data['price'], '1600.00')
        self.assertEqual(resp_bag.data['original_price'], '2000.00')
        self.assertEqual(resp_bag.data['discount_percentage'], 20)
        self.assertIsNotNone(resp_bag.data['category_offer'])

        # Check Wallet product (should remain undiscounted 1000)
        resp_wallet = self.client.get(f'/api/products/{self.prod_wallet.slug}/')
        self.assertEqual(resp_wallet.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_wallet.data['price'], '1000.00')
        self.assertIsNone(resp_wallet.data['original_price'])
        self.assertIsNone(resp_wallet.data['category_offer'])

    # 5. Verify expired offers are not applied
    def test_05_expired_offers_not_applied(self):
        now = timezone.now()
        CategoryOffer.objects.create(
            category=self.cat_handbags,
            offer_type='percentage',
            offer_value=Decimal('50.00'),
            start_date=now - timedelta(days=10),
            end_date=now - timedelta(days=2), # Expired 2 days ago
            is_active=True
        )
        resp = self.client.get(f'/api/products/{self.prod_bag.slug}/')
        self.assertEqual(resp.data['price'], '2000.00')
        self.assertIsNone(resp.data['category_offer'])

    # 6. Verify inactive offers are not applied
    def test_06_inactive_offers_not_applied(self):
        now = timezone.now()
        CategoryOffer.objects.create(
            category=self.cat_handbags,
            offer_type='percentage',
            offer_value=Decimal('50.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            is_active=False # Inactive
        )
        resp = self.client.get(f'/api/products/{self.prod_bag.slug}/')
        self.assertEqual(resp.data['price'], '2000.00')
        self.assertIsNone(resp.data['category_offer'])

    # 7. Verify scheduled offers are not applied early
    def test_07_scheduled_offers_not_applied_early(self):
        now = timezone.now()
        CategoryOffer.objects.create(
            category=self.cat_handbags,
            offer_type='percentage',
            offer_value=Decimal('50.00'),
            start_date=now + timedelta(days=2), # Starts in 2 days
            end_date=now + timedelta(days=10),
            is_active=True
        )
        resp = self.client.get(f'/api/products/{self.prod_bag.slug}/')
        self.assertEqual(resp.data['price'], '2000.00')
        self.assertIsNone(resp.data['category_offer'])

    # 8. Prevent overlapping conflicting offers
    def test_08_prevent_overlapping_conflicting_offers(self):
        self.client.force_authenticate(user=self.admin)
        now = timezone.now()
        CategoryOffer.objects.create(
            category=self.cat_handbags,
            offer_type='percentage',
            offer_value=Decimal('20.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=10),
            is_active=True
        )

        # Attempt to create another active offer for cat_handbags overlapping the date range
        payload_conflict = {
            'category': self.cat_handbags.id,
            'offer_type': 'fixed',
            'offer_value': '150.00',
            'start_date': (now + timedelta(days=2)).isoformat(),
            'end_date': (now + timedelta(days=5)).isoformat(),
            'is_active': True
        }
        resp = self.client.post('/api/admin/category-offers/', payload_conflict)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already exists', str(resp.data))

    # 9. Test product offer and category offer priority (best eligible offer wins without stacking)
    def test_09_offer_priority_best_offer_wins(self):
        now = timezone.now()
        # Product has a product-level discount: MSRP 2000, price 1800 (discount = 200)
        self.prod_bag.compare_at_price = Decimal('2000.00')
        self.prod_bag.price = Decimal('1800.00')
        self.prod_bag.save()

        # Case A: Category offer gives 20% on 2000 = 400 (which is > 200) => Category offer wins (price 1600)
        cat_offer = CategoryOffer.objects.create(
            category=self.cat_handbags,
            offer_type='percentage',
            offer_value=Decimal('20.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            is_active=True
        )

        resp_cat_wins = self.client.get(f'/api/products/{self.prod_bag.slug}/')
        self.assertEqual(resp_cat_wins.data['price'], '1600.00')
        self.assertIsNotNone(resp_cat_wins.data['category_offer'])

        # Case B: If product-level discount is 500 (price 1500, compare 2000), it beats category offer 400 => Product offer wins
        self.prod_bag.price = Decimal('1500.00')
        self.prod_bag.save()

        resp_prod_wins = self.client.get(f'/api/products/{self.prod_bag.slug}/')
        self.assertEqual(resp_prod_wins.data['price'], '1500.00')
        self.assertIsNone(resp_prod_wins.data['category_offer'])

    # 10. Verify cart and checkout prices
    def test_10_cart_and_checkout_prices(self):
        now = timezone.now()
        # 20% Category offer on Handbags (price 2000 -> 1600)
        CategoryOffer.objects.create(
            category=self.cat_handbags,
            offer_type='percentage',
            offer_value=Decimal('20.00'),
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=5),
            is_active=True
        )

        self.client.force_authenticate(user=self.customer)
        # Add 2 Handbags to cart
        cart, _ = Cart.objects.get_or_create(user=self.customer)
        CartItem.objects.create(cart=cart, product=self.prod_bag, quantity=2)

        # Check cart subtotal: 2 * 1600 = 3200
        cart_resp = self.client.get('/api/cart/')
        self.assertEqual(cart_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(cart_resp.data['subtotal'], 3200.00)

        # Place order at checkout
        address = Address.objects.create(
            user=self.customer,
            full_name='Customer Name',
            phone='9876543210',
            address_line_1='123 Luxury Road',
            city='Mumbai',
            state='Maharashtra',
            postal_code='400001',
            country='India',
            is_default=True
        )
        checkout_resp = self.client.post('/api/orders/checkout/', {
            'address_id': address.id,
            'payment_method': 'Cash on Delivery'
        })
        self.assertEqual(checkout_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(float(checkout_resp.data['order']['subtotal']), 3200.00)
        # Verify order item unit_price is 1600
        self.assertEqual(float(checkout_resp.data['order']['items'][0]['unit_price']), 1600.00)

    # 11. Verify unauthorized users cannot manage offers
    def test_11_unauthorized_users_cannot_manage_offers(self):
        # Anonymous user
        self.client.force_authenticate(user=None)
        resp_anon = self.client.get('/api/admin/category-offers/')
        self.assertEqual(resp_anon.status_code, status.HTTP_401_UNAUTHORIZED)

        # Regular customer (non-staff)
        self.client.force_authenticate(user=self.customer)
        resp_cust = self.client.get('/api/admin/category-offers/')
        self.assertEqual(resp_cust.status_code, status.HTTP_403_FORBIDDEN)

    # 12. Test invalid values and date validation
    def test_12_invalid_values_and_date_validation(self):
        self.client.force_authenticate(user=self.admin)
        now = timezone.now()

        # Zero or negative offer value
        resp_zero = self.client.post('/api/admin/category-offers/', {
            'category': self.cat_handbags.id,
            'offer_type': 'percentage',
            'offer_value': '0.00',
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=1)).isoformat()
        })
        self.assertEqual(resp_zero.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('greater than zero', str(resp_zero.data))

        # Percentage exceeding 100
        resp_over = self.client.post('/api/admin/category-offers/', {
            'category': self.cat_handbags.id,
            'offer_type': 'percentage',
            'offer_value': '105.00',
            'start_date': now.isoformat(),
            'end_date': (now + timedelta(days=1)).isoformat()
        })
        self.assertEqual(resp_over.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot exceed 100', str(resp_over.data))

        # End date earlier than start date
        resp_date = self.client.post('/api/admin/category-offers/', {
            'category': self.cat_handbags.id,
            'offer_type': 'percentage',
            'offer_value': '25.00',
            'start_date': (now + timedelta(days=5)).isoformat(),
            'end_date': now.isoformat()
        })
        self.assertEqual(resp_date.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('later than start date', str(resp_date.data))


