from rest_framework import status, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import Address
from .serializers import AddressSerializer


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Strict user scoping security
        return Address.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        with transaction.atomic():
            user_address_count = Address.objects.filter(user=self.request.user).count()
            is_default = serializer.validated_data.get('is_default', False)

            # First address rule: Automatically make it default
            if user_address_count == 0:
                is_default = True

            if is_default:
                Address.objects.filter(user=self.request.user, is_default=True).update(is_default=False)

            serializer.save(user=self.request.user, is_default=is_default)

    def perform_update(self, serializer):
        with transaction.atomic():
            is_default = serializer.validated_data.get('is_default', False)
            if is_default:
                Address.objects.filter(user=self.request.user, is_default=True).exclude(pk=serializer.instance.pk).update(is_default=False)
            serializer.save()

    def perform_destroy(self, instance):
        with transaction.atomic():
            was_default = instance.is_default
            user = instance.user
            instance.delete()

            # Delete Default Address Rule: Automatically select the most recent address as default
            if was_default:
                remaining_address = Address.objects.filter(user=user).order_by('-updated_at').first()
                if remaining_address:
                    remaining_address.is_default = True
                    remaining_address.save(update_fields=['is_default', 'updated_at'])

    @action(detail=True, methods=['post'], url_path='set-default')
    def set_default(self, request, pk=None):
        address = self.get_object() # Ensures 404 if owned by another user
        with transaction.atomic():
            Address.objects.filter(user=request.user, is_default=True).exclude(pk=address.pk).update(is_default=False)
            address.is_default = True
            address.save(update_fields=['is_default', 'updated_at'])

        serializer = self.get_serializer(address)
        return Response(serializer.data, status=status.HTTP_200_OK)
