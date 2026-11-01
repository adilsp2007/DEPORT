from django.db import models
from django.conf import settings
from products.models import Product


class Wishlist(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='wishlist_items'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='in_wishlists'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Wishlist Item'
        verbose_name_plural = 'Wishlist Items'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'product'],
                name='unique_user_product_wishlist'
            )
        ]
        indexes = [
            models.Index(fields=['user', 'product']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.product.name}"
