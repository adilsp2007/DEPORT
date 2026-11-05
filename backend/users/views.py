import os
from django.conf import settings
from django.utils import timezone
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Sum, Q
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import update_last_login
from rest_framework.pagination import PageNumberPagination
from .permissions import IsAdminUser
from .serializers import (
    UserSerializer, AdminUserDetailSerializer, UserProfileUpdateSerializer, RegisterSerializer,
    LoginSerializer, AdminLoginSerializer, LogoutSerializer, GoogleAuthSerializer, ChangePasswordSerializer,
    ForgotPasswordRequestSerializer, ForgotPasswordResetSerializer,
    RequestEmailChangeSerializer, VerifyEmailChangeSerializer, TwoFactorVerifySerializer,
    ToggleTwoFactorSerializer
)
try:
    from products.models import Product
except ImportError:
    Product = None

try:
    from orders.models import Order, Coupon
except ImportError:
    Order = None
    Coupon = None

try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    GOOGLE_AUTH_AVAILABLE = False

User = get_user_model()


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


def is_test_environment():
    import sys
    return bool(getattr(settings, 'TESTING', False) or ('test' in sys.argv))


def send_deport_otp_email(email, code, first_name='', subject="DEPORT - Verification Code"):
    """
    Sends an authentic luxury-styled OTP email via the configured Django email backend or AWS SES.
    Supports:
    1. Direct AWS SES API (via boto3 HTTPS port 443) when USE_AWS_SES=True or SES credentials provided.
       This bypasses EC2 port 25/587 blocking and Google cloud IP restrictions.
    2. Standard Django SMTP backend with granular error handling:
       - SMTPAuthenticationError
       - socket.timeout / TimeoutError
       - SMTPConnectError / ConnectionRefusedError
       - SMTPSenderRefused
       - SMTPRecipientsRefused
       - ssl.SSLError
    Never exposes raw OTP or email passwords in logs.
    Returns (success: bool, message: str)
    """
    import logging
    import smtplib
    import socket
    import ssl
    from django.core.mail import send_mail
    from django.conf import settings

    logger = logging.getLogger('django')
    logger.info(f"Attempting to dispatch verification OTP email to recipient: {email} (subject: {subject})")

    expiry_minutes = getattr(settings, 'OTP_EXPIRY_MINUTES', 5)
    host_user = getattr(settings, 'EMAIL_HOST_USER', '').strip()
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or f"DEPORT Atelier <{host_user or 'noreply@deport.com'}>"

    plain_message = (
        f"Hello {first_name or 'there'},\n\n"
        f"Your 6-digit DEPORT verification code is: {code}\n\n"
        f"This code will expire in {expiry_minutes} minutes.\n\n"
        f"Best regards,\nDEPORT Atelier Team"
    )
    html_message = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; background-color: #0B0F0D; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F3F4F6;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0B0F0D; padding: 40px 15px;">
        <tr>
            <td align="center">
                <table width="560" border="0" cellspacing="0" cellpadding="0" style="background-color: #131915; border: 1px solid #1E2922; border-radius: 4px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <tr>
                        <td align="center" style="padding: 35px 20px 25px; border-bottom: 1px solid #1E2922;">
                            <h1 style="margin: 0; font-family: Georgia, serif; font-size: 28px; letter-spacing: 5px; color: #F3F4F6; text-transform: uppercase;">DEPORT</h1>
                            <p style="margin: 6px 0 0; font-size: 10px; letter-spacing: 3px; color: #10B981; font-weight: 600; text-transform: uppercase;">Carry Your Style &bull; Luxury Bags</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 35px 40px;">
                            <h2 style="margin: 0 0 16px; font-family: Georgia, serif; font-size: 20px; font-weight: 500; color: #FFFFFF; text-align: center;">Verify Your Email Address</h2>
                            <p style="margin: 0 0 25px; font-size: 13px; line-height: 1.7; color: #9CA3AF; text-align: center;">
                                Hello <strong style="color: #F3F4F6;">{first_name or 'Valued Client'}</strong>,<br>
                                Please use the single-use 6-digit verification code below to activate your DEPORT luxury account.
                            </p>
                            <div style="text-align: center; margin: 30px 0;">
                                <div style="display: inline-block; background-color: #0B0F0D; border: 1px solid #10B981; padding: 14px 32px; border-radius: 2px;">
                                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10B981;">{code}</span>
                                </div>
                            </div>
                            <p style="margin: 25px 0 0; font-size: 12px; color: #6B7280; text-align: center;">
                                This verification code is strictly confidential and will expire in <strong style="color: #9CA3AF;">{expiry_minutes} minutes</strong>.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 20px 30px; background-color: #0E1310; border-top: 1px solid #1E2922; font-size: 11px; color: #6B7280; line-height: 1.5;">
                            If you did not initiate this request, you can safely disregard this email.<br>
                            &copy; 2026 DEPORT Atelier Inc. All rights reserved.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
    # 1. AWS SES Direct API Dispatcher (HTTPS Port 443)
    if getattr(settings, 'USE_AWS_SES', False):
        try:
            import boto3
            ses_kwargs = {
                'region_name': getattr(settings, 'AWS_SES_REGION_NAME', 'us-east-1')
            }
            key_id = getattr(settings, 'AWS_ACCESS_KEY_ID', None)
            secret_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', None)
            if key_id and secret_key:
                ses_kwargs['aws_access_key_id'] = key_id
                ses_kwargs['aws_secret_access_key'] = secret_key

            ses_client = boto3.client('ses', **ses_kwargs)
            ses_params = {
                'Source': from_email,
                'Destination': {'ToAddresses': [email]},
                'Message': {
                    'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                    'Body': {
                        'Text': {'Data': plain_message, 'Charset': 'UTF-8'},
                        'Html': {'Data': html_message, 'Charset': 'UTF-8'}
                    }
                }
            }
            config_set = getattr(settings, 'AWS_SES_CONFIGURATION_SET', None)
            if config_set:
                ses_params['ConfigurationSetName'] = config_set

            ses_resp = ses_client.send_email(**ses_params)
            logger.info(f"Successfully sent OTP email via AWS SES to {email} (MessageId: {ses_resp.get('MessageId')})")
            return True, "Email sent successfully via AWS SES."
        except Exception as e:
            logger.error(f"AWS SES delivery error for {email}: {type(e).__name__} - {e}")
            error_code = getattr(e, 'response', {}).get('Error', {}).get('Code', type(e).__name__)
            return False, f"AWS SES email delivery error: {error_code}"

    # 2. Standard SMTP Dispatcher with Granular Error Handling
    backend_str = getattr(settings, 'EMAIL_BACKEND', '')
    is_smtp = 'smtp' in backend_str.lower()
    host_pass = getattr(settings, 'EMAIL_HOST_PASSWORD', '').strip()

    if is_smtp and (not host_user or not host_pass):
        logger.error(
            "SMTP email backend is configured, but EMAIL_HOST_USER or EMAIL_HOST_PASSWORD is missing in backend/.env. "
            "Cannot authenticate with SMTP host."
        )
        return False, "SMTP credentials missing in environment."

    try:
        sent_count = send_mail(
            subject=subject,
            message=plain_message,
            html_message=html_message,
            from_email=from_email,
            recipient_list=[email],
            fail_silently=False
        )
        if sent_count > 0:
            logger.info(f"Successfully sent OTP email to {email}")
            return True, "Email sent successfully."
        else:
            logger.warning(f"send_mail returned 0 messages sent for recipient {email}")
            return False, "Email provider accepted request but delivered 0 messages."
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP authentication failure sending to {email}: {e}")
        return False, "SMTP authentication failed. Verify EMAIL_HOST_USER and EMAIL_HOST_PASSWORD."
    except (socket.timeout, TimeoutError) as e:
        logger.error(f"SMTP connection timeout sending to {email}: {e}")
        return False, "SMTP connection timed out. Check network connectivity or firewall ports."
    except (smtplib.SMTPConnectError, ConnectionRefusedError) as e:
        logger.error(f"SMTP connection error sending to {email}: {e}")
        return False, "Could not connect to SMTP server. Verify host and port."
    except smtplib.SMTPSenderRefused as e:
        logger.error(f"SMTP sender refused sending to {email}: {e}")
        return False, "Sender email address was rejected by SMTP server."
    except smtplib.SMTPRecipientsRefused as e:
        logger.error(f"SMTP recipient refused for {email}: {e}")
        return False, "Recipient email address was rejected by SMTP server."
    except ssl.SSLError as e:
        logger.error(f"SSL/TLS handshake failure sending to {email}: {e}")
        return False, "SSL/TLS secure handshake failed with email server."
    except Exception as e:
        logger.error(f"Failed to deliver OTP email to {email}: {type(e).__name__} - {e}")
        return False, f"Email delivery error: {type(e).__name__}"


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            code = user.generate_otp()
            user_data = UserSerializer(user, context={'request': request}).data

            email_sent, email_msg = send_deport_otp_email(
                email=user.email,
                code=code,
                first_name=user.first_name,
                subject="DEPORT - Your Verification Code"
            )

            is_test = is_test_environment()

            if not email_sent:
                # Reset otp_created_at so the cooldown does not lock the user out from immediate retry
                user.otp_created_at = None
                user.save(update_fields=['otp_created_at'])
                return Response({
                    'user': user_data,
                    'email': user.email,
                    'email_sent': False,
                    'detail': f'Registration succeeded, but the verification code email could not be delivered: {email_msg}. Please click Resend Code to try again.',
                    'otp_code': code if is_test else None
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

            msg = 'Registration successful. Verification OTP sent to your email.'
            return Response({
                'user': user_data,
                'email': user.email,
                'email_sent': True,
                'message': msg,
                'otp_code': code if is_test else None
            }, status=status.HTTP_201_CREATED)

        first_error = None
        for field, errors in serializer.errors.items():
            if isinstance(errors, list) and errors:
                first_error = errors[0]
                break
            elif isinstance(errors, str):
                first_error = errors
                break

        err_data = dict(serializer.errors)
        if first_error and 'detail' not in err_data:
            err_data['detail'] = first_error

        return Response(err_data, status=status.HTTP_400_BAD_REQUEST)

        first_error = None
        for field, errors in serializer.errors.items():
            if isinstance(errors, list) and errors:
                first_error = errors[0]
                break
            elif isinstance(errors, str):
                first_error = errors
                break

        err_data = dict(serializer.errors)
        if first_error and 'detail' not in err_data:
            err_data['detail'] = first_error

        return Response(err_data, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = str(request.data.get('email', '')).lower().strip()
        code = str(request.data.get('otp') or request.data.get('code') or '').strip()

        if not email or not code:
            return Response({'detail': 'Email address and verification code are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(code) != 6 or not code.isdigit():
            return Response({'detail': 'Invalid verification code format. Please enter a 6-digit number.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        with transaction.atomic():
            user = User.objects.select_for_update().filter(email=email).first()
            if not user:
                return Response({'detail': 'No account registered with this email address.', 'not_found': True}, status=status.HTTP_404_NOT_FOUND)

            if user.is_email_verified:
                tokens = get_tokens_for_user(user)
                user_data = UserSerializer(user, context={'request': request}).data
                return Response({
                    'user': user_data,
                    'access': tokens['access'],
                    'refresh': tokens['refresh'],
                    'message': 'Account is already verified. Logged in successfully.',
                    'already_verified': True,
                    'is_email_verified': True
                }, status=status.HTTP_200_OK)

            success, message, reason = user.verify_otp(code)
            if not success:
                status_code = status.HTTP_429_TOO_MANY_REQUESTS if reason == 'TOO_MANY_ATTEMPTS' else status.HTTP_400_BAD_REQUEST
                return Response({
                    'detail': message,
                    'reason': reason
                }, status=status_code)

            tokens = get_tokens_for_user(user)
            user_data = UserSerializer(user, context={'request': request}).data

            return Response({
                'user': user_data,
                'access': tokens['access'],
                'refresh': tokens['refresh'],
                'message': 'Email verified successfully.',
                'is_email_verified': True
            }, status=status.HTTP_200_OK)


class OTPStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        email = request.query_params.get('email', '').lower().strip()
        if not email:
            return Response({'detail': 'Email parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email).first()
        if not user:
            return Response({'detail': 'No account registered with this email address.', 'exists': False}, status=status.HTTP_404_NOT_FOUND)

        if user.is_email_verified:
            return Response({
                'exists': True,
                'is_verified': True,
                'email': user.email,
                'message': 'This account has already been verified.'
            }, status=status.HTTP_200_OK)

        from datetime import timedelta
        from django.utils import timezone
        expiry_minutes = getattr(settings, 'OTP_EXPIRY_MINUTES', 5)
        is_expired = False
        if user.otp_created_at and (timezone.now() - user.otp_created_at) > timedelta(minutes=expiry_minutes):
            is_expired = True

        return Response({
            'exists': True,
            'is_verified': False,
            'email': user.email,
            'is_expired': is_expired,
            'message': 'Verification code active.' if not is_expired else 'Verification code expired.'
        }, status=status.HTTP_200_OK)


class ResendOTPView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        import sys
        email = str(request.data.get('email', '')).lower().strip()

        if not email:
            return Response({'detail': 'Email address is required.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        with transaction.atomic():
            user = User.objects.select_for_update().filter(email=email).first()
            if not user:
                return Response({'detail': 'No account registered with this email address.'}, status=status.HTTP_404_NOT_FOUND)

            if user.is_email_verified:
                return Response({'detail': 'This account has already been verified. Please log in.'}, status=status.HTTP_400_BAD_REQUEST)

            cooldown_seconds = getattr(settings, 'OTP_RESEND_COOLDOWN_SECONDS', 60)
            if user.otp_created_at:
                now = timezone.now()
                seconds_since = (now - user.otp_created_at).total_seconds()
                if seconds_since < cooldown_seconds:
                    remaining = int(cooldown_seconds - seconds_since)
                    return Response({
                        'detail': f'Please wait {remaining} seconds before requesting a new verification code.',
                        'remaining_seconds': remaining
                    }, status=status.HTTP_429_TOO_MANY_REQUESTS)

            code = user.generate_otp()

            email_sent, email_msg = send_deport_otp_email(
                email=user.email,
                code=code,
                first_name=user.first_name,
                subject="DEPORT - New Verification Code"
            )

            is_test = is_test_environment()

            if not email_sent:
                # Reset otp_created_at so cooldown does not penalize user for email delivery error
                user.otp_created_at = None
                user.save(update_fields=['otp_created_at'])
                return Response({
                    'detail': f'Failed to deliver verification code email: {email_msg}. Please check your email configuration or try again.',
                    'email_sent': False,
                    'otp_code': code if is_test else None
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

            msg = 'A new verification code has been sent.'
            return Response({
                'message': msg,
                'email_sent': True,
                'cooldown': cooldown_seconds,
                'otp_code': code if is_test else None
            }, status=status.HTTP_200_OK)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            first_error = None
            for field, errors in serializer.errors.items():
                if isinstance(errors, list) and errors:
                    first_error = errors[0]
                    break
                elif isinstance(errors, str):
                    first_error = errors
                    break
            err_data = dict(serializer.errors)
            if first_error and 'detail' not in err_data:
                err_data['detail'] = first_error
            return Response(err_data, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        password = serializer.validated_data['password']

        user = authenticate(request, username=email, password=password)

        if user is None:
            existing_user = User.objects.filter(email=email).first()
            if existing_user and existing_user.check_password(password):
                if not existing_user.is_email_verified:
                    return Response({
                        'detail': 'Your email address is not yet verified. Please enter your verification code.',
                        'is_unverified': True,
                        'email': email
                    }, status=status.HTTP_403_FORBIDDEN)
                if not existing_user.is_active:
                    return Response({
                        'detail': 'This account has been deactivated. Please contact customer support.',
                        'is_deactivated': True
                    }, status=status.HTTP_403_FORBIDDEN)

            return Response({
                'detail': 'Invalid email or password. Please check your credentials and try again.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_email_verified:
            return Response({
                'detail': 'Your email address is not yet verified. Please enter your verification code.',
                'is_unverified': True,
                'email': email
            }, status=status.HTTP_403_FORBIDDEN)

        if not user.is_active:
            return Response({
                'detail': 'This account has been deactivated. Please contact customer support.',
                'is_deactivated': True
            }, status=status.HTTP_403_FORBIDDEN)

        # Check Two-Step Verification
        if user.is_two_factor_enabled:
            code = user.generate_two_factor_otp()
            try:
                from django.core.mail import send_mail
                from django.conf import settings
                subject = "DEPORT - Two-Step Verification Code"
                message = f"Hello {user.first_name or 'there'},\n\nYour 6-digit DEPORT Two-Step Verification code is: {code}\n\nThis code will expire in 10 minutes.\n\nBest regards,\nDEPORT Atelier Team"
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@deport.com'),
                    recipient_list=[user.email],
                    fail_silently=True
                )
            except Exception:
                pass

            return Response({
                'requires_two_step': True,
                'email': user.email,
                'otp_code': code if is_test_environment() else None,
                'message': 'Two-step verification code sent to your email.'
            }, status=status.HTTP_200_OK)

        update_last_login(None, user)
        tokens = get_tokens_for_user(user)
        user_data = UserSerializer(user, context={'request': request}).data

        return Response({
            'user': user_data,
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'message': 'Login successful'
        }, status=status.HTTP_200_OK)


class AdminLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AdminLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        password = serializer.validated_data['password']

        user = authenticate(request, username=email, password=password)

        if user is None:
            existing_user = User.objects.filter(email=email).first()
            if existing_user and existing_user.check_password(password):
                if not existing_user.is_active:
                    return Response({
                        'detail': 'This administrator account has been deactivated.'
                    }, status=status.HTTP_403_FORBIDDEN)
                if not (existing_user.is_staff or existing_user.is_superuser):
                    return Response({
                        'detail': 'Access denied. You do not have administrator permissions.'
                    }, status=status.HTTP_403_FORBIDDEN)

            return Response({
                'detail': 'Invalid email or password.'
            }, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({
                'detail': 'This administrator account has been deactivated.'
            }, status=status.HTTP_403_FORBIDDEN)

        if not (user.is_staff or user.is_superuser):
            return Response({
                'detail': 'Access denied. You do not have administrator permissions.'
            }, status=status.HTTP_403_FORBIDDEN)

        update_last_login(None, user)
        tokens = get_tokens_for_user(user)
        user_data = UserSerializer(user, context={'request': request}).data

        return Response({
            'user': user_data,
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'message': 'Admin login successful.'
        }, status=status.HTTP_200_OK)


class AdminDashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        blocked_users = User.objects.filter(is_active=False).count()
        total_products = Product.objects.count() if Product else 0
        total_orders = Order.objects.count() if Order else 0

        total_revenue = 0.00
        pending_orders = 0
        delivered_orders = 0
        cancelled_orders = 0
        returned_orders = 0
        active_coupons = 0

        if Order:
            from orders.models import Payment
            # Calculate realized revenue based strictly on verified successful payments
            revenue_data = Payment.objects.filter(status='completed').aggregate(total_sum=Sum('amount'))
            total_revenue = float(revenue_data['total_sum'] or 0.00)
            pending_orders = Order.objects.filter(status='pending').count()
            delivered_orders = Order.objects.filter(status='delivered').count()
            cancelled_orders = Order.objects.filter(status='cancelled').count()
            returned_orders = Order.objects.filter(status__in=['return_requested', 'returned']).count()

        if Coupon:
            active_coupons = Coupon.objects.filter(is_active=True).count()

        recent_users = UserSerializer(
            User.objects.order_by('-created_at')[:5],
            many=True,
            context={'request': request}
        ).data

        recent_orders = []
        if Order:
            recent_orders_qs = Order.objects.order_by('-created_at')[:5]
            recent_orders = [
                {
                    'id': o.id,
                    'order_number': o.order_number,
                    'customer_name': o.shipping_full_name or (o.user.full_name if o.user else 'Guest'),
                    'customer_email': o.user.email if o.user else 'guest@deport.com',
                    'total': float(o.total),
                    'status': o.status,
                    'status_display': o.get_status_display(),
                    'created_at': o.created_at
                }
                for o in recent_orders_qs
            ]

        return Response({
            'currency': 'INR',
            'currency_symbol': '₹',
            'total_users': total_users,
            'active_users': active_users,
            'blocked_users': blocked_users,
            'total_products': total_products,
            'total_orders': total_orders,
            'total_revenue': total_revenue,
            'pending_orders': pending_orders,
            'delivered_orders': delivered_orders,
            'cancelled_orders': cancelled_orders,
            'returned_orders': returned_orders,
            'active_coupons': active_coupons,
            'recent_users': recent_users,
            'recent_orders': recent_orders,
        }, status=status.HTTP_200_OK)


from config.pagination import StandardResultsSetPagination


class AdminUserListView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        queryset = User.objects.all().order_by('-created_at')

        # Search parameter (email, first_name, last_name, phone)
        search_query = request.query_params.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(email__icontains=search_query) |
                Q(first_name__icontains=search_query) |
                Q(last_name__icontains=search_query) |
                Q(phone__icontains=search_query)
            )

        # Status filter parameter (active / blocked)
        status_param = request.query_params.get('status', '').strip().lower()
        if status_param == 'active':
            queryset = queryset.filter(is_active=True)
        elif status_param == 'blocked':
            queryset = queryset.filter(is_active=False)

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = AdminUserDetailSerializer(page, many=True, context={'request': request})
        return paginator.get_paginated_response(serializer.data)


class AdminUserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({'detail': 'User account not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AdminUserDetailSerializer(target_user, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({'detail': 'User account not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Prevent admin from deleting their own account
        if request.user.id == target_user.id:
            return Response({
                'detail': 'You cannot delete your own administrator account.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Prevent non-superusers from deleting superuser accounts
        if target_user.is_superuser and not request.user.is_superuser:
            return Response({
                'detail': 'Superuser accounts can only be deleted by a superadministrator.'
            }, status=status.HTTP_403_FORBIDDEN)

        user_email = target_user.email

        # Clean up profile image if exists
        if target_user.profile_image:
            try:
                target_user.profile_image.delete(save=False)
            except Exception:
                pass

        target_user.delete()

        return Response({
            'message': f"User account for {user_email} has been permanently deleted."
        }, status=status.HTTP_200_OK)


class AdminUserToggleBlockView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def post(self, request, pk):
        target_user = User.objects.filter(pk=pk).first()
        if not target_user:
            return Response({'detail': 'User account not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Prevent blocking own account
        if request.user.id == target_user.id:
            return Response({
                'detail': 'You cannot block your own administrator account.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Prevent non-superuser staff from blocking superusers
        if target_user.is_superuser and not request.user.is_superuser:
            return Response({
                'detail': 'Superuser accounts can only be modified by a superadministrator.'
            }, status=status.HTTP_403_FORBIDDEN)

        target_user.is_active = not target_user.is_active
        target_user.save(update_fields=['is_active'])

        action = "unblocked" if target_user.is_active else "blocked"
        serializer = AdminUserDetailSerializer(target_user, context={'request': request})

        return Response({
            'user': serializer.data,
            'message': f"Account for {target_user.email} has been successfully {action}."
        }, status=status.HTTP_200_OK)


class GoogleConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        client_id = getattr(settings, 'GOOGLE_CLIENT_ID', os.getenv('GOOGLE_CLIENT_ID', '')).strip()
        
        # Dynamically determine the redirect_uri based on the incoming request Origin or Referer
        origin = request.headers.get('Origin') or request.headers.get('Referer', '')
        if origin:
            from urllib.parse import urlparse
            parsed = urlparse(origin)
            base_origin = f"{parsed.scheme}://{parsed.netloc}"
            redirect_uri = f"{base_origin}/auth/google/callback"
        else:
            redirect_uri = getattr(settings, 'GOOGLE_REDIRECT_URI', os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5173/auth/google/callback')).strip()

        is_configured = bool(client_id and not client_id.startswith('your-google'))
        return Response({
            'google_client_id': client_id if is_configured else '',
            'google_redirect_uri': redirect_uri,
            'is_configured': is_configured
        })


class GoogleAuthView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        import requests as http_requests

        serializer = GoogleAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        raw_token = serializer.validated_data.get('token', '').strip()
        code = serializer.validated_data.get('code', '').strip()
        req_redirect_uri = serializer.validated_data.get('redirect_uri', '').strip()

        client_id = getattr(settings, 'GOOGLE_CLIENT_ID', os.getenv('GOOGLE_CLIENT_ID', '')).strip()
        client_secret = getattr(settings, 'GOOGLE_CLIENT_SECRET', os.getenv('GOOGLE_CLIENT_SECRET', '')).strip()
        default_redirect_uri = getattr(settings, 'GOOGLE_REDIRECT_URI', os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5173/auth/google/callback')).strip()
        redirect_uri = req_redirect_uri or default_redirect_uri
        is_configured = bool(client_id and not client_id.startswith('your-google'))

        test_mode = os.getenv('GOOGLE_TEST_MODE', 'False').lower() in ('true', '1') or getattr(settings, 'TESTING', False)

        email = None
        first_name = 'Google'
        last_name = ''

        # Mock / Test Mode Bypass
        if test_mode and (raw_token.startswith('test_mock_') or raw_token.startswith('mock_token_')):
            mock_email = request.data.get('email') or 'google.testuser@deport-atelier.com'
            email = mock_email.lower().strip()
            first_name = request.data.get('first_name', 'Google')
            last_name = request.data.get('last_name', 'Tester')
        else:
            if not is_configured and not test_mode:
                return Response({
                    'detail': 'Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID in the backend environment variables.'
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

            # A. Authorization Code Exchange
            auth_code = code if code else (raw_token if (raw_token.startswith('4/') or ('.' not in raw_token and not raw_token.startswith('ya29.'))) else None)

            if auth_code and client_secret:
                try:
                    token_resp = http_requests.post(
                        'https://oauth2.googleapis.com/token',
                        data={
                            'code': auth_code,
                            'client_id': client_id,
                            'client_secret': client_secret,
                            'redirect_uri': redirect_uri,
                            'grant_type': 'authorization_code'
                        },
                        timeout=10
                    )
                    if token_resp.status_code == 200:
                        token_payload = token_resp.json()
                        if token_payload.get('id_token'):
                            raw_token = token_payload['id_token']
                        elif token_payload.get('access_token'):
                            raw_token = token_payload['access_token']
                except Exception:
                    pass

            if test_mode and (raw_token.startswith('test_mock_') or raw_token.startswith('mock_token_')):
                mock_email = request.data.get('email') or 'google.testuser@deport-atelier.com'
                email = mock_email.lower().strip()
                first_name = request.data.get('first_name', 'Google')
                last_name = request.data.get('last_name', 'Tester')

            # B. ID Token Verification (JWT or Mock)
            if not email and raw_token and GOOGLE_AUTH_AVAILABLE:
                id_info = None
                try:
                    target_audience = client_id if is_configured else None
                    id_info = id_token.verify_oauth2_token(
                        raw_token,
                        google_requests.Request(),
                        target_audience
                    )
                except Exception:
                    try:
                        # Fallback without audience restriction
                        id_info = id_token.verify_oauth2_token(
                            raw_token,
                            google_requests.Request()
                        )
                    except Exception:
                        id_info = None

                if id_info is not None:
                    # Validate issuer
                    if id_info.get('iss') not in ['accounts.google.com', 'https://accounts.google.com']:
                        return Response({'detail': 'Invalid Google token issuer.'}, status=status.HTTP_400_BAD_REQUEST)

                    # Validate verified email
                    if not id_info.get('email_verified', False):
                        return Response({'detail': 'Google email address is not verified.'}, status=status.HTTP_400_BAD_REQUEST)

                    email = id_info.get('email')
                    if not email:
                        return Response({'detail': 'Google token did not provide an email address.'}, status=status.HTTP_400_BAD_REQUEST)

                    email = email.lower().strip()
                    first_name = id_info.get('given_name') or id_info.get('name', 'Google')
                    last_name = id_info.get('family_name', '')

            # C. Fallback Google Tokeninfo Endpoint
            if not email and raw_token and raw_token.count('.') == 2:
                try:
                    ti_resp = http_requests.get(
                        f'https://oauth2.googleapis.com/tokeninfo?id_token={raw_token}',
                        timeout=5
                    )
                    if ti_resp.status_code == 200:
                        ti_data = ti_resp.json()
                        if ti_data.get('email') and str(ti_data.get('email_verified', '')).lower() in ('true', '1'):
                            email = ti_data.get('email', '').lower().strip()
                            first_name = ti_data.get('given_name') or ti_data.get('name', 'Google')
                            last_name = ti_data.get('family_name', '')
                except Exception:
                    pass

            # D. OAuth2 Access Token via UserInfo API
            if not email and raw_token:
                try:
                    userinfo_resp = http_requests.get(
                        'https://www.googleapis.com/oauth2/v3/userinfo',
                        headers={'Authorization': f'Bearer {raw_token}'},
                        timeout=5
                    )
                    if userinfo_resp.status_code == 200:
                        info = userinfo_resp.json()
                        if info.get('email') and info.get('email_verified', False):
                            email = info.get('email', '').lower().strip()
                            first_name = info.get('given_name') or info.get('name', 'Google')
                            last_name = info.get('family_name', '')
                except Exception:
                    pass

        if not email:
            return Response({
                'detail': 'Google token verification failed. The provided credential was invalid, expired, or lacked a verified email.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Safe user lookup & linking
        user = User.objects.filter(email=email).first()

        if user:
            # Enforce that suspended/blocked accounts CANNOT log in via Google
            if not user.is_active:
                return Response({
                    'detail': 'This account has been deactivated or suspended. Please contact customer support.'
                }, status=status.HTTP_403_FORBIDDEN)

            # Safe account linking
            updated_fields = []
            if not user.is_email_verified:
                user.is_email_verified = True
                updated_fields.append('is_email_verified')
            if not user.first_name and first_name:
                user.first_name = first_name
                updated_fields.append('first_name')
            if not user.last_name and last_name:
                user.last_name = last_name
                updated_fields.append('last_name')
            if updated_fields:
                user.save(update_fields=updated_fields + ['updated_at'])
        else:
            # Create new user for verified Google account
            user = User.objects.create_user(
                email=email,
                first_name=first_name,
                last_name=last_name,
                auth_provider='google',
                is_email_verified=True,
                is_active=True
            )

        # Check Two-Factor Authentication if enabled
        if user.is_two_factor_enabled:
            otp_code = user.generate_two_factor_otp()
            try:
                from django.core.mail import send_mail
                subject = "DEPORT - Two-Step Verification Code"
                message = f"Hello {user.first_name or 'there'},\n\nYour 6-digit DEPORT Two-Step Verification code is: {otp_code}\n\nThis code will expire in 10 minutes.\n\nBest regards,\nDEPORT Atelier Team"
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@deport.com'),
                    recipient_list=[user.email],
                    fail_silently=True
                )
            except Exception:
                pass

            return Response({
                'requires_two_step': True,
                'email': user.email,
                'otp_code': otp_code if is_test_environment() else None,
                'message': 'Two-step verification code sent to your email.'
            }, status=status.HTTP_200_OK)

        update_last_login(None, user)
        tokens = get_tokens_for_user(user)
        user_data = UserSerializer(user, context={'request': request}).data

        return Response({
            'user': user_data,
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'message': 'Google authentication successful.'
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        if serializer.is_valid():
            try:
                refresh_token = serializer.validated_data['refresh']
                token = RefreshToken(refresh_token)
                token.blacklist()
                return Response({'detail': "You've been logged out successfully."}, status=status.HTTP_200_OK)
            except Exception:
                return Response({'detail': 'Invalid or expired token.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            updated_user = UserSerializer(request.user, context={'request': request}).data
            return Response(updated_user, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request):
        return self.patch(request)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            return Response({'message': 'Password updated successfully.'}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TwoFactorVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = TwoFactorVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        code = serializer.validated_data['code'].strip()

        user = User.objects.filter(email=email).first()
        if not user:
            return Response({'detail': 'User account not found.'}, status=status.HTTP_404_NOT_FOUND)

        success, msg = user.verify_two_factor_otp(code)
        if not success:
            return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)

        update_last_login(None, user)
        tokens = get_tokens_for_user(user)
        user_data = UserSerializer(user, context={'request': request}).data

        return Response({
            'user': user_data,
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'message': 'Two-step verification successful. Logged in.'
        }, status=status.HTTP_200_OK)


class ToggleTwoFactorView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ToggleTwoFactorSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        is_enabled = serializer.validated_data['is_two_factor_enabled']
        request.user.is_two_factor_enabled = is_enabled
        request.user.save(update_fields=['is_two_factor_enabled'])

        status_text = "enabled" if is_enabled else "disabled"
        return Response({
            'is_two_factor_enabled': request.user.is_two_factor_enabled,
            'message': f'Two-step verification has been {status_text}.'
        }, status=status.HTTP_200_OK)


class ForgotPasswordRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ForgotPasswordRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        user = User.objects.filter(email=email).first()

        if user:
            code = user.generate_reset_password_otp()
            send_deport_otp_email(
                email=user.email,
                code=code,
                first_name=user.first_name,
                subject="DEPORT - Password Reset Code"
            )

        return Response({
            'message': 'If an account exists with this email address, a verification code has been sent.',
            'email': email
        }, status=status.HTTP_200_OK)


class ForgotPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = ForgotPasswordResetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower().strip()
        code = serializer.validated_data['code'].strip()
        new_password = serializer.validated_data['new_password']

        user = User.objects.filter(email=email).first()
        if not user:
            return Response({'detail': 'Account not found.'}, status=status.HTTP_404_NOT_FOUND)

        success, msg = user.verify_reset_password_otp(code)
        if not success:
            return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from django.contrib.auth.password_validation import validate_password
            validate_password(new_password, user=user)
        except Exception as e:
            return Response({'new_password': list(e.messages) if hasattr(e, 'messages') else [str(e)]}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.clear_reset_password_otp()
        user.save()

        return Response({
            'message': 'Your password has been successfully reset. Please log in with your new password.'
        }, status=status.HTTP_200_OK)


class RequestEmailChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RequestEmailChangeSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_email = serializer.validated_data['new_email']
        code = request.user.generate_email_change_otp(new_email)

        send_deport_otp_email(
            email=new_email,
            code=code,
            first_name=request.user.first_name,
            subject="DEPORT - Email Change Verification Code"
        )

        return Response({
            'message': f'Verification code sent to {new_email}.',
            'pending_email': new_email
        }, status=status.HTTP_200_OK)


class VerifyEmailChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = VerifyEmailChangeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        code = serializer.validated_data['code'].strip()
        success, msg = request.user.verify_email_change_otp(code)
        if not success:
            return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)

        user_data = UserSerializer(request.user, context={'request': request}).data
        return Response({
            'user': user_data,
            'message': 'Email address updated successfully.'
        }, status=status.HTTP_200_OK)

