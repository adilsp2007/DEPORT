import re
from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone
from django.utils.text import slugify


class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True, db_index=True, blank=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='categories/', blank=True, null=True)
    image_url = models.URLField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Category'
        verbose_name_plural = 'Categories'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                Lower('name'),
                name='unique_category_name_case_insensitive',
                violation_error_message='Category with this name already exists.'
            )
        ]

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        if self.name:
            # Strip leading/trailing spaces and collapse multiple consecutive whitespace
            self.name = re.sub(r'\s+', ' ', self.name).strip()
            if not self.name:
                raise ValidationError({'name': 'Category name cannot be blank.'})

            qs = Category.objects.filter(name__iexact=self.name)
            if self.pk:
                qs = qs.exclude(pk=self.pk)
            if qs.exists():
                raise ValidationError({'name': 'Category with this name already exists.'})
        else:
            raise ValidationError({'name': 'Category name is required.'})

    def save(self, *args, **kwargs):
        if self.name:
            self.name = re.sub(r'\s+', ' ', self.name).strip()

        if not self.slug and self.name:
            base_slug = slugify(self.name) or 'category'
            slug = base_slug
            counter = 1
            while Category.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug

        self.full_clean()
        super().save(*args, **kwargs)


class CategoryOffer(models.Model):
    OFFER_TYPE_CHOICES = (
        ('percentage', 'Percentage'),
        ('fixed', 'Fixed Amount'),
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='offers',
        db_index=True
    )
    offer_type = models.CharField(
        max_length=20,
        choices=OFFER_TYPE_CHOICES,
        default='percentage',
        db_index=True
    )
    offer_value = models.DecimalField(max_digits=10, decimal_places=2)
    start_date = models.DateTimeField(db_index=True)
    end_date = models.DateTimeField(db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Category Offer'
        verbose_name_plural = 'Category Offers'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['category', 'is_active', 'start_date', 'end_date']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(offer_value__gt=0),
                name='category_offer_value_positive'
            ),
            models.CheckConstraint(
                check=models.Q(end_date__gt=models.F('start_date')),
                name='category_offer_end_after_start'
            ),
        ]

    def __str__(self):
        val_str = f"{self.offer_value}%" if self.offer_type == 'percentage' else f"₹{self.offer_value}"
        cat_name = self.category.name if self.category_id else 'Category'
        return f"{cat_name} Offer - {val_str}"

    @property
    def status(self):
        """Dynamic status: active, scheduled, expired, inactive"""
        if not self.is_active:
            return 'inactive'
        now = timezone.now()
        if now < self.start_date:
            return 'scheduled'
        elif now > self.end_date:
            return 'expired'
        return 'active'

    @property
    def is_currently_valid(self):
        now = timezone.now()
        return (
            self.is_active and
            self.start_date <= now <= self.end_date and
            self.category.is_active and
            not self.category.is_deleted
        )

    def calculate_discount(self, product_price):
        """
        Calculate discount amount for a given product price.
        Ensures final price never drops to zero or below (minimum ₹1.00).
        """
        if not product_price:
            return Decimal('0.00')
        price = Decimal(str(product_price))
        if price <= 0:
            return Decimal('0.00')

        if self.offer_type == 'percentage':
            pct = Decimal(str(self.offer_value))
            discount = (price * pct / Decimal('100')).quantize(Decimal('0.01'))
        else:
            discount = Decimal(str(self.offer_value)).quantize(Decimal('0.01'))

        # Ensure selling price stays positive (at least ₹1.00)
        max_allowed_discount = max(Decimal('0.00'), price - Decimal('1.00'))
        return min(discount, max_allowed_discount)

    def clean(self):
        super().clean()
        if not self.category_id:
            raise ValidationError({'category': 'Category is required.'})

        if not self.offer_type:
            raise ValidationError({'offer_type': 'Offer type is required.'})

        if self.offer_value is None or self.offer_value <= 0:
            raise ValidationError({'offer_value': 'Offer value must be greater than zero.'})

        if self.offer_type == 'percentage' and self.offer_value > 100:
            raise ValidationError({'offer_value': 'Percentage offer cannot exceed 100%.'})

        if self.start_date and self.end_date and self.end_date <= self.start_date:
            raise ValidationError({'end_date': 'End date must be later than start date.'})

        # Overlap check: Prevent duplicate or conflicting active offers for the same category
        if self.is_active and self.category_id and self.start_date and self.end_date:
            overlapping = CategoryOffer.objects.filter(
                category_id=self.category_id,
                is_active=True,
                start_date__lte=self.end_date,
                end_date__gte=self.start_date
            )
            if self.pk:
                overlapping = overlapping.exclude(pk=self.pk)
            if overlapping.exists():
                conflict = overlapping.first()
                cat_name = self.category.name if self.category_id else 'this category'
                raise ValidationError({
                    'category': f'An active offer for "{cat_name}" already exists between {conflict.start_date.strftime("%Y-%m-%d %H:%M")} and {conflict.end_date.strftime("%Y-%m-%d %H:%M")}.'
                })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
