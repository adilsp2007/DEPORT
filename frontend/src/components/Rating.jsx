import React from 'react';
import { Star } from 'lucide-react';

export const Rating = ({ rating = 5, reviewCount = null, size = 14, className = '' }) => {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-0.5 text-[#10B981]">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            className={`${
              star <= Math.round(rating)
                ? 'fill-[#10B981] text-[#10B981]'
                : 'text-gray-700'
            }`}
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-[#F3F4F6]">{Number(rating).toFixed(1)}</span>
      {reviewCount !== null && (
        <span className="text-xs text-gray-400">({reviewCount})</span>
      )}
    </div>
  );
};

export default Rating;
