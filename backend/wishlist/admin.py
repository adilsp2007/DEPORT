from django.contrib import admin
from .models import Wishlist


@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'product', 'created_at')
    search_fields = ('user__email', 'product__name', 'product__sku')
    list_filter = ('created_at',)
    readonly_fields = ('created_at',)
