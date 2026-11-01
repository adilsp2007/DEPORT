import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useShop } from '../context/ShopContext';
import QuantitySelector from '../components/QuantitySelector';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import { formatINR } from '../utils/currencyUtils';
import {
  Trash2,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Truck,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Ticket,
  Tag,
  CheckCircle2,
  X
} from 'lucide-react';

export const CartPage = () => {
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartSubtotal,
    appliedCoupon,
    appliedDiscount,
    applyCoupon,
    removeCoupon,
    canCheckout,
    checkoutBlockReason,
    showToast
  } = useShop();

  const navigate = useNavigate();
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const shippingCost = cartSubtotal >= 300 || cartSubtotal === 0 ? 0 : 25;
  const orderTotal = Math.max(0, cartSubtotal + shippingCost - appliedDiscount);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    setCouponError('');
    if (!couponInput.trim()) return;

    setApplyingCoupon(true);
    const res = await applyCoupon(couponInput);
    setApplyingCoupon(false);
    if (res.success) {
      showToast(res.data.message || `Coupon "${res.data.code}" applied!`);
      setCouponInput('');
    } else {
      setCouponError(res.detail || 'Invalid coupon.');
      showToast(res.detail || 'Invalid coupon.', 'error');
    }
  };

  const handleRemoveCoupon = async () => {
    await removeCoupon();
    setCouponError('');
    showToast('Coupon removed.', 'info');
  };

  const handleCheckout = () => {
    if (!canCheckout) {
      showToast(checkoutBlockReason || 'Please fix out-of-stock items before checkout.', 'error');
      return;
    }
    navigate('/checkout');
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <EmptyState
          icon={ShoppingBag}
          title="Your Shopping Bag is Empty"
          description="Explore our hand-crafted luxury leather bags and tote collections to find your signature piece."
          actionLabel="Explore Collections"
          onAction={() => navigate('/shop')}
          actionIcon={ArrowRight}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 text-[#F3F4F6]">
      {/* Page Header */}
      <div className="mb-8 pb-6 border-b border-[#1E2922] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-1">
            DEPORT ATELIER
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#F3F4F6]">
            Shopping Bag ({cart.reduce((c, i) => c + i.quantity, 0)})
          </h1>
        </div>

        <button
          type="button"
          onClick={clearCart}
          className="text-xs text-gray-400 hover:text-rose-400 uppercase tracking-wider font-semibold cursor-pointer"
        >
          Clear Shopping Bag
        </button>
      </div>

      {/* Out of Stock / Checkout Restricted Warning Banner */}
      {!canCheckout && checkoutBlockReason && (
        <div className="mb-8 p-4 bg-rose-950/70 border-l-4 border-rose-500 text-rose-200 text-xs flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-rose-400 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm text-white">Checkout Restricted</p>
              <p className="mt-0.5">{checkoutBlockReason}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Cart Items Table / List (Left 8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Header Row Desktop */}
          <div className="hidden sm:grid grid-cols-12 text-xs uppercase font-bold tracking-widest text-gray-400 pb-4 border-b border-[#1E2922]">
            <span className="col-span-6">Item Description</span>
            <span className="col-span-3 text-center">Quantity</span>
            <span className="col-span-3 text-right">Total</span>
          </div>

          {cart.map((item) => {
            const product = item.product;
            const stock = product.stock_quantity ?? 10;
            const isOutOfStock = stock === 0;
            const isInsufficient = item.quantity > stock;
            const isUnlisted = product.is_active === false || product.is_deleted === true;
            const price = parseFloat(product.price) || 0;
            const itemTotal = price * item.quantity;

            const productLink = product.slug ? `/product/${product.slug}` : `/shop`;
            const imageSrc =
              item.product?.primary_image ||
              (Array.isArray(item.product?.images) && (item.product.images[0]?.image || item.product.images[0])) ||
              null;

            return (
              <div
                key={`${product.id}-${item.selectedColor?.name || 'def'}`}
                className={`grid grid-cols-1 sm:grid-cols-12 gap-4 items-center p-4 bg-[#131915] border shadow-xs transition-colors ${
                  isOutOfStock || isUnlisted
                    ? 'border-rose-900/60 bg-rose-950/20'
                    : isInsufficient
                    ? 'border-amber-900/60 bg-amber-950/20'
                    : 'border-[#1E2922]'
                }`}
              >
                {/* Product details */}
                <div className="sm:col-span-6 flex gap-4 items-center">
                  <Link to={productLink} className="w-20 h-24 flex-shrink-0 bg-[#161D19] border border-[#1E2922] overflow-hidden">
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-serif text-lg font-bold text-[#10B981]">
                        {product.name?.[0] || 'L'}
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-col items-start space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-[#10B981] font-bold">
                      {product.brand || 'DEPORT'}
                    </span>
                    <Link
                      to={productLink}
                      className="font-serif text-base font-semibold text-[#F3F4F6] hover:text-[#10B981] transition-colors"
                    >
                      {product.name}
                    </Link>

                    {/* Stock Badges */}
                    {isUnlisted ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-950/80 px-2 py-0.5 border border-rose-800">
                        <AlertCircle size={10} /> Product Unlisted
                      </span>
                    ) : isOutOfStock ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-950/80 px-2 py-0.5 border border-rose-800">
                        <AlertCircle size={10} /> Sold Out
                      </span>
                    ) : isInsufficient ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/80 px-2 py-0.5 border border-amber-800">
                        <AlertTriangle size={10} /> Only {stock} Available
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-white font-semibold">
                          {formatINR(price)}
                        </span>
                        {product.compare_at_price && Number(product.compare_at_price) > Number(price) && (
                          <span className="text-[10px] text-gray-500 line-through">
                            {formatINR(product.compare_at_price)}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400">each</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quantity with Stock Validations */}
                <div className="sm:col-span-3 flex items-center justify-between sm:justify-center">
                  <span className="text-xs text-gray-400 sm:hidden">Quantity:</span>
                  <div className="flex flex-col items-center gap-1">
                    <QuantitySelector
                      quantity={item.quantity}
                      onIncrease={() =>
                        updateCartQuantity(product.id, item.selectedColor?.name, item.quantity + 1)
                      }
                      onDecrease={() =>
                        updateCartQuantity(product.id, item.selectedColor?.name, item.quantity - 1)
                      }
                      disabled={isOutOfStock || isUnlisted}
                      size="sm"
                    />
                    <span className="text-[10px] text-gray-500">
                      {isOutOfStock ? '0 in stock' : `Max: ${Math.min(stock, 10)}`}
                    </span>
                  </div>
                </div>

                {/* Total & Remove */}
                <div className="sm:col-span-3 flex items-center justify-between sm:justify-end gap-4">
                  <span className="font-serif text-base font-bold text-[#10B981]">
                    {formatINR(itemTotal)}
                  </span>
                  <button
                    onClick={() => removeFromCart(product.id, item.selectedColor?.name)}
                    className="text-gray-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          <div className="flex justify-between items-center pt-4">
            <Link to="/shop">
              <Button variant="outline" size="sm">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>

        {/* Order Summary Sidebar (Right 4 cols) */}
        <div className="lg:col-span-4 bg-[#131915] border border-[#1E2922] p-6 sm:p-8 shadow-xs space-y-6">
          <h3 className="font-serif text-xl text-[#F3F4F6] pb-4 border-b border-[#1E2922]">
            Order Summary
          </h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span className="font-semibold text-[#F3F4F6]">{formatINR(cartSubtotal)}</span>
            </div>

            {appliedCoupon && appliedDiscount > 0 && (
              <div className="flex justify-between text-[#10B981] font-medium animate-fadeIn">
                <span className="flex items-center gap-1.5">
                  <Tag size={13} />
                  <span>Promo Code ({appliedCoupon.code})</span>
                </span>
                <span className="font-semibold font-mono">-{formatINR(appliedDiscount)}</span>
              </div>
            )}

            {appliedCoupon && appliedDiscount === 0 && (
              <p className="text-[11px] text-amber-400">
                Minimum order of {formatINR(appliedCoupon.min_order_amount)} required for coupon <strong className="font-mono">{appliedCoupon.code}</strong>.
              </p>
            )}

            <div className="flex justify-between text-gray-400">
              <span>Complimentary Shipping</span>
              <span className="font-semibold text-[#10B981]">
                {shippingCost === 0 ? 'FREE' : formatINR(shippingCost)}
              </span>
            </div>

            {shippingCost > 0 && (
              <p className="text-[11px] text-[#10B981]">
                Add {formatINR(Math.max(0, 300 - cartSubtotal))} more for FREE Global Express Shipping
              </p>
            )}

            <div className="pt-4 border-t border-[#1E2922] flex justify-between items-baseline font-serif text-xl text-[#F3F4F6] font-bold">
              <span>Total</span>
              <span className="text-[#10B981]">{formatINR(orderTotal)}</span>
            </div>
          </div>

          {/* Coupon Code Section */}
          <div className="pt-4 border-t border-[#1E2922]">
            {appliedCoupon ? (
              <div className="p-3 bg-[#161D19] border border-[#10B981]/30 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-[#10B981] text-xs font-mono font-bold">
                    <CheckCircle2 size={14} />
                    <span>{appliedCoupon.code}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {appliedCoupon.discount_type === 'percentage'
                      ? `${appliedCoupon.discount_value}% Discount${appliedCoupon.max_discount_amount ? ` (Max ${formatINR(appliedCoupon.max_discount_amount)})` : ''}`
                      : `${formatINR(appliedCoupon.discount_value)} Fixed Discount`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 hover:bg-rose-950/40 rounded transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Coupon Code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    className="flex-1 bg-[#161D19] text-[#F3F4F6] text-xs px-3 py-2 border border-[#1E2922] focus:outline-none focus:border-[#10B981] uppercase font-mono"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={applyingCoupon}
                    disabled={!couponInput.trim() || applyingCoupon}
                  >
                    Apply
                  </Button>
                </div>
                {couponError && (
                  <p className="text-[11px] text-rose-400 font-medium">
                    {couponError}
                  </p>
                )}
              </form>
            )}
          </div>

          {/* Checkout Button & Restriction Alert */}
          <div>
            <Button
              variant="primary"
              fullWidth
              size="lg"
              icon={ArrowRight}
              onClick={handleCheckout}
              disabled={!canCheckout}
              className={!canCheckout ? 'opacity-50 cursor-not-allowed bg-gray-800 border-gray-700' : ''}
            >
              {canCheckout ? 'Proceed to Checkout' : 'Checkout Restricted'}
            </Button>

            {!canCheckout && (
              <p className="text-[11px] text-rose-400 text-center mt-2 font-medium">
                Please remove or adjust out-of-stock items before checking out.
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-[#1E2922] space-y-2 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-[#10B981]" />
              <span>256-Bit SSL Encrypted Safe Checkout</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck size={14} className="text-[#10B981]" />
              <span>Complimentary Returns & Gift Packaging</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
