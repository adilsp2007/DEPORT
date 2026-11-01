from rest_framework import serializers
from .models import Product, ProductImage, Banner
from categories.models import Category


class CategorySimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'is_active', 'is_deleted')


class ProductImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ('id', 'product', 'image', 'image_url', 'alt_text', 'is_primary', 'sort_order')

    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return obj.image_url or None


class ProductListSerializer(serializers.ModelSerializer):
    category = CategorySimpleSerializer(read_only=True)
    is_available = serializers.SerializerMethodField()
    primary_image = serializers.SerializerMethodField()
    currency = serializers.CharField(default='INR', read_only=True)
    currency_symbol = serializers.CharField(default='₹', read_only=True)
    original_price = serializers.SerializerMethodField()
    discounted_price = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            'id', 'name', 'slug', 'short_description', 'price',
            'compare_at_price', 'original_price', 'discounted_price',
            'discount_percentage', 'has_discount',
            'currency', 'currency_symbol',
            'category', 'brand', 'is_new',
            'is_featured', 'is_best_seller', 'stock_quantity',
            'is_active', 'is_deleted', 'is_available', 'primary_image'
        )

    def get_is_available(self, obj):
        return obj.stock_quantity > 0 and obj.is_active and not obj.is_deleted

    def get_original_price(self, obj):
        if obj.compare_at_price and obj.price is not None and obj.compare_at_price > obj.price:
            return str(obj.compare_at_price)
        return None

    def get_discounted_price(self, obj):
        return str(obj.price) if obj.price is not None else "0.00"

    def get_discount_percentage(self, obj):
        if obj.compare_at_price and obj.price is not None and obj.compare_at_price > obj.price and obj.compare_at_price > 0:
            diff = obj.compare_at_price - obj.price
            pct = (diff / obj.compare_at_price) * 100
            return int(round(float(pct)))
        return 0

    def get_has_discount(self, obj):
        return bool(obj.compare_at_price and obj.price is not None and obj.compare_at_price > obj.price)

    def get_primary_image(self, obj):
        images = list(obj.images.all())
        if not images:
            return None
        primary = next((img for img in images if img.is_primary), images[0])
        request = self.context.get('request')
        if primary.image:
            return request.build_absolute_uri(primary.image.url) if request else primary.image.url
        return primary.image_url or None


class ProductDetailSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)
    category = CategorySimpleSerializer(read_only=True)
    images = serializers.SerializerMethodField()
    is_available = serializers.SerializerMethodField()
    primary_image = serializers.SerializerMethodField()
    currency = serializers.CharField(default='INR', read_only=True)
    currency_symbol = serializers.CharField(default='₹', read_only=True)
    original_price = serializers.SerializerMethodField()
    discounted_price = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            'id', 'name', 'slug', 'description', 'short_description',
            'price', 'compare_at_price', 'original_price', 'discounted_price',
            'discount_percentage', 'has_discount',
            'currency', 'currency_symbol',
            'category', 'brand', 'sku',
            'stock_quantity', 'is_available', 'is_active', 'is_deleted',
            'is_new', 'is_featured', 'is_best_seller', 'images',
            'primary_image', 'created_at', 'updated_at'
        )

    def get_is_available(self, obj):
        return obj.stock_quantity > 0 and obj.is_active and not obj.is_deleted

    def get_original_price(self, obj):
        if obj.compare_at_price and obj.price is not None and obj.compare_at_price > obj.price:
            return str(obj.compare_at_price)
        return None

    def get_discounted_price(self, obj):
        return str(obj.price) if obj.price is not None else "0.00"

    def get_discount_percentage(self, obj):
        if obj.compare_at_price and obj.price is not None and obj.compare_at_price > obj.price and obj.compare_at_price > 0:
            diff = obj.compare_at_price - obj.price
            pct = (diff / obj.compare_at_price) * 100
            return int(round(float(pct)))
        return 0

    def get_has_discount(self, obj):
        return bool(obj.compare_at_price and obj.price is not None and obj.compare_at_price > obj.price)

    def get_images(self, obj):
        sorted_images = obj.images.all().order_by('-is_primary', 'sort_order', 'id')
        return ProductImageSerializer(sorted_images, many=True, context=self.context).data

    def get_primary_image(self, obj):
        images = list(obj.images.all())
        if not images:
            return None
        primary = next((img for img in images if img.is_primary), images[0])
        request = self.context.get('request')
        if primary.image:
            return request.build_absolute_uri(primary.image.url) if request else primary.image.url
        return primary.image_url or None


class ProductAdminSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)
    images = ProductImageSerializer(many=True, read_only=True)
    category_detail = CategorySimpleSerializer(source='category', read_only=True)
    primary_image = serializers.SerializerMethodField()
    currency = serializers.CharField(default='INR', read_only=True)
    currency_symbol = serializers.CharField(default='₹', read_only=True)
    original_price = serializers.SerializerMethodField()
    discounted_price = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = '__all__'

    def validate(self, attrs):
        price = attrs.get('price')
        compare_at_price = attrs.get('compare_at_price')

        if price is None and self.instance:
            price = self.instance.price
        if compare_at_price is None and self.instance:
            compare_at_price = self.instance.compare_at_price

        if price is not None and price <= 0:
            raise serializers.ValidationError({'price': 'Price must be greater than zero.'})

        if compare_at_price is not None and compare_at_price < 0:
            raise serializers.ValidationError({'compare_at_price': 'Original price cannot be negative.'})

        if compare_at_price is not None and price is not None and compare_at_price > 0:
            if price > compare_at_price:
                raise serializers.ValidationError({'price': 'Discounted selling price cannot exceed the original price.'})

        return attrs

    def get_original_price(self, obj):
        if obj.compare_at_price and obj.price is not None and obj.compare_at_price > obj.price:
            return str(obj.compare_at_price)
        return None

    def get_discounted_price(self, obj):
        return str(obj.price) if obj.price is not None else "0.00"

    def get_discount_percentage(self, obj):
        if obj.compare_at_price and obj.price is not None and obj.compare_at_price > obj.price and obj.compare_at_price > 0:
            diff = obj.compare_at_price - obj.price
            pct = (diff / obj.compare_at_price) * 100
            return int(round(float(pct)))
        return 0

    def get_has_discount(self, obj):
        return bool(obj.compare_at_price and obj.price is not None and obj.compare_at_price > obj.price)

    def get_primary_image(self, obj):
        images = list(obj.images.all())
        if not images:
            return None
        primary = next((img for img in images if img.is_primary), images[0])
        request = self.context.get('request')
        if primary.image:
            return request.build_absolute_uri(primary.image.url) if request else primary.image.url
        return primary.image_url or None


class BannerSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = Banner
        fields = (
            'id', 'title', 'subtitle', 'tagline', 'image', 'image_url',
            'button_text', 'button_link', 'secondary_button_text',
            'secondary_button_link', 'placement', 'is_active',
            'display_order', 'created_at', 'updated_at'
        )

    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return obj.image_url or None


# Alias for backward compatibility across modules
ProductSerializer = ProductListSerializer
