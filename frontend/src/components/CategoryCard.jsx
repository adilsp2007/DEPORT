import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const CategoryCard = ({ category }) => {
  const categoryKey = category.slug || category.id;
  const imageSrc = category.image || category.image_url || 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80';
  const countDisplay = category.product_count !== undefined 
    ? `${category.product_count} ${category.product_count === 1 ? 'Design' : 'Designs'}`
    : (category.itemCount || 'Curated Atelier');

  return (
    <Link
      to={`/shop?category=${categoryKey}`}
      className="group relative flex flex-col justify-end aspect-3/4 overflow-hidden bg-[#0B0F0D] text-white p-6 md:p-8 border border-[#1E2922] shadow-sm"
    >
      {/* Background Image with Overlay */}
      <img
        src={imageSrc}
        alt={category.name}
        onError={(e) => {
          e.currentTarget.src = 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80';
        }}
        className="absolute inset-0 h-full w-full object-cover object-center opacity-85 transition-transform duration-700 ease-out group-hover:scale-108"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F0D]/95 via-[#0B0F0D]/50 to-transparent transition-opacity duration-300 group-hover:opacity-95" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-start transition-transform duration-300 group-hover:-translate-y-1">
        <span className="text-[10px] uppercase font-bold tracking-widest text-[#10B981] mb-1">
          {countDisplay}
        </span>

        <h3 className="font-serif text-2xl md:text-3xl text-white font-medium mb-2">
          {category.name}
        </h3>

        <p className="text-xs md:text-sm text-gray-300 font-light line-clamp-2 mb-4 max-w-xs">
          {category.description}
        </p>

        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#10B981] group-hover:text-white transition-colors">
          Shop Now
          <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
};

export default CategoryCard;
