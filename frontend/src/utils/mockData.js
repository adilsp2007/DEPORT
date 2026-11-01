export const CATEGORIES = [
  {
    id: 'handbags',
    name: 'Handbags',
    description: 'Iconic structured silhouettes crafted from refined Italian leather.',
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    itemCount: '24 Items'
  },
  {
    id: 'tote-bags',
    name: 'Tote Bags',
    description: 'Spacious elegance engineered for seamless daily transitions.',
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
    itemCount: '18 Items'
  },
  {
    id: 'crossbody',
    name: 'Crossbody Bags',
    description: 'Hands-free luxury designed with adjustable brass-accented straps.',
    image: 'https://images.unsplash.com/photo-1566150476483-623049099965?auto=format&fit=crop&w=800&q=80',
    itemCount: '32 Items'
  },
  {
    id: 'backpacks',
    name: 'Backpacks',
    description: 'Minimalist city carryalls built with ergonomics and modern style.',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
    itemCount: '15 Items'
  },
  {
    id: 'travel-bags',
    name: 'Travel Bags',
    description: 'Sophisticated duffels and weekenders made for memorable journeys.',
    image: 'https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=800&q=80',
    itemCount: '12 Items'
  },
  {
    id: 'laptop-bags',
    name: 'Laptop Bags',
    description: 'Padded tech compartments wrapped in rich full-grain leather.',
    image: 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=800&q=80',
    itemCount: '20 Items'
  },
  {
    id: 'shoulder-bags',
    name: 'Shoulder Bags',
    description: 'Classic slouchy and baguette cuts with smooth gold-tone hardware.',
    image: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=800&q=80',
    itemCount: '28 Items'
  },
  {
    id: 'wallets',
    name: 'Wallets',
    description: 'Compact cardholders and zip-around continental leather wallets.',
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
    itemCount: '16 Items'
  }
];

