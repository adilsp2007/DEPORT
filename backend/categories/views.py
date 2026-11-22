import re
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone
from users.permissions import IsAdminUser
from .models import Category, CategoryOffer
from .serializers import CategorySerializer, CategoryDetailSerializer, CategoryOfferSerializer


from config.pagination import StandardResultsSetPagination


class CategoryPagination(StandardResultsSetPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public customer ViewSet for viewing active categories.
    Hides inactive and soft-deleted categories.
    """
    lookup_field = 'slug'
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Category.objects.filter(is_active=True, is_deleted=False).order_by('name')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CategoryDetailSerializer
        return CategorySerializer


class CategoryAdminViewSet(viewsets.ModelViewSet):
    """
    Admin ViewSet for Category management.
    Features:
    - Add, Edit, Delete (soft delete)
    - Search with cancel/clear button support (backend)
    - Pagination (backend)
    - Sorted in descending order (-created_at) by default
    """
    queryset = Category.objects.all().order_by('-created_at')
    serializer_class = CategoryDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    pagination_class = CategoryPagination
    lookup_field = 'pk'

    def get_queryset(self):
        queryset = Category.objects.all()
        params = self.request.query_params

        # Search parameter (backend search)
        search_query = params.get('search')
        if search_query:
            search_query = search_query.strip()
            queryset = queryset.filter(
                Q(name__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(slug__icontains=search_query)
            )

        # Status filter
        status_param = params.get('status')
        if status_param == 'active':
            queryset = queryset.filter(is_active=True, is_deleted=False)
        elif status_param == 'inactive':
            queryset = queryset.filter(is_active=False, is_deleted=False)
        elif status_param == 'deleted':
            queryset = queryset.filter(is_deleted=True)

        # Sort parameter (default: descending order by created_at)
        sort_param = params.get('sort')
        if sort_param == 'name_asc':
            queryset = queryset.order_by('name')
        elif sort_param == 'name_desc':
            queryset = queryset.order_by('-name')
        elif sort_param == 'oldest':
            queryset = queryset.order_by('created_at')
        else:
            queryset = queryset.order_by('-created_at')

        return queryset

    def create(self, request, *args, **kwargs):
        """
        Handle creating category. If category with same name exists and is soft-deleted,
        reactivate and update it cleanly.
        """
        name = request.data.get('name', '')
        cleaned_name = re.sub(r'\s+', ' ', name).strip() if isinstance(name, str) else ''
        existing_deleted = Category.objects.filter(name__iexact=cleaned_name, is_deleted=True).first() if cleaned_name else None
        if existing_deleted:
            existing_deleted.is_deleted = False
            existing_deleted.is_active = True
            if 'description' in request.data:
                existing_deleted.description = request.data.get('description', '')
            if 'image' in request.FILES:
                existing_deleted.image = request.FILES['image']
            existing_deleted.save()
            return Response(self.get_serializer(existing_deleted).data, status=status.HTTP_201_CREATED)
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Soft delete category: sets is_deleted=True and is_active=False.
        Preserves database integrity without breaking product FK relations.
        """
        category = self.get_object()
        category.is_deleted = True
        category.is_active = False
        category.save()
        return Response({
            'message': f'Category "{category.name}" soft deleted successfully.',
            'id': category.id,
            'is_deleted': True,
            'is_active': False
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        """
        Restore a soft-deleted category.
        """
        category = self.get_object()
        category.is_deleted = False
        category.is_active = True
        category.save()
        return Response({
            'message': f'Category "{category.name}" restored successfully.',
            'id': category.id,
            'is_deleted': False,
            'is_active': True
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        """
        Toggle active status of a category.
        """
        category = self.get_object()
        category.is_active = not category.is_active
        category.save()
        return Response({
            'message': f'Category status updated to {"Active" if category.is_active else "Inactive"}.',
            'id': category.id,
            'is_active': category.is_active
        }, status=status.HTTP_200_OK)


class CategoryOfferAdminViewSet(viewsets.ModelViewSet):
    """
    Admin ViewSet for managing Category Offers.
    Supports:
    - Create, Read, Update, Delete
    - Toggle Active Status
    - Search by category name
    - Filter by status (active, scheduled, expired, inactive)
    - Sorting by newest, oldest, value_high, value_low, end_date
    - Pagination
    """
    queryset = CategoryOffer.objects.all().select_related('category').order_by('-created_at')
    serializer_class = CategoryOfferSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = CategoryOffer.objects.all().select_related('category')
        params = self.request.query_params
        now = timezone.now()

        # Search by category name
        search = params.get('search')
        if search:
            search = search.strip()
            queryset = queryset.filter(category__name__icontains=search)

        # Filter by status
        status_param = params.get('status')
        if status_param == 'active':
            queryset = queryset.filter(is_active=True, start_date__lte=now, end_date__gte=now)
        elif status_param == 'scheduled':
            queryset = queryset.filter(is_active=True, start_date__gt=now)
        elif status_param == 'expired':
            queryset = queryset.filter(is_active=True, end_date__lt=now)
        elif status_param == 'inactive':
            queryset = queryset.filter(is_active=False)

        # Filter by category
        category_id = params.get('category')
        if category_id and category_id.isdigit():
            queryset = queryset.filter(category_id=int(category_id))

        # Filter by offer_type
        offer_type = params.get('offer_type')
        if offer_type in ['percentage', 'fixed']:
            queryset = queryset.filter(offer_type=offer_type)

        # Sorting
        sort_param = params.get('sort', 'newest')
        sort_map = {
            'newest': '-created_at',
            'oldest': 'created_at',
            'value_high': '-offer_value',
            'value_low': 'offer_value',
            'end_date': 'end_date',
        }
        order_by = sort_map.get(sort_param, '-created_at')
        return queryset.order_by(order_by)

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        offer = self.get_object()
        offer.is_active = not offer.is_active
        offer.save()
        status_text = 'Active' if offer.is_active else 'Inactive'
        return Response({
            'message': f'Offer for "{offer.category.name}" updated to {status_text}.',
            'offer': self.get_serializer(offer).data
        }, status=status.HTTP_200_OK)
