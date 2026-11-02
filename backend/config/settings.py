import os
import sys
from pathlib import Path
from datetime import timedelta

TESTING = 'test' in sys.argv

BASE_DIR = Path(__file__).resolve().parent.parent

from dotenv import load_dotenv

# Load environment variables from .env if present
env_file = BASE_DIR / '.env'
if env_file.exists():
    load_dotenv(env_file, override=True)

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-deport-bag-store-key-development-2026')

DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = [h.strip() for h in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()]
# Custom User Model
AUTH_USER_MODEL = 'users.User'

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',

    # Local apps
    'users',
    'categories',
    'products',
    'addresses',
    'cart',
    'wishlist',
    'orders',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database Configuration
USE_POSTGRES = os.getenv('USE_POSTGRES', 'False').lower() in ('true', '1')

if USE_POSTGRES:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DATABASE_NAME', 'deport_db'),
            'USER': os.getenv('DATABASE_USER', 'postgres'),
            'PASSWORD': os.getenv('DATABASE_PASSWORD', 'postgres'),
            'HOST': os.getenv('DATABASE_HOST', 'localhost'),
            'PORT': os.getenv('DATABASE_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Email Configuration
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() in ('true', '1', 'yes')
EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'False').lower() in ('true', '1', 'yes')
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', 'amhd7858@gmail.com').strip()
email_host_pass = os.getenv('EMAIL_HOST_PASSWORD', '').strip().strip('"\'')
if 'gmail.com' in os.getenv('EMAIL_HOST', 'smtp.gmail.com').lower():
    email_host_pass = email_host_pass.replace(' ', '')
EMAIL_HOST_PASSWORD = email_host_pass
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', f'DEPORT Atelier <{EMAIL_HOST_USER or "amhd7858@gmail.com"}>').strip('"\'')
EMAIL_TIMEOUT = 10

# OTP Configuration
OTP_EXPIRY_MINUTES = int(os.getenv('OTP_EXPIRY_MINUTES', 5))
OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv('OTP_RESEND_COOLDOWN_SECONDS', 60))
MAX_OTP_ATTEMPTS = int(os.getenv('MAX_OTP_ATTEMPTS', 5))

# Google OAuth Settings
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '').strip()
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '').strip()
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5173/auth/google/callback').strip()

# Razorpay Payment Gateway Settings (Standard Checkout)
RAZORPAY_KEY_ID = os.getenv('RAZORPAY_KEY_ID', '').strip()
RAZORPAY_KEY_SECRET = os.getenv('RAZORPAY_KEY_SECRET', '').strip()
RAZORPAY_WEBHOOK_SECRET = os.getenv('RAZORPAY_WEBHOOK_SECRET', '').strip()
RAZORPAY_CURRENCY = os.getenv('RAZORPAY_CURRENCY', 'INR').strip()

# CORS Settings
frontend_origins = os.getenv('FRONTEND_URL', 'http://localhost:5173,http://localhost:5174').split(',')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in frontend_origins if origin.strip()]
CORS_ALLOW_ALL_ORIGINS = os.getenv('CORS_ALLOW_ALL', 'False').lower() == 'true'  # For dev convenience

# Cache Configuration (Fast In-Memory Cache for instant response)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'deport-cache-storage',
    }
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',
    ),
}

access_minutes = int(os.getenv('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', 15))
refresh_days = int(os.getenv('JWT_REFRESH_TOKEN_LIFETIME_DAYS', 7))

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=access_minutes),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=refresh_days),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# Google OAuth 2.0 Configuration
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '').strip()
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '').strip()
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5173/auth/google/callback').strip()

CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if o.strip()]

USE_HTTPS = os.getenv('USE_HTTPS', 'False').lower() == 'true'

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = USE_HTTPS
    SESSION_COOKIE_SECURE = USE_HTTPS
    CSRF_COOKIE_SECURE = USE_HTTPS