export const PRODUCTS = [
  {
    id: '1',
    name: 'The Aurelia Leather Handbag',
    slug: 'the-aurelia-leather-handbag',
    category: 'handbags',
    categoryName: 'Handbags',
    price: 495,
    oldPrice: 580,
    rating: 4.9,
    reviewCount: 42,
    badge: 'NEW',
    isNew: true,
    isBestSeller: true,
    isFeatured: true,
    colors: [
      { name: 'Warm Taupe', hex: '#8C7A6B' },
      { name: 'Onyx Black', hex: '#1E1B18' },
      { name: 'Cognac Brown', hex: '#9E5B32' },
      { name: 'Ivory Cream', hex: '#F3EFE6' }
    ],
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1566150476483-623049099965?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=1000&q=80'
    ],
    description: 'Exquisitely handcrafted in Florence using vegetable-tanned calfskin leather. The Aurelia combines a structured architectural silhouette with a spacious satin-lined interior.',
    features: [
      '100% Full-grain Italian calfskin leather',
      'Custom gold-plated brass hardware and turn-lock closure',
      'Protective brass feet at base',
      'Interior zippered divider and double smartphone slip pockets',
      'Detachable leather shoulder strap (20"- 24" drop)'
    ],
    specifications: {
      Dimensions: '11.5" W x 8.5" H x 4.5" D',
      Weight: '1.8 lbs',
      Origin: 'Made in Italy'
    }
  },
  {
    id: '2',
    name: 'Sienna Everyday Canvas & Leather Tote',
    slug: 'sienna-everyday-tote',
    category: 'tote-bags',
    categoryName: 'Tote Bags',
    price: 340,
    oldPrice: null,
    rating: 4.8,
    reviewCount: 38,
    badge: 'BEST SELLER',
    isNew: false,
    isBestSeller: true,
    isFeatured: true,
    colors: [
      { name: 'Sand & Tan', hex: '#D2B48C' },
      { name: 'Midnight & Black', hex: '#1E1B18' }
    ],
    images: [
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=1000&q=80'
    ],
    description: 'Designed for effortless elegance on busy days. Features ultra-durable water-resistant organic canvas trimmed with rich full-grain saddle leather.',
    features: [
      'Heavyweight organic cotton canvas with water-repellent finish',
      'Reinforced leather handles with 9" shoulder drop',
      'Fits up to 15" MacBook Pro comfortably',
      'Magnetic top snap closure'
    ],
    specifications: {
      Dimensions: '16" W x 12.5" H x 6" D',
      Weight: '1.4 lbs',
      Origin: 'Made in Portugal'
    }
  },
  {
    id: '3',
    name: 'Vesper Minimalist Crossbody',
    slug: 'vesper-minimalist-crossbody',
    category: 'crossbody',
    categoryName: 'Crossbody Bags',
    price: 285,
    oldPrice: 320,
    rating: 4.9,
    reviewCount: 64,
    badge: 'POPULAR',
    isNew: true,
    isBestSeller: true,
    isFeatured: true,
    colors: [
      { name: 'Mocha', hex: '#4A3B32' },
      { name: 'Nude Beige', hex: '#E5D3C4' },
      { name: 'Olive Green', hex: '#556B2F' }
    ],
    images: [
      'https://images.unsplash.com/photo-1566150476483-623049099965?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=1000&q=80'
    ],
    description: 'Compact yet cleverly organized. The Vesper offers sleek geometric lines, buttery soft nappa leather, and a magnetic flap closure with gold foil monogramming.',
    features: [
      'Ultra-soft Nappa leather exterior with soft suede interior lining',
      'Adjustable crossbody strap with signature gold buckle',
      'Back external card slot for fast transit payments',
      'Internal key clip and zipped secret compartment'
    ],
    specifications: {
      Dimensions: '8.5" W x 6" H x 2.8" D',
      Weight: '0.9 lbs',
      Origin: 'Made in Spain'
    }
  },
  {
    id: '4',
    name: 'Monaco Executive Laptop Brief',
    slug: 'monaco-laptop-brief',
    category: 'laptop-bags',
    categoryName: 'Laptop Bags',
    price: 520,
    oldPrice: 600,
    rating: 5.0,
    reviewCount: 29,
    badge: 'LUXURY',
    isNew: false,
    isBestSeller: false,
    isFeatured: true,
    colors: [
      { name: 'Espresso', hex: '#2B1B17' },
      { name: 'Slate Gray', hex: '#4F565E' }
    ],
    images: [
      'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80'
    ],
    description: 'Refined professionalism redefined. Dual padded laptop compartments with faux-fur lining safeguard laptops up to 16". Built-in luggage strap for travel.',
    features: [
      'Padded sleeve fits up to 16" laptops',
      'Integrated trolley sleeve for luggage handle attachment',
      'Waterproof YKK zipper hardware',
      'Pen sleeves, cable organizer pockets, and tablet slot'
    ],
    specifications: {
      Dimensions: '15.5" W x 11" H x 3.5" D',
      Weight: '2.1 lbs',
      Origin: 'Made in Italy'
    }
  },
  {
    id: '5',
    name: 'Atlas Leather Weekender Travel Duffel',
    slug: 'atlas-leather-weekender',
    category: 'travel-bags',
    categoryName: 'Travel Bags',
    price: 680,
    oldPrice: 750,
    rating: 4.9,
    reviewCount: 51,
    badge: 'NEW ARRIVAL',
    isNew: true,
    isBestSeller: false,
    isFeatured: true,
    colors: [
      { name: 'Chestnut Brown', hex: '#633B1E' },
      { name: 'Black Velvet Leather', hex: '#141414' }
    ],
    images: [
      'https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80'
    ],
    description: 'The ultimate getaway travel companion. Meets international carry-on requirements with a dedicated ventilated shoe compartment and padded shoulder strap.',
    features: [
      'Separate side-zip shoe compartment',
      'Carry-on approved size for international airlines',
      'Heavy-duty brass YKK zipper with lockable pulls',
      'Includes leather luggage tag and dust cover bag'
    ],
    specifications: {
      Dimensions: '21" W x 12.5" H x 10" D',
      Weight: '3.6 lbs',
      Origin: 'Made in Florence'
    }
  },
  {
    id: '6',
    name: 'Paloma Slouchy Leather Shoulder Bag',
    slug: 'paloma-slouchy-shoulder-bag',
    category: 'shoulder-bags',
    categoryName: 'Shoulder Bags',
    price: 410,
    oldPrice: null,
    rating: 4.7,
    reviewCount: 31,
    badge: null,
    isNew: false,
    isBestSeller: true,
    isFeatured: false,
    colors: [
      { name: 'Caramel', hex: '#A86536' },
      { name: 'Off-White', hex: '#FAF9F6' },
      { name: 'Forest Green', hex: '#2D4030' }
    ],
    images: [
      'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1566150476483-623049099965?auto=format&fit=crop&w=1000&q=80'
    ],
    description: 'Effortless relaxed luxury. Soft pebble-grain leather drapes comfortably against your side with a wide padded shoulder strap.',
    features: [
      'Supple pebble grain leather',
      'Magnetic top closure with hidden zip inner pocket',
      'Gold foil brand logo accent'
    ],
    specifications: {
      Dimensions: '14" W x 10" H x 5" D',
      Weight: '1.3 lbs',
      Origin: 'Made in Spain'
    }
  },
  {
    id: '7',
    name: 'Urban Luxe Leather Backpack',
    slug: 'urban-luxe-leather-backpack',
    category: 'backpacks',
    categoryName: 'Backpacks',
    price: 395,
    oldPrice: 450,
    rating: 4.8,
    reviewCount: 47,
    badge: 'NEW',
    isNew: true,
    isBestSeller: false,
    isFeatured: false,
    colors: [
      { name: 'Charcoal Black', hex: '#1E1B18' },
      { name: 'Tan Brown', hex: '#9E5B32' }
    ],
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=1000&q=80'
    ],
    description: 'Sleek, modern backpack tailored for city commutes and weekend explorations. Features an ergonomic padded back panel and quick-access top flap.',
    features: [
      '14" internal padded laptop sleeve',
      'Hidden anti-theft zipper pocket on back panel',
      'Water-resistant lining'
    ],
    specifications: {
      Dimensions: '12" W x 15.5" H x 5" D',
      Weight: '1.9 lbs',
      Origin: 'Made in Italy'
    }
  },
  {
    id: '8',
    name: 'Celeste Continental Zip Wallet',
    slug: 'celeste-continental-zip-wallet',
    category: 'wallets',
    categoryName: 'Wallets',
    price: 165,
    oldPrice: 195,
    rating: 4.9,
    reviewCount: 88,
    badge: 'BEST SELLER',
    isNew: false,
    isBestSeller: true,
    isFeatured: false,
    colors: [
      { name: 'Soft Gold', hex: '#B08D57' },
      { name: 'Onyx Black', hex: '#1E1B18' },
      { name: 'Rose Dust', hex: '#D4B8B1' }
    ],
    images: [
      'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80'
    ],
    description: 'Classic zip-around continental wallet with 12 card slots, dual full-length bill compartments, and a zippered coin pocket.',
    features: [
      'RFID blocking internal protection',
      '12 card slots and 2 note compartments',
      'Smooth gold-tone zip puller'
    ],
    specifications: {
      Dimensions: '7.8" W x 4" H x 1" D',
      Weight: '0.4 lbs',
      Origin: 'Made in France'
    }
  }
];

