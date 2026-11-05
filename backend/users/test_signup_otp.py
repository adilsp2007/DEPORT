from datetime import timedelta
from unittest.mock import patch, MagicMock
import smtplib
import socket

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import DatabaseError
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class SignupAndOTPExtensiveTestCase(TestCase):
    """
    Automated test suite verifying the 12 required scenarios for DEPORT Signup and OTP delivery:
    1. Successful signup
    2. Invalid email
    3. Existing email (verified and unverified)
    4. Successful OTP sending
    5. Incorrect OTP
    6. Expired OTP
    7. Successful OTP verification
    8. Resend OTP
    9. Email server failure (SMTP failure handling)
    10. Database failure
    11. Network/API failure / Connection timeout
    12. Multiple OTP requests (Rate limiting / Cooldown)
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

        user = User.objects.get(email=self.valid_payload['email'])
        self.assertFalse(user.is_email_verified)
        self.assertIsNotNone(user.otp_code)
        self.assertIsNotNone(user.otp_created_at)

    # 2. Invalid email
    def test_02_invalid_email(self):
        payload = self.valid_payload.copy()
        payload['email'] = 'invalid-email-format'

        response = self.client.post(self.signup_url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    # 3. Existing email (both verified and unverified accounts)
    @patch('users.views.send_deport_otp_email')
    def test_03_existing_email_handling(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")

        # First signup
        r1 = self.client.post(self.signup_url, self.valid_payload, format='json')
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)

        # Duplicate signup while unverified
        r2 = self.client.post(self.signup_url, self.valid_payload, format='json')
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('pending verification', str(r2.data.get('email', '')))

        # Verify account
        user = User.objects.get(email=self.valid_payload['email'])
        user.is_email_verified = True
        user.save()

        # Duplicate signup when already verified
        r3 = self.client.post(self.signup_url, self.valid_payload, format='json')
        self.assertEqual(r3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already exists', str(r3.data.get('email', '')))

    # 4. Successful OTP sending
    @patch('django.core.mail.send_mail')
    def test_04_successful_otp_sending(self, mock_send_mail):
        mock_send_mail.return_value = 1  # 1 message delivered

        response = self.client.post(self.signup_url, self.valid_payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data.get('email_sent'))
        self.assertTrue(mock_send_mail.called)
        sent_args = mock_send_mail.call_args[1]
        self.assertEqual(sent_args['recipient_list'], [self.valid_payload['email']])

    # 5. Incorrect OTP
    @patch('users.views.send_deport_otp_email')
    def test_05_incorrect_otp(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        self.client.post(self.signup_url, self.valid_payload, format='json')

        response = self.client.post(self.verify_url, {
            'email': self.valid_payload['email'],
            'code': '999999'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid verification code', response.data.get('detail', ''))

        user = User.objects.get(email=self.valid_payload['email'])
        self.assertFalse(user.is_email_verified)
        self.assertEqual(user.otp_attempts, 1)

    # 6. Expired OTP
    @patch('users.views.send_deport_otp_email')
    def test_06_expired_otp(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        reg_resp = self.client.post(self.signup_url, self.valid_payload, format='json')
        code = reg_resp.data.get('otp_code')

        user = User.objects.get(email=self.valid_payload['email'])
        # Age the OTP past 5-minute expiry (e.g. 6 minutes ago)
        user.otp_created_at = timezone.now() - timedelta(minutes=6)
        user.save()

        response = self.client.post(self.verify_url, {
            'email': self.valid_payload['email'],
            'code': code
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('reason'), 'EXPIRED')
        self.assertIn('expired', response.data.get('detail', '').lower())

    # 7. Successful OTP verification
    @patch('users.views.send_deport_otp_email')
    def test_07_successful_otp_verification(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        reg_resp = self.client.post(self.signup_url, self.valid_payload, format='json')
        code = reg_resp.data.get('otp_code')

        response = self.client.post(self.verify_url, {
            'email': self.valid_payload['email'],
            'code': code
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('message'), 'Email verified successfully.')
        self.assertTrue(response.data.get('is_email_verified'))

        user = User.objects.get(email=self.valid_payload['email'])
        self.assertTrue(user.is_email_verified)
        self.assertTrue(user.is_active)
        self.assertIsNone(user.otp_code)
        self.assertIsNone(user.otp_created_at)

        # Confirm user can now log in
        login_resp = self.client.post(self.login_url, {
            'email': self.valid_payload['email'],
            'password': self.valid_payload['password']
        }, format='json')
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        self.assertIn('access', login_resp.data)

    # 8. Resend OTP
    @patch('users.views.send_deport_otp_email')
    def test_08_resend_otp(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        self.client.post(self.signup_url, self.valid_payload, format='json')

        user = User.objects.get(email=self.valid_payload['email'])
        old_hash = user.otp_code

        # Advance time past cooldown (e.g. 65 seconds ago)
        user.otp_created_at = timezone.now() - timedelta(seconds=65)
        user.save()

        resend_resp = self.client.post(self.resend_url, {
            'email': self.valid_payload['email']
        }, format='json')

        self.assertEqual(resend_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resend_resp.data.get('email_sent'))
        self.assertEqual(resend_resp.data.get('cooldown'), 60)

        user.refresh_from_db()
        self.assertNotEqual(user.otp_code, old_hash)

    # 9. Email server failure
    @patch('django.core.mail.send_mail')
    def test_09_email_server_failure(self, mock_send_mail):
        # Simulate SMTP authentication error from server
        mock_send_mail.side_effect = smtplib.SMTPAuthenticationError(535, b"5.7.8 Authentication credentials invalid")

        response = self.client.post(self.signup_url, self.valid_payload, format='json')

        # When email delivery fails, backend must return 503 and report email_sent=False
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(response.data.get('email_sent'))
        self.assertIn('email could not be delivered', response.data.get('detail', ''))

        # User is created unverified safely
        user = User.objects.get(email=self.valid_payload['email'])
        self.assertFalse(user.is_email_verified)
        # Cooldown should be cleared so user can retry
        self.assertIsNone(user.otp_created_at)

    # 10. Database failure handling
    @patch('users.serializers.User.objects.create_user')
    def test_10_database_failure(self, mock_create):
        mock_create.side_effect = DatabaseError("Database connection lost.")

        with self.assertRaises(DatabaseError):
            self.client.post(self.signup_url, self.valid_payload, format='json')

    # 11. Network/API failure / Connection timeout
    @patch('django.core.mail.send_mail')
    def test_11_network_timeout_failure(self, mock_send_mail):
        # Simulate network timeout (e.g. blocked outbound port 587 on cloud host)
        mock_send_mail.side_effect = socket.timeout("The read operation timed out")

        response = self.client.post(self.signup_url, self.valid_payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(response.data.get('email_sent'))
        self.assertIn('timed out', response.data.get('detail', '').lower())

    # 12. Multiple OTP requests (Rate limiting / Cooldown enforcement)
    @patch('users.views.send_deport_otp_email')
    def test_12_multiple_otp_requests_cooldown(self, mock_send_email):
        mock_send_email.return_value = (True, "Email sent successfully.")
        self.client.post(self.signup_url, self.valid_payload, format='json')

        # Immediately request resend without waiting 60s
        resend_attempt_1 = self.client.post(self.resend_url, {
            'email': self.valid_payload['email']
        }, format='json')

        self.assertEqual(resend_attempt_1.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('remaining_seconds', resend_attempt_1.data)
        self.assertTrue(resend_attempt_1.data['remaining_seconds'] > 0)
        self.assertIn('Please wait', resend_attempt_1.data.get('detail', ''))

