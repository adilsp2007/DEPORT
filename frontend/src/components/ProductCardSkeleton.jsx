import React from 'react';
import Skeleton from './Skeleton';

export const ProductCardSkeleton = () => {
  return (
    <div className="bg-[#131915] border border-[#1E2922] p-4 flex flex-col space-y-4">
      <Skeleton className="w-full aspect-4/5" />
      <Skeleton className="w-1/3 h-3" />
      <Skeleton className="w-3/4 h-5" />
      <Skeleton className="w-1/2 h-4" />
      <div className="pt-2 border-t border-[#1E2922] flex justify-between items-center">
        <Skeleton className="w-20 h-5" />
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
    </div>
  );
};

export default ProductCardSkeleton;
