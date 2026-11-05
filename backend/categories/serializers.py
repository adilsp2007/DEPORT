import re
from rest_framework import serializers
from .models import Category


class CategorySerializer(serializers.ModelSerializer):
    
    slug = serializers.SlugField(required=False, allow_blank=True)
    product_count = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'description', 'image', 'image_url', 'is_active', 'is_deleted', 'product_count', 'created_at')

    def validate_name(self, value):
        cleaned_name = re.sub(r'\s+', ' ', value).strip()
        if not cleaned_name:
            raise serializers.ValidationError("Category name cannot be blank.")

        qs = Category.objects.filter(name__iexact=cleaned_name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError("Category already exists.")

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
    slug = serializers.SlugField(required=False, allow_blank=True)
    product_count = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug','description','image','image_url', 'is_active', 'is_deleted', 'product_count', 'created_at', 'updated_at')

    def validate_name(self, value):
        cleaned_name = re.sub(r'\s+', ' ', value).strip()
        if not cleaned_name:
            raise serializers.ValidationError("Category name cannot be blank.")

        qs = Category.objects.filter(name__iexact=cleaned_name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError("Category already exists.")

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
