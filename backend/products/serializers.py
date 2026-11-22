from rest_framework import serializers
from .models import Product, ProductImage, Banner
from categories.models import Category
from categories.offer_service import get_effective_product_price


class CategorySimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'is_active', 'is_deleted')


class CategoryPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    default_error_messages = {
        'required': 'Please select a category.',
        'null': 'Please select a category.',
        'blank': 'Please select a category.',
        'does_not_exist': 'Please select a valid category.',
        'incorrect_type': 'Please select a category.',
    }

    def to_internal_value(self, data):
        if data in [None, '', 'null', 0, '0']:
            self.fail('null')
        return super().to_internal_value(data)


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
    price = serializers.SerializerMethodField()
    compare_at_price = serializers.SerializerMethodField()
    original_price = serializers.SerializerMethodField()
    discounted_price = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()
    category_offer = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            'id', 'name', 'slug', 'short_description', 'price',
            'compare_at_price', 'original_price', 'discounted_price',
            'discount_percentage', 'has_discount', 'category_offer',
            'currency', 'currency_symbol',
            'category', 'brand', 'is_new',
            'is_featured', 'is_best_seller', 'stock_quantity',
            'is_active', 'is_deleted', 'is_available', 'primary_image'
        )

    def get_is_available(self, obj):
        return obj.stock_quantity > 0 and obj.is_active and not obj.is_deleted

    def get_price(self, obj):
        eff = get_effective_product_price(obj)
        return str(eff['selling_price'])

    def get_compare_at_price(self, obj):
        eff = get_effective_product_price(obj)
        return str(eff['original_price']) if eff['has_discount'] else None

    def get_original_price(self, obj):
        eff = get_effective_product_price(obj)
        return str(eff['original_price']) if eff['has_discount'] else None

    def get_discounted_price(self, obj):
        eff = get_effective_product_price(obj)
        return str(eff['selling_price'])

    def get_discount_percentage(self, obj):
        eff = get_effective_product_price(obj)
        return eff['discount_percentage']

    def get_has_discount(self, obj):
        eff = get_effective_product_price(obj)
        return eff['has_discount']

    def get_category_offer(self, obj):
        eff = get_effective_product_price(obj)
        return eff['category_offer']

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
    price = serializers.SerializerMethodField()
    compare_at_price = serializers.SerializerMethodField()
    original_price = serializers.SerializerMethodField()
    discounted_price = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()
    has_discount = serializers.SerializerMethodField()
    category_offer = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            'id', 'name', 'slug', 'description', 'short_description',
            'price', 'compare_at_price', 'original_price', 'discounted_price',
            'discount_percentage', 'has_discount', 'category_offer',
            'currency', 'currency_symbol',
            'category', 'brand', 'sku',
            'stock_quantity', 'is_available', 'is_active', 'is_deleted',
            'is_new', 'is_featured', 'is_best_seller', 'images',
            'primary_image', 'created_at', 'updated_at'
        )

    def get_is_available(self, obj):
        return obj.stock_quantity > 0 and obj.is_active and not obj.is_deleted

    def get_price(self, obj):
        eff = get_effective_product_price(obj)
        return str(eff['selling_price'])

    def get_compare_at_price(self, obj):
        eff = get_effective_product_price(obj)
        return str(eff['original_price']) if eff['has_discount'] else None

    def get_original_price(self, obj):
        eff = get_effective_product_price(obj)
        return str(eff['original_price']) if eff['has_discount'] else None

    def get_discounted_price(self, obj):
        eff = get_effective_product_price(obj)
        return str(eff['selling_price'])

    def get_discount_percentage(self, obj):
        eff = get_effective_product_price(obj)
        return eff['discount_percentage']

    def get_has_discount(self, obj):
        eff = get_effective_product_price(obj)
        return eff['has_discount']

    def get_category_offer(self, obj):
        eff = get_effective_product_price(obj)
        return eff['category_offer']

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
    name = serializers.CharField(
        max_length=255,
        error_messages={
            'blank': 'Product name cannot be blank.',
            'required': 'Product name is required.'
        }
    )
    sku = serializers.CharField(
        max_length=100,
        error_messages={
            'blank': 'SKU cannot be blank.',
            'required': 'SKU is required.'
        }
    )
    category = CategoryPrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        required=True,
        allow_null=False,
        error_messages={
            'required': 'Please select a category.',
            'null': 'Please select a category.',
            'blank': 'Please select a category.',
            'does_not_exist': 'Please select a valid category.',
            'incorrect_type': 'Please select a category.',
        }
    )
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

    def validate_name(self, value):
        import re
        if not value:
            raise serializers.ValidationError("Product name is required.")
        cleaned = re.sub(r'\s+', ' ', value).strip()
        if not cleaned:
            raise serializers.ValidationError("Product name cannot be blank.")
        qs = Product.objects.filter(name__iexact=cleaned)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Product with this name already exists.")
        return cleaned

    def validate_sku(self, value):
        if not value:
            raise serializers.ValidationError("SKU is required.")
        cleaned = value.strip().upper()
        if not cleaned:
            raise serializers.ValidationError("SKU cannot be blank.")
        qs = Product.objects.filter(sku__iexact=cleaned)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Product with this SKU already exists.")
        return cleaned

    def validate_stock_quantity(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Stock quantity cannot be negative.")
        return value

    def validate(self, attrs):
        if not self.instance and not attrs.get('category'):
            raise serializers.ValidationError({'category': ['Please select a category.']})

        if self.instance and 'category' in self.initial_data and not attrs.get('category'):
            raise serializers.ValidationError({'category': ['Please select a category.']})

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


class BannerLinkedProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ('id', 'name', 'sku', 'price')


class BannerSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    banner_type = serializers.CharField(source='placement', required=False)
    placement_display = serializers.CharField(source='get_placement_display', read_only=True)
    banner_type_display = serializers.CharField(source='get_placement_display', read_only=True)
    status = serializers.CharField(read_only=True)
    is_currently_valid = serializers.BooleanField(read_only=True)
    linked_category_details = CategorySimpleSerializer(source='linked_category', read_only=True)
    linked_product_details = BannerLinkedProductSerializer(source='linked_product', read_only=True)
    uploaded_image = serializers.ImageField(source='image', required=False, write_only=True, allow_null=True)

    class Meta:
        model = Banner
        fields = (
            'id', 'title', 'subtitle', 'tagline', 'image', 'uploaded_image', 'image_url',
            'button_text', 'button_link', 'secondary_button_text',
            'secondary_button_link', 'placement', 'banner_type',
            'placement_display', 'banner_type_display',
            'start_date', 'end_date', 'status', 'is_currently_valid',
            'linked_category', 'linked_category_details',
            'linked_product', 'linked_product_details',
            'is_active', 'display_order', 'created_at', 'updated_at'
        )

    def validate_title(self, value):
        import re
        if not value:
            raise serializers.ValidationError('Banner title is required.')
        cleaned = re.sub(r'\s+', ' ', str(value)).strip()
        if not cleaned:
            raise serializers.ValidationError('Banner title cannot be blank.')
        return cleaned

    def validate_button_link(self, value):
        if value:
            val = str(value).strip()
            if not (val.startswith('/') or val.startswith('http://') or val.startswith('https://')):
                raise serializers.ValidationError('Button link must be a valid path (e.g. /shop) or full URL.')
            return val
        return '/shop'

    def validate(self, attrs):
        # Resolve placement from banner_type if provided
        initial = getattr(self, 'initial_data', {})
        if 'placement' not in attrs:
            b_type = initial.get('banner_type') or initial.get('type')
            if b_type:
                attrs['placement'] = str(b_type).strip().lower()

        valid_types = [c[0] for c in Banner.PLACEMENT_CHOICES]
        p = attrs.get('placement', self.instance.placement if self.instance else 'hero')
        if p and p.lower() not in valid_types:
            raise serializers.ValidationError({
                'banner_type': f'Invalid banner type "{p}". Available types: {", ".join(valid_types)}.'
            })

        # Date validations
        start_date = attrs.get('start_date') if 'start_date' in attrs else (self.instance.start_date if self.instance else None)
        end_date = attrs.get('end_date') if 'end_date' in attrs else (self.instance.end_date if self.instance else None)
        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({'end_date': 'End date must be later than start date.'})

        # Image validation
        has_new_file = bool(attrs.get('image'))
        has_url = bool(attrs.get('image_url')) or bool(initial.get('image_url'))
        has_existing_img = bool(self.instance and (self.instance.image or self.instance.image_url))

        # Check file extension and size if file is being uploaded
        new_file = attrs.get('image')
        if new_file and hasattr(new_file, 'size'):
            # Max 5MB
            if new_file.size > 5 * 1024 * 1024:
                raise serializers.ValidationError({'image': 'Image file size must not exceed 5MB.'})
            allowed_exts = ('.jpg', '.jpeg', '.png', '.webp', '.avif')
            if not new_file.name.lower().endswith(allowed_exts):
                raise serializers.ValidationError({
                    'image': f'Unsupported image format. Allowed formats: {", ".join(allowed_exts)}.'
                })

        if not self.instance and not has_new_file and not has_url:
            raise serializers.ValidationError({'image': 'Banner image or image URL is required.'})

        return attrs

    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return obj.image_url or None


# Standard Product serializer for product operations
class ProductSerializer(ProductAdminSerializer):
    """
    Standard Product serializer for product creation and update operations,
    enforcing mandatory category, SKU, name, and price validation.
    """
    pass
