from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, NewsletterSubscriber


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'first_name', 'last_name', 'auth_provider', 'is_staff', 'is_active', 'created_at')
    list_filter = ('auth_provider', 'is_staff', 'is_active', 'created_at')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {'fields': ('first_name', 'last_name', 'phone', 'profile_image')}),
        ('Permissions', {'fields': ('auth_provider', 'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'created_at', 'updated_at')}),
    )
    readonly_fields = ('created_at', 'updated_at', 'last_login')
    search_fields = ('email', 'first_name', 'last_name', 'phone')
    ordering = ('-created_at',)


@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display = ('email', 'is_active', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('email',)
