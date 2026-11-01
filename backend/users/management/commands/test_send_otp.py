from django.core.management.base import BaseCommand
from django.conf import settings
from users.views import send_deport_otp_email


class Command(BaseCommand):
    help = "Test sending an OTP email to a specified email address using current SMTP configuration"

    def add_arguments(self, parser):
        parser.add_argument(
            'email',
            nargs='?',
            default='amhd7858@gmail.com',
            help='Recipient email address to test (defaults to amhd7858@gmail.com)'
        )

    def handle(self, *args, **options):
        recipient = options['email'].strip()
        self.stdout.write(self.style.NOTICE(f"\n--- Testing DEPORT OTP Email Dispatch ---"))
        self.stdout.write(f"EMAIL_BACKEND:       {settings.EMAIL_BACKEND}")
        self.stdout.write(f"EMAIL_HOST:          {settings.EMAIL_HOST}:{settings.EMAIL_PORT}")
        self.stdout.write(f"EMAIL_USE_TLS:       {settings.EMAIL_USE_TLS}")
        self.stdout.write(f"EMAIL_HOST_USER:     {settings.EMAIL_HOST_USER}")
        self.stdout.write(f"EMAIL_HOST_PASSWORD: {'[CONFIGURED]' if settings.EMAIL_HOST_PASSWORD else '[EMPTY / NOT CONFIGURED]'}")
        self.stdout.write(f"DEFAULT_FROM_EMAIL:  {settings.DEFAULT_FROM_EMAIL}")
        self.stdout.write(f"Recipient Target:    {recipient}\n")

        if not settings.EMAIL_HOST_PASSWORD:
            self.stdout.write(self.style.ERROR(
                "ERROR: EMAIL_HOST_PASSWORD is empty in backend/.env!\n"
                "To send live emails with Gmail, generate a 16-character Google App Password at:\n"
                "  https://myaccount.google.com/apppasswords\n"
                "and set EMAIL_HOST_PASSWORD=xxxx xxxx xxxx xxxx in backend/.env"
            ))
            return

        self.stdout.write(f"Dispatching test OTP email to {recipient}...")
        success, message = send_deport_otp_email(
            email=recipient,
            code="123456",
            first_name="Test User",
            subject="DEPORT - Verification Code Test"
        )

        if success:
            self.stdout.write(self.style.SUCCESS(f"\nSUCCESS: Email delivered successfully to {recipient}!"))
        else:
            self.stdout.write(self.style.ERROR(f"\nFAILURE: {message}"))
