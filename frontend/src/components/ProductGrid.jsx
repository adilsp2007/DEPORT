import React from 'react';
import ProductCard from './ProductCard';
import Skeleton from './Skeleton';

export const ProductGrid = ({ products = [], loading = false, columns = 4, className = '' }) => {
  if (loading) {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 ${className}`}>
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="flex flex-col gap-3">
            <Skeleton className="aspect-4/5 w-full" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const columnClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  };

  return (
    <div className={`grid ${columnClasses[columns] || columnClasses[4]} gap-4 md:gap-6 ${className}`}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};

export default ProductGrid;
