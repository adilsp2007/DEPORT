from django.test import TestCase, RequestFactory
from django.core.exceptions import ValidationError as DjangoValidationError, PermissionDenied
from django.db import IntegrityError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import ValidationError as DRFValidationError, NotAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from config.exceptions import custom_exception_handler


class ErrorHandlingTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.request = self.factory.get('/api/test/')
        self.context = {'request': self.request, 'view': APIView()}

    def test_drf_validation_error_dict(self):
        exc = DRFValidationError({'email': ['This email is already registered.']})
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data.get('detail'), 'This email is already registered.')
        self.assertIn('email', resp.data)

    def test_drf_validation_error_list(self):
        exc = DRFValidationError(['Invalid payload received.'])
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data.get('detail'), 'Invalid payload received.')

    def test_simple_jwt_token_error_translation(self):
        exc = NotAuthenticated('Given token not valid for any token type')
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(resp.data.get('detail'), 'Your session has expired. Please log in again.')

    def test_django_core_validation_error(self):
        exc = DjangoValidationError({'phone': ['Enter a valid 10-digit mobile number.']})
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data.get('detail'), 'Enter a valid 10-digit mobile number.')

    def test_integrity_error_duplicate(self):
        exc = IntegrityError('UNIQUE constraint failed: users_user.email')
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(resp.data.get('detail'), 'A record with this information already exists.')

    def test_http404_error(self):
        exc = Http404('Resource does not exist.')
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(resp.data.get('detail'), 'The requested record was not found.')

    def test_permission_denied_error(self):
        exc = PermissionDenied('Access denied.')
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp.data.get('detail'), 'You do not have permission to perform this action.')

    def test_unhandled_exception_returns_500_without_leaking_trace(self):
        exc = RuntimeError('Secret database credentials or path /var/www/...')
        resp = custom_exception_handler(exc, self.context)
        self.assertEqual(resp.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(resp.data.get('detail'), 'Something went wrong on our server. Please try again later.')
        self.assertNotIn('/var/www', str(resp.data))

