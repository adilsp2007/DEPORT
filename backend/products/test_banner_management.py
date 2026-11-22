import datetime
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from django.core.files.uploadedfile import SimpleUploadedFile

from users.models import User
from products.models import Banner, Product
from categories.models import Category


class BannerAdminManagementTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        # 1. Staff Admin User
        cls.admin_user = User.objects.create_superuser(
            email='admin_banners@deport.com',
            password='AdminPassword123!',
            first_name='Admin',
            last_name='Banners'
        )
        cls.admin_user.is_email_verified = True
        cls.admin_user.save()

        # 2. Regular Customer User
        cls.customer_user = User.objects.create_user(
            email='customer_banners@deport.com',
            password='CustomerPassword123!',
            first_name='Customer',
            last_name='Banners'
        )
        cls.customer_user.is_email_verified = True
        cls.customer_user.save()

        # 3. Category & Product for linking
        cls.category = Category.objects.create(
            name='Luxury Bags',
            slug='luxury-bags',
            is_active=True
        )
        cls.product = Product.objects.create(
            name='Monaco Duffle',
            sku='MON-001',
            price=1500.00,
            category=cls.category,
            is_active=True
        )

        now = timezone.now()

        # 4. Create distinct banners for testing:
        # Banner 1: Hero, Active
        cls.banner_hero = Banner.objects.create(
            title='Autumn Heritage Hero',
            placement='hero',
            is_active=True,
            image_url='https://example.com/hero.jpg',
            button_text='Explore',
            button_link='/shop',
            display_order=1
        )

        # Banner 2: Promotional, Active
        cls.banner_promo = Banner.objects.create(
            title='Black Friday Promo',
            placement='promotional',
            is_active=True,
            image_url='https://example.com/promo.jpg',
            button_text='Shop Sale',
            button_link='/shop?sale=true',
            display_order=2
        )

        # Banner 3: Secondary, Inactive
        cls.banner_sec_inactive = Banner.objects.create(
            title='Archive Collection Secondary',
            placement='secondary',
            is_active=False,
            image_url='https://example.com/sec.jpg',
            button_text='Archive',
            button_link='/archive',
            display_order=3
        )

        # Banner 4: Hero, Expired
        cls.banner_expired = Banner.objects.create(
            title='Expired Summer Hero',
            placement='hero',
            is_active=True,
            start_date=now - datetime.timedelta(days=30),
            end_date=now - datetime.timedelta(days=10),
            image_url='https://example.com/expired.jpg',
            display_order=4
        )

        # Banner 5: Hero, Scheduled Future
        cls.banner_scheduled = Banner.objects.create(
            title='Future Winter Hero',
            placement='hero',
            is_active=True,
            start_date=now + datetime.timedelta(days=10),
            end_date=now + datetime.timedelta(days=30),
            image_url='https://example.com/scheduled.jpg',
            display_order=5
        )

    def test_01_display_all_banners(self):
        """1. Display all banners via admin endpoint."""
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/admin/banners/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 5)

    def test_02_filter_by_each_banner_type(self):
        """2. Filter by each available banner type (hero, promotional, secondary)."""
        self.client.force_authenticate(user=self.admin_user)

        # Hero filter
        res_hero = self.client.get('/api/admin/banners/?banner_type=hero')
        self.assertEqual(res_hero.status_code, status.HTTP_200_OK)
        self.assertEqual(res_hero.data['count'], 3)
        for b in res_hero.data['results']:
            self.assertEqual(b['placement'], 'hero')

        # Also support ?placement=hero parameter
        res_hero_plac = self.client.get('/api/admin/banners/?placement=hero')
        self.assertEqual(res_hero_plac.status_code, status.HTTP_200_OK)
        self.assertEqual(res_hero_plac.data['count'], 3)

        # Promotional filter
        res_promo = self.client.get('/api/admin/banners/?banner_type=promotional')
        self.assertEqual(res_promo.status_code, status.HTTP_200_OK)
        self.assertEqual(res_promo.data['count'], 1)
        self.assertEqual(res_promo.data['results'][0]['title'], 'Black Friday Promo')

        # Secondary filter
        res_sec = self.client.get('/api/admin/banners/?banner_type=secondary')
        self.assertEqual(res_sec.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sec.data['count'], 1)
        self.assertEqual(res_sec.data['results'][0]['title'], 'Archive Collection Secondary')

    def test_03_select_all_types(self):
        """3. Select 'all' or 'All Types' returns all banners."""
        self.client.force_authenticate(user=self.admin_user)
        res_all = self.client.get('/api/admin/banners/?banner_type=all')
        self.assertEqual(res_all.status_code, status.HTTP_200_OK)
        self.assertEqual(res_all.data['count'], 5)

    def test_04_filter_by_type_with_no_matching_banners(self):
        """4. Filter by type with no matching banners returns empty results safely."""
        self.client.force_authenticate(user=self.admin_user)
        # Create a temporary non-matching query
        res = self.client.get('/api/admin/banners/?banner_type=nonexistent_type')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 0)
        self.assertEqual(len(res.data['results']), 0)

    def test_05_combine_type_and_status_filters(self):
        """5. Combine type and status filters."""
        self.client.force_authenticate(user=self.admin_user)

        # Hero + Active (should exclude expired and scheduled)
        res_hero_act = self.client.get('/api/admin/banners/?banner_type=hero&status=active')
        self.assertEqual(res_hero_act.status_code, status.HTTP_200_OK)
        self.assertEqual(res_hero_act.data['count'], 1)
        self.assertEqual(res_hero_act.data['results'][0]['title'], 'Autumn Heritage Hero')

        # Hero + Expired
        res_hero_exp = self.client.get('/api/admin/banners/?banner_type=hero&status=expired')
        self.assertEqual(res_hero_exp.status_code, status.HTTP_200_OK)
        self.assertEqual(res_hero_exp.data['count'], 1)
        self.assertEqual(res_hero_exp.data['results'][0]['title'], 'Expired Summer Hero')

        # Secondary + Inactive
        res_sec_inact = self.client.get('/api/admin/banners/?banner_type=secondary&status=inactive')
        self.assertEqual(res_sec_inact.status_code, status.HTTP_200_OK)
        self.assertEqual(res_sec_inact.data['count'], 1)
        self.assertEqual(res_sec_inact.data['results'][0]['title'], 'Archive Collection Secondary')

    def test_06_search_by_banner_title(self):
        """6. Search by banner title (case-insensitive substring)."""
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/admin/banners/?search=black friday')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 1)
        self.assertEqual(res.data['results'][0]['title'], 'Black Friday Promo')

    def test_07_apply_date_filters(self):
        """7. Apply start_date and end_date filters."""
        self.client.force_authenticate(user=self.admin_user)
        yesterday = (timezone.now() - datetime.timedelta(days=1)).strftime('%Y-%m-%d')
        res = self.client.get(f'/api/admin/banners/?start_date={yesterday}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # All banners created today or in the future
        self.assertTrue(res.data['count'] >= 1)

    def test_08_pagination_with_active_filters(self):
        """8. Pagination works with active filters."""
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/admin/banners/?banner_type=hero&page=1&page_size=2')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 3)
        self.assertEqual(len(res.data['results']), 2)

        # Page 2
        res2 = self.client.get('/api/admin/banners/?banner_type=hero&page=2&page_size=2')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res2.data['results']), 1)

    def test_09_clear_all_filters(self):
        """9. Resetting/clearing filters returns full dataset."""
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/admin/banners/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 5)

    def test_10_create_new_banner(self):
        """10. Create a new banner with validation."""
        self.client.force_authenticate(user=self.admin_user)

        # Missing required title fails
        res_bad = self.client.post('/api/admin/banners/', {
            'title': '',
            'placement': 'hero'
        }, format='json')
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('title', res_bad.data)

        # End date earlier than start date fails
        now = timezone.now()
        res_bad_dates = self.client.post('/api/admin/banners/', {
            'title': 'Invalid Date Banner',
            'placement': 'hero',
            'image_url': 'https://example.com/banner.jpg',
            'start_date': now.isoformat(),
            'end_date': (now - datetime.timedelta(days=2)).isoformat()
        }, format='json')
        self.assertEqual(res_bad_dates.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('end_date', res_bad_dates.data)

        # Valid banner creation
        payload = {
            'title': 'New Spring Collection',
            'banner_type': 'hero',
            'image_url': 'https://example.com/new_spring.jpg',
            'button_text': 'View Spring',
            'button_link': '/shop?collection=spring',
            'linked_category': self.category.id,
            'is_active': True,
            'display_order': 10
        }
        res_create = self.client.post('/api/admin/banners/', payload, format='json')
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_create.data['title'], 'New Spring Collection')
        self.assertEqual(res_create.data['placement'], 'hero')
        self.assertEqual(res_create.data['banner_type'], 'hero')
        self.assertEqual(res_create.data['linked_category'], self.category.id)

    def test_11_edit_existing_banner(self):
        """11. Edit an existing banner and verify partial updates preserve image."""
        self.client.force_authenticate(user=self.admin_user)
        update_data = {
            'title': 'Updated Heritage Hero',
            'button_text': 'Shop Heritage'
        }
        res = self.client.patch(f'/api/admin/banners/{self.banner_hero.id}/', update_data, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['title'], 'Updated Heritage Hero')
        self.assertEqual(res.data['button_text'], 'Shop Heritage')
        # Existing image is preserved
        self.assertEqual(res.data['image_url'], 'https://example.com/hero.jpg')

    def test_12_delete_banner(self):
        """12. Delete a banner."""
        self.client.force_authenticate(user=self.admin_user)
        banner_to_delete = Banner.objects.create(
            title='Temporary Banner To Delete',
            placement='hero',
            image_url='https://example.com/temp.jpg'
        )
        res = self.client.delete(f'/api/admin/banners/{banner_to_delete.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Banner.objects.filter(id=banner_to_delete.id).exists())

    def test_13_activate_and_deactivate_banner(self):
        """13. Toggle active / inactive status."""
        self.client.force_authenticate(user=self.admin_user)
        self.assertTrue(self.banner_promo.is_active)

        # Deactivate
        res_toggle = self.client.post(f'/api/admin/banners/{self.banner_promo.id}/toggle-status/')
        self.assertEqual(res_toggle.status_code, status.HTTP_200_OK)
        self.assertFalse(res_toggle.data['banner']['is_active'])

        # Reactivate
        res_toggle_back = self.client.post(f'/api/admin/banners/{self.banner_promo.id}/toggle-status/')
        self.assertEqual(res_toggle_back.status_code, status.HTTP_200_OK)
        self.assertTrue(res_toggle_back.data['banner']['is_active'])

    def test_14_unauthorized_users_blocked(self):
        """14. Unauthorized users cannot access banner management APIs (401/403)."""
        # Anonymous user gets 401
        res_anon = self.client.get('/api/admin/banners/')
        self.assertEqual(res_anon.status_code, status.HTTP_401_UNAUTHORIZED)

        # Customer user gets 403
        self.client.force_authenticate(user=self.customer_user)
        res_cust = self.client.get('/api/admin/banners/')
        self.assertEqual(res_cust.status_code, status.HTTP_403_FORBIDDEN)

