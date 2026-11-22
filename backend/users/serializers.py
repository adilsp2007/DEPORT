from rest_framework import serializers# pyrefly: ignore[missing-import]
from django.contrib.auth import get_user_model# pyrefly: ignore[missing-import]
from django.contrib.auth.password_validation import validate_password# pyrefly: ignore[missing-import]
from django.core.exceptions import ValidationError as DjangoValidationError # pyrefly: ignore[missing-import]

from .models import NewsletterSubscriber
import os
import re

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = (
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'phone', 'profile_image', 'auth_provider', 'is_two_factor_enabled',
            'is_active', 'is_staff', 'is_superuser', 'last_login', 'created_at'
        )
        read_only_fields = ('id', 'email', 'auth_provider', 'is_active', 'is_staff', 'is_superuser', 'last_login', 'created_at')


class AdminUserDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = (
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'phone', 'profile_image', 'auth_provider', 'is_email_verified',
            'is_active', 'is_staff', 'is_superuser', 'last_login', 'created_at', 'updated_at'
        )
        read_only_fields = fields


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    remove_image = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'email', 'phone', 'profile_image', 'remove_image')
        read_only_fields = ('is_email_verified', 'is_active', 'is_staff', 'is_superuser', 'auth_provider')

    def validate_first_name(self, value):
        if value is not None:
            cleaned = str(value).strip()
            if not cleaned:
                raise serializers.ValidationError("First name cannot be blank.")
            if len(cleaned) < 2:
                raise serializers.ValidationError("First name must be at least 2 characters long.")
            if len(cleaned) > 150:
                raise serializers.ValidationError("First name cannot exceed 150 characters.")
            if not re.search(r'[a-zA-Z]', cleaned):
                raise serializers.ValidationError("First name must contain letters.")
            if re.search(r'[<>{}[\]\\\/=+_*^%$#@!~`|]', cleaned):
                raise serializers.ValidationError("First name contains invalid characters.")
            return cleaned
        return value

    def validate_last_name(self, value):
        if value is not None:
            cleaned = str(value).strip()
            if cleaned:
                if len(cleaned) > 150:
                    raise serializers.ValidationError("Last name cannot exceed 150 characters.")
                if not re.search(r'[a-zA-Z]', cleaned):
                    raise serializers.ValidationError("Last name must contain letters.")
                if re.search(r'[<>{}[\]\\\/=+_*^%$#@!~`|]', cleaned):
                    raise serializers.ValidationError("Last name contains invalid characters.")
            return cleaned
        return value

    def validate_email(self, value):
        if value:
            email = value.lower().strip()
            from django.core.validators import validate_email as django_validate_email
            from django.core.exceptions import ValidationError as DjangoValidationError
            try:
                django_validate_email(email)
            except DjangoValidationError:
                raise serializers.ValidationError("Enter a valid email address.")

            parts = email.split('@')
            if len(parts) != 2 or not parts[0] or not parts[1]:
                raise serializers.ValidationError("Enter a valid email address.")

            domain = parts[1]
            if '.' not in domain or domain.startswith('.') or domain.endswith('.'):
                raise serializers.ValidationError("Enter a valid email address with a valid domain.")

            domain_parts = domain.split('.')
            if any(not p for p in domain_parts) or len(domain_parts[-1]) < 2:
                raise serializers.ValidationError("Enter a valid email address with a valid top-level domain.")

            if User.objects.exclude(pk=self.instance.pk).filter(email=email).exists():
                raise serializers.ValidationError("An account with this email address already exists.")
            return email
        return value

    def validate_phone(self, value):
        if value is None or str(value).strip() == "":
            raise serializers.ValidationError("Phone number is required.")

        raw = str(value).strip()

        # Reject alphabets
        if re.search(r'[a-zA-Z]', raw):
            raise serializers.ValidationError("Phone number cannot contain alphabets.")

        # Reject invalid special characters (allow optional +, digits, spaces, hyphens, parentheses)
        if not re.match(r'^\+?[0-9\s\-()]+$', raw):
            raise serializers.ValidationError("Phone number contains invalid special characters.")

        # Extract digits
        digits = re.sub(r'\D', '', raw)

        has_plus_91 = False
        if raw.startswith('+91'):
            has_plus_91 = True
            if len(digits) < 12:
                raise serializers.ValidationError("Phone number must contain exactly 10 digits after +91.")
            if len(digits) > 12:
                raise serializers.ValidationError("Phone number cannot exceed 10 digits after +91.")
            mobile_digits = digits[2:]
        elif raw.startswith('91') and len(digits) == 12:
            has_plus_91 = True
            mobile_digits = digits[2:]
        elif len(digits) == 10:
            mobile_digits = digits
        elif len(digits) < 10:
            raise serializers.ValidationError("Phone number must contain exactly 10 digits.")
        else:
            raise serializers.ValidationError("Phone number cannot exceed 10 digits (excluding +91 country code).")

        # Indian mobile numbers must start with 6, 7, 8, or 9
        if mobile_digits[0] not in ('6', '7', '8', '9'):
            raise serializers.ValidationError("Indian mobile numbers must start with 6, 7, 8, or 9.")

        # Reject dummy repeating digits (e.g. 0000000000)
        if len(set(mobile_digits)) <= 1:
            raise serializers.ValidationError("Please enter a valid, active mobile number.")

        # Uniqueness check: reject if already registered to another account
        if self.instance:
            from django.db.models import Q
            existing = User.objects.exclude(pk=self.instance.pk).filter(
                Q(phone=mobile_digits) |
                Q(phone=f"+91{mobile_digits}") |
                Q(phone=f"+91 {mobile_digits}") |
                Q(phone__endswith=mobile_digits)
            ).first()
            if existing:
                raise serializers.ValidationError("This phone number is already registered to another account.")

        return f"+91{mobile_digits}" if has_plus_91 else mobile_digits

    def validate_profile_image(self, value):
        if value:
            # Validate max file size (5 MB)
            max_size = 5 * 1024 * 1024
            if value.size > max_size:
                raise serializers.ValidationError("Profile image file size cannot exceed 5 MB.")

            # Validate file extension
            ext = os.path.splitext(value.name)[1].lower()
            valid_extensions = ['.jpg', '.jpeg', '.png', '.webp']
            if ext not in valid_extensions:
                raise serializers.ValidationError("Unsupported image format. Allowed formats: JPG, JPEG, PNG, WEBP.")
        return value

    def update(self, instance, validated_data):
        remove_image = validated_data.pop('remove_image', False)

        if remove_image:
            if instance.profile_image:
                instance.profile_image.delete(save=False)
            instance.profile_image = None

        new_email = validated_data.get('email')
        if new_email and new_email != instance.email:
            # When email changes, require re-verification
            instance.is_email_verified = False
            instance.otp_code = None
            instance.otp_created_at = None

        # Prevent mass-assignment of protected security fields
        for field in ('is_email_verified', 'is_active', 'is_staff', 'is_superuser', 'auth_provider'):
            validated_data.pop(field, None)

        return super().update(instance, validated_data)


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True, default='')
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate_phone(self, value):
        if not value or not str(value).strip():
            return ''
        raw = str(value).strip()
        cleaned_str = re.sub(r'[\s\-()]+', '', raw)
        if re.search(r'[a-zA-Z]', cleaned_str):
            raise serializers.ValidationError("Phone number must not contain letters.")
        if re.search(r'[<>{}[\]\\\/=+_*^%$#@!~`|]', cleaned_str):
            raise serializers.ValidationError("Phone number contains invalid special characters.")

        digits = re.sub(r'\D', '', raw)
        has_plus_91 = False
        if raw.startswith('+91'):
            has_plus_91 = True
            if len(digits) < 12:
                raise serializers.ValidationError("Phone number must contain exactly 10 digits after +91.")
            if len(digits) > 12:
                raise serializers.ValidationError("Phone number cannot exceed 10 digits after +91.")
            mobile_digits = digits[2:]
        elif raw.startswith('91') and len(digits) == 12:
            has_plus_91 = True
            mobile_digits = digits[2:]
        elif len(digits) == 10:
            mobile_digits = digits
        elif len(digits) < 10:
            raise serializers.ValidationError("Phone number must contain exactly 10 digits.")
        else:
            raise serializers.ValidationError("Phone number cannot exceed 10 digits (excluding +91 country code).")

        if mobile_digits[0] not in ('6', '7', '8', '9'):
            raise serializers.ValidationError("Indian mobile numbers must start with 6, 7, 8, or 9.")

        if len(set(mobile_digits)) <= 1:
            raise serializers.ValidationError("Please enter a valid, active mobile number.")

        from django.db.models import Q
        existing = User.objects.filter(is_email_verified=True).filter(
            Q(phone=mobile_digits) |
            Q(phone=f"+91{mobile_digits}") |
            Q(phone=f"+91 {mobile_digits}") |
            Q(phone__endswith=mobile_digits)
        ).first()
        if existing:
            raise serializers.ValidationError("This phone number is already registered to another account.")

        return f"+91{mobile_digits}" if has_plus_91 else mobile_digits

    def validate_email(self, value):
        if not value or not isinstance(value, str):
            raise serializers.ValidationError("Email address is required.")

        email = value.lower().strip()
        if not email:
            raise serializers.ValidationError("Email address cannot be blank.")

        from django.core.validators import validate_email as django_validate_email
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            django_validate_email(email)
        except DjangoValidationError:
            raise serializers.ValidationError("Enter a valid email address.")

        parts = email.split('@')
        if len(parts) != 2 or not parts[0] or not parts[1]:
            raise serializers.ValidationError("Enter a valid email address.")

        domain = parts[1]
        if '.' not in domain or domain.startswith('.') or domain.endswith('.'):
            raise serializers.ValidationError("Enter a valid email address with a valid domain.")

        domain_parts = domain.split('.')
        if any(not p for p in domain_parts) or len(domain_parts[-1]) < 2:
            raise serializers.ValidationError("Enter a valid email address with a valid top-level domain.")

        existing = User.objects.filter(email=email).first()
        if existing and existing.is_email_verified:
            raise serializers.ValidationError("An account with this email address already exists. Please log in.")
        return email

    def validate(self, attrs):
        first_name = attrs.get('first_name', '').strip()
        last_name = attrs.get('last_name', '').strip()
        full_name_val = (attrs.get('full_name') or attrs.get('name') or '').strip()

        if not first_name:
            if full_name_val:
                parts = full_name_val.split(None, 1)
                first_name = parts[0]
                last_name = parts[1] if len(parts) > 1 else ''
            else:
                raise serializers.ValidationError({"first_name": "First name or full name is required."})

        attrs['first_name'] = first_name
        attrs['last_name'] = last_name
        attrs.pop('name', None)
        attrs.pop('full_name', None)

        password = attrs.get('password')
        confirm_password = attrs.get('confirm_password')

        if password != confirm_password:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        user_obj = User(
            email=attrs.get('email'),
            first_name=attrs.get('first_name'),
            last_name=attrs.get('last_name')
        )
        try:
            validate_password(password=password, user=user_obj)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})

        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password', None)
        email = validated_data['email']

        # If user registered earlier but never completed email verification, update their details
        existing_unverified = User.objects.filter(email=email, is_email_verified=False).first()
        if existing_unverified:
            existing_unverified.first_name = validated_data.get('first_name', existing_unverified.first_name)
            existing_unverified.last_name = validated_data.get('last_name', existing_unverified.last_name)
            if validated_data.get('phone'):
                existing_unverified.phone = validated_data.get('phone')
            existing_unverified.set_password(validated_data['password'])
            existing_unverified.auth_provider = 'email'
            existing_unverified.is_active = False
            existing_unverified.is_email_verified = False
            existing_unverified.save()
            return existing_unverified

        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            phone=validated_data.get('phone', ''),
            auth_provider='email',
            is_active=False,
            is_email_verified=False
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(
        required=True,
        error_messages={
            'required': 'Email address is required.',
            'blank': 'Email address cannot be empty.',
            'invalid': 'Please enter a valid email address.'
        }
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        error_messages={
            'required': 'Password is required.',
            'blank': 'Password cannot be empty.'
        }
    )


class AdminLoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)


class GoogleAuthSerializer(serializers.Serializer):
    token = serializers.CharField(required=False, allow_blank=True)
    credential = serializers.CharField(required=False, allow_blank=True)
    code = serializers.CharField(required=False, allow_blank=True)
    access_token = serializers.CharField(required=False, allow_blank=True)
    id_token = serializers.CharField(required=False, allow_blank=True)
    redirect_uri = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        raw_token = (
            attrs.get('token') or
            attrs.get('credential') or
            attrs.get('code') or
            attrs.get('access_token') or
            attrs.get('id_token')
        )
        if not raw_token or not str(raw_token).strip():
            raise serializers.ValidationError({"token": "Google ID token, credential, or authorization code is required."})
        attrs['token'] = str(raw_token).strip()

        # Preserve explicit code or redirect_uri if provided
        if attrs.get('code'):
            attrs['code'] = str(attrs['code']).strip()
        if attrs.get('redirect_uri'):
            attrs['redirect_uri'] = str(attrs['redirect_uri']).strip()
        return attrs


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=True)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Your current password is incorrect.")
        return value

    def validate(self, attrs):
        new_password = attrs.get('new_password')
        confirm_password = attrs.get('confirm_password')

        if new_password != confirm_password:
            raise serializers.ValidationError({"confirm_password": "New passwords do not match."})

        user = self.context['request'].user
        try:
            validate_password(password=new_password, user=user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"new_password": list(e.messages)})

        return attrs


class NewsletterSubscriberSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsletterSubscriber
        fields = ('id', 'email', 'is_active', 'created_at')



class ForgotPasswordRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class ForgotPasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    code = serializers.CharField(required=True, min_length=6, max_length=6)
    new_password = serializers.CharField(required=True, min_length=8, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs.get('new_password') != attrs.get('confirm_password'):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs


class RequestEmailChangeSerializer(serializers.Serializer):
    new_email = serializers.EmailField(required=True)

    def validate_new_email(self, value):
        email = value.lower().strip()
        request = self.context.get('request')
        current_user = getattr(request, 'user', None)

        if current_user and current_user.email == email:
            raise serializers.ValidationError("The new email must be different from your current email.")

        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError("An account with this email address already exists.")

        return email


class VerifyEmailChangeSerializer(serializers.Serializer):
    code = serializers.CharField(required=True, min_length=6, max_length=6)


class TwoFactorVerifySerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    code = serializers.CharField(required=True, min_length=6, max_length=6)


class ToggleTwoFactorSerializer(serializers.Serializer):
    is_two_factor_enabled = serializers.BooleanField(required=True)

