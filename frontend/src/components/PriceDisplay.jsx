import React from 'react';
import { formatINR } from '../utils/currencyUtils';

/**
 * Universal Price and Discount Display Component for DEPORT
 * Renders:
 * - Selling Price (prominently in bold white text)
 * - Original Price (smaller, grey, with strikethrough)
 * - Discount Badge (e.g., "29% OFF" in brand emerald)
 * If no discount exists (or compare price <= selling price), only displays regular price.
 */
export const PriceDisplay = ({
  price,
  oldPrice = null,
  discountPercentage = null,
  size = 'md',
  showBadge = true,
  className = '',
  badgeClassName = ''
}) => {
  const formattedPrice = formatINR(price);
  if (!formattedPrice) return null;

  const numPrice = Number(price);
  const numOldPrice =
    oldPrice !== null && oldPrice !== undefined && oldPrice !== ''
      ? Number(oldPrice)
      : null;

  // A discount is valid only when original price is strictly greater than selling price and selling price >= 0
  const hasDiscount =
    numOldPrice !== null &&
    !isNaN(numOldPrice) &&
    !isNaN(numPrice) &&
    numOldPrice > numPrice &&
    numPrice >= 0;

  // Calculate discount percentage if not explicitly provided
  let pct = 0;
  if (hasDiscount) {
    if (discountPercentage !== null && discountPercentage !== undefined && !isNaN(Number(discountPercentage))) {
      pct = Math.round(Number(discountPercentage));
    } else if (numOldPrice > 0) {
      pct = Math.round(((numOldPrice - numPrice) / numOldPrice) * 100);
    }
  }

  // Size styling tokens
  const priceSizes = {
    xs: 'text-xs font-bold',
    sm: 'text-sm sm:text-base font-bold',
    md: 'text-base sm:text-lg font-bold',
    lg: 'text-2xl sm:text-3xl font-bold font-serif',
    xl: 'text-3xl sm:text-4xl font-bold font-serif'
  };

  const oldPriceSizes = {
    xs: 'text-[10px]',
    sm: 'text-xs',
    md: 'text-xs sm:text-sm',
    lg: 'text-sm sm:text-base',
    xl: 'text-base sm:text-lg'
  };

  const badgeSizes = {
    xs: 'text-[9px] px-1 py-0.5',
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-[11px] px-1.5 py-0.5',
    lg: 'text-xs px-2 py-0.5',
    xl: 'text-xs sm:text-sm px-2.5 py-1'
  };

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      {/* 1. Final Selling Price (Prominently bold and high-contrast) */}
      <span className={`${priceSizes[size] || priceSizes.md} text-white tracking-tight`}>
        {formattedPrice}
      </span>

      {/* 2. Original Price (Smaller, grey, crossed out) */}
      {hasDiscount && (
        <span
          className={`${oldPriceSizes[size] || oldPriceSizes.md} text-gray-400 line-through font-normal select-none`}
          aria-label={`Original price: ${formatINR(numOldPrice)}`}
        >
          {formatINR(numOldPrice)}
        </span>
      )}

      {/* 3. Discount Percentage Badge (Clearly visible & compact) */}
      {hasDiscount && pct > 0 && showBadge && (
        <span
          className={`inline-flex items-center font-extrabold uppercase tracking-wider bg-[#10B981] text-black font-sans leading-none shadow-xs whitespace-nowrap rounded-xs ${
            badgeSizes[size] || badgeSizes.md
          } ${badgeClassName}`}
          aria-label={`${pct}% discount`}
        >
          {pct}% OFF
        </span>
      )}
    </div>
  );
};

export default PriceDisplay;
