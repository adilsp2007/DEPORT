from django.db import models
from django.conf import settings


class Address(models.Model):
    LABEL_CHOICES = (
        ('Home', 'Home'),
        ('Office', 'Office'),
        ('Other', 'Other'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='addresses')
    label = models.CharField(max_length=50, choices=LABEL_CHOICES, default='Home')
    full_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=30)
    address_line_1 = models.CharField(max_length=255)
    address_line_2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100, default='United States')
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Address'
        verbose_name_plural = 'Addresses'
        ordering = ['-is_default', '-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user'],
                condition=models.Q(is_default=True),
                name='one_default_address_per_user'
            )
        ]

    def __str__(self):
        return f"{self.label} - {self.full_name} ({self.city})"

    def save(self, *args, **kwargs):
        if self.is_default:
            Address.objects.filter(user=self.user, is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)
