from rest_framework import serializers
from .models import Address


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = (
            'id', 'user', 'label', 'full_name', 'phone',
            'address_line_1', 'address_line_2', 'city', 'state',
            'postal_code', 'country', 'is_default', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'user', 'created_at', 'updated_at')

    def validate_label(self, value):
        valid_labels = ['Home', 'Office', 'Other']
        if value not in valid_labels:
            raise serializers.ValidationError(f"Label must be one of: {', '.join(valid_labels)}.")
        return value

    def validate_phone(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Phone number is required.")
        cleaned = value.strip()
        if len(cleaned) < 5 or len(cleaned) > 30:
            raise serializers.ValidationError("Please enter a valid phone number.")
        return cleaned

    def validate_full_name(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Full recipient name is required.")
        return value.strip()

    def validate_address_line_1(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Street address line 1 is required.")
        return value.strip()

    def validate_city(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("City is required.")
        return value.strip()

    def validate_state(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("State / Province is required.")
        return value.strip()

    def validate_postal_code(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Postal / ZIP code is required.")
        return value.strip()

    def validate_country(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Country is required.")
        return value.strip()
