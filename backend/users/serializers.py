from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import NewsletterSubscriber
import os

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

    def validate_email(self, value):
        if value:
            email = value.lower().strip()
            if User.objects.exclude(pk=self.instance.pk).filter(email=email).exists():
                raise serializers.ValidationError("An account with this email address already exists.")
            return email
        return value

    def validate_phone(self, value):
        if value:
            cleaned = value.strip()
            if len(cleaned) > 30:
                raise serializers.ValidationError("Phone number cannot exceed 30 characters.")
            return cleaned
        return value

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

        return super().update(instance, validated_data)


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    full_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=True)

    def validate_email(self, value):
        email = value.lower().strip()
        existing = User.objects.filter(email=email).first()
        if existing:
            if existing.is_email_verified:
                raise serializers.ValidationError("An account with this email address already exists. Please log in.")
            raise serializers.ValidationError("An account with this email address is pending verification. Please enter your verification code or log in.")
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
            existing_unverified.set_password(validated_data['password'])
            existing_unverified.auth_provider = 'email'
            existing_unverified.is_active = True
            existing_unverified.save()
            return existing_unverified

        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            auth_provider='email',
            is_active=True
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

