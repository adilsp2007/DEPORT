from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from categories.models import Category

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
        self.assertIn('Category already exists.', str(resp1.data))

        # 2. Uppercase with leading/trailing whitespace: '  BACKPACKS  '
        resp2 = self.client.post('/api/admin/categories/', {'name': '  BACKPACKS  '})
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Category already exists.', str(resp2.data))

        # 3. Multiple consecutive spaces inside: 'Clutches' already exists, try '  CLUTCHES  '
        resp3 = self.client.post('/api/admin/categories/', {'name': '  CLUTCHES  '})
        self.assertEqual(resp3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Category already exists.', str(resp3.data))

    def test_case_insensitive_duplicate_editing_rejected(self):
        # Try to rename cat2 ('Clutches') to 'backpacks'
        resp = self.client.patch(f'/api/admin/categories/{self.cat2.id}/', {'name': 'backpacks'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Category already exists.', str(resp.data))

        # Updating cat1 with its own name should succeed
        resp_self = self.client.patch(f'/api/admin/categories/{self.cat1.id}/', {'name': '  Backpacks  '})
        self.assertEqual(resp_self.status_code, status.HTTP_200_OK)
        self.cat1.refresh_from_db()
        self.assertEqual(self.cat1.name, 'Backpacks')

    def test_whitespace_collapsing_on_creation(self):
        # Create a new category with irregular spacing: '  Travel    Duffel   Bags  '
        resp = self.client.post('/api/admin/categories/', {'name': '  Travel    Duffel   Bags  '})
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['name'], 'Travel Duffel Bags')

        cat = Category.objects.get(id=resp.data['id'])
        self.assertEqual(cat.name, 'Travel Duffel Bags')
        self.assertEqual(cat.slug, 'travel-duffel-bags')

