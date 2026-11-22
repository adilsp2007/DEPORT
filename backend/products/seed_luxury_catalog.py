import os
import sys

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + '/..')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from decimal import Decimal
from django.utils.text import slugify
from products.models import Product, ProductImage, Category

def run():
    print("=== Starting Luxury Catalog Seeding & Deduplication ===")

    # 1. Delete ugly screenshot files from disk
    media_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'media', 'products')
    junk_files = [
        'Screenshot_2025-07-14_082159-cropped.jpg',
        'Screenshot_2025-07-14_084211-cropped.jpg',
        'Screenshot_2025-07-14_084211-cropped_91CUGOZ.jpg',
        'Screenshot_2025-07-14_084557-cropped.jpg',
        'Screenshot_2025-07-14_084557-cropped_sBOCjwA.jpg',
        'ca81fa68-6f53-421c-8c95-ac1ea44d06fe-cropped.jpg',
    ]
    for jf in junk_files:
        p = os.path.join(media_dir, jf)
        if os.path.exists(p):
            try:
                os.remove(p)
                print(f"Removed junk file: {jf}")
            except Exception as e:
                print(f"Could not remove {jf}: {e}")

    # Remove any ProductImage referencing the junk files
    for jf in junk_files:
        ProductImage.objects.filter(image__contains=jf).delete()

    # Soft-delete or clean junk test category 'abcd'
    Category.objects.filter(slug='abcd').update(is_deleted=True, is_active=False)

    # 2. Define the 48 curated products (6 products per 8 categories)
    catalog = [
        # --- HANDBAGS ---
        {
            "category_slug": "handbags",
            "name": "DEPORT Aurelia Italian Calfskin Handbag",
            "sku": "DEP-HB-001",
            "price": Decimal("6499.00"),
            "compare_at_price": Decimal("9999.00"),
            "stock_quantity": 24,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": True,
            "image_file": "handbags_1_1584917865442-de89df76afd3.jpg",
            "unsplash_id": "1584917865442-de89df76afd3",
            "short_description": "Handcrafted structured calfskin handbag with solid emerald-burnished brass hardware.",
            "description": "The Aurelia Handbag epitomizes Italian leather excellence. Sculpted from full-grain vegetable-tanned Tuscan calfskin, it features hand-stitched rolled top handles, an optional crossbody strap, and protective brass feet. The micro-suede interior contains dedicated smartphone and zippered security compartments.",
        },
        {
            "category_slug": "handbags",
            "name": "DEPORT Sienna Structured Mini Tote",
            "sku": "DEP-HB-002",
            "price": Decimal("7299.00"),
            "compare_at_price": Decimal("11499.00"),
            "stock_quantity": 18,
            "is_new": True,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "handbags_2_1590874103328-eac38a683ce7.jpg",
            "unsplash_id": "1590874103328-eac38a683ce7",
            "short_description": "Compact architectural silhouette in ochre-tan pebble leather with dual carry options.",
            "description": "Architectural lines meet everyday practicality in the Sienna Mini Tote. Cut from durable pebble-grain cowhide that resists moisture and scratches, this signature piece is accented by polished palladium hardware and a secure magnetic fold-over bridge closure.",
        },
        {
            "category_slug": "handbags",
            "name": "DEPORT Palazzo Croc-Embossed Top Handle",
            "sku": "DEP-HB-003",
            "price": Decimal("8999.00"),
            "compare_at_price": Decimal("13999.00"),
            "stock_quantity": 14,
            "is_new": False,
            "is_featured": True,
            "is_best_seller": False,
            "image_file": "handbags_3_1566150905458-1bf1fc113f0d.jpg",
            "unsplash_id": "1566150905458-1bf1fc113f0d",
            "short_description": "Exquisite crocodile-embossed leather satchel with signature monogram lock.",
            "description": "An opulent homage to vintage glamour. The Palazzo handbag is constructed from hand-glazed crocodile-embossed leather, crowned with an arched bamboo-accented top handle and a turn-lock closure.",
        },
        {
            "category_slug": "handbags",
            "name": "DEPORT Verona Classic Box Handbag",
            "sku": "DEP-HB-004",
            "price": Decimal("5999.00"),
            "compare_at_price": Decimal("8499.00"),
            "stock_quantity": 28,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "handbags_4_1548036328-c9fa89d128fa.jpg",
            "unsplash_id": "1548036328-c9fa89d128fa",
            "short_description": "Rich cognac leather box satchel with hand-burnished edge paint.",
            "description": "Form follows timeless elegance in the Verona Classic Box Handbag. Handcrafted with traditional saddlery techniques, each edge is manually bevelled and sealed with seven layers of waterproof lacquer.",
        },
        {
            "category_slug": "handbags",
            "name": "DEPORT Bellagio Midnight Noir Satchel",
            "sku": "DEP-HB-005",
            "price": Decimal("9499.00"),
            "compare_at_price": Decimal("14999.00"),
            "stock_quantity": 12,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": False,
            "image_file": "handbags_5_1591561954557-26941169b49e.jpg",
            "unsplash_id": "1591561954557-26941169b49e",
            "short_description": "Monochromatic deep black nappa satchel with brushed gunmetal hardware.",
            "description": "The pinnacle of understated luxury. Built from ultra-supple full-grain midnight nappa leather, the Bellagio Satchel provides generous volume without compromising its razor-sharp silhouette.",
        },
        {
            "category_slug": "handbags",
            "name": "DEPORT Milano Scarlet Trapezoid Handbag",
            "sku": "DEP-HB-006",
            "price": Decimal("8199.00"),
            "compare_at_price": Decimal("12999.00"),
            "stock_quantity": 16,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "handbags_6_1594223274512-ad4803739b7c.jpg",
            "unsplash_id": "1594223274512-ad4803739b7c",
            "short_description": "Striking crimson leather statement bag with geometric faceted body.",
            "description": "Make an unforgettable impression with the Milano Scarlet Handbag. Crafted in deep ruby red Tuscan leather with precise hand-painted corners and satin gold hardware.",
        },

        # --- TOTE BAGS ---
        {
            "category_slug": "tote-bags",
            "name": "DEPORT Grand Atelier Shopper Tote",
            "sku": "DEP-TT-001",
            "price": Decimal("5499.00"),
            "compare_at_price": Decimal("7999.00"),
            "stock_quantity": 30,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": True,
            "image_file": "tote-bags_1_1544816155-12df9643f363.jpg",
            "unsplash_id": "1544816155-12df9643f363",
            "short_description": "Spacious heavy-duty canvas tote reinforced with bridle leather trim.",
            "description": "Engineered for weekend escapes and demanding workdays alike. Combining 18oz waterproof cotton canvas with thick bridle leather handles, the Grand Atelier Shopper accommodates up to a 16-inch laptop with room to spare.",
        },
        {
            "category_slug": "tote-bags",
            "name": "DEPORT Milano Workday Carryall Tote",
            "sku": "DEP-TT-002",
            "price": Decimal("6899.00"),
            "compare_at_price": Decimal("9999.00"),
            "stock_quantity": 22,
            "is_new": False,
            "is_featured": True,
            "is_best_seller": True,
            "image_file": "tote-bags_2_1575032617751-6ddec2089882.jpg",
            "unsplash_id": "1575032617751-6ddec2089882",
            "short_description": "Polished executive tote with padded tech sleeve and zip-top security.",
            "description": "A refined solution for modern professionals. Features a central padded 15\" laptop divider, key leash, pen loops, and a waterproof twill lining.",
        },
        {
            "category_slug": "tote-bags",
            "name": "DEPORT Verona Large Nappa Shopper",
            "sku": "DEP-TT-003",
            "price": Decimal("7599.00"),
            "compare_at_price": Decimal("11299.00"),
            "stock_quantity": 19,
            "is_new": True,
            "is_featured": False,
            "is_best_seller": False,
            "image_file": "tote-bags_3_1598532163257-ae3c6b2524b6.jpg",
            "unsplash_id": "1598532163257-ae3c6b2524b6",
            "short_description": "Silky-smooth olive nappa leather carryall with generous interior volume.",
            "description": "Draped in buttery nappa leather that softens beautifully with age. Comes complete with a detachable matching leather zip wristlet pouch.",
        },
        {
            "category_slug": "tote-bags",
            "name": "DEPORT Amalfi Structured Canvas & Leather Tote",
            "sku": "DEP-TT-004",
            "price": Decimal("4899.00"),
            "compare_at_price": Decimal("6999.00"),
            "stock_quantity": 25,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "tote-bags_alt_1508296695146-257a814070b4.jpg",
            "unsplash_id": "1508296695146-257a814070b4",
            "short_description": "Breezy coastal aesthetic paired with full-grain leather base and handles.",
            "description": "Inspired by the Italian Riviera. Heavyweight woven textured fabric paired with rich caramel bridle leather guarantees resilience through years of travels.",
        },
        {
            "category_slug": "tote-bags",
            "name": "DEPORT Signature Artisan Market Tote",
            "sku": "DEP-TT-005",
            "price": Decimal("6299.00"),
            "compare_at_price": Decimal("8999.00"),
            "stock_quantity": 17,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": False,
            "image_file": "tote-bags_5_1490114538077-0a7f8cb49891.jpg",
            "unsplash_id": "1490114538077-0a7f8cb49891",
            "short_description": "Vegetable-tanned leather market tote with natural raw-edge interior.",
            "description": "Raw, authentic leather craftsmanship. Crafted entirely from 2.2mm thick unlined vegetable-tanned shoulder leather, developing a unique personal patina from day one.",
        },
        {
            "category_slug": "tote-bags",
            "name": "DEPORT Monaco Executive Double-Handle Tote",
            "sku": "DEP-TT-006",
            "price": Decimal("8499.00"),
            "compare_at_price": Decimal("12499.00"),
            "stock_quantity": 15,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": False,
            "image_file": "tote-bags_6_1523779917675-b6ed3a42a561.jpg",
            "unsplash_id": "1523779917675-b6ed3a42a561",
            "short_description": "Structured dual-handle carryall in deep ebony leather with gold accents.",
            "description": "Uncompromising executive elegance. Double rolled top handles, an extended brass zip closure, and interior document organizers keep everything pristine.",
        },

        # --- SHOULDER BAGS ---
        {
            "category_slug": "shoulder-bags",
            "name": "DEPORT Luna Pebble Grain Shoulder Bag",
            "sku": "DEP-SB-001",
            "price": Decimal("5799.00"),
            "compare_at_price": Decimal("8499.00"),
            "stock_quantity": 21,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": True,
            "image_file": "shoulder-bags_1_1605100804763-247f67b3557e.jpg",
            "unsplash_id": "1605100804763-247f67b3557e",
            "short_description": "Crescent silhouette shoulder bag with wide ergonomic strap and brass buckle.",
            "description": "Flowing curves define the Luna Shoulder Bag. Designed to nestle seamlessly under the arm, crafted in supple pebble-grain leather with a secure magnetic top tab.",
        },
        {
            "category_slug": "shoulder-bags",
            "name": "DEPORT Baguette Chain Shoulder Pouch",
            "sku": "DEP-SB-002",
            "price": Decimal("4999.00"),
            "compare_at_price": Decimal("7299.00"),
            "stock_quantity": 26,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "shoulder-bags_2_1577733966973-d680bffd2e80.jpg",
            "unsplash_id": "1577733966973-d680bffd2e80",
            "short_description": "90s-inspired minimalist shoulder baguette with detachable chunky curb chain.",
            "description": "Chic minimalism at its finest. The Baguette Pouch pairs a compact streamlined profile with a solid metal chain strap that transitions seamlessly from day to gala.",
        },
        {
            "category_slug": "shoulder-bags",
            "name": "DEPORT Vintage Saddle Flap Shoulder Bag",
            "sku": "DEP-SB-003",
            "price": Decimal("6399.00"),
            "compare_at_price": Decimal("9499.00"),
            "stock_quantity": 18,
            "is_new": False,
            "is_featured": True,
            "is_best_seller": False,
            "image_file": "shoulder-bags_3_1618219908412-a29a1bb7b86e.jpg",
            "unsplash_id": "1618219908412-a29a1bb7b86e",
            "short_description": "Equestrian-inspired saddle bag with contrast stitching and horseshoe ring.",
            "description": "Equestrian roots meet modern city living. Hand-molded saddle silhouette with contrast wax thread and an adjustable drop shoulder strap.",
        },
        {
            "category_slug": "shoulder-bags",
            "name": "DEPORT Crescent Minimalist Leather Hobo",
            "sku": "DEP-SB-004",
            "price": Decimal("5299.00"),
            "compare_at_price": Decimal("7899.00"),
            "stock_quantity": 20,
            "is_new": True,
            "is_featured": False,
            "is_best_seller": False,
            "image_file": "shoulder-bags_4_1509319117193-57bab727e09d.jpg",
            "unsplash_id": "1509319117193-57bab727e09d",
            "short_description": "Fluid slouchy hobo bag in ultra-soft tumbled Italian cowhide.",
            "description": "Effortless casual luxury. The Crescent Hobo drapes naturally, featuring a reinforced flat shoulder rest and an internal zipped valuables compartment.",
        },
        {
            "category_slug": "shoulder-bags",
            "name": "DEPORT Sophia Pleated Nappa Shoulder Bag",
            "sku": "DEP-SB-005",
            "price": Decimal("7199.00"),
            "compare_at_price": Decimal("10999.00"),
            "stock_quantity": 14,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "shoulder-bags_5_1597633425046-08f5110420b5.jpg",
            "unsplash_id": "1597633425046-08f5110420b5",
            "short_description": "Artisanal accordion pleating along buttery-soft nappa leather edges.",
            "description": "Master craftsmanship on display. Intricate manual pleating creates a sculptural silhouette, secured by a hidden magnetic kiss-lock mechanism.",
        },
        {
            "category_slug": "shoulder-bags",
            "name": "DEPORT Aethelgard Quilted Shoulder Purse",
            "sku": "DEP-SB-006",
            "price": Decimal("6799.00"),
            "compare_at_price": Decimal("9899.00"),
            "stock_quantity": 23,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": False,
            "image_file": "shoulder-bags_6_1608256246200-53e635b5b65f.jpg",
            "unsplash_id": "1608256246200-53e635b5b65f",
            "short_description": "Diamond-quilted lambskin with leather-interlaced gold shoulder chain.",
            "description": "Timeless quilted sophistication. Crafted from smooth lambskin with double-stitch diamond quilting, finished with DEPORT's hallmark gold twist clasp.",
        },

        # --- CROSSBODY BAGS ---
        {
            "category_slug": "crossbody-bags",
            "name": "DEPORT Roma Flap Crossbody Bag",
            "sku": "DEP-CB-001",
            "price": Decimal("4299.00"),
            "compare_at_price": Decimal("6499.00"),
            "stock_quantity": 32,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": True,
            "image_file": "crossbody-bags_1_1601924994987-69e26d50dc26.jpg",
            "unsplash_id": "1601924994987-69e26d50dc26",
            "short_description": "Classic front-flap crossbody in smooth box calfskin with magnetic snap.",
            "description": "Your indispensable everyday partner. The Roma Flap combines a compact footprint with thoughtful internal gussets that expand gently to hold essentials.",
        },
        {
            "category_slug": "crossbody-bags",
            "name": "DEPORT Everyday Soft Nappa Crossbody",
            "sku": "DEP-CB-002",
            "price": Decimal("3999.00"),
            "compare_at_price": Decimal("5999.00"),
            "stock_quantity": 27,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "crossbody-bags_2_1524498250077-390f9e378fc0.jpg",
            "unsplash_id": "1524498250077-390f9e378fc0",
            "short_description": "Featherlight crossbody with dual zip pockets and adjustable webbing strap.",
            "description": "Designed for continuous motion. Soft nappa leather conforms comfortably against the hip, complemented by high-glide metal zips and a quick-adjust strap.",
        },
        {
            "category_slug": "crossbody-bags",
            "name": "DEPORT Chelsea Camera Crossbody Bag",
            "sku": "DEP-CB-003",
            "price": Decimal("4599.00"),
            "compare_at_price": Decimal("6999.00"),
            "stock_quantity": 25,
            "is_new": True,
            "is_featured": False,
            "is_best_seller": False,
            "image_file": "crossbody-bags_3_1549465220-1a8b9238cd48.jpg",
            "unsplash_id": "1549465220-1a8b9238cd48",
            "short_description": "Structured boxy camera bag silhouette with exterior slip card pocket.",
            "description": "Retro camera styling meets modern utility. Built from scratch-resistant saffiano leather with an external slip pocket for quick transit-card access.",
        },
        {
            "category_slug": "crossbody-bags",
            "name": "DEPORT Verona Micro Crossbody Pouch",
            "sku": "DEP-CB-004",
            "price": Decimal("3299.00"),
            "compare_at_price": Decimal("4899.00"),
            "stock_quantity": 35,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "crossbody-bags_4_1512314889357-e157c22f938d.jpg",
            "unsplash_id": "1512314889357-e157c22f938d",
            "short_description": "Petite phone & cardholder crossbody in burnished bridle leather.",
            "description": "Minimalism at its most disciplined. Perfectly sized for large smartphones, passport, and cards, finished with an ultra-fine leather cord strap.",
        },
        {
            "category_slug": "crossbody-bags",
            "name": "DEPORT Kensington Saddle Crossbody",
            "sku": "DEP-CB-005",
            "price": Decimal("4899.00"),
            "compare_at_price": Decimal("7299.00"),
            "stock_quantity": 18,
            "is_new": False,
            "is_featured": True,
            "is_best_seller": False,
            "image_file": "crossbody-bags_5_1563245372-f21724e3856d.jpg",
            "unsplash_id": "1563245372-f21724e3856d",
            "short_description": "Heritage equestrian curved flap bag with antiqued brass O-ring.",
            "description": "Rich heritage spirit. Crafted from hand-rubbed pull-up leather that reveals lighter tones as it flexes, developing character with every journey.",
        },
        {
            "category_slug": "crossbody-bags",
            "name": "DEPORT Torino Compact Tech Crossbody",
            "sku": "DEP-CB-006",
            "price": Decimal("3799.00"),
            "compare_at_price": Decimal("5499.00"),
            "stock_quantity": 29,
            "is_new": True,
            "is_featured": False,
            "is_best_seller": False,
            "image_file": "crossbody-bags_6_1543163521-1bf539c55dd2.jpg",
            "unsplash_id": "1543163521-1bf539c55dd2",
            "short_description": "Sleek travel sling with RFID-blocking passport slot and key clip.",
            "description": "Urban commute perfection. Water-resistant matte calfskin, weather-sealed zippers, and dedicated organization for power banks, cables, and earbuds.",
        },

        # --- BACKPACKS ---
        {
            "category_slug": "backpacks",
            "name": "DEPORT Heritage Full-Grain Rucksack",
            "sku": "DEP-BP-001",
            "price": Decimal("7999.00"),
            "compare_at_price": Decimal("11999.00"),
            "stock_quantity": 22,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": True,
            "image_file": "backpacks_1_1553062407-98eeb64c6a62.jpg",
            "unsplash_id": "1553062407-98eeb64c6a62",
            "short_description": "Rugged yet luxurious full-grain leather pack with drawstring and buckle flap.",
            "description": "The quintessential explorer's luxury rucksack. Crafted from 2.0mm thick full-grain leather, equipped with padded air-mesh shoulder straps, 15\" laptop slot, and brass hardware.",
        },
        {
            "category_slug": "backpacks",
            "name": "DEPORT Venture Roll-Top Leather Travel Pack",
            "sku": "DEP-BP-002",
            "price": Decimal("8499.00"),
            "compare_at_price": Decimal("12899.00"),
            "stock_quantity": 16,
            "is_new": False,
            "is_featured": True,
            "is_best_seller": False,
            "image_file": "backpacks_2_1622560480605-d83c853bc5c3.jpg",
            "unsplash_id": "1622560480605-d83c853bc5c3",
            "short_description": "Expandable roll-top travel pack with waterproof zipper side access.",
            "description": "Adaptable capacity for urban commutes or 3-day trips. Roll-top mechanism expands volume by 6 liters, while a quick-access side zip lets you retrieve your laptop in seconds.",
        },
        {
            "category_slug": "backpacks",
            "name": "DEPORT Minimalist City Commuter Backpack",
            "sku": "DEP-BP-003",
            "price": Decimal("6999.00"),
            "compare_at_price": Decimal("9999.00"),
            "stock_quantity": 28,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "backpacks_3_1588850561407-ed78c282e89b.jpg",
            "unsplash_id": "1588850561407-ed78c282e89b",
            "short_description": "Streamlined matte black leather backpack tailored for slim modern electronics.",
            "description": "Sleek and stealthy. Designed to maintain an ultra-slim 4-inch profile whether full or empty, with integrated cable routing channels and a padded 16\" laptop cradle.",
        },
        {
            "category_slug": "backpacks",
            "name": "DEPORT Monaco Convertible Backpack Tote",
            "sku": "DEP-BP-004",
            "price": Decimal("7499.00"),
            "compare_at_price": Decimal("10999.00"),
            "stock_quantity": 19,
            "is_new": True,
            "is_featured": False,
            "is_best_seller": False,
            "image_file": "backpacks_4_1547949003-9792a18a2601.jpg",
            "unsplash_id": "1547949003-9792a18a2601",
            "short_description": "Hybrid design that switches seamlessly between tote and backpack carry.",
            "description": "Dual functionality without stylistic sacrifice. Tuck-away shoulder straps convert this tote into an ergonomic backpack in under 5 seconds.",
        },
        {
            "category_slug": "backpacks",
            "name": "DEPORT Alpine Waxed Canvas & Leather Pack",
            "sku": "DEP-BP-005",
            "price": Decimal("6499.00"),
            "compare_at_price": Decimal("9299.00"),
            "stock_quantity": 25,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "backpacks_5_1578632767115-351597cf2477.jpg",
            "unsplash_id": "1578632767115-351597cf2477",
            "short_description": "Heavy weatherproof canvas accented with hand-waxed vegetable bridle leather.",
            "description": "Built to withstand inclement weather in style. Waxed cotton repellency combined with thick leather base panelling protects gear during transit.",
        },
        {
            "category_slug": "backpacks",
            "name": "DEPORT Sovereign Executive Laptop Backpack",
            "sku": "DEP-BP-006",
            "price": Decimal("8999.00"),
            "compare_at_price": Decimal("13499.00"),
            "stock_quantity": 15,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": False,
            "image_file": "backpacks_6_1517445312882-bc9910d016b7.jpg",
            "unsplash_id": "1517445312882-bc9910d016b7",
            "short_description": "Triple-compartment luxury leather pack with luggage trolley pass-through sleeve.",
            "description": "Engineered for international business travel. Features dedicated tech, documents, and apparel zones, TSA-compliant flat lay opening, and luggage trolley sleeve.",
        },

        # --- TRAVEL BAGS ---
        {
            "category_slug": "travel-bags",
            "name": "DEPORT Grand Weekend Leather Duffel",
            "sku": "DEP-TB-001",
            "price": Decimal("11999.00"),
            "compare_at_price": Decimal("17999.00"),
            "stock_quantity": 18,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": True,
            "image_file": "travel-bags_1_1556905055-8f358a7a47b2.jpg",
            "unsplash_id": "1556905055-8f358a7a47b2",
            "short_description": "Classic 45-liter carry-on duffel in full-grain Italian timber leather.",
            "description": "Your ultimate travel heirloom. Sized precisely to international carry-on requirements, featuring reinforced dual handles, heavy-gauge two-way brass zippers, and a detachable padded shoulder strap.",
        },
        {
            "category_slug": "travel-bags",
            "name": "DEPORT Vanguard Garment & Travel Holdall",
            "sku": "DEP-TB-002",
            "price": Decimal("12999.00"),
            "compare_at_price": Decimal("19499.00"),
            "stock_quantity": 12,
            "is_new": False,
            "is_featured": True,
            "is_best_seller": False,
            "image_file": "travel-bags_2_1581044777550-4cfa60707c03.jpg",
            "unsplash_id": "1581044777550-4cfa60707c03",
            "short_description": "Innovative suit garment bag that zips into a spacious cylindrical holdall.",
            "description": "Arrive with garments unwrinkled. Unrolls completely into a full-length suit carrier, then zips up into a spacious luxury duffel with internal shoe compartment.",
        },
        {
            "category_slug": "travel-bags",
            "name": "DEPORT Navigator Weekender Leather Duffel",
            "sku": "DEP-TB-003",
            "price": Decimal("10499.00"),
            "compare_at_price": Decimal("15999.00"),
            "stock_quantity": 20,
            "is_new": True,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "travel-bags_3_1490481651871-ab68de25d43d.jpg",
            "unsplash_id": "1490481651871-ab68de25d43d",
            "short_description": "Medium-sized barrel duffel tailored for 2-3 day getaways.",
            "description": "Balanced proportions and rugged elegance. High-grade cognac leather with double-reinforced bottom and internal mesh organization pockets.",
        },
        {
            "category_slug": "travel-bags",
            "name": "DEPORT Horizon Leather Cabin Holdall",
            "sku": "DEP-TB-004",
            "price": Decimal("11299.00"),
            "compare_at_price": Decimal("16999.00"),
            "stock_quantity": 15,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": False,
            "image_file": "travel-bags_4_1445205170230-053b83016050.jpg",
            "unsplash_id": "1445205170230-053b83016050",
            "short_description": "Hand-buffed espresso leather holdall with brass padlock and leather key fob.",
            "description": "Traditional British motoring luggage styling. Finished with antiqued solid brass hardware, luggage tag, and protective floor studs.",
        },
        {
            "category_slug": "travel-bags",
            "name": "DEPORT Sovereign 48-Hour Travel Bag",
            "sku": "DEP-TB-005",
            "price": Decimal("13499.00"),
            "compare_at_price": Decimal("20999.00"),
            "stock_quantity": 10,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": False,
            "image_file": "travel-bags_5_1483985988355-763728e1935b.jpg",
            "unsplash_id": "1483985988355-763728e1935b",
            "short_description": "Top-tier vegetable-tanned duffel featuring separate ventilated shoe pocket.",
            "description": "The ultimate luxury traveler's companion. Dedicated exterior side-loading ventilated shoe chamber keeps footwear isolated from clean attire.",
        },
        {
            "category_slug": "travel-bags",
            "name": "DEPORT Globetrotter Waxed Canvas & Bridle Duffel",
            "sku": "DEP-TB-006",
            "price": Decimal("9999.00"),
            "compare_at_price": Decimal("14999.00"),
            "stock_quantity": 22,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "travel-bags_6_1492707892479-7bc8d5a4ee93.jpg",
            "unsplash_id": "1492707892479-7bc8d5a4ee93",
            "short_description": "Weatherproof 24oz army duck canvas framed with dark chocolate bridle leather.",
            "description": "Built for a lifetime of rugged exploration. Repels downpours, resists abrasions, and carries everything you need for international expeditions.",
        },

        # --- LAPTOP BAGS ---
        {
            "category_slug": "laptop-bags",
            "name": "DEPORT Executive Dual-Compartment Briefcase",
            "sku": "DEP-LB-001",
            "price": Decimal("7999.00"),
            "compare_at_price": Decimal("11999.00"),
            "stock_quantity": 24,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": True,
            "image_file": "laptop-bags_1_1522335789203-aabd1fc54bc9.jpg",
            "unsplash_id": "1522335789203-aabd1fc54bc9",
            "short_description": "Classic structured dual-gusset briefcase with padded 16\" laptop chamber.",
            "description": "Commands respect in any boardroom. Crafted from full-grain vegetable-tanned leather with twin compartments separating tech hardware from contracts and files.",
        },
        {
            "category_slug": "laptop-bags",
            "name": "DEPORT Slim Tech Leather Document Case",
            "sku": "DEP-LB-002",
            "price": Decimal("5999.00"),
            "compare_at_price": Decimal("8999.00"),
            "stock_quantity": 28,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "laptop-bags_2_1526170375885-4d8ecf77b99f.jpg",
            "unsplash_id": "1526170375885-4d8ecf77b99f",
            "short_description": "Ultra-slim 2-inch profile briefcase for 14\" laptops, tablets, and files.",
            "description": "Sleek and lightweight. Protects your MacBook or laptop in dense high-rebound closed-cell foam, complemented by comfortable rolled handles and an optional shoulder strap.",
        },
        {
            "category_slug": "laptop-bags",
            "name": "DEPORT Wall Street Leather Attache Case",
            "sku": "DEP-LB-003",
            "price": Decimal("8999.00"),
            "compare_at_price": Decimal("13499.00"),
            "stock_quantity": 14,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": False,
            "image_file": "laptop-bags_3_1491553895911-0055eca6402d.jpg",
            "unsplash_id": "1491553895911-0055eca6402d",
            "short_description": "Hard-sided briefcase with dual combination brass locks and pigskin lining.",
            "description": "The quintessential heritage executive briefcase. Hand-molded over a lightweight wooden frame, lined in buttery suede with multi-tiered document expansion sleeves.",
        },
        {
            "category_slug": "laptop-bags",
            "name": "DEPORT Sovereign Padded 16\" Laptop Briefcase",
            "sku": "DEP-LB-004",
            "price": Decimal("8499.00"),
            "compare_at_price": Decimal("12999.00"),
            "stock_quantity": 20,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "laptop-bags_4_1542291026-7eec264c27ff.jpg",
            "unsplash_id": "1542291026-7eec264c27ff",
            "short_description": "Modern executive carrier featuring TSA-checkpoint friendly lay-flat laptop sleeve.",
            "description": "Streamlines airport security. Lay-flat tech compartment allows scanning without laptop removal, cushioned with velvet-lined impact protection bumpers.",
        },
        {
            "category_slug": "laptop-bags",
            "name": "DEPORT Ambassador Zip-Around Tech Brief",
            "sku": "DEP-LB-005",
            "price": Decimal("7299.00"),
            "compare_at_price": Decimal("10499.00"),
            "stock_quantity": 21,
            "is_new": True,
            "is_featured": False,
            "is_best_seller": False,
            "image_file": "laptop-bags_5_1505740420928-5e560c06d30e.jpg",
            "unsplash_id": "1505740420928-5e560c06d30e",
            "short_description": "Contemporary briefcase with 3/4 perimeter zipper for effortless access.",
            "description": "Engineered for tech enthusiasts. Accommodates dual chargers, multiple mice, external drives, and up to a 15.6\" device in plush fleece-lined slots.",
        },
        {
            "category_slug": "laptop-bags",
            "name": "DEPORT Metropolitan Leather Folio Document Case",
            "sku": "DEP-LB-006",
            "price": Decimal("6499.00"),
            "compare_at_price": Decimal("9299.00"),
            "stock_quantity": 26,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "laptop-bags_6_1572635196237-14b3f281503f.jpg",
            "unsplash_id": "1572635196237-14b3f281503f",
            "short_description": "Minimalist zip folio designed for 13\" laptops, notebooks, and writing instruments.",
            "description": "Refined minimalism. Tuck it effortlessly under arm or slide into a larger carryall. Full-perimeter zipper and business card pockets keep work essentials poised.",
        },

        # --- WALLETS ---
        {
            "category_slug": "wallets",
            "name": "DEPORT Continental Zip-Around Leather Wallet",
            "sku": "DEP-WL-001",
            "price": Decimal("2499.00"),
            "compare_at_price": Decimal("3799.00"),
            "stock_quantity": 38,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": True,
            "image_file": "wallets_1_1627123424574-724758594e93.jpg",
            "unsplash_id": "1627123424574-724758594e93",
            "short_description": "Expansive continental wallet with 12 card slots, coin pouch, and phone pocket.",
            "description": "Complete financial organization in hand. Features 12 card slots, full-length billfold dividers, a center zippered coin pouch, and RFID signal blocking.",
        },
        {
            "category_slug": "wallets",
            "name": "DEPORT Slim Bifold Cardholder Wallet",
            "sku": "DEP-WL-002",
            "price": Decimal("1999.00"),
            "compare_at_price": Decimal("2999.00"),
            "stock_quantity": 45,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "wallets_2_1607604276583-eef5d076aa5f.jpg",
            "unsplash_id": "1607604276583-eef5d076aa5f",
            "short_description": "Ultra-thin front-pocket bifold crafted from supple Italian vegetable calfskin.",
            "description": "Engineered to eliminate pocket bulk. Weighing less than 50 grams, this cardholder securely holds 8 cards and folded cash while maintaining an ultra-thin profile.",
        },
        {
            "category_slug": "wallets",
            "name": "DEPORT Accordion Leather Card Case",
            "sku": "DEP-WL-003",
            "price": Decimal("2199.00"),
            "compare_at_price": Decimal("3299.00"),
            "stock_quantity": 30,
            "is_new": True,
            "is_featured": False,
            "is_best_seller": False,
            "image_file": "wallets_3_1515886657613-9f3515b0c78f.jpg",
            "unsplash_id": "1515886657613-9f3515b0c78f",
            "short_description": "Fan-out accordion card organizer with secure perimeter zip closure.",
            "description": "Instant card visibility. Unzips to reveal 9 fan-out card slots and two coin gussets, keeping IDs, credit cards, and tokens neatly categorized.",
        },
        {
            "category_slug": "wallets",
            "name": "DEPORT Heritage Minimalist Money Clip Wallet",
            "sku": "DEP-WL-004",
            "price": Decimal("1799.00"),
            "compare_at_price": Decimal("2699.00"),
            "stock_quantity": 35,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "wallets_4_1529139574466-a303027c1d8b.jpg",
            "unsplash_id": "1529139574466-a303027c1d8b",
            "short_description": "Solid spring-steel money clip combined with quick-draw card slots.",
            "description": "Refined simplicity. Crafted with an internal sprung brass money clip for paper currency and external quick-access thumb slides for frequent cards.",
        },
        {
            "category_slug": "wallets",
            "name": "DEPORT Tuscan Passport & Travel Leather Wallet",
            "sku": "DEP-WL-005",
            "price": Decimal("2799.00"),
            "compare_at_price": Decimal("3999.00"),
            "stock_quantity": 25,
            "is_new": True,
            "is_featured": True,
            "is_best_seller": False,
            "image_file": "wallets_5_1539109136881-3be0616acf4b.jpg",
            "unsplash_id": "1539109136881-3be0616acf4b",
            "short_description": "Dedicated passport cover with boarding pass sleeve and dual SIM slots.",
            "description": "Your indispensable boarding companion. Holds standard international passports, boarding passes, SIM cards, ejection pin, and foreign currencies securely.",
        },
        {
            "category_slug": "wallets",
            "name": "DEPORT Trifold Compact Flap Coin Wallet",
            "sku": "DEP-WL-006",
            "price": Decimal("2299.00"),
            "compare_at_price": Decimal("3499.00"),
            "stock_quantity": 32,
            "is_new": False,
            "is_featured": False,
            "is_best_seller": True,
            "image_file": "wallets_6_1534030347209-467a5b0ad3e6.jpg",
            "unsplash_id": "1534030347209-467a5b0ad3e6",
            "short_description": "Trifold silhouette featuring an exterior snap coin pouch and deep cash well.",
            "description": "Maximum utility in a palm-sized package. Snap coin pouch on the exterior paired with a full-depth banknote sleeve and 6 card pockets.",
        },
    ]

    print(f"Total catalog definitions to process: {len(catalog)}")

    # 3. Process each item: update existing matching products or create new
    # Map of category slugs to Category objects
    category_map = {c.slug: c for c in Category.objects.all()}

    # Check existing products in database
    existing_products = list(Product.objects.all().order_by('id'))
    used_product_ids = set()

    for idx, item in enumerate(catalog):
        cat = category_map.get(item["category_slug"])
        if not cat:
            print(f"Warning: Category '{item['category_slug']}' not found!")
            continue

        # Look for existing product to update (by SKU, or by name match, or assign unused existing products)
        product = None
        if Product.objects.filter(sku=item["sku"]).exists():
            product = Product.objects.get(sku=item["sku"])
        else:
            # Check if there is an unused existing product in this category
            unused_in_cat = [p for p in existing_products if p.id not in used_product_ids and p.category_id == cat.id]
            if unused_in_cat:
                product = unused_in_cat[0]
            else:
                # Check any unused existing product from database (e.g. test product 30, 29, etc.)
                unused_any = [p for p in existing_products if p.id not in used_product_ids and p.category_id not in [10, 11]]
                if unused_any:
                    product = unused_any[0]

        if not product:
            # Create fresh product
            slug = slugify(item["name"])
            product = Product.objects.create(
                category=cat,
                name=item["name"],
                slug=slug,
                brand="DEPORT Atelier",
                sku=item["sku"],
                price=item["price"],
                compare_at_price=item["compare_at_price"],
                stock_quantity=item["stock_quantity"],
                short_description=item["short_description"],
                description=item["description"],
                is_active=True,
                is_deleted=False,
                is_new=item["is_new"],
                is_featured=item["is_featured"],
                is_best_seller=item["is_best_seller"]
            )
            print(f"Created new product {product.id}: {product.name} ({product.sku})")
        else:
            # Update existing product
            product.category = cat
            product.name = item["name"]
            product.slug = slugify(item["name"])
            product.brand = "DEPORT Atelier"
            product.sku = item["sku"]
            product.price = item["price"]
            product.compare_at_price = item["compare_at_price"]
            product.stock_quantity = item["stock_quantity"]
            product.short_description = item["short_description"]
            product.description = item["description"]
            product.is_active = True
            product.is_deleted = False
            product.is_new = item["is_new"]
            product.is_featured = item["is_featured"]
            product.is_best_seller = item["is_best_seller"]
            product.save()
            print(f"Updated product {product.id}: {product.name} ({product.sku})")

        used_product_ids.add(product.id)

        # Update / replace ProductImage
        # Delete old images for this product
        product.images.all().delete()

        # Create fresh unique primary image
        img_rel_path = f"products/{item['image_file']}"
        unsplash_url = f"https://images.unsplash.com/photo-{item['unsplash_id']}?auto=format&fit=crop&w=800&q=80"
        ProductImage.objects.create(
            product=product,
            image=img_rel_path,
            image_url=unsplash_url,
            alt_text=f"{product.name} - Luxury Handcrafted Leather Bag",
            is_primary=True,
            sort_order=0
        )

    # 4. Handle analytics products (ensure they also have unique images)
    try:
        p31 = Product.objects.get(id=31)
        p31.images.all().delete()
        ProductImage.objects.create(
            product=p31,
            image="products/shoulder-bags_4_alt_1511556532299-8f662fc26c06.jpg",
            image_url="https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=800&q=80",
            alt_text="Analytics Duffle Bag",
            is_primary=True,
            sort_order=0
        )
    except Product.DoesNotExist:
        pass

    try:
        p32 = Product.objects.get(id=32)
        p32.images.all().delete()
        ProductImage.objects.create(
            product=p32,
            image="products/analytics_suitcase.jpg",
            image_url="https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?auto=format&fit=crop&w=800&q=80",
            alt_text="Analytics Suitcase",
            is_primary=True,
            sort_order=0
        )
    except Product.DoesNotExist:
        pass

    # Handle any remaining unused products (e.g. mock products not in the 48)
    for p in existing_products:
        if p.id not in used_product_ids and p.id not in [31, 32]:
            p.is_active = False
            p.is_deleted = True
            p.save()
            print(f"Deactivated obsolete product {p.id}: {p.name}")

    print("\n=== Verification ===")
    active_prods = Product.objects.filter(is_active=True, is_deleted=False)
    print(f"Total active products: {active_prods.count()}")
    
    primary_images = []
    for p in active_prods:
        primary = p.images.filter(is_primary=True).first()
        img_name = primary.image.name if primary and primary.image else (primary.image_url if primary else None)
        primary_images.append(img_name)
        print(f"[{p.category.name}] {p.name} | SKU: {p.sku} | Price: ₹{p.price} | Image: {img_name}")

    print(f"\nTotal primary images: {len(primary_images)}")
    print(f"Unique primary images: {len(set(primary_images))}")
    assert len(primary_images) == len(set(primary_images)), "Duplicate primary images found!"
    print("SUCCESS: Every product has a 100% UNIQUE, DISTINCT luxury photo!")

if __name__ == '__main__':
    run()
