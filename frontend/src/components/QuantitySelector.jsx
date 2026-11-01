import React from 'react';
import { Plus, Minus } from 'lucide-react';

export const QuantitySelector = ({ quantity, onIncrease, onDecrease, min = 1, max = 99, size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-8 px-2 text-xs',
    md: 'h-11 px-3 text-sm',
    lg: 'h-12 px-4 text-base'
  };

  return (
    <div className={`inline-flex items-center border border-[#1E2922] bg-[#161D19] ${sizeClasses[size]}`}>
      <button
        type="button"
        onClick={onDecrease}
        disabled={quantity <= min}
        className="p-1 text-[#F3F4F6] hover:text-[#10B981] disabled:opacity-30 disabled:hover:text-[#F3F4F6] transition-colors"
        aria-label="Decrease quantity"
      >
        <Minus size={14} />
      </button>
      
      <span className="w-10 text-center font-semibold text-[#F3F4F6]">
        {quantity}
      </span>
      
      <button
        type="button"
        onClick={onIncrease}
        disabled={quantity >= max}
        className="p-1 text-[#F3F4F6] hover:text-[#10B981] disabled:opacity-30 disabled:hover:text-[#F3F4F6] transition-colors"
        aria-label="Increase quantity"
      >
        <Plus size={14} />
      </button>
    </div>
  );
};

export default QuantitySelector;
