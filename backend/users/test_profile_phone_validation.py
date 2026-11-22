import json
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class IndianPhoneNumberAndProfileValidationTests(TestCase):
    """
    Unit tests ensuring phone number validation on profile page follows:
    - 10-digit Indian mobile numbers.
    - Starting with 6, 7, 8, or 9.
    - Optional +91 or 91 country code.
    - Rejects alphabets, special characters, incomplete, and invalid mobile numbers.
    - Rejects empty values (mandatory).
    - Rejects duplicate numbers already registered to another account.
    - Preserves existing profile information.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='client_one@deport.com',
            password='SecurePassword@123',
            first_name='Eleanor',
            last_name='Vance',
            is_email_verified=True,
            is_active=True
        )
        self.other_user = User.objects.create_user(
            email='client_two@deport.com',
            password='SecurePassword@123',
            first_name='Second',
            last_name='User',
            phone='+919876543210',
            is_email_verified=True,
            is_active=True
        )
        self.client.force_authenticate(user=self.user)

    def test_01_valid_inputs_from_spec(self):
        """Test the specified valid phone numbers: 9876543210, +919876543210, 6123456789."""
        # 1. 6123456789 (starts with 6)
        resp1 = self.client.patch('/api/users/me/', {'phone': '6123456789'}, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK, f"Error: {resp1.data}")
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, '6123456789')
        # Check other fields preserved
        self.assertEqual(self.user.first_name, 'Eleanor')
        self.assertEqual(self.user.last_name, 'Vance')

        # 2. 9876543211 (valid 10 digit, starts with 9)
        resp2 = self.client.patch('/api/users/me/', {'phone': '9876543211'}, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, '9876543211')

        # 3. +918123456789 (with +91 country code, starts with 8)
        resp3 = self.client.patch('/api/users/me/', {'phone': '+918123456789'}, format='json')
        self.assertEqual(resp3.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, '+918123456789')

        # 4. +91 71234 56789 (with spaces and +91)
        resp4 = self.client.patch('/api/users/me/', {'phone': '+91 71234 56789'}, format='json')
        self.assertEqual(resp4.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, '+917123456789')

    def test_02_invalid_inputs_from_spec(self):
        """Test the specified invalid phone numbers: 5123456789, 987654321, 98765432101, abc9876543, Empty."""
        # 5123456789 (Invalid: starts with 5)
        resp = self.client.patch('/api/users/me/', {'phone': '5123456789'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', resp.data)
        self.assertIn('Indian mobile numbers must start with 6, 7, 8, or 9', str(resp.data['phone']))

        # 987654321 (Invalid: only 9 digits, incomplete)
        resp = self.client.patch('/api/users/me/', {'phone': '987654321'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', resp.data)
        self.assertIn('10 digits', str(resp.data['phone']))

        # 98765432101 (Invalid: 11 digits without country code)
        resp = self.client.patch('/api/users/me/', {'phone': '98765432101'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', resp.data)

        # abc9876543 (Invalid: contains alphabets)
        resp = self.client.patch('/api/users/me/', {'phone': 'abc9876543'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', resp.data)
        self.assertIn('alphabets', str(resp.data['phone']))

        # Empty value (Invalid: mandatory)
        resp = self.client.patch('/api/users/me/', {'phone': ''}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', resp.data)

        # Whitespace only
        resp = self.client.patch('/api/users/me/', {'phone': '   '}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', resp.data)

    def test_03_duplicate_number_rejection(self):
        """Reject duplicate phone number registered to another user."""
        # other_user has '+919876543210'
        # Trying to set '+919876543210'
        resp = self.client.patch('/api/users/me/', {'phone': '+919876543210'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', resp.data)
        self.assertIn('already registered', str(resp.data['phone']))

        # Trying to set '9876543210' (without +91 prefix)
        resp2 = self.client.patch('/api/users/me/', {'phone': '9876543210'}, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone', resp2.data)
        self.assertIn('already registered', str(resp2.data['phone']))

    def test_04_preserves_profile_fields(self):
        """Updating phone preserves names, email, and authentication status."""
        valid_phone = '9123456789'
        resp = self.client.patch('/api/users/me/', {'phone': valid_phone}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, valid_phone)
        self.assertEqual(self.user.email, 'client_one@deport.com')
        self.assertEqual(self.user.first_name, 'Eleanor')
        self.assertEqual(self.user.last_name, 'Vance')
        self.assertTrue(self.user.is_email_verified)
        self.assertTrue(self.user.is_active)
