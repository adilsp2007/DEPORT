# Generated for 2FA, Email Change OTP, and Password Reset OTP

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_user_is_email_verified_user_otp_code_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='auth_provider',
            field=models.CharField(
                choices=[('email', 'Email'), ('google', 'Google'), ('facebook', 'Facebook')],
                default='email',
                max_length=20
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='is_two_factor_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='pending_email',
            field=models.EmailField(blank=True, max_length=254, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='email_change_otp',
            field=models.CharField(blank=True, max_length=6, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='email_change_otp_created_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='reset_password_otp',
            field=models.CharField(blank=True, max_length=6, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='reset_password_otp_created_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
