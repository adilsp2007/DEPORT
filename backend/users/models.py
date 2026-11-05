import secrets
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.contrib.auth.hashers import make_password, check_password


class UserManager(BaseUserManager):
    """Custom user manager where email is the unique identifier for authentication."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be provided')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_email_verified', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    AUTH_PROVIDER_CHOICES = (
        ('email', 'Email'),
        ('google', 'Google'),
    )

    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    profile_image = models.ImageField(upload_to='profiles/', blank=True, null=True)
    auth_provider = models.CharField(max_length=20, choices=AUTH_PROVIDER_CHOICES, default='email')

    is_email_verified = models.BooleanField(default=False)
    otp_code = models.CharField(max_length=128, blank=True, null=True)
    otp_created_at = models.DateTimeField(blank=True, null=True)
    otp_attempts = models.PositiveIntegerField(default=0)

    # Two-Step Verification (2FA)
    is_two_factor_enabled = models.BooleanField(default=False)

    # Email Edit Verification with OTP
    pending_email = models.EmailField(blank=True, null=True)
    email_change_otp = models.CharField(max_length=6, blank=True, null=True)
    email_change_otp_created_at = models.DateTimeField(blank=True, null=True)

    # Forgot / Reset Password with OTP
    reset_password_otp = models.CharField(max_length=6, blank=True, null=True)
    reset_password_otp_created_at = models.DateTimeField(blank=True, null=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

    def generate_otp(self):
        """
        Generates a cryptographically secure 6-digit numeric OTP,
        preserving leading zeros as a string. Stores a secure salted hash
        in the database, resets attempts, and sets the creation timestamp.
        """
        code = ''.join(secrets.choice('0123456789') for _ in range(6))
        self.otp_code = make_password(code)
        self.otp_created_at = timezone.now()
        self.otp_attempts = 0
        self.save(update_fields=['otp_code', 'otp_created_at', 'otp_attempts'])
        self._raw_otp = code
        return code

    def verify_otp(self, code):
        """
        Atomically verifies the provided OTP against the stored hash.
        Enforces configurable expiry (default 5 minutes) and maximum attempts (default 5).
        Atomically consumes the OTP upon successful verification.
        """
        clean_code = str(code).strip() if code is not None else ''
        if not self.otp_code or not clean_code:
            return False, "Invalid verification code. Please try again.", "INVALID"

        if len(clean_code) != 6 or not clean_code.isdigit():
            return False, "Invalid verification code format. Please enter a 6-digit number.", "INVALID_FORMAT"

        max_attempts = getattr(settings, 'MAX_OTP_ATTEMPTS', 5)
        if self.otp_attempts >= max_attempts:
            return False, "Too many failed attempts. This verification code has been invalidated. Please request a new code.", "TOO_MANY_ATTEMPTS"

        expiry_minutes = getattr(settings, 'OTP_EXPIRY_MINUTES', 5)
        if not self.otp_created_at or (timezone.now() - self.otp_created_at) > timedelta(minutes=expiry_minutes):
            return False, "This verification code has expired. Please request a new code.", "EXPIRED"

        is_match = False
        try:
            is_match = check_password(clean_code, self.otp_code)
        except Exception:
            is_match = False

        if not is_match and secrets.compare_digest(self.otp_code, clean_code):
            is_match = True

        if not is_match:
            self.otp_attempts += 1
            if self.otp_attempts >= max_attempts:
                self.otp_code = None
                self.save(update_fields=['otp_attempts', 'otp_code'])
                return False, "Too many failed attempts. This verification code has been invalidated. Please request a new code.", "TOO_MANY_ATTEMPTS"
            self.save(update_fields=['otp_attempts'])
            return False, "Invalid verification code. Please try again.", "INVALID"

        # Successful verification: atomically mark verified and consume OTP challenge
        self.is_email_verified = True
        self.is_active = True
        self.otp_code = None
        self.otp_created_at = None
        self.otp_attempts = 0
        self.save(update_fields=['is_email_verified', 'is_active', 'otp_code', 'otp_created_at', 'otp_attempts'])
        return True, "Email verified successfully.", "SUCCESS"

    def generate_two_factor_otp(self):
        code = ''.join(secrets.choice('0123456789') for _ in range(6))
        self.otp_code = make_password(code)
        self.otp_created_at = timezone.now()
        self.otp_attempts = 0
        self.save(update_fields=['otp_code', 'otp_created_at', 'otp_attempts'])
        self._raw_otp = code
        return code

    def verify_two_factor_otp(self, code):
        clean_code = str(code).strip() if code is not None else ''
        if not self.otp_code or not clean_code:
            return False, "Invalid two-step verification code."
        expiry_minutes = getattr(settings, 'OTP_EXPIRY_MINUTES', 5)
        if self.otp_created_at and (timezone.now() - self.otp_created_at) > timedelta(minutes=expiry_minutes):
            return False, "Two-step verification code has expired."
        is_match = False
        try:
            is_match = check_password(clean_code, self.otp_code)
        except Exception:
            is_match = False
        if not is_match and secrets.compare_digest(self.otp_code, clean_code):
            is_match = True
        if not is_match:
            return False, "Invalid verification code. Please check and try again."
        self.otp_code = None
        self.otp_created_at = None
        self.otp_attempts = 0
        self.save(update_fields=['otp_code', 'otp_created_at', 'otp_attempts'])
        return True, "Two-step verification successful."

    def generate_reset_password_otp(self):
        code = ''.join(secrets.choice('0123456789') for _ in range(6))
        self.reset_password_otp = code
        self.reset_password_otp_created_at = timezone.now()
        self.save(update_fields=['reset_password_otp', 'reset_password_otp_created_at'])
        return code

    def verify_reset_password_otp(self, code):
        if not self.reset_password_otp or not code:
            return False, "Invalid password reset code."
        if self.reset_password_otp_created_at and (timezone.now() - self.reset_password_otp_created_at) > timedelta(minutes=10):
            return False, "Password reset code has expired. Please request a new code."
        if self.reset_password_otp.strip() != str(code).strip():
            return False, "Invalid password reset code."
        return True, "Code verified."

    def clear_reset_password_otp(self):
        self.reset_password_otp = None
        self.reset_password_otp_created_at = None
        self.save(update_fields=['reset_password_otp', 'reset_password_otp_created_at'])

    def generate_email_change_otp(self, new_email):
        code = ''.join(secrets.choice('0123456789') for _ in range(6))
        self.pending_email = new_email.lower().strip()
        self.email_change_otp = code
        self.email_change_otp_created_at = timezone.now()
        self.save(update_fields=['pending_email', 'email_change_otp', 'email_change_otp_created_at'])
        return code

    def verify_email_change_otp(self, code):
        if not self.email_change_otp or not code or not self.pending_email:
            return False, "Invalid email verification request."
        if self.email_change_otp_created_at and (timezone.now() - self.email_change_otp_created_at) > timedelta(minutes=10):
            return False, "Verification code for email change has expired."
        if self.email_change_otp.strip() != str(code).strip():
            return False, "Invalid verification code."
        # Commit email update
        self.email = self.pending_email
        self.pending_email = None
        self.email_change_otp = None
        self.email_change_otp_created_at = None
        self.save(update_fields=['email', 'pending_email', 'email_change_otp', 'email_change_otp_created_at'])
        return True, "Email address updated successfully."



class NewsletterSubscriber(models.Model):
    email = models.EmailField(unique=True, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Newsletter Subscriber'
        verbose_name_plural = 'Newsletter Subscribers'

    def __str__(self):
        return self.email
