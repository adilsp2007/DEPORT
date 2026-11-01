import io
from unittest.mock import patch
from PIL import Image
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


def create_dummy_image(name='test.jpg', size=(100, 100), color='blue', format='JPEG'):
    file = io.BytesIO()
    image = Image.new('RGB', size, color)
    image.save(file, format)
    file.seek(0)
    return SimpleUploadedFile(name, file.read(), content_type=f'image/{format.lower()}')


class AuthenticationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'
        self.verify_email_url = '/api/auth/verify-email/'
        self.login_url = '/api/auth/login/'
        self.logout_url = '/api/auth/logout/'
        self.me_url = '/api/users/me/'
        self.refresh_url = '/api/auth/refresh/'
        self.google_url = '/api/auth/google/'

        self.user_data = {
            'first_name': 'Eleanor',
            'last_name': 'Vance',
            'email': 'eleanor.vance@example.com',
            'password': 'StrongPassword123!',
            'confirm_password': 'StrongPassword123!'
        }

    def _register_and_verify(self, user_data=None):
        data = user_data or self.user_data
        reg_resp = self.client.post(self.register_url, data, format='json')
        code = reg_resp.data.get('otp_code')
        verify_resp = self.client.post(self.verify_email_url, {'email': data['email'], 'code': code}, format='json')
        login_resp = self.client.post(self.login_url, {'email': data['email'], 'password': data['password']}, format='json')
        return login_resp

    def test_valid_registration(self):
        response = self.client.post(self.register_url, self.user_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['email'], 'eleanor.vance@example.com')
        self.assertNotIn('password', response.data['user'])

    def test_verify_email_success(self):
        reg_resp = self.client.post(self.register_url, self.user_data, format='json')
        code = reg_resp.data.get('otp_code')
        response = self.client.post(self.verify_email_url, {'email': 'eleanor.vance@example.com', 'code': code}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'Email verified successfully.')
        user = User.objects.get(email='eleanor.vance@example.com')
        self.assertTrue(user.is_email_verified)
        self.assertTrue(user.is_active)

    def test_verify_email_invalid_code(self):
        self.client.post(self.register_url, self.user_data, format='json')
        response = self.client.post(self.verify_email_url, {'email': 'eleanor.vance@example.com', 'code': '000000'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['detail'], 'Invalid verification code. Please try again.')

    def test_resend_otp(self):
        from django.utils import timezone
        from datetime import timedelta
        self.client.post(self.register_url, self.user_data, format='json')
        user = User.objects.get(email='eleanor.vance@example.com')
        old_otp = user.otp_code
        # Simulate cooldown passage (65 seconds ago)
        user.otp_created_at = timezone.now() - timedelta(seconds=65)
        user.save()

        response = self.client.post('/api/auth/resend-otp/', {'email': 'eleanor.vance@example.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'A new verification code has been sent.')
        user.refresh_from_db()
        self.assertNotEqual(user.otp_code, old_otp)

    def test_login_unverified_user(self):
        self.client.post(self.register_url, self.user_data, format='json')
        response = self.client.post(self.login_url, {'email': 'eleanor.vance@example.com', 'password': 'StrongPassword123!'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(response.data['is_unverified'])

    def test_duplicate_email_registration(self):
        self.client.post(self.register_url, self.user_data, format='json')
        response = self.client.post(self.register_url, self.user_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_password_mismatch_registration(self):
        data = self.user_data.copy()
        data['confirm_password'] = 'DifferentPassword123!'
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('confirm_password', response.data)

    def test_login_correct_credentials(self):
        self._register_and_verify()
        login_data = {
            'email': 'eleanor.vance@example.com',
            'password': 'StrongPassword123!'
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_login_incorrect_credentials(self):
        self._register_and_verify()
        login_data = {
            'email': 'eleanor.vance@example.com',
            'password': 'WrongPassword123!'
        }
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user_unauthenticated(self):
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user_authenticated(self):
        login_resp = self._register_and_verify()
        token = login_resp.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.get(self.me_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'eleanor.vance@example.com')

    def test_logout(self):
        login_resp = self._register_and_verify()
        token = login_resp.data['access']
        refresh = login_resp.data['refresh']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = self.client.post(self.logout_url, {'refresh': refresh}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        refresh_resp = self.client.post(self.refresh_url, {'refresh': refresh}, format='json')
        self.assertEqual(refresh_resp.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('users.views.id_token.verify_oauth2_token')
    def test_google_auth_new_user(self, mock_verify):
        mock_verify.return_value = {
            'iss': 'https://accounts.google.com',
            'email': 'google.newuser@example.com',
            'email_verified': True,
            'given_name': 'Google',
            'family_name': 'NewUser',
        }
        response = self.client.post(self.google_url, {'token': 'valid-mock-google-id-token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['email'], 'google.newuser@example.com')
        self.assertEqual(response.data['user']['auth_provider'], 'google')

    @patch('users.views.id_token.verify_oauth2_token')
    def test_google_auth_account_linking(self, mock_verify):
        self.client.post(self.register_url, self.user_data, format='json')
        initial_count = User.objects.count()

        mock_verify.return_value = {
            'iss': 'https://accounts.google.com',
            'email': 'eleanor.vance@example.com',
            'email_verified': True,
            'given_name': 'Eleanor',
            'family_name': 'Vance',
        }
        response = self.client.post(self.google_url, {'token': 'valid-mock-google-id-token'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(User.objects.count(), initial_count)
        self.assertEqual(response.data['user']['email'], 'eleanor.vance@example.com')

    def test_google_auth_missing_token_rejected(self):
        # Sending empty request without token must fail
        response = self.client.post(self.google_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_google_auth_raw_email_without_token_rejected(self):
        # Sending raw email directly without token must be rejected
        payload = {'email': 'victim@example.com'}
        response = self.client.post(self.google_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('users.views.id_token.verify_oauth2_token')
    def test_google_auth_unverified_email_rejected(self, mock_verify):
        mock_verify.return_value = {
            'iss': 'https://accounts.google.com',
            'email': 'unverified@example.com',
            'email_verified': False,
        }
        response = self.client.post(self.google_url, {'token': 'token-with-unverified-email'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('not verified', response.data['detail'])

    @patch('users.views.id_token.verify_oauth2_token')
    def test_google_auth_invalid_issuer_rejected(self, mock_verify):
        mock_verify.return_value = {
            'iss': 'https://malicious-issuer.com',
            'email': 'hacker@example.com',
            'email_verified': True,
        }
        response = self.client.post(self.google_url, {'token': 'token-with-bad-issuer'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid Google token issuer', response.data['detail'])

    @patch('users.views.id_token.verify_oauth2_token')
    def test_google_auth_suspended_user_cannot_login(self, mock_verify):
        blocked_user = User.objects.create_user(
            email='blocked.user@example.com',
            password='Password123!',
            is_active=False
        )
        mock_verify.return_value = {
            'iss': 'https://accounts.google.com',
            'email': 'blocked.user@example.com',
            'email_verified': True,
        }
        response = self.client.post(self.google_url, {'token': 'token-for-blocked-user'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        blocked_user.refresh_from_db()
        self.assertFalse(blocked_user.is_active)  # Must remain suspended!

    def test_update_profile_first_last_phone(self):
        login_resp = self._register_and_verify()
        token = login_resp.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        update_data = {
            'first_name': 'Eleanor Updated',
            'last_name': 'Vance Updated',
            'phone': '+1 (555) 999-8888'
        }
        response = self.client.patch(self.me_url, update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['first_name'], 'Eleanor Updated')
        self.assertEqual(response.data['last_name'], 'Vance Updated')
        self.assertEqual(response.data['phone'], '+1 (555) 999-8888')

    def test_update_profile_email(self):
        login_resp = self._register_and_verify()
        token = login_resp.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        update_data = {'email': 'amhd7858@gmail.com'}
        response = self.client.patch(self.me_url, update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'amhd7858@gmail.com')
        user = User.objects.get(pk=User.objects.get(email='amhd7858@gmail.com').pk)
        self.assertEqual(user.email, 'amhd7858@gmail.com')

    def test_update_profile_security_fields(self):
        login_resp = self._register_and_verify()
        token = login_resp.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        update_data = {
            'is_staff': True,
            'is_superuser': True,
            'auth_provider': 'google'
        }
        response = self.client.patch(self.me_url, update_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = User.objects.get(email='eleanor.vance@example.com')
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(user.auth_provider, 'email')

    def test_update_profile_image_and_removal(self):
        login_resp = self._register_and_verify()
        token = login_resp.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')

        # 1. Upload valid image
        dummy_img = create_dummy_image()
        response = self.client.patch(self.me_url, {'profile_image': dummy_img}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(response.data['profile_image'])

        # 2. Remove profile image
        response = self.client.patch(self.me_url, {'remove_image': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['profile_image'])


class AdminAuthenticationTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_login_url = '/api/admin/login/'

        # Create Administrator Account
        self.admin_user = User.objects.create_superuser(
            email='admin@deport.com',
            password='AdminPassword123!',
            first_name='Admin',
            last_name='User'
        )

        # Create Standard Customer Account
        self.customer_user = User.objects.create_user(
            email='customer@deport.com',
            password='CustomerPassword123!',
            first_name='Customer',
            last_name='User',
            is_email_verified=True,
            is_active=True
        )

    def test_admin_login_success(self):
        response = self.client.post(
            self.admin_login_url,
            {'email': 'admin@deport.com', 'password': 'AdminPassword123!'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['email'], 'admin@deport.com')
        self.assertTrue(response.data['user']['is_staff'])

    def test_admin_login_invalid_password(self):
        response = self.client.post(
            self.admin_login_url,
            {'email': 'admin@deport.com', 'password': 'WrongPassword123!'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data['detail'], 'Invalid email or password.')

    def test_customer_login_rejected_on_admin_endpoint(self):
        response = self.client.post(
            self.admin_login_url,
            {'email': 'customer@deport.com', 'password': 'CustomerPassword123!'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Access denied', response.data['detail'])

    def test_deactivated_admin_login_rejected(self):
        self.admin_user.is_active = False
        self.admin_user.save()

        response = self.client.post(
            self.admin_login_url,
            {'email': 'admin@deport.com', 'password': 'AdminPassword123!'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('deactivated', response.data['detail'])

    def test_is_admin_permission_class(self):
        from users.permissions import IsAdminUser
        from rest_framework.request import Request
        from rest_framework.test import APIRequestFactory

        factory = APIRequestFactory()
        permission = IsAdminUser()

        # Unauthenticated request
        req1 = factory.get('/')
        req1.user = None
        self.assertFalse(permission.has_permission(req1, None))

        # Customer request
        req2 = factory.get('/')
        req2.user = self.customer_user
        self.assertFalse(permission.has_permission(req2, None))

        # Admin request
        req3 = factory.get('/')
        req3.user = self.admin_user
        self.assertTrue(permission.has_permission(req3, None))

    def test_public_signup_cannot_create_admin(self):
        signup_data = {
            'first_name': 'Hacker',
            'last_name': 'Admin',
            'email': 'hacker@example.com',
            'password': 'Password123!',
            'confirm_password': 'Password123!',
            'is_staff': True,
            'is_superuser': True
        }
        response = self.client.post('/api/auth/register/', signup_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email='hacker@example.com')
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_admin_dashboard_stats_endpoint(self):
        # 1. Unauthenticated request rejected
        response = self.client.get('/api/admin/dashboard/stats/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Customer authenticated request rejected
        self.client.force_authenticate(user=self.customer_user)
        response = self.client.get('/api/admin/dashboard/stats/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Admin authenticated request succeeds with real numbers
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/admin/dashboard/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_users', response.data)
        self.assertIn('active_users', response.data)
        self.assertIn('blocked_users', response.data)
        self.assertIn('total_products', response.data)
        self.assertIn('total_orders', response.data)
        self.assertIn('total_revenue', response.data)
        self.assertEqual(response.data['total_users'], User.objects.count())

    def test_admin_user_list_search_and_filter(self):
        self.client.force_authenticate(user=self.admin_user)

        # List users (paginated)
        response = self.client.get('/api/admin/users/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertGreaterEqual(response.data['count'], 2)

        # Search by email
        search_resp = self.client.get('/api/admin/users/?search=customer@deport.com')
        self.assertEqual(search_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(search_resp.data['count'], 1)
        self.assertEqual(search_resp.data['results'][0]['email'], 'customer@deport.com')

        # Filter by active status
        filter_resp = self.client.get('/api/admin/users/?status=active')
        self.assertEqual(filter_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(all(u['is_active'] for u in filter_resp.data['results']))

    def test_admin_user_detail(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(f'/api/admin/users/{self.customer_user.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'customer@deport.com')
        self.assertNotIn('password', response.data)

    def test_admin_toggle_block_user(self):
        self.client.force_authenticate(user=self.admin_user)

        # 1. Block customer user
        resp1 = self.client.post(f'/api/admin/users/{self.customer_user.id}/toggle-block/')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        self.assertFalse(resp1.data['user']['is_active'])
        self.customer_user.refresh_from_db()
        self.assertFalse(self.customer_user.is_active)

        # 2. Unblock customer user
        resp2 = self.client.post(f'/api/admin/users/{self.customer_user.id}/toggle-block/')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertTrue(resp2.data['user']['is_active'])

    def test_self_block_prevention(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(f'/api/admin/users/{self.admin_user.id}/toggle-block/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot block your own', response.data['detail'])

    def test_admin_delete_user(self):
        self.client.force_authenticate(user=self.admin_user)
        target_id = self.customer_user.id
        response = self.client.delete(f'/api/admin/users/{target_id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('permanently deleted', response.data['message'])
        self.assertFalse(User.objects.filter(id=target_id).exists())

    def test_admin_delete_self_prevention(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.delete(f'/api/admin/users/{self.admin_user.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cannot delete your own', response.data['detail'])
        self.assertTrue(User.objects.filter(id=self.admin_user.id).exists())

    def test_staff_delete_superuser_prevention(self):
        # Create non-superuser staff admin
        staff_admin = User.objects.create_user(
            email='staff@deport.com',
            password='Password123!',
            is_staff=True,
            is_superuser=False
        )
        self.client.force_authenticate(user=staff_admin)
        # Attempt to delete superuser (self.admin_user is superuser or let's check)
        self.admin_user.is_superuser = True
        self.admin_user.save()
        response = self.client.delete(f'/api/admin/users/{self.admin_user.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Superuser accounts can only be deleted', response.data['detail'])
        self.assertTrue(User.objects.filter(id=self.admin_user.id).exists())


class OTPVerificationComprehensiveTestCase(TestCase):
    """
    Mandatory test suite verifying all 17 requirements of the DEPORT OTP flow:
    - Secure OTP generation (secrets, 6 digits, preserves leading zeros)
    - Hashed storage (never plaintext in DB)
    - Email sending and failure handling
    - Atomic verification & attempt limits
    - Resend cooldowns & invalidation
    - Account unverified isolation & cross-account isolation
    """

    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'
        self.verify_url = '/api/auth/verify-email/'
        self.resend_url = '/api/auth/resend-otp/'
        self.status_url = '/api/auth/otp-status/'
        self.login_url = '/api/auth/login/'

        self.signup_payload = {
            'first_name': 'Alexander',
            'last_name': 'McQueen',
            'email': 'alexander.mcqueen@deport-atelier.com',
            'password': 'SecureAtelierPassword2026!',
            'confirm_password': 'SecureAtelierPassword2026!'
        }

    def test_01_signup_creates_verification_challenge(self):
        resp = self.client.post(self.register_url, self.signup_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email='alexander.mcqueen@deport-atelier.com')

        # User must NOT be marked verified on signup
        self.assertFalse(user.is_email_verified)
        self.assertIsNotNone(user.otp_code)
        self.assertIsNotNone(user.otp_created_at)
        self.assertEqual(user.otp_attempts, 0)

        # Stored OTP must be a secure hash, NOT the plaintext 6-digit number
        raw_code = resp.data.get('otp_code')
        self.assertTrue(len(user.otp_code) > 20)
        from django.contrib.auth.hashers import check_password
        self.assertTrue(check_password(raw_code, user.otp_code))

    def test_02_otp_email_sending_succeeds_when_backend_configured(self):
        from django.core import mail
        mail.outbox = []
        resp = self.client.post(self.register_url, self.signup_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        sent_email = mail.outbox[0]
        self.assertEqual(sent_email.to, ['alexander.mcqueen@deport-atelier.com'])
        self.assertIn('DEPORT', sent_email.subject)
        code = resp.data.get('otp_code')
        self.assertIn(code, sent_email.body)

    @patch('users.views.send_deport_otp_email')
    def test_03_email_delivery_failure_handled_correctly(self, mock_send):
        mock_send.return_value = (False, "SMTP delivery connection timeout.")
        resp = self.client.post(self.register_url, self.signup_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(resp.data.get('email_sent'))
        self.assertIn('could not be delivered', resp.data.get('detail', ''))

    def test_04_correct_otp_verifies_intended_account(self):
        reg_resp = self.client.post(self.register_url, self.signup_payload, format='json')
        code = reg_resp.data.get('otp_code')

        verify_resp = self.client.post(self.verify_url, {
            'email': 'alexander.mcqueen@deport-atelier.com',
            'code': code
        }, format='json')
        self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(verify_resp.data.get('message'), 'Email verified successfully.')
        self.assertIn('access', verify_resp.data)
        self.assertIn('refresh', verify_resp.data)

        user = User.objects.get(email='alexander.mcqueen@deport-atelier.com')
        self.assertTrue(user.is_email_verified)
        self.assertTrue(user.is_active)
        self.assertIsNone(user.otp_code)
        self.assertIsNone(user.otp_created_at)

    def test_05_incorrect_otp_rejected(self):
        self.client.post(self.register_url, self.signup_payload, format='json')
        verify_resp = self.client.post(self.verify_url, {
            'email': 'alexander.mcqueen@deport-atelier.com',
            'code': '999999'
        }, format='json')
        self.assertEqual(verify_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid verification code', verify_resp.data.get('detail', ''))

        user = User.objects.get(email='alexander.mcqueen@deport-atelier.com')
        self.assertFalse(user.is_email_verified)
        self.assertEqual(user.otp_attempts, 1)

    def test_06_expired_otp_rejected(self):
        from django.utils import timezone
        from datetime import timedelta
        reg_resp = self.client.post(self.register_url, self.signup_payload, format='json')
        code = reg_resp.data.get('otp_code')

        user = User.objects.get(email='alexander.mcqueen@deport-atelier.com')
        user.otp_created_at = timezone.now() - timedelta(minutes=10)
        user.save()

        verify_resp = self.client.post(self.verify_url, {
            'email': 'alexander.mcqueen@deport-atelier.com',
            'code': code
        }, format='json')
        self.assertEqual(verify_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(verify_resp.data.get('reason'), 'EXPIRED')
        self.assertIn('expired', verify_resp.data.get('detail', '').lower())

    def test_07_otp_cannot_be_reused(self):
        reg_resp = self.client.post(self.register_url, self.signup_payload, format='json')
        code = reg_resp.data.get('otp_code')

        v1 = self.client.post(self.verify_url, {'email': self.signup_payload['email'], 'code': code}, format='json')
        self.assertEqual(v1.status_code, status.HTTP_200_OK)

        # Attempt reuse
        v2 = self.client.post(self.verify_url, {'email': self.signup_payload['email'], 'code': code}, format='json')
        self.assertTrue(v2.data.get('already_verified') or v2.status_code == status.HTTP_200_OK)
        user = User.objects.get(email=self.signup_payload['email'])
        self.assertIsNone(user.otp_code)

    def test_08_new_otp_invalidates_previous_otp(self):
        from django.utils import timezone
        from datetime import timedelta
        reg_resp = self.client.post(self.register_url, self.signup_payload, format='json')
        otp_1 = reg_resp.data.get('otp_code')

        user = User.objects.get(email=self.signup_payload['email'])
        user.otp_created_at = timezone.now() - timedelta(seconds=65)
        user.save()

        resend_resp = self.client.post(self.resend_url, {'email': self.signup_payload['email']}, format='json')
        self.assertEqual(resend_resp.status_code, status.HTTP_200_OK)
        otp_2 = resend_resp.data.get('otp_code')
        self.assertNotEqual(otp_1, otp_2)

        # Old OTP 1 rejected
        v_old = self.client.post(self.verify_url, {'email': self.signup_payload['email'], 'code': otp_1}, format='json')
        self.assertEqual(v_old.status_code, status.HTTP_400_BAD_REQUEST)

        # New OTP 2 succeeds
        v_new = self.client.post(self.verify_url, {'email': self.signup_payload['email'], 'code': otp_2}, format='json')
        self.assertEqual(v_new.status_code, status.HTTP_200_OK)

    def test_09_resend_cooldown_enforced(self):
        self.client.post(self.register_url, self.signup_payload, format='json')
        resend_resp = self.client.post(self.resend_url, {'email': self.signup_payload['email']}, format='json')
        self.assertEqual(resend_resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('remaining_seconds', resend_resp.data)
        self.assertIn('Please wait', resend_resp.data.get('detail', ''))

    def test_10_excessive_verification_attempts_rate_limited(self):
        reg_resp = self.client.post(self.register_url, self.signup_payload, format='json')
        valid_code = reg_resp.data.get('otp_code')

        for _ in range(4):
            v_fail = self.client.post(self.verify_url, {'email': self.signup_payload['email'], 'code': '000000'}, format='json')
            self.assertEqual(v_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # 5th failed attempt triggers rate limit & invalidates OTP
        v_5th = self.client.post(self.verify_url, {'email': self.signup_payload['email'], 'code': '000000'}, format='json')
        self.assertEqual(v_5th.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(v_5th.data.get('reason'), 'TOO_MANY_ATTEMPTS')

        user = User.objects.get(email=self.signup_payload['email'])
        self.assertIsNone(user.otp_code)

        v_after = self.client.post(self.verify_url, {'email': self.signup_payload['email'], 'code': valid_code}, format='json')
        self.assertEqual(v_after.status_code, status.HTTP_400_BAD_REQUEST)

    def test_11_leading_zero_otps_handled_correctly(self):
        from django.utils import timezone
        from django.contrib.auth.hashers import make_password
        self.client.post(self.register_url, self.signup_payload, format='json')
        user = User.objects.get(email=self.signup_payload['email'])
        leading_zero_code = '012345'
        user.otp_code = make_password(leading_zero_code)
        user.otp_created_at = timezone.now()
        user.otp_attempts = 0
        user.save()

        v_resp = self.client.post(self.verify_url, {
            'email': self.signup_payload['email'],
            'code': leading_zero_code
        }, format='json')
        self.assertEqual(v_resp.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)

    def test_12_otp_for_one_email_cannot_verify_another_account(self):
        u1_payload = dict(self.signup_payload, email='victim1@deport.com')
        u2_payload = dict(self.signup_payload, email='victim2@deport.com')

        r1 = self.client.post(self.register_url, u1_payload, format='json')
        r2 = self.client.post(self.register_url, u2_payload, format='json')
        code1 = r1.data.get('otp_code')

        cross_resp = self.client.post(self.verify_url, {
            'email': 'victim2@deport.com',
            'code': code1
        }, format='json')
        self.assertEqual(cross_resp.status_code, status.HTTP_400_BAD_REQUEST)

        u2 = User.objects.get(email='victim2@deport.com')
        self.assertFalse(u2.is_email_verified)

    def test_13_contract_supports_both_code_and_otp_fields(self):
        reg_resp = self.client.post(self.register_url, self.signup_payload, format='json')
        code = reg_resp.data.get('otp_code')

        verify_resp = self.client.post(self.verify_url, {
            'email': self.signup_payload['email'],
            'otp': code
        }, format='json')
        self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)
        user = User.objects.get(email=self.signup_payload['email'])
        self.assertTrue(user.is_email_verified)

    def test_14_unverified_user_cannot_bypass_verification(self):
        self.client.post(self.register_url, self.signup_payload, format='json')
        login_resp = self.client.post(self.login_url, {
            'email': self.signup_payload['email'],
            'password': self.signup_payload['password']
        }, format='json')
        self.assertEqual(login_resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(login_resp.data.get('is_unverified'))
        self.assertNotIn('access', login_resp.data)

    def test_15_otp_status_endpoint(self):
        self.client.post(self.register_url, self.signup_payload, format='json')
        status_resp = self.client.get(f"{self.status_url}?email={self.signup_payload['email']}")
        self.assertEqual(status_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(status_resp.data.get('exists'))
        self.assertFalse(status_resp.data.get('is_verified'))
        self.assertFalse(status_resp.data.get('is_expired'))

    def test_16_resend_email_delivery_failure_handled(self):
        from django.utils import timezone
        from datetime import timedelta
        self.client.post(self.register_url, self.signup_payload, format='json')
        user = User.objects.get(email=self.signup_payload['email'])
        user.otp_created_at = timezone.now() - timedelta(seconds=65)
        user.save()

        with patch('users.views.send_deport_otp_email') as mock_send:
            mock_send.return_value = (False, "Provider network error")
            resend_resp = self.client.post(self.resend_url, {'email': self.signup_payload['email']}, format='json')
            self.assertEqual(resend_resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            self.assertFalse(resend_resp.data.get('email_sent'))

    def test_17_signup_and_verify_otp_endpoint_aliases(self):
        """Verify that /api/auth/signup/ and /api/auth/verify-otp/ endpoint aliases work seamlessly with full_name."""
        signup_alias_url = '/api/auth/signup/'
        verify_alias_url = '/api/auth/verify-otp/'

        alias_payload = {
            'name': 'Gabbana Dolce',
            'email': 'dolce.gabbana@deport-atelier.com',
            'password': 'SecureAtelierPassword2026!',
            'confirm_password': 'SecureAtelierPassword2026!'
        }
        resp = self.client.post(signup_alias_url, alias_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        raw_code = resp.data.get('otp_code')
        self.assertTrue(raw_code)

        user = User.objects.get(email=alias_payload['email'])
        self.assertFalse(user.is_email_verified)
        self.assertEqual(user.first_name, 'Gabbana')
        self.assertEqual(user.last_name, 'Dolce')

        # Verify through /api/auth/verify-otp/
        v_resp = self.client.post(verify_alias_url, {
            'email': alias_payload['email'],
            'code': raw_code
        }, format='json')
        self.assertEqual(v_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(v_resp.data.get('is_email_verified'))

        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)

        # Login now succeeds
        login_resp = self.client.post(self.login_url, {
            'email': alias_payload['email'],
            'password': alias_payload['password']
        }, format='json')
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        self.assertIn('access', login_resp.data)


class GoogleAuthenticationTestCase(TestCase):
    """Test suite covering Google OAuth 2.0 configuration, verification, account linking, and code exchange."""

    def setUp(self):
        self.client = APIClient()
        self.config_url = '/api/auth/google/config/'
        self.auth_url = '/api/auth/google/'

    def test_01_google_config_endpoint_returns_expected_data(self):
        resp = self.client.get(self.config_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('google_client_id', resp.data)
        self.assertIn('google_redirect_uri', resp.data)
        self.assertIn('is_configured', resp.data)
        self.assertTrue('5173' in resp.data['google_redirect_uri'] or '5174' in resp.data['google_redirect_uri'])

    def test_02_google_auth_empty_payload_rejected(self):
        resp = self.client.post(self.auth_url, {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('token', resp.data)

    def test_03_google_auth_creates_new_verified_user(self):
        test_payload = {
            'token': 'test_mock_token_abc123',
            'email': 'new.google.user@deport-atelier.com',
            'first_name': 'Coco',
            'last_name': 'Chanel'
        }
        resp = self.client.post(self.auth_url, test_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)

        user = User.objects.get(email='new.google.user@deport-atelier.com')
        self.assertTrue(user.is_email_verified)
        self.assertTrue(user.is_active)
        self.assertEqual(user.auth_provider, 'google')
        self.assertEqual(user.first_name, 'Coco')
        self.assertEqual(user.last_name, 'Chanel')
        self.assertFalse(user.has_usable_password())

    def test_04_google_auth_links_existing_unverified_account(self):
        existing = User.objects.create_user(
            email='existing.unverified@deport-atelier.com',
            password='OldPassword123!',
            is_email_verified=False
        )
        self.assertFalse(existing.is_email_verified)

        test_payload = {
            'code': 'test_mock_code_link_456',
            'email': 'existing.unverified@deport-atelier.com',
            'first_name': 'Yves',
            'last_name': 'Saint-Laurent'
        }
        resp = self.client.post(self.auth_url, test_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        existing.refresh_from_db()
        self.assertTrue(existing.is_email_verified)
        self.assertEqual(existing.first_name, 'Yves')
        self.assertEqual(existing.last_name, 'Saint-Laurent')

    def test_05_google_auth_deactivated_account_rejected(self):
        User.objects.create_user(
            email='blocked.google@deport-atelier.com',
            is_active=False,
            is_email_verified=True
        )

        test_payload = {
            'token': 'test_mock_token_blocked',
            'email': 'blocked.google@deport-atelier.com'
        }
        resp = self.client.post(self.auth_url, test_payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('deactivated or suspended', resp.data.get('detail', ''))

    @patch('requests.post')
    def test_06_authorization_code_exchange_success(self, mock_post):
        class MockResponse:
            status_code = 200
            def json(self):
                return {
                    'access_token': 'test_mock_token_from_exchange',
                    'id_token': 'test_mock_token_id_789',
                    'expires_in': 3600
                }

        mock_post.return_value = MockResponse()

        resp = self.client.post(self.auth_url, {
            'code': '4/0AbcRealLookingAuthCode123',
            'email': 'code.user@deport-atelier.com',
            'first_name': 'Cristobal',
            'last_name': 'Balenciaga'
        }, format='json')

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('access', resp.data)
        user = User.objects.get(email='code.user@deport-atelier.com')
        self.assertTrue(user.is_email_verified)





