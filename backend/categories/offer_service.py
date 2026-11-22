from decimal import Decimal
from django.utils import timezone
from .models import CategoryOffer


def get_active_category_offer(category_id, now=None):
    """
    Retrieve the active, currently valid CategoryOffer for the given category_id.
    Ensures that offer is active, start_date <= now <= end_date,
    and category is active and not soft-deleted.
    """
    if not category_id:
        return None
    if now is None:
        now = timezone.now()

    return CategoryOffer.objects.filter(
        category_id=category_id,
        is_active=True,
        start_date__lte=now,
        end_date__gte=now,
        category__is_active=True,
        category__is_deleted=False
    ).select_related('category').order_by('-created_at').first()


def get_effective_product_price(product, now=None):
    """
    Computes the authoritative pricing and discount for a product taking into account:
    1. Product direct discounts (compare_at_price vs regular price)
    2. Active category offers
    3. Priority rule: The customer always receives the BEST (highest) eligible discount,
       preventing unintended stacking while ensuring maximum savings.
    4. Guardrail: Selling price never becomes negative or zero (minimum ₹1.00).

    Returns a dict with:
        original_price: Decimal
        selling_price: Decimal
        discount_amount: Decimal
        discount_percentage: int
        has_discount: bool
        applied_offer_type: 'category' | 'product' | None
        category_offer: dict | None
    """
    if now is None:
        now = timezone.now()

    raw_price = Decimal(str(product.price or '0.00'))
    raw_compare = Decimal(str(product.compare_at_price)) if product.compare_at_price is not None and product.compare_at_price != '' else None

    # Determine product-level baseline and discount
    if raw_compare is not None and raw_compare > raw_price:
        original_price = raw_compare
        product_discount = raw_compare - raw_price
    else:
        original_price = raw_price
        product_discount = Decimal('0.00')

    # Determine category offer discount if applicable
    category_id = getattr(product, 'category_id', None)
    cat_offer = get_active_category_offer(category_id, now=now) if category_id else None

    cat_discount = Decimal('0.00')
    if cat_offer:
        cat_discount = cat_offer.calculate_discount(original_price)

    # Offer Priority Selection (Best eligible discount wins)
    if cat_offer and cat_discount > product_discount:
        # Category offer gives a bigger saving
        applied_discount = cat_discount
        applied_offer_type = 'category'
        selling_price = max(Decimal('1.00'), (original_price - cat_discount).quantize(Decimal('0.01')))
        category_offer_info = {
            'id': cat_offer.id,
            'offer_type': cat_offer.offer_type,
            'offer_value': str(cat_offer.offer_value),
            'category_name': cat_offer.category.name
        }
    elif product_discount > Decimal('0.00'):
        # Product offer gives equal or better saving
        applied_discount = product_discount
        applied_offer_type = 'product'
        selling_price = raw_price
        category_offer_info = None
    else:
        # No eligible discount
        applied_discount = Decimal('0.00')
        applied_offer_type = None
        selling_price = original_price
        category_offer_info = None

    # Calculate discount percentage
    if original_price > Decimal('0.00') and applied_discount > Decimal('0.00'):
        pct = int(round(float((applied_discount / original_price) * 100)))
    else:
        pct = 0

    return {
        'original_price': original_price.quantize(Decimal('0.01')),
        'selling_price': selling_price.quantize(Decimal('0.01')),
        'discount_amount': applied_discount.quantize(Decimal('0.01')),
        'discount_percentage': pct,
        'has_discount': bool(applied_discount > Decimal('0.00')),
        'applied_offer_type': applied_offer_type,
        'category_offer': category_offer_info
    }

