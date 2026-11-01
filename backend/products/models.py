from django.db import models
from django.utils.text import slugify
from categories.models import Category


class Product(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=280, unique=True, db_index=True, blank=True)
    description = models.TextField()
    short_description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    compare_at_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='products',
        db_index=True
    )
    brand = models.CharField(max_length=100, default='DEPORT')
    sku = models.CharField(max_length=100, unique=True, db_index=True)
    stock_quantity = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    is_new = models.BooleanField(default=False, db_index=True)
    is_best_seller = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Product'
        verbose_name_plural = 'Products'
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(check=models.Q(price__gte=0), name='product_price_non_negative'),
            models.CheckConstraint(check=models.Q(compare_at_price__gte=0) | models.Q(compare_at_price__isnull=True), name='product_compare_price_non_negative'),
            models.CheckConstraint(check=models.Q(stock_quantity__gte=0), name='product_stock_non_negative'),
        ]
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['sku']),
            models.Index(fields=['is_active', 'is_featured']),
            models.Index(fields=['is_active', 'is_new']),
            models.Index(fields=['is_active', 'is_best_seller']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return self.name

    @property
    def original_price(self):
        """Returns original MSRP/compare price if available, else regular price."""
        return self.compare_at_price if self.compare_at_price and self.compare_at_price > self.price else None

    @property
    def discounted_price(self):
        """Returns current final selling price."""
        return self.price

    @property
    def has_discount(self):
        """True if original compare_at_price is greater than current selling price."""
        if self.compare_at_price is not None and self.price is not None:
            return bool(self.compare_at_price > self.price and self.price >= 0)
        return False

    @property
    def discount_percentage(self):
        """
        Calculates discount percentage:
        ((original_price - discounted_price) / original_price) * 100
        Rounded to a whole number. Returns 0 if no discount.
        """
        if self.has_discount and self.compare_at_price and self.compare_at_price > 0:
            diff = self.compare_at_price - self.price
            pct = (diff / self.compare_at_price) * 100
            return int(round(float(pct)))
        return 0

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.price is not None and self.price < 0:
            raise ValidationError({'price': 'Price cannot be negative.'})
        if self.compare_at_price is not None and self.compare_at_price < 0:
            raise ValidationError({'compare_at_price': 'Original price cannot be negative.'})
        if self.compare_at_price is not None and self.price is not None:
            if self.compare_at_price > 0 and self.price > self.compare_at_price:
                raise ValidationError({'price': 'Discounted selling price cannot exceed the original price.'})
        super().clean()

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or 'product'
            slug = base_slug
            counter = 1
            while Product.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    image_url = models.URLField(max_length=500, blank=True)
    alt_text = models.CharField(max_length=255, blank=True)
    is_primary = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Product Image'
        verbose_name_plural = 'Product Images'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f"Image for {self.product.name}"


class Banner(models.Model):
    PLACEMENT_CHOICES = (
        ('hero', 'Hero Section'),
        ('promotional', 'Promotional Banner'),
        ('secondary', 'Secondary Banner'),
    )

    title = models.CharField(max_length=255)
    subtitle = models.TextField(blank=True)
    tagline = models.CharField(max_length=150, blank=True)
    image = models.ImageField(upload_to='banners/', blank=True, null=True)
    image_url = models.URLField(max_length=500, blank=True)
    button_text = models.CharField(max_length=100, default='Shop Collection')
    button_link = models.CharField(max_length=255, default='/shop')
    secondary_button_text = models.CharField(max_length=100, blank=True)
    secondary_button_link = models.CharField(max_length=255, blank=True)
    placement = models.CharField(max_length=50, choices=PLACEMENT_CHOICES, default='hero', db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    display_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Banner'
        verbose_name_plural = 'Banners'
        ordering = ['display_order', '-created_at']

    def __str__(self):
        return f"{self.get_placement_display()} - {self.title}"