export const MOCK_USER = {
  name: 'Eleanor Vance',
  firstName: 'Eleanor',
  lastName: 'Vance',
  email: 'eleanor.vance@deport.com',
  phone: '+1 (555) 234-5678',
  memberSince: 'January 2024',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
  ordersCount: 4,
  wishlistCount: 3
};

export const MOCK_ADDRESSES = [
  {
    id: 'addr-1',
    title: 'Home (Default)',
    type: 'Home',
    fullName: 'Eleanor Vance',
    street: '742 Evergreen Terrace, Suite 4B',
    city: 'New York',
    state: 'NY',
    zipCode: '10021',
    country: 'United States',
    phone: '+1 (555) 234-5678',
    isDefault: true
  },
  {
    id: 'addr-2',
    title: 'Design Studio',
    type: 'Office',
    fullName: 'Eleanor Vance / Deport Studio',
    street: '580 Fifth Avenue, 12th Floor',
    city: 'New York',
    state: 'NY',
    zipCode: '10036',
    country: 'United States',
    phone: '+1 (555) 987-6543',
    isDefault: false
  }
];

export const MOCK_INITIAL_CART = [
  {
    product: PRODUCTS[0],
    selectedColor: PRODUCTS[0].colors[0],
    quantity: 1
  },
  {
    product: PRODUCTS[2],
    selectedColor: PRODUCTS[2].colors[0],
    quantity: 1
  }
];

export const MOCK_INITIAL_WISHLIST = [PRODUCTS[0], PRODUCTS[1], PRODUCTS[4]];
