import re
from decimal import Decimal
from rest_framework import serializers
from .models import Category, CategoryOffer


class CategorySerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        max_length=100,
        error_messages={
            'blank': 'Category name cannot be blank.',
            'required': 'Category name is required.'
        }
    )
    slug = serializers.SlugField(required=False, allow_blank=True)
    product_count = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'description', 'image', 'image_url', 'is_active', 'is_deleted', 'product_count', 'created_at')

    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError("Category name is required.")
        cleaned_name = re.sub(r'\s+', ' ', value).strip()
        if not cleaned_name:
            raise serializers.ValidationError("Category name cannot be blank.")

        qs = Category.objects.filter(name__iexact=cleaned_name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError("Category with this name already exists.")

        return cleaned_name

    def get_product_count(self, obj):
        return obj.products.filter(is_active=True, is_deleted=False).count()

    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return obj.image_url or None


class CategoryDetailSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        max_length=100,
        error_messages={
            'blank': 'Category name cannot be blank.',
            'required': 'Category name is required.'
        }
    )
    slug = serializers.SlugField(required=False, allow_blank=True)
    product_count = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug','description','image','image_url', 'is_active', 'is_deleted', 'product_count', 'created_at', 'updated_at')

    def validate_name(self, value):
        if not value:
            raise serializers.ValidationError("Category name is required.")
        cleaned_name = re.sub(r'\s+', ' ', value).strip()
        if not cleaned_name:
            raise serializers.ValidationError("Category name cannot be blank.")

        qs = Category.objects.filter(name__iexact=cleaned_name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError("Category with this name already exists.")

        return cleaned_name

    def get_product_count(self, obj):
        return obj.products.filter(is_active=True, is_deleted=False).count()

    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return obj.image_url or None


class CategoryOfferSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        error_messages={
            'required': 'Category is required.',
            'null': 'Please select a category.',
            'does_not_exist': 'Selected category does not exist.'
        }
    )
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    status = serializers.CharField(read_only=True)

    class Meta:
        model = CategoryOffer
        fields = (
            'id', 'category', 'category_name', 'category_slug',
            'offer_type', 'offer_value', 'start_date', 'end_date',
            'is_active', 'status', 'created_at', 'updated_at'
        )

    def validate_offer_value(self, value):
        if value is None or Decimal(str(value)) <= Decimal('0.00'):
            raise serializers.ValidationError('Offer value must be greater than zero.')
        return value

    def validate(self, attrs):
        category = attrs.get('category')
        if not category and self.instance:
            category = self.instance.category

        offer_type = attrs.get('offer_type')
        if not offer_type and self.instance:
            offer_type = self.instance.offer_type

        offer_value = attrs.get('offer_value')
        if offer_value is None and self.instance:
            offer_value = self.instance.offer_value

        start_date = attrs.get('start_date')
        if not start_date and self.instance:
            start_date = self.instance.start_date

        end_date = attrs.get('end_date')
        if not end_date and self.instance:
            end_date = self.instance.end_date

        is_active = attrs.get('is_active')
        if is_active is None and self.instance:
            is_active = self.instance.is_active
        elif is_active is None:
            is_active = True

        if not category:
            raise serializers.ValidationError({'category': 'Category is required.'})

        if not offer_type:
            raise serializers.ValidationError({'offer_type': 'Offer type is required.'})

        if offer_value is None or Decimal(str(offer_value)) <= Decimal('0.00'):
            raise serializers.ValidationError({'offer_value': 'Offer value must be greater than zero.'})

        if offer_type == 'percentage' and Decimal(str(offer_value)) > Decimal('100.00'):
            raise serializers.ValidationError({'offer_value': 'Percentage offer cannot exceed 100%.'})

        if start_date and end_date and end_date <= start_date:
            raise serializers.ValidationError({'end_date': 'End date must be later than start date.'})

        # Overlapping active offers check
        if is_active and category and start_date and end_date:
            overlapping = CategoryOffer.objects.filter(
                category=category,
                is_active=True,
                start_date__lte=end_date,
                end_date__gte=start_date
            )
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)

            if overlapping.exists():
                conflict = overlapping.first()
                cat_name = category.name
                raise serializers.ValidationError({
                    'category': f'An active offer for "{cat_name}" already exists between {conflict.start_date.strftime("%Y-%m-%d %H:%M")} and {conflict.end_date.strftime("%Y-%m-%d %H:%M")}.'
                })

        return attrs
