import re
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower
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
                violation_error_message='Category already exists.'
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
                raise ValidationError({'name': 'Category already exists.'})

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
