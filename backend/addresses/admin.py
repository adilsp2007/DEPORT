from django.contrib import admin
from .models import Address


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'user', 'label', 'city', 'state', 'country', 'is_default', 'created_at')
    list_filter = ('label', 'is_default', 'country', 'created_at')
    search_fields = ('full_name', 'user__email', 'city', 'street', 'postal_code')
    readonly_fields = ('created_at', 'updated_at')
