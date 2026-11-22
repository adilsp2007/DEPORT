import json
from datetime import timedelta
from django.utils import timezone
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class SignupEmailValidationAndAdminActivationTests(TestCase):
    """
    Comprehensive tests enforcing strict email validation, mandatory email verification,
    admin account status vs email verification independence, and permission protection.
    """

    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_superuser(
            email='admin_test@deport.com',
            password='AdminPassword@123',
            first_name='Admin',
            last_name='User'
        )

    def test_01_invalid_email_format(self):
        """Reject malformed email addresses across various invalid structures."""
        invalid_emails = [
            'adil123',
            'adil@',
            '@domain.com',
            'test@domain',
            'test@.com',
            'test@domain.',
            'test@domain..com',
            'plainaddress',
            '#@%^%#$@#$@#.com',
        ]
        for email in invalid_emails:
            response = self.client.post('/api/auth/register/', {
                'first_name': 'Test',
                'last_name': 'User',
                'email': email,
                'password': 'SecurePassword@123',
                'confirm_password': 'SecurePassword@123'
            }, format='json')
            self.assertEqual(
                response.status_code,
                status.HTTP_400_BAD_REQUEST,
                f"Expected 400 Bad Request for email '{email}', got {response.status_code}"
            )
            self.assertIn('email', response.data.get('errors', response.data))

    def test_02_empty_email(self):
        """Reject empty or whitespace-only email addresses."""
        for empty_val in ['', '   ', '\t', None]:
            data = {
                'first_name': 'Test',
                'last_name': 'User',
                'password': 'SecurePassword@123',
                'confirm_password': 'SecurePassword@123'
            }
            if empty_val is not None:
                data['email'] = empty_val

            response = self.client.post('/api/auth/register/', data, format='json')
            self.assertEqual(
                response.status_code,
                status.HTTP_400_BAD_REQUEST,
                f"Expected 400 Bad Request for empty email '{empty_val}'"
            )

    def test_03_valid_email_format(self):
        """Accept valid, properly formatted email addresses."""
        response = self.client.post('/api/auth/register/', {
            'first_name': 'Valid',
            'last_name': 'User',
            'email': '  valid.client@example.com  ',
            'password': 'SecurePassword@123',
            'confirm_password': 'SecurePassword@123'
        }, format='json')
        self.assertIn(response.status_code, [status.HTTP_201_CREATED, status.HTTP_503_SERVICE_UNAVAILABLE])
        user = User.objects.filter(email='valid.client@example.com').first()
        self.assertIsNotNone(user)
        self.assertEqual(user.email, 'valid.client@example.com')

    def test_04_signup_with_invalid_email_must_not_create_database_user(self):
        """Signup with invalid email such as 'adil123' must never create a database user."""
        initial_count = User.objects.count()
        response = self.client.post('/api/auth/register/', {
            'first_name': 'Adil',
            'last_name': 'Test',
            'email': 'adil123',
            'password': 'SecurePassword@123',
            'confirm_password': 'SecurePassword@123'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email__icontains='adil123').exists())
        self.assertEqual(User.objects.count(), initial_count)

    def test_05_signup_must_create_unverified_account(self):
        """Signup creates an unverified account with is_email_verified=False."""
        response = self.client.post('/api/auth/register/', {
            'first_name': 'Unverified',
            'last_name': 'Client',
            'email': 'unverified_client@example.com',
            'password': 'SecurePassword@123',
            'confirm_password': 'SecurePassword@123'
        }, format='json')

        self.assertIn(response.status_code, [status.HTTP_201_CREATED, status.HTTP_503_SERVICE_UNAVAILABLE])
        user = User.objects.get(email='unverified_client@example.com')
        self.assertFalse(user.is_email_verified)
        self.assertFalse(user.is_active)

    def test_06_unverified_account_must_not_log_in(self):
        """Unverified accounts must be rejected with 403 Forbidden and exact warning message."""
        User.objects.create_user(
            email='pending_login@example.com',
            password='SecurePassword@123',
            first_name='Pending',
            last_name='User',
            is_active=True,
            is_email_verified=False
        )

        response = self.client.post('/api/auth/login/', {
            'email': 'pending_login@example.com',
            'password': 'SecurePassword@123'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data.get('detail'), 'Please verify your email address before logging in.')
        self.assertTrue(response.data.get('is_unverified'))
        self.assertNotIn('access', response.data)
        self.assertNotIn('refresh', response.data)

    def test_07_incorrect_otp_must_not_verify_account(self):
        """Submitting an incorrect OTP must reject verification and leave account unverified."""
        user = User.objects.create_user(
            email='wrong_otp@example.com',
            password='SecurePassword@123',
            first_name='Wrong',
            last_name='OTP',
            is_email_verified=False
        )
        user.generate_otp()

        response = self.client.post('/api/auth/verify-email/', {
            'email': 'wrong_otp@example.com',
            'otp': '000000'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        self.assertFalse(user.is_email_verified)

    def test_08_expired_otp_must_not_verify_account(self):
        """Submitting an expired OTP (> 5 minutes) must reject verification."""
        user = User.objects.create_user(
            email='expired_otp@example.com',
            password='SecurePassword@123',
            first_name='Expired',
            last_name='OTP',
            is_email_verified=False
        )
        code = user.generate_otp()
        user.otp_created_at = timezone.now() - timedelta(minutes=6)
        user.save(update_fields=['otp_created_at'])

        response = self.client.post('/api/auth/verify-email/', {
            'email': 'expired_otp@example.com',
            'otp': code
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('reason'), 'EXPIRED')
        user.refresh_from_db()
        self.assertFalse(user.is_email_verified)

    def test_09_correct_otp_must_verify_account(self):
        """Submitting the correct, unexpired OTP successfully verifies the account."""
        user = User.objects.create_user(
            email='correct_otp@example.com',
            password='SecurePassword@123',
            first_name='Correct',
            last_name='OTP',
            is_email_verified=False
        )
        code = user.generate_otp()

        response = self.client.post('/api/auth/verify-email/', {
            'email': 'correct_otp@example.com',
            'otp': code
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)
        self.assertIsNone(user.otp_code)

    def test_10_admin_activation_must_not_automatically_verify_email(self):
        """Admin unblocking or activating an unverified account must NOT verify their email."""
        user = User.objects.create_user(
            email='unblock_test@example.com',
            password='SecurePassword@123',
            first_name='Unblock',
            last_name='Test',
            is_active=False,
            is_email_verified=False
        )

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(f'/api/admin/users/{user.id}/toggle-block/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        user.refresh_from_db()
        self.assertTrue(user.is_active, "Account should now be active.")
        self.assertFalse(user.is_email_verified, "Account MUST remain unverified!")

    def test_11_admin_unblock_must_not_automatically_verify_email(self):
        """Unblocked user still cannot log in until OTP verification is completed."""
        user = User.objects.create_user(
            email='unblock_login_test@example.com',
            password='SecurePassword@123',
            first_name='UnblockLogin',
            last_name='Test',
            is_active=False,
            is_email_verified=False
        )

        # Admin unblocks account
        self.client.force_authenticate(user=self.admin_user)
        self.client.post(f'/api/admin/users/{user.id}/toggle-block/')
        self.client.force_authenticate(user=None)

        # User attempts to log in
        login_resp = self.client.post('/api/auth/login/', {
            'email': 'unblock_login_test@example.com',
            'password': 'SecurePassword@123'
        }, format='json')

        self.assertEqual(login_resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(login_resp.data.get('detail'), 'Please verify your email address before logging in.')

    def test_12_verified_users_can_log_in(self):
        """Verified users with active accounts can log in and receive JWT tokens."""
        User.objects.create_user(
            email='verified_login@example.com',
            password='SecurePassword@123',
            first_name='Verified',
            last_name='User',
            is_active=True,
            is_email_verified=True
        )

        response = self.client.post('/api/auth/login/', {
            'email': 'verified_login@example.com',
            'password': 'SecurePassword@123'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_13_regular_users_cannot_modify_verification_status(self):
        """Regular users cannot modify is_email_verified or is_active via profile update API."""
        user = User.objects.create_user(
            email='regular_user@example.com',
            password='SecurePassword@123',
            first_name='Regular',
            last_name='User',
            is_active=True,
            is_email_verified=False
        )

        self.client.force_authenticate(user=user)
        response = self.client.patch('/api/auth/me/', {
            'first_name': 'ChangedName',
            'is_email_verified': True,
            'is_active': False,
            'is_staff': True,
            'is_superuser': True
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.first_name, 'ChangedName')
        self.assertFalse(user.is_email_verified, "Regular user MUST NOT be able to verify themselves via profile!")
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_14_admin_only_permissions_work_correctly(self):
        """Non-admin user cannot access admin user management APIs; authorized admin can."""
        normal_user = User.objects.create_user(
            email='customer@example.com',
            password='SecurePassword@123',
            first_name='Customer',
            last_name='User',
            is_active=True,
            is_email_verified=True
        )

        # Unauthenticated access
        self.client.force_authenticate(user=None)
        res_unauth = self.client.get('/api/admin/users/')
        self.assertEqual(res_unauth.status_code, status.HTTP_401_UNAUTHORIZED)

        # Customer access
        self.client.force_authenticate(user=normal_user)
        res_customer = self.client.get('/api/admin/users/')
        self.assertEqual(res_customer.status_code, status.HTTP_403_FORBIDDEN)

        # Admin access
        self.client.force_authenticate(user=self.admin_user)
        res_admin = self.client.get('/api/admin/users/')
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)

    def test_15_admin_user_management_only_shows_email_verified_users_by_default(self):
        """Only email verification completed users enter User Management in admin side by default."""
        unverified_user = User.objects.create_user(
            email='pending_signup@example.com',
            password='SecurePassword@123',
            first_name='Pending',
            last_name='Signup',
            is_active=True,
            is_email_verified=False
        )
        verified_user = User.objects.create_user(
            email='verified_customer@example.com',
            password='SecurePassword@123',
            first_name='Verified',
            last_name='Customer',
            is_active=True,
            is_email_verified=True
        )

        self.client.force_authenticate(user=self.admin_user)

        # Default query: ONLY email verified users enter
        response = self.client.get('/api/admin/users/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_emails = [u['email'] for u in response.data['results']]

        self.assertIn('verified_customer@example.com', returned_emails)
        self.assertNotIn('pending_signup@example.com', returned_emails, "Unverified user MUST NOT enter default admin user management!")

        # Explicit query for unverified: unverified user appears
        res_unverified = self.client.get('/api/admin/users/?status=unverified')
        self.assertEqual(res_unverified.status_code, status.HTTP_200_OK)
        unverified_emails = [u['email'] for u in res_unverified.data['results']]
        self.assertIn('pending_signup@example.com', unverified_emails)
        self.assertNotIn('verified_customer@example.com', unverified_emails)
