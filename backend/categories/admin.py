import re
from django import forms
from django.contrib import admin
from .models import Category


class CategoryAdminForm(forms.ModelForm):
    class Meta:
        model = Category
        fields = '__all__'

    def clean_name(self):
        name = self.cleaned_data.get('name', '')
        cleaned_name = re.sub(r'\s+', ' ', name).strip()
        if not cleaned_name:
            raise forms.ValidationError("Category name cannot be blank.")

        qs = Category.objects.filter(name__iexact=cleaned_name)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise forms.ValidationError("Category already exists.")

        return cleaned_name


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    form = CategoryAdminForm
    list_display = ('name', 'slug', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ('created_at', 'updated_at')
