import calendar
import datetime
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Count, Avg, Q
from django.db.models.functions import TruncDay, TruncHour, TruncWeek, TruncMonth, TruncYear
from rest_framework.exceptions import ValidationError

from orders.models import Order, Payment, OrderItem, Coupon
from products.models import Product
from categories.models import Category
from users.models import User


def calc_change_pct(current, previous):
    """
    Safely calculates percentage increase or decrease:
    ((current - previous) / previous) * 100
    Handles zero previous value gracefully.
    """
    c = float(current or 0)
    p = float(previous or 0)
    if p == 0:
        return 100.0 if c > 0 else 0.0
    return round(((c - p) / p) * 100, 1)


def resolve_date_range(period='this_month', start_date_str=None, end_date_str=None, tz=None):
    """
    Resolves start_date, end_date, and equivalent previous-period boundaries
    based on the selected period filter or custom date range.
    """
    if tz is None:
        tz = timezone.get_current_timezone()

    now = timezone.now().astimezone(tz)
    today = now.date()

    period = (period or 'this_month').strip().lower()

    if period == 'today':
        start_dt = datetime.datetime.combine(today, datetime.time.min).replace(tzinfo=tz)
        end_dt = datetime.datetime.combine(today, datetime.time.max).replace(tzinfo=tz)
        prev_start_dt = start_dt - datetime.timedelta(days=1)
        prev_end_dt = end_dt - datetime.timedelta(days=1)
        default_grouping = 'hour'

    elif period == 'yesterday':
        yesterday = today - datetime.timedelta(days=1)
        start_dt = datetime.datetime.combine(yesterday, datetime.time.min).replace(tzinfo=tz)
        end_dt = datetime.datetime.combine(yesterday, datetime.time.max).replace(tzinfo=tz)
        prev_start_dt = start_dt - datetime.timedelta(days=1)
        prev_end_dt = end_dt - datetime.timedelta(days=1)
        default_grouping = 'hour'

    elif period == 'this_week':
        # Start of current week (Monday)
        start_day = today - datetime.timedelta(days=today.weekday())
        start_dt = datetime.datetime.combine(start_day, datetime.time.min).replace(tzinfo=tz)
        end_dt = datetime.datetime.combine(today, datetime.time.max).replace(tzinfo=tz)
        prev_start_dt = start_dt - datetime.timedelta(days=7)
        prev_end_dt = end_dt - datetime.timedelta(days=7)
        default_grouping = 'day'

    elif period == 'this_month':
        start_dt = datetime.datetime(today.year, today.month, 1, 0, 0, 0, tzinfo=tz)
        end_dt = datetime.datetime.combine(today, datetime.time.max).replace(tzinfo=tz)

        # Previous month equivalent
        if today.month == 1:
            prev_year = today.year - 1
            prev_month = 12
        else:
            prev_year = today.year
            prev_month = today.month - 1
        _, last_day_prev = calendar.monthrange(prev_year, prev_month)
        prev_start_dt = datetime.datetime(prev_year, prev_month, 1, 0, 0, 0, tzinfo=tz)
        prev_end_dt = datetime.datetime(
            prev_year, prev_month, min(today.day, last_day_prev),
            23, 59, 59, 999999, tzinfo=tz
        )
        default_grouping = 'day'

    elif period == 'last_month':
        if today.month == 1:
            lm_year = today.year - 1
            lm_month = 12
        else:
            lm_year = today.year
            lm_month = today.month - 1
        _, last_day = calendar.monthrange(lm_year, lm_month)
        start_dt = datetime.datetime(lm_year, lm_month, 1, 0, 0, 0, tzinfo=tz)
        end_dt = datetime.datetime(lm_year, lm_month, last_day, 23, 59, 59, 999999, tzinfo=tz)

        # Period before last month
        if lm_month == 1:
            plm_year = lm_year - 1
            plm_month = 12
        else:
            plm_year = lm_year
            plm_month = lm_month - 1
        _, last_day_plm = calendar.monthrange(plm_year, plm_month)
        prev_start_dt = datetime.datetime(plm_year, plm_month, 1, 0, 0, 0, tzinfo=tz)
        prev_end_dt = datetime.datetime(plm_year, plm_month, last_day_plm, 23, 59, 59, 999999, tzinfo=tz)
        default_grouping = 'day'

    elif period == 'this_year':
        start_dt = datetime.datetime(today.year, 1, 1, 0, 0, 0, tzinfo=tz)
        end_dt = datetime.datetime.combine(today, datetime.time.max).replace(tzinfo=tz)
        prev_start_dt = datetime.datetime(today.year - 1, 1, 1, 0, 0, 0, tzinfo=tz)
        prev_end_dt = datetime.datetime(
            today.year - 1, today.month, min(today.day, 28),
            23, 59, 59, 999999, tzinfo=tz
        )
        default_grouping = 'month'

    elif period == 'last_year':
        ly = today.year - 1
        start_dt = datetime.datetime(ly, 1, 1, 0, 0, 0, tzinfo=tz)
        end_dt = datetime.datetime(ly, 12, 31, 23, 59, 59, 999999, tzinfo=tz)
        ply = ly - 1
        prev_start_dt = datetime.datetime(ply, 1, 1, 0, 0, 0, tzinfo=tz)
        prev_end_dt = datetime.datetime(ply, 12, 31, 23, 59, 59, 999999, tzinfo=tz)
        default_grouping = 'month'

    elif period == 'custom':
        if not start_date_str or not end_date_str:
            raise ValidationError({'detail': 'Both start_date and end_date are required for custom date range.'})

        try:
            parsed_start = datetime.datetime.strptime(start_date_str.strip(), '%Y-%m-%d').date()
        except ValueError:
            raise ValidationError({'start_date': 'Invalid start_date format. Use YYYY-MM-DD.'})

        try:
            parsed_end = datetime.datetime.strptime(end_date_str.strip(), '%Y-%m-%d').date()
        except ValueError:
            raise ValidationError({'end_date': 'Invalid end_date format. Use YYYY-MM-DD.'})

        if parsed_start > parsed_end:
            raise ValidationError({'end_date': 'End date cannot be earlier than start date.'})

        start_dt = datetime.datetime.combine(parsed_start, datetime.time.min).replace(tzinfo=tz)
        end_dt = datetime.datetime.combine(parsed_end, datetime.time.max).replace(tzinfo=tz)
        duration = end_dt - start_dt
        prev_end_dt = start_dt - datetime.timedelta(microseconds=1)
        prev_start_dt = prev_end_dt - duration

        num_days = (parsed_end - parsed_start).days + 1
        if num_days <= 2:
            default_grouping = 'hour'
        elif num_days <= 60:
            default_grouping = 'day'
        elif num_days <= 365:
            default_grouping = 'month'
        else:
            default_grouping = 'year'

    else:
        raise ValidationError({
            'period': f'Invalid period "{period}". Valid options: today, yesterday, this_week, this_month, last_month, this_year, last_year, custom.'
        })

    return {
        'period': period,
        'start_dt': start_dt,
        'end_dt': end_dt,
        'prev_start_dt': prev_start_dt,
        'prev_end_dt': prev_end_dt,
        'default_grouping': default_grouping
    }


