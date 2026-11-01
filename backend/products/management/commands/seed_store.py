from django.core.management.base import BaseCommand
from django.utils.text import slugify
from categories.models import Category
from products.models import Product, ProductImage, Banner
from orders.models import Coupon
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = 'Seeds initial categories, products, images, banners, and coupons for the DEPORT store'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting DEPORT Store Database Seeding...'))

        # 1. Seed Categories with dynamic image_url
        category_data = [
            {
                'name': 'Handbags',
                'desc': 'Iconic structured silhouettes crafted from refined Italian leather.',
                'image_url': 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80'
            },
            {
                'name': 'Tote Bags',
                'desc': 'Spacious elegance engineered for seamless daily transitions.',
                'image_url': 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80'
            },
            {
                'name': 'Shoulder Bags',
                'desc': 'Classic slouchy and baguette cuts with smooth gold-tone hardware.',
                'image_url': 'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=800&q=80'
            },
            {
                'name': 'Crossbody Bags',
                'desc': 'Hands-free luxury designed with adjustable brass-accented straps.',
                'image_url': 'https://images.unsplash.com/photo-1566150476483-623049099965?auto=format&fit=crop&w=800&q=80'
            },
            {
                'name': 'Backpacks',
                'desc': 'Minimalist city carryalls built with ergonomics and modern style.',
                'image_url': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80'
            },
            {
                'name': 'Travel Bags',
                'desc': 'Sophisticated duffels and weekenders made for memorable journeys.',
                'image_url': 'https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=800&q=80'
            },
            {
                'name': 'Laptop Bags',
                'desc': 'Padded tech compartments wrapped in rich full-grain leather.',
                'image_url': 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=800&q=80'
            },
            {
                'name': 'Wallets',
                'desc': 'Compact cardholders and zip-around continental leather wallets.',
                'image_url': 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80'
            },
        ]

        categories_by_name = {}
        for c in category_data:
            cat, created = Category.objects.get_or_create(
                name=c['name'],
                defaults={
                    'slug': slugify(c['name']),
                    'description': c['desc'],
                    'image_url': c['image_url'],
                    'is_active': True
                }
            )
            if not cat.image_url:
                cat.image_url = c['image_url']
                cat.save(update_fields=['image_url'])
            categories_by_name[cat.name] = cat
            if created:
                self.stdout.write(self.style.SUCCESS(f' Created Category: {cat.name}'))

        # 2. Seed Products (22 Products)
        products_data = [
            # Handbags
            {
                'name': 'Aurelia Italian Calfskin Handbag',
                'sku': 'LUX-HB-001',
                'category': 'Handbags',
                'price': Decimal('495.00'),
                'compare': Decimal('580.00'),
                'desc': 'Exquisitely handcrafted in Florence using vegetable-tanned calfskin leather. The Aurelia combines a structured architectural silhouette with a spacious interior lined in soft microsuede.',
                'short_desc': 'Italian calfskin structured handbag.',
                'stock': 25,
                'is_active': True,
                'is_featured': True,
                'is_new': True,
                'is_best_seller': True,
            },
            {
                'name': 'Palazzo Croc-Embossed Top Handle',
                'sku': 'LUX-HB-002',
                'category': 'Handbags',
                'price': Decimal('560.00'),
                'compare': Decimal('650.00'),
                'desc': 'Sophisticated crocodile-embossed leather top-handle bag featuring gold-plated lock closure and detachable shoulder strap.',
                'short_desc': 'Glossy croc-embossed leather top handle.',
                'stock': 12,
                'is_active': True,
                'is_featured': True,
                'is_new': False,
                'is_best_seller': True,
            },
            {
                'name': 'Sienna Structured Mini Tote',
                'sku': 'LUX-HB-003',
                'category': 'Handbags',
                'price': Decimal('420.00'),
                'compare': None,
                'desc': 'Compact structured handbag with accordion side gussets and polished brass feet.',
                'short_desc': 'Mini structured calfskin top handle bag.',
                'stock': 18,
                'is_active': True,
                'is_featured': False,
                'is_new': True,
                'is_best_seller': False,
            },

            # Crossbody Bags
            {
                'name': 'Everyday Soft Nappa Crossbody',
                'sku': 'LUX-CB-004',
                'category': 'Crossbody Bags',
                'price': Decimal('285.00'),
                'compare': Decimal('320.00'),
                'desc': 'Compact yet cleverly organized. Offers sleek geometric lines, buttery soft nappa leather, and a magnetic flap closure.',
                'short_desc': 'Nappa leather hands-free crossbody.',
                'stock': 40,
                'is_active': True,
                'is_featured': True,
                'is_new': True,
                'is_best_seller': True,
            },
            {
                'name': 'Roma Flap Crossbody Bag',
                'sku': 'LUX-CB-005',
                'category': 'Crossbody Bags',
                'price': Decimal('310.00'),
                'compare': Decimal('360.00'),
                'desc': 'Sleek saddle silhouette with signature turn-lock hardware and adjustable crossbody strap.',
                'short_desc': 'Saddle leather flap crossbody.',
                'stock': 15,
                'is_active': True,
                'is_featured': False,
                'is_new': False,
                'is_best_seller': True,
            },
            {
                'name': 'Verona Micro Crossbody Pouch',
                'sku': 'LUX-CB-006',
                'category': 'Crossbody Bags',
                'price': Decimal('195.00'),
                'compare': None,
                'desc': 'Ultra-compact pouch designed for smartphone, cards, and keys. Crafted from durable pebble grain leather.',
                'short_desc': 'Micro grain leather phone pouch.',
                'stock': 0, # Out of stock product
                'is_active': True,
                'is_featured': False,
                'is_new': True,
                'is_best_seller': False,
            },

            # Tote Bags
            {
                'name': 'Urban Canvas & Leather Tote',
                'sku': 'LUX-TT-007',
                'category': 'Tote Bags',
                'price': Decimal('340.00'),
                'compare': Decimal('400.00'),
                'desc': 'Designed for effortless elegance on busy days. Features ultra-durable water-resistant organic canvas trimmed with rich saddle leather.',
                'short_desc': 'Heavyweight organic cotton & leather tote.',
                'stock': 30,
                'is_active': True,
                'is_featured': True,
                'is_new': False,
                'is_best_seller': True,
            },
            {
                'name': 'Verona Large Leather Shopper',
                'sku': 'LUX-TT-008',
                'category': 'Tote Bags',
                'price': Decimal('460.00'),
                'compare': None,
                'desc': 'Unstructured open tote with removable internal zippered pouch and reinforced shoulder handles.',
                'short_desc': 'Spacious open-top pebbled leather shopper.',
                'stock': 22,
                'is_active': True,
                'is_featured': False,
                'is_new': True,
                'is_best_seller': False,
            },
            {
                'name': 'Milano Workday Carryall Tote',
                'sku': 'LUX-TT-009',
                'category': 'Tote Bags',
                'price': Decimal('490.00'),
                'compare': Decimal('550.00'),
                'desc': 'Zippered main compartment with dedicated laptop slip sleeve and key leash.',
                'short_desc': 'Structured workday tote with zip closure.',
                'stock': 14,
                'is_active': True,
                'is_featured': True,
                'is_new': False,
                'is_best_seller': True,
            },

            # Shoulder Bags
            {
                'name': 'Luna Pebble Grain Shoulder Bag',
                'sku': 'LUX-SB-010',
                'category': 'Shoulder Bags',
                'price': Decimal('410.00'),
                'compare': Decimal('480.00'),
                'desc': 'Effortless relaxed luxury. Soft pebble-grain leather drapes comfortably against your side with a wide padded shoulder strap.',
                'short_desc': 'Supple pebble grain shoulder bag.',
                'stock': 15,
                'is_active': True,
                'is_featured': False,
                'is_new': False,
                'is_best_seller': True,
            },
            {
                'name': 'Baguette Chain Shoulder Pouch',
                'sku': 'LUX-SB-011',
                'category': 'Shoulder Bags',
                'price': Decimal('325.00'),
                'compare': None,
                'desc': '90s-inspired baguette shape accented with a removable gold chain strap.',
                'short_desc': 'Chic baguette pouch with gold hardware.',
                'stock': 28,
                'is_active': True,
                'is_featured': True,
                'is_new': True,
                'is_best_seller': False,
            },

            # Backpacks
            {
                'name': 'Minimalist City Leather Backpack',
                'sku': 'LUX-BP-012',
                'category': 'Backpacks',
                'price': Decimal('395.00'),
                'compare': Decimal('450.00'),
                'desc': 'Sleek, modern backpack tailored for city commutes and weekend explorations. Features an ergonomic padded back panel.',
                'short_desc': 'City commute leather backpack with 14" sleeve.',
                'stock': 20,
                'is_active': True,
                'is_featured': False,
                'is_new': True,
                'is_best_seller': False,
            },
            {
                'name': 'Monaco Convertible Backpack Tote',
                'sku': 'LUX-BP-013',
                'category': 'Backpacks',
                'price': Decimal('430.00'),
                'compare': Decimal('490.00'),
                'desc': 'Versatile design seamlessly converts from shoulder tote to hands-free backpack in seconds.',
                'short_desc': 'Convertible 2-in-1 leather tote backpack.',
                'stock': 10,
                'is_active': True,
                'is_featured': True,
                'is_new': False,
                'is_best_seller': True,
            },

            # Travel Bags
            {
                'name': 'Grand Weekend Leather Duffel',
                'sku': 'LUX-TB-014',
                'category': 'Travel Bags',
                'price': Decimal('680.00'),
                'compare': Decimal('750.00'),
                'desc': 'The ultimate getaway travel companion. Meets international carry-on requirements with a dedicated ventilated shoe compartment.',
                'short_desc': 'Carry-on approved full-grain leather duffel.',
                'stock': 12,
                'is_active': True,
                'is_featured': True,
                'is_new': True,
                'is_best_seller': False,
            },
            {
                'name': 'Vanguard Garment Travel Bag',
                'sku': 'LUX-TB-015',
                'category': 'Travel Bags',
                'price': Decimal('740.00'),
                'compare': Decimal('820.00'),
                'desc': 'Combines suit garment bag protection with roomy duffel volume for flawless business travel.',
                'short_desc': 'Full-grain leather 2-in-1 garment duffel.',
                'stock': 8,
                'is_active': True,
                'is_featured': False,
                'is_new': True,
                'is_best_seller': False,
            },

            # Laptop Bags
            {
                'name': 'Executive Dual-Compartment Briefcase',
                'sku': 'LUX-LB-016',
                'category': 'Laptop Bags',
                'price': Decimal('520.00'),
                'compare': Decimal('600.00'),
                'desc': 'Refined professionalism redefined. Dual padded laptop compartments with faux-fur lining safeguard laptops up to 16".',
                'short_desc': 'Padded 16" laptop brief with luggage strap.',
                'stock': 18,
                'is_active': True,
                'is_featured': True,
                'is_new': False,
                'is_best_seller': False,
            },
            {
                'name': 'Slim Tech Leather Document Case',
                'sku': 'LUX-LB-017',
                'category': 'Laptop Bags',
                'price': Decimal('360.00'),
                'compare': None,
                'desc': 'Ultra-slim leather portfolio envelope for 14" laptops and documents.',
                'short_desc': 'Slim magnetic-closure leather laptop sleeve.',
                'stock': 25,
                'is_active': True,
                'is_featured': False,
                'is_new': True,
                'is_best_seller': False,
            },

            # Wallets
            {
                'name': 'Continental Zip-Around Leather Wallet',
                'sku': 'LUX-WL-018',
                'category': 'Wallets',
                'price': Decimal('165.00'),
                'compare': Decimal('195.00'),
                'desc': 'Classic zip-around continental wallet with 12 card slots, dual full-length bill compartments, and a zippered coin pocket.',
                'short_desc': 'RFID-protected leather zip wallet.',
                'stock': 50,
                'is_active': True,
                'is_featured': False,
                'is_new': False,
                'is_best_seller': True,
            },
            {
                'name': 'Slim Bifold Cardholder Wallet',
                'sku': 'LUX-WL-019',
                'category': 'Wallets',
                'price': Decimal('95.00'),
                'compare': Decimal('120.00'),
                'desc': 'Minimalist bifold cardholder crafted from smooth box calf leather with cash clip.',
                'short_desc': 'Slim bifold calfskin cardholder.',
                'stock': 60,
                'is_active': True,
                'is_featured': False,
                'is_new': True,
                'is_best_seller': False,
            },
            {
                'name': 'Accordion Card Case',
                'sku': 'LUX-WL-020',
                'category': 'Wallets',
                'price': Decimal('110.00'),
                'compare': None,
                'desc': 'Compact expanding card pouch with snap flap closure.',
                'short_desc': 'Expanding pebble leather card pouch.',
                'stock': 35,
                'is_active': True,
                'is_featured': False,
                'is_new': False,
                'is_best_seller': False,
            },

            # Inactive & Archived Products (Requirement Test)
            {
                'name': 'Archived Vintage Messenger (Inactive)',
                'sku': 'LUX-INACT-021',
                'category': 'Handbags',
                'price': Decimal('290.00'),
                'compare': None,
                'desc': 'Inactive product test item.',
                'short_desc': 'Inactive product.',
                'stock': 10,
                'is_active': False, # Inactive product
                'is_featured': False,
                'is_new': False,
                'is_best_seller': False,
            },
            {
                'name': 'Legacy Canvas Duffle (Out of Stock)',
                'sku': 'LUX-OOS-022',
                'category': 'Travel Bags',
                'price': Decimal('450.00'),
                'compare': Decimal('520.00'),
                'desc': 'Out of stock duffle test item.',
                'short_desc': 'Out of stock travel duffle.',
                'stock': 0, # Out of stock
                'is_active': True,
                'is_featured': False,
                'is_new': False,
                'is_best_seller': False,
            },
        ]

        for p_info in products_data:
            cat_obj = categories_by_name.get(p_info['category'])
            prod, created = Product.objects.get_or_create(
                sku=p_info['sku'],
                defaults={
                    'name': p_info['name'],
                    'slug': slugify(p_info['name']),
                    'category': cat_obj,
                    'price': p_info['price'],
                    'compare_at_price': p_info['compare'],
                    'description': p_info['desc'],
                    'short_description': p_info['short_desc'],
                    'brand': 'DEPORT',
                    'stock_quantity': p_info['stock'],
                    'is_active': p_info['is_active'],
                    'is_featured': p_info['is_featured'],
                    'is_new': p_info['is_new'],
                    'is_best_seller': p_info['is_best_seller']
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f' Created Product: {prod.name} (SKU: {prod.sku})'))

        # 3. Seed Product Images for all products in database
        category_image_pool = {
            'Handbags': [
                'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=80'
            ],
            'Tote Bags': [
                'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80'
            ],
            'Shoulder Bags': [
                'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1566150476483-623049099965?auto=format&fit=crop&w=1000&q=80'
            ],
            'Crossbody Bags': [
                'https://images.unsplash.com/photo-1566150476483-623049099965?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80'
            ],
            'Backpacks': [
                'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=1000&q=80'
            ],
            'Travel Bags': [
                'https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80'
            ],
            'Laptop Bags': [
                'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=80'
            ],
            'Wallets': [
                'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1000&q=80',
                'https://images.unsplash.com/photo-1606503828347-8e6f1f44e12e?auto=format&fit=crop&w=1000&q=80'
            ],
        }

        default_images = [
            'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80',
            'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=80',
        ]

        all_products = Product.objects.all()
        for prod in all_products:
            if prod.images.count() == 0:
                cat_name = prod.category.name if prod.category else 'Handbags'
                images_list = category_image_pool.get(cat_name, default_images)
                for idx, img_url in enumerate(images_list):
                    ProductImage.objects.create(
                        product=prod,
                        image_url=img_url,
                        alt_text=f"{prod.name} view {idx + 1}",
                        is_primary=(idx == 0),
                        sort_order=idx
                    )
                self.stdout.write(self.style.SUCCESS(f' Attached images to: {prod.name}'))

        # 4. Seed Dynamic Banners
        Banner.objects.get_or_create(
            placement='hero',
            defaults={
                'title': 'Carry Your Style',
                'tagline': 'NEW COLLECTION 2026',
                'subtitle': 'Discover timeless leather bags and modern luxury carryalls meticulously engineered for your everyday elegance.',
                'image_url': 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=80',
                'button_text': 'Shop Collection',
                'button_link': '/shop',
                'secondary_button_text': 'Explore Handbags',
                'secondary_button_link': '/shop?category=handbags',
                'is_active': True,
                'display_order': 1
            }
        )

        Banner.objects.get_or_create(
            placement='promotional',
            defaults={
                'title': 'The Aurelia Italian Calfskin Series',
                'tagline': 'LIMITED EDITION CRAFTSMANSHIP',
                'subtitle': 'Handcrafted in Florence using vegetable-tanned leathers and finished with solid emerald-accented brass hardware.',
                'image_url': 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1600&q=80',
                'button_text': 'Discover Aurelia Series',
                'button_link': '/product/aurelia-italian-calfskin-handbag',
                'is_active': True,
                'display_order': 2
            }
        )
        self.stdout.write(self.style.SUCCESS(' Seeded Dynamic Hero & Promotional Banners.'))

        # 5. Seed Initial Active Coupons
        Coupon.objects.get_or_create(
            code='DEPORT5',
            defaults={
                'discount_type': 'percentage',
                'discount_value': Decimal('5.00'),
                'min_order_amount': Decimal('50.00'),
                'max_discount_amount': Decimal('100.00'),
                'start_date': timezone.now() - timedelta(days=30),
                'expiration_date': timezone.now() + timedelta(days=365),
                'usage_limit': 1000,
                'per_user_limit': 2,
                'is_active': True
            }
        )

        Coupon.objects.get_or_create(
            code='DEPORT10',
            defaults={
                'discount_type': 'percentage',
                'discount_value': Decimal('10.00'),
                'min_order_amount': Decimal('50.00'),
                'max_discount_amount': Decimal('100.00'),
                'start_date': timezone.now() - timedelta(days=30),
                'expiration_date': timezone.now() + timedelta(days=365),
                'usage_limit': 1000,
                'per_user_limit': 2,
                'is_active': True
            }
        )

        Coupon.objects.get_or_create(
            code='WELCOME20',
            defaults={
                'discount_type': 'fixed',
                'discount_value': Decimal('20.00'),
                'min_order_amount': Decimal('100.00'),
                'start_date': timezone.now() - timedelta(days=30),
                'expiration_date': timezone.now() + timedelta(days=180),
                'usage_limit': 500,
                'per_user_limit': 1,
                'is_active': True
            }
        )
        self.stdout.write(self.style.SUCCESS(' Seeded Active Coupons (DEPORT5, DEPORT10, WELCOME20).'))

        self.stdout.write(self.style.SUCCESS('DEPORT Store Database Seeding Completed Successfully!'))
