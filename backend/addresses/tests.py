from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Address

User = get_user_model()


class AddressCRUDTestCase(TestCase):
    def setUp(self):
        self.client_a = APIClient()
        self.client_b = APIClient()

        self.user_a = User.objects.create_user(
            email='user_a@example.com',
            password='Password123!',
            first_name='User',
            last_name='A'
        )
        self.user_b = User.objects.create_user(
            email='user_b@example.com',
            password='Password123!',
            first_name='User',
            last_name='B'
        )

        self.client_a.force_authenticate(user=self.user_a)
        self.client_b.force_authenticate(user=self.user_b)

        self.list_url = '/api/addresses/'

        self.addr_data_1 = {
            'label': 'Home',
            'full_name': 'User A',
            'phone': '+1 (555) 111-2222',
            'address_line_1': '123 Main Street',
            'address_line_2': 'Apt 4B',
            'city': 'New York',
            'state': 'NY',
            'postal_code': '10001',
            'country': 'United States',
            'is_default': False
        }

    def test_unauthenticated_access_denied(self):
        unauth_client = APIClient()
        response = unauth_client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_first_address_auto_default(self):
        response = self.client_a.post(self.list_url, self.addr_data_1, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['is_default'])

    def test_create_multiple_addresses_and_default_switch(self):
        # 1. Create first (becomes default)
        r1 = self.client_a.post(self.list_url, self.addr_data_1, format='json')
        addr1_id = r1.data['id']
        self.assertTrue(r1.data['is_default'])

        # 2. Create second with is_default=True
        addr2_data = self.addr_data_1.copy()
        addr2_data['label'] = 'Office'
        addr2_data['is_default'] = True
        r2 = self.client_a.post(self.list_url, addr2_data, format='json')
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)
        self.assertTrue(r2.data['is_default'])

        # Check addr1 is now is_default=False
        addr1 = Address.objects.get(pk=addr1_id)
        self.assertFalse(addr1.is_default)
        self.assertEqual(Address.objects.filter(user=self.user_a, is_default=True).count(), 1)

    def test_user_ownership_isolation(self):
        # User A creates address
        r1 = self.client_a.post(self.list_url, self.addr_data_1, format='json')
        addr_a_id = r1.data['id']

        # User B lists addresses -> should be empty
        r_list_b = self.client_b.get(self.list_url)
        self.assertEqual(len(r_list_b.data), 0)

        # User B attempts to GET User A's address -> 404
        r_get_b = self.client_b.get(f'{self.list_url}{addr_a_id}/')
        self.assertEqual(r_get_b.status_code, status.HTTP_404_NOT_FOUND)

        # User B attempts to PATCH User A's address -> 404
        r_patch_b = self.client_b.patch(f'{self.list_url}{addr_a_id}/', {'city': 'Hacked'}, format='json')
        self.assertEqual(r_patch_b.status_code, status.HTTP_404_NOT_FOUND)

        # User B attempts to DELETE User A's address -> 404
        r_del_b = self.client_b.delete(f'{self.list_url}{addr_a_id}/')
        self.assertEqual(r_del_b.status_code, status.HTTP_404_NOT_FOUND)

    def test_set_default_endpoint(self):
        r1 = self.client_a.post(self.list_url, self.addr_data_1, format='json')
        addr1_id = r1.data['id']

        addr2_data = self.addr_data_1.copy()
        addr2_data['label'] = 'Office'
        addr2_data['is_default'] = False
        r2 = self.client_a.post(self.list_url, addr2_data, format='json')
        addr2_id = r2.data['id']

        # Set addr2 as default via set-default endpoint
        r_set = self.client_a.post(f'{self.list_url}{addr2_id}/set-default/')
        self.assertEqual(r_set.status_code, status.HTTP_200_OK)
        self.assertTrue(r_set.data['is_default'])

        addr1 = Address.objects.get(pk=addr1_id)
        self.assertFalse(addr1.is_default)

    def test_delete_default_address_reassigns(self):
        r1 = self.client_a.post(self.list_url, self.addr_data_1, format='json')
        addr1_id = r1.data['id']

        addr2_data = self.addr_data_1.copy()
        addr2_data['label'] = 'Office'
        addr2_data['is_default'] = False
        r2 = self.client_a.post(self.list_url, addr2_data, format='json')
        addr2_id = r2.data['id']

        # Delete addr1 (which was default)
        r_del = self.client_a.delete(f'{self.list_url}{addr1_id}/')
        self.assertEqual(r_del.status_code, status.HTTP_204_NO_CONTENT)

        # Check addr2 is now automatically assigned is_default=True
        addr2 = Address.objects.get(pk=addr2_id)
        self.assertTrue(addr2.is_default)
