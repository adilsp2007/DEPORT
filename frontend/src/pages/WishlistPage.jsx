import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useWishlist from '../hooks/useWishlist';
import { useShop } from '../context/ShopContext';
import AccountSidebar from '../components/AccountSidebar';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import PriceDisplay from '../components/PriceDisplay';
import {
  Heart,
  ShoppingBag,
  Trash2,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const WishlistPage = () => {
  const { wishlist, isLoading, removeFromWishlist } = useWishlist();
  const { addToCart, showToast } = useShop();
  const navigate = useNavigate();

  const handleMoveToBag = (product) => {
    const isAvailable = product.is_available ?? (product.stock_quantity > 0);
    if (!isAvailable) {
      showToast('This item is currently out of stock.', 'info');
      return;
    }
    addToCart(product);
    removeFromWishlist(product.id);
    showToast(`Moved "${product.name}" to your shopping bag.`);
  };

  const handleRemove = (product) => {
    removeFromWishlist(product.id);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 text-[#F3F4F6]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#1E2922] mb-10 gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            MY ACCOUNT
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#F3F4F6] flex items-center gap-3">
            <Heart className="text-[#10B981]" size={32} />
            My Wishlist ({wishlist.length})
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-light">
            Your curated collection of saved favorites. Move items to your bag whenever you are ready.
          </p>
        </div>

        {wishlist.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              let movedCount = 0;
              wishlist.forEach((item) => {
                const prod = item.product;
                const isAvail = prod?.is_available ?? (prod?.stock_quantity > 0);
                if (prod && isAvail) {
                  addToCart(prod);
                  removeFromWishlist(prod.id);
                  movedCount++;
                }
              });
              if (movedCount > 0) {
                showToast(`Moved ${movedCount} item(s) to your shopping bag!`);
              } else {
                showToast('No in-stock items available to move.', 'info');
              }
            }}
            icon={ShoppingBag}
          >
            Move All Available to Bag
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Account Sidebar Navigation */}
        <div className="lg:col-span-3">
          <AccountSidebar />
        </div>

        {/* Main Wishlist Content */}
        <div className="lg:col-span-9">
          {/* Loading Skeletons */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <ProductCardSkeleton key={n} />
              ))}
            </div>
          )}

          {/* Empty Wishlist State */}
          {!isLoading && wishlist.length === 0 && (
            <EmptyState
              icon={Heart}
              title="Your Wishlist Is Empty"
              description="Save the luxury leather bags you love and they will appear here for easy access."
              actionLabel="Explore Collections"
              actionIcon={ArrowRight}
              onAction={() => navigate('/shop')}
            />
          )}

          {/* Wishlist Items Grid */}
          {!isLoading && wishlist.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {wishlist.map((item) => {
                const product = item.product;
                if (!product) return null;

                const primaryImg =
                  product.primary_image ||
                  (Array.isArray(product.images) && product.images[0]?.image) ||
                  product.images?.[0] ||
                  'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80';

                const isAvailable = product.is_available ?? (product.stock_quantity > 0);
                const productSlug = product.slug || product.id;

                return (
                  <div
                    key={item.id || product.id}
                    className="group flex flex-col bg-[#131915] border border-[#1E2922] hover:border-[#10B981]/50 transition-all duration-300 shadow-md hover:shadow-2xl overflow-hidden"
                  >
                    {/* Image & Badges */}
                    <div className="relative aspect-4/5 overflow-hidden bg-[#0B0F0D]">
                      <Link to={`/product/${productSlug}`} className="block h-full w-full">
                        <img
                          src={primaryImg}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </Link>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemove(product)}
                        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-[#0B0F0D]/80 hover:bg-rose-950/80 text-gray-300 hover:text-rose-400 border border-[#1E2922] hover:border-rose-800 flex items-center justify-center transition-all z-10 cursor-pointer"
                        title="Remove from wishlist"
                      >
                        <Trash2 size={16} />
                      </button>

                      {/* Stock Status Badge */}
                      <div className="absolute top-3 left-3 z-10">
                        {isAvailable ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest bg-[#10B981] text-black">
                            In Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest bg-rose-800 text-white">
                            Out of Stock
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content & Actions */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-[#10B981] font-bold block mb-1">
                          {product.category?.name || product.brand || 'DEPORT'}
                        </span>
                        <Link
                          to={`/product/${productSlug}`}
                          className="font-serif text-base text-[#F3F4F6] hover:text-[#10B981] transition-colors line-clamp-1 font-semibold block"
                        >
                          {product.name}
                        </Link>
                        <div className="mt-2">
                          <PriceDisplay
                            price={product.price}
                            oldPrice={product.compare_at_price || product.original_price}
                            discountPercentage={product.discount_percentage}
                            size="sm"
                          />
                        </div>
                      </div>

                      {/* Move to Bag Action */}
                      <div className="pt-3 border-t border-[#1E2922] flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          fullWidth
                          icon={ShoppingBag}
                          onClick={() => handleMoveToBag(product)}
                          disabled={!isAvailable}
                          className={!isAvailable ? 'opacity-50 cursor-not-allowed bg-stone-800 border-stone-700' : ''}
                        >
                          {isAvailable ? 'Move to Bag' : 'Sold Out'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WishlistPage;
