from datetime import timedelta
from unittest.mock import patch
import smtplib
import socket

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class SignupAndOTPExtensiveTestCase(TestCase):
    """
    Automated test suite verifying the 18 requirements for DEPORT Signup and OTP delivery:
    1. Successful signup.
    2. Invalid email.
    3. Weak password.
    4. Password mismatch.
    5. Duplicate verified email.
    6. Existing unverified email.
    7. Successful OTP email delivery.
    8. Correct OTP verification.
    9. Incorrect OTP.
    10. Expired OTP.
    11. Reused OTP.
    12. Successful resend OTP.
    13. Resend cooldown (30-second cooldown).
    14. Verification of an already verified account.
    15. JWT token generation.
    16. Login before email verification.
    17. Login after email verification.
    18. SMTP failure handling.
    """

    def setUp(self):
        self.client = APIClient()
        self.signup_url = '/api/auth/register/'
        self.verify_url = '/api/auth/verify-email/'
        self.resend_url = '/api/auth/resend-otp/'
        self.login_url = '/api/auth/login/'

        self.valid_payload = {
            'first_name': 'Alexander',
            'last_name': 'Deport',
            'email': 'alexander.deport@example.com',
            'password': 'LuxuryPassword123!',
            'confirm_password': 'LuxuryPassword123!'
        }

    # 1. Successful signup
    @patch('users.views.send_deport_otp_email')
    def test_01_successful_signup(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")

        response = self.client.post(self.signup_url, self.valid_payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data.get('email_sent'))
        self.assertEqual(response.data['user']['email'], self.valid_payload['email'])
        self.assertIsNone(response.data.get('otp_code'), "OTP must never be returned in API response")

        user = User.objects.get(email=self.valid_payload['email'])
        self.assertFalse(user.is_email_verified)
        self.assertFalse(user.is_active, "Unverified user must not be active")
        self.assertIsNotNone(user.otp_code)
        self.assertIsNotNone(user.otp_created_at)

    # 2. Invalid email
    def test_02_invalid_email(self):
        payload = self.valid_payload.copy()
        payload['email'] = 'invalid-email-format'

        response = self.client.post(self.signup_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    # 3. Weak password (< 8 chars)
    def test_03_weak_password(self):
        payload = self.valid_payload.copy()
        payload['password'] = 'short'
        payload['confirm_password'] = 'short'

        response = self.client.post(self.signup_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    # 4. Password mismatch
    def test_04_password_mismatch(self):
        payload = self.valid_payload.copy()
        payload['confirm_password'] = 'DifferentPassword123!'

        response = self.client.post(self.signup_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('confirm_password', response.data)

    # 5. Duplicate verified email
    @patch('users.views.send_deport_otp_email')
    def test_05_duplicate_verified_email(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")

        # Register and mark verified
        r1 = self.client.post(self.signup_url, self.valid_payload, format='json')
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email=self.valid_payload['email'])
        user.is_email_verified = True
        user.save()

        # Duplicate signup with verified email
        r2 = self.client.post(self.signup_url, self.valid_payload, format='json')
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already exists', str(r2.data.get('email', '')))

    # 6. Existing unverified email (updates details, issues new OTP, no duplicate user records)
    @patch('users.views.send_deport_otp_email')
    def test_06_existing_unverified_email(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")

        # First signup
        r1 = self.client.post(self.signup_url, self.valid_payload, format='json')
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)

        # Re-register with unverified email, updating first_name
        payload2 = self.valid_payload.copy()
        payload2['first_name'] = 'UpdatedAlexander'
        r2 = self.client.post(self.signup_url, payload2, format='json')

        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)
        self.assertTrue(r2.data.get('email_sent'))

        user = User.objects.get(email=self.valid_payload['email'])
        self.assertEqual(user.first_name, 'UpdatedAlexander')
        # Confirm no duplicate database entries
        self.assertEqual(User.objects.filter(email=self.valid_payload['email']).count(), 1)

    # 7. Successful OTP email delivery
    @patch('django.core.mail.send_mail')
    def test_07_successful_otp_email_delivery(self, mock_send_mail):
        mock_send_mail.return_value = 1  # 1 message delivered

        response = self.client.post(self.signup_url, self.valid_payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data.get('email_sent'))
        self.assertTrue(mock_send_mail.called)

        call_kwargs = mock_send_mail.call_args[1]
        self.assertEqual(call_kwargs['recipient_list'], [self.valid_payload['email']])
        self.assertIn('DEPORT', call_kwargs['subject'])
        self.assertIn('5 minutes', call_kwargs['message'])

    # 8. Correct OTP verification
    @patch('users.views.send_deport_otp_email')
    def test_08_correct_otp_verification(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        reg_resp = self.client.post(self.signup_url, self.valid_payload, format='json')
        code = mock_send_email.call_args[1]['code']

        # Test verification using "otp" field (as well as "code")
        response = self.client.post(self.verify_url, {
            'email': self.valid_payload['email'],
            'otp': code
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('message'), 'Email verified successfully.')
        self.assertTrue(response.data.get('is_email_verified'))

        user = User.objects.get(email=self.valid_payload['email'])
        self.assertTrue(user.is_email_verified)
        self.assertTrue(user.is_active)
        self.assertIsNone(user.otp_code)

    # 9. Incorrect OTP
    @patch('users.views.send_deport_otp_email')
    def test_09_incorrect_otp(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        self.client.post(self.signup_url, self.valid_payload, format='json')

        response = self.client.post(self.verify_url, {
            'email': self.valid_payload['email'],
            'otp': '000000'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid verification code', response.data.get('detail', ''))

        user = User.objects.get(email=self.valid_payload['email'])
        self.assertFalse(user.is_email_verified)
        self.assertEqual(user.otp_attempts, 1)

    # 10. Expired OTP
    @patch('users.views.send_deport_otp_email')
    def test_10_expired_otp(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        reg_resp = self.client.post(self.signup_url, self.valid_payload, format='json')
        code = mock_send_email.call_args[1]['code']

        user = User.objects.get(email=self.valid_payload['email'])
        # Age OTP past 5-minute expiry
        user.otp_created_at = timezone.now() - timedelta(minutes=6)
        user.save()

        response = self.client.post(self.verify_url, {
            'email': self.valid_payload['email'],
            'otp': code
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('reason'), 'EXPIRED')
        self.assertIn('expired', response.data.get('detail', '').lower())

    # 11. Reused OTP
    @patch('users.views.send_deport_otp_email')
    def test_11_reused_otp(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        reg_resp = self.client.post(self.signup_url, self.valid_payload, format='json')
        code = mock_send_email.call_args[1]['code']

        # First verification succeeds
        v1 = self.client.post(self.verify_url, {
            'email': self.valid_payload['email'],
            'otp': code
        }, format='json')
        self.assertEqual(v1.status_code, status.HTTP_200_OK)

        # Second verification attempt with same OTP is rejected
        v2 = self.client.post(self.verify_url, {
            'email': self.valid_payload['email'],
            'otp': code
        }, format='json')
        self.assertEqual(v2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(v2.data.get('already_verified'))

    # 12. Successful resend OTP
    @patch('users.views.send_deport_otp_email')
    def test_12_successful_resend_otp(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        self.client.post(self.signup_url, self.valid_payload, format='json')

        user = User.objects.get(email=self.valid_payload['email'])
        old_otp_hash = user.otp_code

        # Advance beyond 30-second cooldown
        user.otp_created_at = timezone.now() - timedelta(seconds=35)
        user.save()

        resend_resp = self.client.post(self.resend_url, {
            'email': self.valid_payload['email']
        }, format='json')

        self.assertEqual(resend_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resend_resp.data.get('email_sent'))
        self.assertEqual(resend_resp.data.get('cooldown'), 30)

        user.refresh_from_db()
        self.assertNotEqual(user.otp_code, old_otp_hash)

    # 13. Resend cooldown (30-second cooldown)
    @patch('users.views.send_deport_otp_email')
    def test_13_resend_cooldown(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        self.client.post(self.signup_url, self.valid_payload, format='json')

        # Immediately request resend within cooldown
        resend_resp = self.client.post(self.resend_url, {
            'email': self.valid_payload['email']
        }, format='json')

        self.assertEqual(resend_resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('remaining_seconds', resend_resp.data)
        self.assertTrue(resend_resp.data['remaining_seconds'] > 0)

    # 14. Verification of an already verified account
    @patch('users.views.send_deport_otp_email')
    def test_14_verification_of_already_verified_account(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        self.client.post(self.signup_url, self.valid_payload, format='json')

        user = User.objects.get(email=self.valid_payload['email'])
        user.is_email_verified = True
        user.save()

        response = self.client.post(self.verify_url, {
            'email': self.valid_payload['email'],
            'otp': '123456'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(response.data.get('already_verified'))

    # 15. JWT token generation
    @patch('users.views.send_deport_otp_email')
    def test_15_jwt_token_generation(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        reg_resp = self.client.post(self.signup_url, self.valid_payload, format='json')
        code = mock_send_email.call_args[1]['code']

        verify_resp = self.client.post(self.verify_url, {
            'email': self.valid_payload['email'],
            'code': code
        }, format='json')

        self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)
        self.assertIn('access', verify_resp.data)
        self.assertIn('refresh', verify_resp.data)
        self.assertTrue(len(verify_resp.data['access']) > 20)

    # 16. Login before email verification
    @patch('users.views.send_deport_otp_email')
    def test_16_login_before_email_verification(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        self.client.post(self.signup_url, self.valid_payload, format='json')

        login_resp = self.client.post(self.login_url, {
            'email': self.valid_payload['email'],
            'password': self.valid_payload['password']
        }, format='json')

        self.assertEqual(login_resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(login_resp.data.get('is_unverified'))

    # 17. Login after email verification
    @patch('users.views.send_deport_otp_email')
    def test_17_login_after_email_verification(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        reg_resp = self.client.post(self.signup_url, self.valid_payload, format='json')
        code = mock_send_email.call_args[1]['code']

        # Verify
        self.client.post(self.verify_url, {
            'email': self.valid_payload['email'],
            'code': code
        }, format='json')

        # Login
        login_resp = self.client.post(self.login_url, {
            'email': self.valid_payload['email'],
            'password': self.valid_payload['password']
        }, format='json')

        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        self.assertIn('access', login_resp.data)
        self.assertIn('refresh', login_resp.data)

    # 18. SMTP failure handling
    @patch('django.core.mail.send_mail')
    def test_18_smtp_failure_handling(self, mock_send_mail):
        mock_send_mail.side_effect = smtplib.SMTPAuthenticationError(535, b"5.7.8 Bad credentials")

        response = self.client.post(self.signup_url, self.valid_payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(response.data.get('email_sent'))
        self.assertIn('email could not be delivered', response.data.get('detail', ''))

        user = User.objects.get(email=self.valid_payload['email'])
        self.assertFalse(user.is_email_verified)
        # Cooldown cleared so user is not penalized
        self.assertIsNone(user.otp_created_at)
