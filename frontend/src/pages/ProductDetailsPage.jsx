import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProduct, useProducts } from '../hooks/useProducts';
import { useWishlist } from '../hooks/useWishlist';
import ProductImageGallery from '../components/ProductImageGallery';
import Rating from '../components/Rating';
import PriceDisplay from '../components/PriceDisplay';
import QuantitySelector from '../components/QuantitySelector';
import Button from '../components/Button';
import { formatINR } from '../utils/currencyUtils';
import ProductGrid from '../components/ProductGrid';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { useShop } from '../context/ShopContext';
import {
  Heart,
  ShoppingBag,
  ShieldCheck,
  Truck,
  RefreshCw,
  ArrowLeft,
  PackageX,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Award,
  Clock,
  Feather,
  Sparkles
} from 'lucide-react';

export const ProductDetailsPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data: product, isLoading, isError } = useProduct(slug);
  const { addToCart, showToast } = useShop();
  const { isWishlisted, toggleWishlist, removeFromWishlist } = useWishlist();

  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');

  // Redirect to listing if product is blocked, unlisted, or soft-deleted
  useEffect(() => {
    if (!isLoading && product) {
      const isBlocked = product.is_active === false || product.is_deleted === true;
      const isCategoryBlocked = product.category && (product.category.is_active === false || product.category.is_deleted === true);

      if (isBlocked || isCategoryBlocked) {
        showToast('This product is currently unavailable.', 'error');
        navigate('/shop', { replace: true });
      }
    } else if (!isLoading && isError) {
      showToast('This product is currently unavailable.', 'error');
      navigate('/shop', { replace: true });
    }
  }, [product, isLoading, isError, navigate, showToast]);

  // Fetch related products in same category
  const categorySlug = product?.category?.slug;
  const { data: relatedData } = useProducts(
    categorySlug ? { category: categorySlug, page_size: 4 } : {}
  );
  const relatedProducts = (relatedData?.results || []).filter(
    (p) => p.slug !== slug
  ).slice(0, 4);

  const wishlisted = product ? isWishlisted(product.id) : false;
  const stockQty = product?.stock_quantity ?? 0;
  const isAvailable = stockQty > 0 && product?.is_active && !product?.is_deleted;

  const priceNum = parseFloat(product?.price || 0);
  const comparePriceNum = parseFloat(product?.compare_at_price || product?.original_price || 0);
  const hasDiscount = product?.has_discount ?? (comparePriceNum > priceNum);
  const discountPercent = product?.discount_percentage || (hasDiscount && comparePriceNum > 0
    ? Math.round(((comparePriceNum - priceNum) / comparePriceNum) * 100)
    : 0);

  const handleAddToCart = async () => {
    const isBlocked = product?.is_active === false || product?.is_deleted === true;
    const isCategoryBlocked = product?.category && (product.category.is_active === false || product.category.is_deleted === true);
    if (isBlocked || isCategoryBlocked) {
      showToast('This product is currently unlisted or unavailable.', 'error');
      navigate('/shop', { replace: true });
      return;
    }

    if (!isAvailable) {
      showToast('This item is currently out of stock.', 'error');
      return;
    }

    if (addToCart && product) {
      const res = await addToCart(product, null, quantity);
      if (res?.blocked) {
        navigate('/shop', { replace: true });
      } else if (wishlisted && removeFromWishlist) {
        removeFromWishlist(product.id);
      }
    }
  };

  const handleToggleWishlist = async () => {
    const isBlocked = product?.is_active === false || product?.is_deleted === true;
    const isCategoryBlocked = product?.category && (product.category.is_active === false || product.category.is_deleted === true);
    if (isBlocked || isCategoryBlocked) {
      showToast('This product is currently unlisted or unavailable.', 'error');
      navigate('/shop', { replace: true });
      return;
    }

    if (product) {
      try {
        await toggleWishlist(product);
      } catch (err) {
        if (err?.response?.status === 404 || err?.response?.status === 400) {
          showToast('Product is no longer available.', 'error');
          navigate('/shop', { replace: true });
        }
      }
    }
  };

  // Mock Reviews for luxury details
  const reviews = [
    {
      id: 1,
      author: 'Sophia Sterling',
      rating: 5,
      date: '2 weeks ago',
      title: 'Incredible craftsmanship and texture',
      comment: 'The leather aroma and stitching quality rival heritage fashion houses. It holds my 14" laptop with ample room for travel essentials.'
    },
    {
      id: 2,
      author: 'Julian Vance',
      rating: 5,
      date: '1 month ago',
      title: 'Perfection in every detail',
      comment: 'The brass hardware has a substantial weight, and the burnished edges demonstrate exceptional leatherworking.'
    }
  ];

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 space-y-8">
        <Skeleton className="w-48 h-4" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7">
            <Skeleton className="w-full aspect-4/5" />
          </div>
          <div className="lg:col-span-5 space-y-6">
            <Skeleton className="w-24 h-4" />
            <Skeleton className="w-3/4 h-8" />
            <Skeleton className="w-1/3 h-6" />
            <Skeleton className="w-full h-20" />
            <Skeleton className="w-full h-12" />
          </div>
        </div>
      </div>
    );
  }

  // Fallback if not loaded
  if (isError || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <EmptyState
          icon={PackageX}
          title="Product Unavailable"
          description="The item you are attempting to view is unlisted, blocked, or no longer available."
          actionLabel="Return to Catalog"
          actionIcon={ArrowLeft}
          onAction={() => navigate('/shop')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 text-[#111827]">
      {/* Breadcrumbs Navigation */}
      <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-xs text-gray-600">
        <Link to="/" className="hover:text-[#10B981] transition-colors">Home</Link>
        <ChevronRight size={14} />
        <Link to="/shop" className="hover:text-[#10B981] transition-colors">Shop</Link>
        {product.category && (
          <>
            <ChevronRight size={14} />
            <Link
              to={`/shop?category=${product.category.slug}`}
              className="hover:text-[#10B981] transition-colors"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight size={14} />
        <span className="text-black font-semibold truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start mb-20">
        {/* Left Column: Zoomable Image Gallery */}
        <div className="lg:col-span-7">
          <ProductImageGallery
            images={product.images || []}
            primaryImage={product.primary_image}
            productName={product.name}
          />
        </div>

        {/* Right Column: Product Information */}
        <div className="lg:col-span-5 flex flex-col items-start">
          {/* Category & Discount Badge */}
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-[0.2em] text-[#10B981]">
                {product.category?.name || 'DEPORT Atelier'}
              </span>
              {product.category_offer && (
                <span className="bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                  Category Offer
                </span>
              )}
            </div>

            {hasDiscount && (
              <span className="bg-[#10B981] text-black text-[10px] uppercase font-bold tracking-widest px-2.5 py-1">
                {discountPercent}% OFF
              </span>
            )}
          </div>

          <h1
            className="font-serif text-3xl sm:text-4xl text-black font-normal mb-3 leading-tight"
            style={{ color: '#000000' }}
          >
            {product.name}
          </h1>

          {/* Ratings & SKU */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-300 w-full">
            <Rating rating={4.9} reviewCount={24} size={16} />
            <span className="text-xs text-gray-600 font-mono">SKU: {product.sku}</span>
          </div>

          {/* Price Display */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <PriceDisplay
              price={product.price}
              oldPrice={product.compare_at_price || product.original_price}
              discountPercentage={product.discount_percentage || discountPercent}
              size="xl"
              priceClassName="text-black font-bold font-serif"
              oldPriceClassName="text-gray-500"
            />
            {hasDiscount && (
              <span className="text-xs sm:text-sm text-emerald-800 font-semibold">
                (Save {formatINR(comparePriceNum - priceNum)})
              </span>
            )}
          </div>

          {/* Category Offer Banner if applied */}
          {product.category_offer && (
            <div className="mb-6 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2 w-full">
              <Sparkles size={15} className="text-emerald-700 shrink-0" />
              <span>
                <strong>Category Offer:</strong> {product.category_offer.offer_type === 'percentage' ? `${parseFloat(product.category_offer.offer_value)}% discount` : `${formatINR(product.category_offer.offer_value)} discount`} applied to {product.category_offer.category_name}.
              </span>
            </div>
          )}

          {/* Stock Info Status */}
          <div className="mb-6 w-full">
            {isAvailable ? (
              stockQty <= 5 ? (
                <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>Only <strong>{stockQty}</strong> left in stock — order soon to secure your piece.</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-900 bg-emerald-100 border border-emerald-300 px-3 py-1.5">
                  <CheckCircle2 size={14} className="text-emerald-700" />
                  <span>In Stock • Ready for immediate courier dispatch</span>
                </div>
              )
            ) : (
              <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center gap-2.5">
                <AlertCircle size={16} className="text-rose-600" />
                <span>
                  <strong>Currently Sold Out.</strong> This handcrafted item is momentarily out of stock.
                </span>
              </div>
            )}
          </div>

          {/* Short Description */}
          {product.short_description && (
            <p className="text-gray-800 text-sm leading-relaxed mb-6 font-medium">
              {product.short_description}
            </p>
          )}

          {/* Quantity Selector & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full mb-8">
            <QuantitySelector
              quantity={quantity}
              onIncrease={() => setQuantity((q) => Math.min(stockQty, q + 1))}
              onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={!isAvailable}
              size="lg"
            />

            <Button
              variant="primary"
              size="lg"
              fullWidth
              icon={ShoppingBag}
              onClick={handleAddToCart}
              disabled={!isAvailable}
              className={!isAvailable ? 'opacity-50 cursor-not-allowed bg-gray-800 border-gray-700' : ''}
            >
              {isAvailable ? 'Add to Shopping Bag' : 'Out of Stock'}
            </Button>

            <button
              type="button"
              onClick={handleToggleWishlist}
              className={`p-4 border transition-colors flex items-center justify-center cursor-pointer ${
                wishlisted
                  ? 'border-[#10B981] bg-[#161D19] text-[#10B981]'
                  : 'border-[#1E2922] bg-[#131915] text-[#F3F4F6] hover:border-[#10B981]'
              }`}
              title={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              <Heart size={20} fill={wishlisted ? '#10B981' : 'none'} />
            </button>
          </div>

          {/* Value Perks */}
          <div className="grid grid-cols-1 gap-3 p-4 bg-[#131915] border border-[#1E2922] w-full mb-8 text-xs text-gray-200 shadow-xs">
            <div className="flex items-center gap-3">
              <Truck size={16} className="text-[#10B981]" />
              <span>Complimentary insured express shipping worldwide</span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck size={16} className="text-[#10B981]" />
              <span>Backed by DEPORT Lifetime Heritage Guarantee</span>
            </div>
            <div className="flex items-center gap-3">
              <RefreshCw size={16} className="text-[#10B981]" />
              <span>Complimentary 30-day returns & exchanges</span>
            </div>
          </div>
        </div>
      </div>

      {/* Product Highlights Section */}
      <div className="mb-20">
        <h3
          className="font-serif text-2xl font-normal text-black mb-8 pb-4 border-b border-gray-300"
          style={{ color: '#000000' }}
        >
          Product Highlights & Specifications
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white border border-stone-200 space-y-3 shadow-xs">
            <Award size={24} className="text-[#10B981]" />
            <h4 className="font-serif text-base font-bold text-black">Full-Grain Tuscan Leather</h4>
            <p className="text-xs text-gray-600 leading-relaxed font-light">
              Tanned naturally with plant-based extracts to develop a rich, lustrous patina over years of use.
            </p>
          </div>

          <div className="p-6 bg-white border border-stone-200 space-y-3 shadow-xs">
            <Clock size={24} className="text-[#10B981]" />
            <h4 className="font-serif text-base font-bold text-black">Lifetime Durability</h4>
            <p className="text-xs text-gray-600 leading-relaxed font-light">
              Reinforced stress points, heavy-gauge nylon threads, and antiqued solid brass hardware.
            </p>
          </div>

          <div className="p-6 bg-white border border-stone-200 space-y-3 shadow-xs">
            <Feather size={24} className="text-[#10B981]" />
            <h4 className="font-serif text-base font-bold text-black">Ergonomic Engineering</h4>
            <p className="text-xs text-gray-600 leading-relaxed font-light">
              Balanced weight distribution and padded straps tailored for effortless all-day commuting.
            </p>
          </div>
        </div>
      </div>

      {/* Product Description & Reviews Tabs */}
      <div className="mb-20 bg-white border border-stone-200 p-6 sm:p-10 shadow-xs">
        <div className="flex items-center gap-8 border-b border-gray-200 pb-4 mb-8">
          <button
            type="button"
            onClick={() => setActiveTab('description')}
            className={`font-serif text-lg font-medium transition-colors relative pb-4 -mb-4 cursor-pointer ${
              activeTab === 'description' ? 'text-emerald-700 font-bold' : 'text-gray-600 hover:text-black'
            }`}
          >
            Product Overview
            {activeTab === 'description' && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#10B981]" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`font-serif text-lg font-medium transition-colors relative pb-4 -mb-4 cursor-pointer ${
              activeTab === 'reviews' ? 'text-emerald-700 font-bold' : 'text-gray-600 hover:text-black'
            }`}
          >
            Customer Reviews ({reviews.length})
            {activeTab === 'reviews' && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#10B981]" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`font-serif text-lg font-medium transition-colors relative pb-4 -mb-4 cursor-pointer ${
              activeTab === 'details' ? 'text-emerald-700 font-bold' : 'text-gray-600 hover:text-black'
            }`}
          >
            Atelier Specifications
            {activeTab === 'details' && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#10B981]" />}
          </button>
        </div>

        {activeTab === 'description' && (
          <div className="text-sm text-gray-800 leading-relaxed font-light space-y-4 max-w-3xl">
            <p>{product.description}</p>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-6 max-w-3xl">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
              <div className="text-3xl font-serif font-bold text-emerald-700">4.9</div>
              <div>
                <Rating rating={4.9} reviewCount={24} size={18} />
                <p className="text-xs text-gray-600 mt-1">Based on 24 verified collector reviews</p>
              </div>
            </div>

            <div className="divide-y divide-gray-200 space-y-4">
              {reviews.map((rev) => (
                <div key={rev.id} className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-black">{rev.author}</span>
                    <span className="text-xs text-gray-500">{rev.date}</span>
                  </div>
                  <Rating rating={rev.rating} size={14} />
                  <p className="text-xs font-bold text-gray-900">{rev.title}</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{rev.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="max-w-md space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="font-semibold text-black">Brand</span>
              <span className="text-gray-600">{product.brand || 'DEPORT'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="font-semibold text-black">Category</span>
              <span className="text-gray-600">{product.category?.name || 'Leather Bags'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="font-semibold text-black">SKU</span>
              <span className="text-gray-600 font-mono">{product.sku}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="font-semibold text-black">Stock Status</span>
              <span className="text-gray-600">{stockQty} units remaining</span>
            </div>
          </div>
        )}
      </div>

      {/* You May Also Like (Related Products Recommendation) */}
      {relatedProducts.length > 0 && (
        <div>
          <h3
            className="font-serif text-2xl font-normal text-black mb-8 pb-4 border-b border-gray-300"
            style={{ color: '#000000' }}
          >
            You May Also Admire
          </h3>
          <ProductGrid products={relatedProducts} columns={4} />
        </div>
      )}
    </div>
  );
};

export default ProductDetailsPage;