def get_dashboard_analytics(
    period='this_month',
    start_date=None,
    end_date=None,
    grouping=None,
    top_products_sort='units_sold_desc',
    order_search='',
    order_status='',
    tz=None
):
    """
    Main aggregator for Admin Analytics.
    Returns structured stats, time-series chart data, category breakdown,
    top products, order status distribution, and recent orders.
    """
    dates = resolve_date_range(period=period, start_date_str=start_date, end_date_str=end_date, tz=tz)
    start_dt = dates['start_dt']
    end_dt = dates['end_dt']
    prev_start_dt = dates['prev_start_dt']
    prev_end_dt = dates['prev_end_dt']

    # Grouping validation
    valid_groupings = ['hour', 'day', 'week', 'month', 'year']
    active_grouping = grouping.strip().lower() if grouping and grouping.strip().lower() in valid_groupings else dates['default_grouping']

    # -------------------------------------------------------------
    # 1. QUALIFYING QUERIES FOR REVENUE & ORDERS
    # Cancelled and refunded orders must not contribute to realized revenue.
    # -------------------------------------------------------------
    current_orders_qs = Order.objects.filter(created_at__range=(start_dt, end_dt))
    prev_orders_qs = Order.objects.filter(created_at__range=(prev_start_dt, prev_end_dt))

    # Realized revenue from completed payments for non-cancelled/non-returned orders
    current_payments_qs = Payment.objects.filter(
        status='completed',
        order__created_at__range=(start_dt, end_dt)
    ).exclude(order__status__in=['cancelled', 'returned'])

    prev_payments_qs = Payment.objects.filter(
        status='completed',
        order__created_at__range=(prev_start_dt, prev_end_dt)
    ).exclude(order__status__in=['cancelled', 'returned'])

    current_revenue = float(current_payments_qs.aggregate(total=Sum('amount'))['total'] or 0.00)
    prev_revenue = float(prev_payments_qs.aggregate(total=Sum('amount'))['total'] or 0.00)

    # Qualifying orders count (orders with completed payment) for AOV
    current_qualifying_orders = current_orders_qs.filter(
        payments__status='completed'
    ).exclude(status__in=['cancelled', 'returned']).distinct().count()

    prev_qualifying_orders = prev_orders_qs.filter(
        payments__status='completed'
    ).exclude(status__in=['cancelled', 'returned']).distinct().count()

    current_aov = round(current_revenue / current_qualifying_orders, 2) if current_qualifying_orders > 0 else 0.00
    prev_aov = round(prev_revenue / prev_qualifying_orders, 2) if prev_qualifying_orders > 0 else 0.00

    # Total units sold across completed orders
    current_items_qs = OrderItem.objects.filter(
        order__created_at__range=(start_dt, end_dt),
        is_cancelled=False,
        order__payments__status='completed'
    ).exclude(order__status__in=['cancelled', 'returned'])

    prev_items_qs = OrderItem.objects.filter(
        order__created_at__range=(prev_start_dt, prev_end_dt),
        is_cancelled=False,
        order__payments__status='completed'
    ).exclude(order__status__in=['cancelled', 'returned'])

    current_units_sold = int(current_items_qs.aggregate(total=Sum('quantity'))['total'] or 0)
    prev_units_sold = int(prev_items_qs.aggregate(total=Sum('quantity'))['total'] or 0)

    # -------------------------------------------------------------
    # 2. OVERVIEW CARDS (All 12 Requested Cards)
    # -------------------------------------------------------------
    # Orders metrics
    curr_total_orders = current_orders_qs.count()
    prev_total_orders = prev_orders_qs.count()

    curr_delivered_orders = current_orders_qs.filter(status='delivered').count()
    prev_delivered_orders = prev_orders_qs.filter(status='delivered').count()

    curr_pending_orders = current_orders_qs.filter(status='pending').count()
    prev_pending_orders = prev_orders_qs.filter(status='pending').count()

    curr_cancelled_orders = current_orders_qs.filter(status='cancelled').count()
    prev_cancelled_orders = prev_orders_qs.filter(status='cancelled').count()

    # Catalog & User cumulative metrics
    total_products = Product.objects.filter(is_deleted=False).count()
    prev_products = Product.objects.filter(created_at__lte=prev_end_dt, is_deleted=False).count()

    total_categories = Category.objects.filter(is_deleted=False).count()
    prev_categories = Category.objects.filter(created_at__lte=prev_end_dt, is_deleted=False).count()

    total_users = User.objects.filter(is_email_verified=True).count()
    prev_users = User.objects.filter(created_at__lte=prev_end_dt, is_email_verified=True).count()

    total_customers = User.objects.filter(is_email_verified=True, is_staff=False, is_superuser=False).count()
    prev_customers = User.objects.filter(created_at__lte=prev_end_dt, is_email_verified=True, is_staff=False, is_superuser=False).count()

    total_coupons = Coupon.objects.count()
    prev_coupons = Coupon.objects.filter(created_at__lte=prev_end_dt).count()

    active_coupons = Coupon.objects.filter(is_active=True).count()
    prev_active_coupons = Coupon.objects.filter(created_at__lte=prev_end_dt, is_active=True).count()

    cards = {
        'total_revenue': {
            'value': current_revenue,
            'previous': prev_revenue,
            'change_pct': calc_change_pct(current_revenue, prev_revenue),
            'formatted': f"₹{current_revenue:,.2f}"
        },
        'total_orders': {
            'value': curr_total_orders,
            'previous': prev_total_orders,
            'change_pct': calc_change_pct(curr_total_orders, prev_total_orders)
        },
        'total_products': {
            'value': total_products,
            'previous': prev_products,
            'change_pct': calc_change_pct(total_products, prev_products)
        },
        'total_categories': {
            'value': total_categories,
            'previous': prev_categories,
            'change_pct': calc_change_pct(total_categories, prev_categories)
        },
        'total_users': {
            'value': total_users,
            'previous': prev_users,
            'change_pct': calc_change_pct(total_users, prev_users)
        },
        'total_customers': {
            'value': total_customers,
            'previous': prev_customers,
            'change_pct': calc_change_pct(total_customers, prev_customers)
        },
        'total_delivered_orders': {
            'value': curr_delivered_orders,
            'previous': prev_delivered_orders,
            'change_pct': calc_change_pct(curr_delivered_orders, prev_delivered_orders)
        },
        'pending_orders': {
            'value': curr_pending_orders,
            'previous': prev_pending_orders,
            'change_pct': calc_change_pct(curr_pending_orders, prev_pending_orders)
        },
        'cancelled_orders': {
            'value': curr_cancelled_orders,
            'previous': prev_cancelled_orders,
            'change_pct': calc_change_pct(curr_cancelled_orders, prev_cancelled_orders)
        },
        'total_coupons': {
            'value': total_coupons,
            'previous': prev_coupons,
            'change_pct': calc_change_pct(total_coupons, prev_coupons)
        },
        'active_coupons': {
            'value': active_coupons,
            'previous': prev_active_coupons,
            'change_pct': calc_change_pct(active_coupons, prev_active_coupons)
        },
        'total_sales': {
            'value': current_units_sold,
            'previous': prev_units_sold,
            'change_pct': calc_change_pct(current_units_sold, prev_units_sold)
        }
    }

    # -------------------------------------------------------------
    # 3. SALES PERFORMANCE COMPARISON (Section 6)
    # -------------------------------------------------------------
    sales_performance = {
        'revenue': {
            'current': current_revenue,
            'previous': prev_revenue,
            'change_pct': calc_change_pct(current_revenue, prev_revenue)
        },
        'total_sales': {
            'current': current_units_sold,
            'previous': prev_units_sold,
            'change_pct': calc_change_pct(current_units_sold, prev_units_sold)
        },
        'orders_count': {
            'current': curr_total_orders,
            'previous': prev_total_orders,
            'change_pct': calc_change_pct(curr_total_orders, prev_total_orders)
        },
        'average_order_value': {
            'current': current_aov,
            'previous': prev_aov,
            'change_pct': calc_change_pct(current_aov, prev_aov)
        }
    }

    # -------------------------------------------------------------
    # 4. TIME-SERIES CHARTS (Revenue & Orders)
    # Zero-filled continuous intervals
    # -------------------------------------------------------------
    trunc_map = {
        'hour': TruncHour,
        'day': TruncDay,
        'week': TruncWeek,
        'month': TruncMonth,
        'year': TruncYear
    }
    trunc_func = trunc_map.get(active_grouping, TruncDay)

    # Group revenue by interval
    revenue_series = current_payments_qs.annotate(
        interval=trunc_func('order__created_at')
    ).values('interval').annotate(
        revenue=Sum('amount'),
        orders_count=Count('order_id', distinct=True)
    ).order_by('interval')

    rev_by_interval = {}
    for item in revenue_series:
        if item['interval']:
            key = item['interval'].isoformat()
            rev_by_interval[key] = {
                'revenue': float(item['revenue'] or 0.0),
                'orders_count': int(item['orders_count'] or 0)
            }

    # Group orders by interval
    orders_series = current_orders_qs.annotate(
        interval=trunc_func('created_at')
    ).values('interval').annotate(
        total=Count('id'),
        delivered=Count('id', filter=Q(status='delivered')),
        pending=Count('id', filter=Q(status='pending')),
        cancelled=Count('id', filter=Q(status='cancelled')),
        processing=Count('id', filter=Q(status='processing')),
        confirmed=Count('id', filter=Q(status='confirmed')),
        shipped=Count('id', filter=Q(status__in=['shipped', 'out_for_delivery']))
    ).order_by('interval')

    orders_by_interval = {}
    for item in orders_series:
        if item['interval']:
            key = item['interval'].isoformat()
            orders_by_interval[key] = {
                'total': int(item['total'] or 0),
                'delivered': int(item['delivered'] or 0),
                'pending': int(item['pending'] or 0),
                'cancelled': int(item['cancelled'] or 0),
                'processing': int(item['processing'] or 0),
                'confirmed': int(item['confirmed'] or 0),
                'shipped': int(item['shipped'] or 0)
            }

    # Generate continuous intervals between start_dt and end_dt
    interval_slots = []
    curr_slot = start_dt

    if active_grouping == 'hour':
        curr_slot = curr_slot.replace(minute=0, second=0, microsecond=0)
        while curr_slot <= end_dt:
            interval_slots.append(curr_slot)
            curr_slot += datetime.timedelta(hours=1)

    elif active_grouping == 'day':
        curr_slot = curr_slot.replace(hour=0, minute=0, second=0, microsecond=0)
        while curr_slot <= end_dt:
            interval_slots.append(curr_slot)
            curr_slot += datetime.timedelta(days=1)

    elif active_grouping == 'week':
        # Start at beginning of week
        curr_slot = curr_slot - datetime.timedelta(days=curr_slot.weekday())
        curr_slot = curr_slot.replace(hour=0, minute=0, second=0, microsecond=0)
        while curr_slot <= end_dt:
            interval_slots.append(curr_slot)
            curr_slot += datetime.timedelta(days=7)

    elif active_grouping == 'month':
        curr_slot = curr_slot.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        while curr_slot <= end_dt:
            interval_slots.append(curr_slot)
            # advance one month
            if curr_slot.month == 12:
                curr_slot = curr_slot.replace(year=curr_slot.year + 1, month=1)
            else:
                curr_slot = curr_slot.replace(month=curr_slot.month + 1)

    else:  # year
        curr_slot = curr_slot.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        while curr_slot <= end_dt:
            interval_slots.append(curr_slot)
            curr_slot = curr_slot.replace(year=curr_slot.year + 1)

    # Format chart labels
    revenue_chart_data = []
    orders_chart_data = []

    for slot in interval_slots:
        slot_key = slot.isoformat()
        slot_date_str = slot.strftime('%Y-%m-%d')

        if active_grouping == 'hour':
            label = slot.strftime('%H:%M')
        elif active_grouping == 'day':
            label = slot.strftime('%b %d')
        elif active_grouping == 'week':
            label = f"Wk of {slot.strftime('%b %d')}"
        elif active_grouping == 'month':
            label = slot.strftime('%b %Y')
        else:
            label = slot.strftime('%Y')

        # Find matching revenue and order items (exact or matching date/hour)
        rev_entry = rev_by_interval.get(slot_key)
        if not rev_entry:
            # Fallback by matching prefix
            prefix = slot_date_str if active_grouping != 'hour' else slot.strftime('%Y-%m-%dT%H')
            matched_rev = [v for k, v in rev_by_interval.items() if k.startswith(prefix)]
            if matched_rev:
                rev_entry = {
                    'revenue': sum(m['revenue'] for m in matched_rev),
                    'orders_count': sum(m['orders_count'] for m in matched_rev)
                }
            else:
                rev_entry = {'revenue': 0.0, 'orders_count': 0}

        ord_entry = orders_by_interval.get(slot_key)
        if not ord_entry:
            prefix = slot_date_str if active_grouping != 'hour' else slot.strftime('%Y-%m-%dT%H')
            matched_ord = [v for k, v in orders_by_interval.items() if k.startswith(prefix)]
            if matched_ord:
                ord_entry = {
                    'total': sum(m['total'] for m in matched_ord),
                    'delivered': sum(m['delivered'] for m in matched_ord),
                    'pending': sum(m['pending'] for m in matched_ord),
                    'cancelled': sum(m['cancelled'] for m in matched_ord),
                    'processing': sum(m['processing'] for m in matched_ord),
                    'confirmed': sum(m['confirmed'] for m in matched_ord),
                    'shipped': sum(m['shipped'] for m in matched_ord)
                }
            else:
                ord_entry = {'total': 0, 'delivered': 0, 'pending': 0, 'cancelled': 0, 'processing': 0, 'confirmed': 0, 'shipped': 0}

        revenue_chart_data.append({
            'date': slot_date_str,
            'timestamp': slot_key,
            'label': label,
            'revenue': round(rev_entry['revenue'], 2),
            'orders_count': rev_entry['orders_count']
        })

        orders_chart_data.append({
            'date': slot_date_str,
            'timestamp': slot_key,
            'label': label,
            'total': ord_entry['total'],
            'delivered': ord_entry['delivered'],
            'pending': ord_entry['pending'],
            'cancelled': ord_entry['cancelled'],
            'processing': ord_entry['processing'],
            'confirmed': ord_entry['confirmed'],
            'shipped': ord_entry['shipped']
        })

    # -------------------------------------------------------------
    # 5. ORDER STATUS DISTRIBUTION (Section 5)
    # -------------------------------------------------------------
    status_palette = {
        'pending': {'label': 'Pending', 'color': '#F59E0B'},
        'confirmed': {'label': 'Confirmed', 'color': '#3B82F6'},
        'processing': {'label': 'Processing', 'color': '#8B5CF6'},
        'shipped': {'label': 'Shipped', 'color': '#06B6D4'},
        'out_for_delivery': {'label': 'Out for Delivery', 'color': '#14B8A6'},
        'delivered': {'label': 'Delivered', 'color': '#10B981'},
        'cancelled': {'label': 'Cancelled', 'color': '#EF4444'},
        'return_requested': {'label': 'Return Requested', 'color': '#F97316'},
        'returned': {'label': 'Returned', 'color': '#6B7280'}
    }

    status_counts = current_orders_qs.values('status').annotate(count=Count('id'))
    status_map = {item['status']: item['count'] for item in status_counts}

    status_distribution = []
    # Primary groups to always represent cleanly
    primary_statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']

    for st in primary_statuses:
        meta = status_palette.get(st, {'label': st.title(), 'color': '#9CA3AF'})
        if st == 'shipped':
            cnt = status_map.get('shipped', 0) + status_map.get('out_for_delivery', 0)
        elif st == 'returned':
            cnt = status_map.get('returned', 0) + status_map.get('return_requested', 0)
        else:
            cnt = status_map.get(st, 0)

        pct = round((cnt / curr_total_orders) * 100, 1) if curr_total_orders > 0 else 0.0

        status_distribution.append({
            'status': st,
            'label': meta['label'],
            'count': cnt,
            'percentage': pct,
            'color': meta['color']
        })

    # -------------------------------------------------------------
    # 6. TOP-SELLING PRODUCTS (Section 7)
    # -------------------------------------------------------------
    sort_order_map = {
        'units_sold_desc': ('-units_sold', '-total_revenue'),
        'revenue_desc': ('-total_revenue', '-units_sold'),
        'units_sold_asc': ('units_sold', 'total_revenue'),
    }
    sort_fields = sort_order_map.get(top_products_sort, ('-units_sold', '-total_revenue'))

    top_products_qs = current_items_qs.values(
        'product_id',
        'product_name',
        'product_sku',
        'product__category__name',
        'product_image'
    ).annotate(
        units_sold=Sum('quantity'),
        total_revenue=Sum('total_price')
    ).order_by(*sort_fields)[:10]

    top_selling_products = []
    for p in top_products_qs:
        # Resolve best image
        img = p['product_image']
        if not img and p['product_id']:
            prod_obj = Product.objects.filter(id=p['product_id']).prefetch_related('images').first()
            if prod_obj:
                prim_img = prod_obj.images.filter(is_primary=True).first() or prod_obj.images.first()
                if prim_img:
                    img = prim_img.image_url or (prim_img.image.url if prim_img.image else '')

        top_selling_products.append({
            'id': p['product_id'],
            'name': p['product_name'],
            'sku': p['product_sku'] or 'N/A',
            'category_name': p['product__category__name'] or 'DEPORT Atelier',
            'image': img or '',
            'units_sold': int(p['units_sold'] or 0),
            'total_revenue': float(p['total_revenue'] or 0.0),
            'formatted_revenue': f"₹{float(p['total_revenue'] or 0.0):,.2f}"
        })

    # -------------------------------------------------------------
    # 7. CATEGORY-WISE SALES ANALYTICS (Section 8)
    # -------------------------------------------------------------
    cat_sales_qs = current_items_qs.values(
        'product__category_id',
        'product__category__name'
    ).annotate(
        units_sold=Sum('quantity'),
        total_revenue=Sum('total_price')
    ).order_by('-total_revenue')

    total_cat_rev = sum(float(item['total_revenue'] or 0.0) for item in cat_sales_qs)
    category_sales = []
    cat_colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#14B8A6', '#F97316', '#6366F1']

    for idx, c in enumerate(cat_sales_qs):
        rev = float(c['total_revenue'] or 0.0)
        pct = round((rev / total_cat_rev) * 100, 1) if total_cat_rev > 0 else 0.0
        category_sales.append({
            'category_id': c['product__category_id'],
            'category_name': c['product__category__name'] or 'Bags & Accessories',
            'units_sold': int(c['units_sold'] or 0),
            'total_revenue': rev,
            'percentage': pct,
            'color': cat_colors[idx % len(cat_colors)]
        })

    # -------------------------------------------------------------
    # 8. RECENT ORDERS (Section 9)
    # Search, filter by status, sort by latest
    # -------------------------------------------------------------
    orders_table_qs = Order.objects.filter(created_at__range=(start_dt, end_dt)).select_related('user').prefetch_related('payments')

    if order_search:
        s = order_search.strip()
        orders_table_qs = orders_table_qs.filter(
            Q(order_number__icontains=s) |
            Q(shipping_full_name__icontains=s) |
            Q(user__first_name__icontains=s) |
            Q(user__last_name__icontains=s) |
            Q(user__email__icontains=s)
        )

    if order_status:
        st = order_status.strip().lower()
        if st in dict(Order.STATUS_CHOICES):
            orders_table_qs = orders_table_qs.filter(status=st)

    recent_orders_list = []
    for o in orders_table_qs.order_by('-created_at')[:10]:
        latest_payment = o.payments.first()
        payment_status = latest_payment.status if latest_payment else ('completed' if o.status == 'delivered' else 'pending')
        recent_orders_list.append({
            'id': o.id,
            'order_number': o.order_number,
            'customer_name': o.shipping_full_name or (o.user.full_name if o.user else 'Guest'),
            'customer_email': o.user.email if o.user else 'guest@deport.com',
            'created_at': o.created_at.isoformat(),
            'total': float(o.total),
            'formatted_total': f"₹{float(o.total):,.2f}",
            'order_status': o.status,
            'status_display': o.get_status_display(),
            'payment_status': payment_status
        })

    return {
        'period': dates['period'],
        'start_date': start_dt.isoformat(),
        'end_date': end_dt.isoformat(),
        'prev_start_date': prev_start_dt.isoformat(),
        'prev_end_date': prev_end_dt.isoformat(),
        'grouping': active_grouping,
        'cards': cards,
        'sales_performance': sales_performance,
        'revenue_chart': revenue_chart_data,
        'orders_chart': orders_chart_data,
        'order_status_distribution': status_distribution,
        'top_selling_products': top_selling_products,
        'category_sales': category_sales,
        'recent_orders': recent_orders_list
    }
