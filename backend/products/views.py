from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from django.db.models import Q
from decimal import Decimal, InvalidOperation
from users.permissions import IsAdminUser
from .models import Product, ProductImage, Banner
from .serializers import (
    ProductListSerializer,
    ProductDetailSerializer,
    ProductImageSerializer,
    ProductAdminSerializer,
    BannerSerializer
)


from config.pagination import StandardResultsSetPagination, ProductGridPagination


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public customer ViewSet for viewing active, listed products.
    Lookup by slug: /api/products/<slug>/
    Supports:
    - Search with cancel/clear button (backend)
    - Pagination (backend)
    - Sorting: price_low, price_high, name_asc (A-Z), name_desc (Z-A), newest, popular, best_selling
    - Filters: Category, Price range, Brand, is_new, is_featured, is_best_seller
    - Combined search, sort, and filter
    - Hiding blocked / unlisted / soft-deleted products and products belonging to inactive/deleted categories
    """
    lookup_field = 'slug'
    permission_classes = [permissions.AllowAny]
    pagination_class = ProductGridPagination

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ProductDetailSerializer
        return ProductListSerializer

    def get_queryset(self):
        # Strictly hide blocked/unlisted/soft-deleted products
        queryset = Product.objects.filter(
            is_active=True,
            is_deleted=False
        ).select_related('category').prefetch_related('images')

        # Filter out products whose category is inactive or soft-deleted (if category exists)
        queryset = queryset.filter(
            Q(category__isnull=True) |
            (Q(category__is_active=True) & Q(category__is_deleted=False))
        )

        params = self.request.query_params

        # 1. Category filter (by slug or ID)
        category_param = params.get('category')
        if category_param and category_param.strip().lower() != 'all':
            category_param = category_param.strip()
            if category_param.isdigit():
                queryset = queryset.filter(category_id=int(category_param))
            else:
                queryset = queryset.filter(category__slug=category_param)

        # 2. Search filter (backend search)
        search_query = params.get('search')
        if search_query:
            search_query = search_query.strip()
            queryset = queryset.filter(
                Q(name__icontains=search_query) |
                Q(short_description__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(brand__icontains=search_query) |
                Q(sku__icontains=search_query)
            )

        # 3. Price range filter
        min_price = params.get('min_price')
        if min_price is not None and min_price != '':
            try:
                min_dec = Decimal(min_price)
                if min_dec >= 0:
                    queryset = queryset.filter(price__gte=min_dec)
            except (InvalidOperation, ValueError):
                pass

        max_price = params.get('max_price')
        if max_price is not None and max_price != '':
            try:
                max_dec = Decimal(max_price)
                if max_dec >= 0:
                    queryset = queryset.filter(price__lte=max_dec)
            except (InvalidOperation, ValueError):
                pass

        # 4. Brand filter (optional)
        brand_param = params.get('brand')
        if brand_param:
            queryset = queryset.filter(brand__iexact=brand_param.strip())

        # 5. Boolean collection flags
        if params.get('is_new') in ['true', 'True', '1']:
            queryset = queryset.filter(is_new=True)

        if params.get('is_featured') in ['true', 'True', '1']:
            queryset = queryset.filter(is_featured=True)

        if params.get('is_best_seller') in ['true', 'True', '1']:
            queryset = queryset.filter(is_best_seller=True)

        # 6. Sorting options (Price low to high, high to low, A-Z, Z-A, etc.)
        sort_param = params.get('sort')
        sort_map = {
            'price_low': 'price',
            'price_high': '-price',
            'name_asc': 'name',
            'name_desc': '-name',
            'newest': '-created_at',
            'popular': ('-is_featured', '-created_at'),
            'best_selling': ('-is_best_seller', '-created_at'),
        }

        if sort_param in sort_map:
            ordering = sort_map[sort_param]
            if isinstance(ordering, tuple):
                queryset = queryset.order_by(*ordering)
            else:
                queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('-created_at')

        return queryset

    @action(detail=False, methods=['get'], url_path='brands')
    def brands(self, request):
        """
        List all distinct brands currently active in catalog for filter options.
        """
        brands_list = (
            Product.objects.filter(is_active=True, is_deleted=False)
            .values_list('brand', flat=True)
            .distinct()
        )
        cleaned_brands = sorted(list(set(b for b in brands_list if b)))
        return Response(cleaned_brands)


class ProductAdminViewSet(viewsets.ModelViewSet):
    """
    Admin ViewSet for Product CRUD operations.
    Features:
    - Add, Edit, Delete (soft delete)
    - Multiple images upload (minimum 3 validation)
    - Image cropping and resizing support
    - Pagination (backend)
    - Search with cancel/clear button support
    - Sort in descending order by default
    """
    queryset = Product.objects.all().select_related('category').prefetch_related('images').order_by('-created_at')
    serializer_class = ProductDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ProductAdminSerializer
        return ProductDetailSerializer

    def get_queryset(self):
        queryset = Product.objects.all().select_related('category').prefetch_related('images')
        params = self.request.query_params

        # Search parameter (name, SKU, brand, description)
        search_query = params.get('search')
        if search_query:
            search_query = search_query.strip()
            queryset = queryset.filter(
                Q(name__icontains=search_query) |
                Q(sku__icontains=search_query) |
                Q(brand__icontains=search_query) |
                Q(description__icontains=search_query)
            )

        # Category filter
        category_id = params.get('category')
        if category_id and category_id.lower() != 'all':
            if category_id.isdigit():
                queryset = queryset.filter(category_id=int(category_id))
            else:
                queryset = queryset.filter(category__slug=category_id)

        # Brand filter
        brand_param = params.get('brand')
        if brand_param:
            queryset = queryset.filter(brand__iexact=brand_param)

        # Status filter
        status_param = params.get('status')
        if status_param == 'active':
            queryset = queryset.filter(is_active=True, is_deleted=False)
        elif status_param == 'inactive':
            queryset = queryset.filter(is_active=False, is_deleted=False)
        elif status_param == 'deleted':
            queryset = queryset.filter(is_deleted=True)

        # Stock status filter
        stock_status = params.get('stock_status')
        if stock_status == 'out_of_stock':
            queryset = queryset.filter(stock_quantity=0)
        elif stock_status == 'low_stock':
            queryset = queryset.filter(stock_quantity__gt=0, stock_quantity__lte=5)
        elif stock_status == 'in_stock':
            queryset = queryset.filter(stock_quantity__gt=5)

        # Sort parameter (Default: descending order by created_at)
        sort_param = params.get('sort')
        sort_map = {
            'newest': '-created_at',
            'oldest': 'created_at',
            'price_low': 'price',
            'price_high': '-price',
            'name_asc': 'name',
            'name_desc': '-name',
            'stock_low': 'stock_quantity',
            'stock_high': '-stock_quantity',
        }
        if sort_param in sort_map:
            queryset = queryset.order_by(sort_map[sort_param])
        else:
            queryset = queryset.order_by('-created_at')

        return queryset

    def create(self, request, *args, **kwargs):
        """
        Create a product with support for multiple images (minimum 3 images required).
        """
        uploaded_files = request.FILES.getlist('images') or request.FILES.getlist('images[]')
        
        # Check image files requirement
        if 'images' in request.FILES or 'images[]' in request.FILES:
            if len(uploaded_files) < 3:
                return Response({
                    'images': ['At least 3 images are required for each product.']
                }, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = serializer.save()

        # Save uploaded images
        for index, file_obj in enumerate(uploaded_files):
            ProductImage.objects.create(
                product=product,
                image=file_obj,
                is_primary=(index == 0),
                sort_order=index
            )

        output_serializer = ProductDetailSerializer(product, context={'request': request})
        return Response(output_serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        """
        Soft delete: sets is_deleted=True and is_active=False.
        """
        product = self.get_object()
        product.is_deleted = True
        product.is_active = False
        product.save()
        return Response({
            'message': f'Product "{product.name}" soft deleted successfully.',
            'id': product.id,
            'is_deleted': True,
            'is_active': False
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        """
        Restore a soft-deleted product.
        """
        product = self.get_object()
        product.is_deleted = False
        product.is_active = True
        product.save()
        return Response({
            'message': f'Product "{product.name}" restored successfully.',
            'id': product.id,
            'is_deleted': False,
            'is_active': True
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        """
        Toggle product active status (Block / Unblock / List / Unlist).
        """
        product = self.get_object()
        product.is_active = not product.is_active
        product.save()
        return Response({
            'message': f'Product status updated to {"Active" if product.is_active else "Inactive"}.',
            'id': product.id,
            'is_active': product.is_active
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='upload-images')
    def upload_images(self, request, pk=None):
        """
        Upload multiple images to an existing product with minimum 3 validation.
        """
        product = self.get_object()
        files = request.FILES.getlist('images') or request.FILES.getlist('images[]')
        if not files:
            file_single = request.FILES.get('image')
            if file_single:
                files = [file_single]

        existing_count = product.images.count()
        total_after = existing_count + len(files)

        if total_after < 3 and request.data.get('enforce_min') == 'true':
            return Response({
                'images': [f'Product must have at least 3 images. Currently has {existing_count}, uploading {len(files)}.']
            }, status=status.HTTP_400_BAD_REQUEST)

        created_images = []
        for idx, f in enumerate(files):
            has_primary = product.images.filter(is_primary=True).exists()
            is_primary = not has_primary and idx == 0
            img = ProductImage.objects.create(
                product=product,
                image=f,
                is_primary=is_primary,
                sort_order=existing_count + idx
            )
            created_images.append(img)

        return Response({
            'message': f'Successfully uploaded {len(created_images)} image(s).',
            'images': ProductImageSerializer(created_images, many=True, context={'request': request}).data,
            'total_images': product.images.count()
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch', 'post'], url_path='update-stock')
    def update_stock(self, request, pk=None):
        """
        Quick Stock Update action for Admin Inventory Management.
        Supports direct stock_quantity set or incremental adjustment (+/-).
        """
        product = self.get_object()
        stock = request.data.get('stock_quantity')
        adjustment = request.data.get('adjustment')

        if stock is not None:
            try:
                new_stock = int(stock)
                if new_stock < 0:
                    return Response({'detail': 'Stock quantity cannot be negative.'}, status=status.HTTP_400_BAD_REQUEST)
                product.stock_quantity = new_stock
            except ValueError:
                return Response({'detail': 'Invalid stock quantity.'}, status=status.HTTP_400_BAD_REQUEST)
        elif adjustment is not None:
            try:
                adj = int(adjustment)
                new_stock = product.stock_quantity + adj
                if new_stock < 0:
                    return Response({'detail': 'Resulting stock quantity cannot be negative.'}, status=status.HTTP_400_BAD_REQUEST)
                product.stock_quantity = new_stock
            except ValueError:
                return Response({'detail': 'Invalid adjustment value.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'detail': 'Either stock_quantity or adjustment must be provided.'}, status=status.HTTP_400_BAD_REQUEST)

        product.save(update_fields=['stock_quantity', 'updated_at'])
        return Response({
            'message': f'Stock for "{product.name}" updated to {product.stock_quantity} units.',
            'product': ProductDetailSerializer(product, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class ProductImageAdminViewSet(viewsets.ModelViewSet):
    """
    Admin ViewSet for individual ProductImage CRUD operations.
    """
    queryset = ProductImage.objects.all()
    serializer_class = ProductImageSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    @action(detail=True, methods=['post'], url_path='set-primary')
    def set_primary(self, request, pk=None):
        image = self.get_object()
        ProductImage.objects.filter(product=image.product).update(is_primary=False)
        image.is_primary = True
        image.save()
        return Response({'message': 'Primary image updated successfully.'}, status=status.HTTP_200_OK)


class BannerViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public ViewSet for active promotional & hero banners.
    Supports filtering by ?placement=hero, ?placement=promotional, etc.
    """
    serializer_class = BannerSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        queryset = Banner.objects.filter(is_active=True).order_by('display_order', '-created_at')
        placement = self.request.query_params.get('placement')
        if placement:
            queryset = queryset.filter(placement=placement)
        return queryset


class BannerAdminViewSet(viewsets.ModelViewSet):
    """
    Admin ViewSet for full Banner management.
    """
    queryset = Banner.objects.all().order_by('display_order', '-created_at')
    serializer_class = BannerSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
