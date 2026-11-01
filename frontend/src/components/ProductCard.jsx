import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag } from 'lucide-react';
import Rating from './Rating';
import PriceDisplay from './PriceDisplay';
import { useShop } from '../context/ShopContext';
import { useWishlist } from '../hooks/useWishlist';

export const ProductCard = ({ product }) => {
  const { addToCart, showToast } = useShop();
  const { isWishlisted, toggleWishlist, removeFromWishlist } = useWishlist();

  if (!product) return null;

  const wishlisted = isWishlisted(product.id);

  // Determine image source
  const imageUrl =
    product.primary_image ||
    (Array.isArray(product.images) && product.images.length > 0
      ? typeof product.images[0] === 'string'
        ? product.images[0]
        : product.images[0]?.image
      : null);

  // Calculate discount percentage
  const priceNum = parseFloat(product.price || 0);
  const comparePriceNum = parseFloat(product.compare_at_price || 0);
  const hasDiscount = comparePriceNum > priceNum;
  const discountPercent = hasDiscount
    ? Math.round(((comparePriceNum - priceNum) / comparePriceNum) * 100)
    : 0;

  const productSlug = product.slug || product.id;
  const categoryName = product.category?.name || product.categoryName || 'DEPORT';
  const isAvailable = product.is_available ?? (product.stock_quantity > 0);

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAvailable) {
      showToast('This item is currently out of stock.', 'info');
      return;
    }
    if (addToCart) addToCart(product);
    if (wishlisted && removeFromWishlist) {
      removeFromWishlist(product.id);
    }
  };

  const handleToggleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  return (
    <div className="group relative flex flex-col bg-[#131915] border border-[#10B981]/20 transition-all duration-300 hover:shadow-2xl hover:border-[#10B981]/50">
      {/* Image container with hover zoom */}
      <div className="relative aspect-4/5 overflow-hidden bg-[#0B0F0D]">
        <Link to={`/product/${productSlug}`} className="block h-full w-full">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80';
              }}
              className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-108 opacity-90"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#0B0F0D] text-[#9CA3AF] text-center p-4">
              <span className="font-serif text-lg tracking-widest text-[#10B981] font-bold">DEPORT</span>
              <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF]/70 mt-1">No Image Available</span>
            </div>
          )}
        </Link>

        {/* Badges Stack */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {!isAvailable && (
            <span className="bg-rose-700 text-white text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 shadow-sm">
              OUT OF STOCK
            </span>
          )}

          {isAvailable && product.is_new && (
            <span className="bg-[#10B981] text-black text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 shadow-sm font-sans">
              NEW
            </span>
          )}

          {isAvailable && hasDiscount && (
            <span className="bg-[#10B981] text-black text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 shadow-sm font-sans">
              {discountPercent}% OFF
            </span>
          )}

          {isAvailable && !product.is_new && product.is_best_seller && (
            <span className="bg-[#059669] text-white text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 shadow-sm font-sans">
              BESTSELLER
            </span>
          )}
        </div>

        {/* Wishlist Heart Button */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          className={`absolute top-3 right-3 p-2.5 rounded-full transition-all duration-300 z-10 ${
            wishlisted
              ? 'bg-[#10B981] text-black'
              : 'bg-[#0B0F0D]/80 text-white hover:bg-[#10B981] hover:text-black'
          } shadow-sm border border-[#10B981]/30`}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          title={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
        >
          <Heart size={16} fill={wishlisted ? 'black' : 'none'} className="transition-colors" />
        </button>

        {/* Quick Add to Bag overlay on hover */}
        <div className="absolute inset-x-3 bottom-3 transform translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 z-10 hidden md:block">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!isAvailable}
            className={`w-full text-xs font-bold uppercase tracking-widest py-3 flex items-center justify-center gap-2 transition-colors duration-200 shadow-lg ${
              isAvailable
                ? 'bg-[#10B981] text-black hover:bg-[#059669] hover:text-white'
                : 'bg-stone-800 text-stone-500 cursor-not-allowed'
            }`}
          >
            <ShoppingBag size={14} />
            {isAvailable ? 'Add to Bag' : 'Out of Stock'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 md:p-5">
        <span className="text-[11px] uppercase tracking-wider text-[#10B981] font-semibold mb-1">
          {categoryName}
        </span>

        <Link
          to={`/product/${productSlug}`}
          className="font-serif text-base text-white hover:text-[#10B981] transition-colors line-clamp-1 mb-2 font-medium"
        >
          {product.name}
        </Link>

        <Rating rating={product.rating || 5.0} reviewCount={product.reviewCount || 12} className="mb-3" />

        <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-white/10">
          <PriceDisplay
            price={product.price}
            oldPrice={product.compare_at_price || product.original_price || product.oldPrice}
            discountPercentage={product.discount_percentage || discountPercent}
            size="sm"
            className="flex-1 min-w-0"
          />

          {/* Mobile add button */}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!isAvailable}
            className={`md:hidden shrink-0 p-2 ${isAvailable ? 'text-[#10B981] hover:text-white' : 'text-stone-500 cursor-not-allowed'}`}
            aria-label="Add to bag"
          >
            <ShoppingBag size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
