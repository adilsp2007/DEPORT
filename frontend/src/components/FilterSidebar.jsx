import React, { useState, useEffect } from 'react';
import { useCategories } from '../hooks/useProducts';
import productService from '../services/productService';

export const FilterSidebar = ({
  selectedCategory,
  onSelectCategory,
  minPrice,
  maxPrice,
  onPriceChange,
  selectedBrand,
  onSelectBrand,
  isNew,
  onToggleNew,
  isFeatured,
  onToggleFeatured,
  isBestSeller,
  onToggleBestSeller,
  onReset
}) => {
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.results || categoriesData || [];

  const [brands, setBrands] = useState([]);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const brandsList = await productService.getBrands();
        if (Array.isArray(brandsList) && brandsList.length > 0) {
          setBrands(brandsList);
        } else {
          setBrands(['DEPORT']);
        }
      } catch (err) {
        setBrands(['DEPORT']);
      }
    };
    fetchBrands();
  }, []);

  return (
    <aside className="w-full flex flex-col gap-8 pr-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1E2922]">
        <h3 className="font-serif text-lg font-semibold text-[#F3F4F6]">Filters</h3>
        <button
          type="button"
          onClick={onReset}
          className="text-xs uppercase tracking-wider font-semibold text-[#10B981] hover:text-[#059669] transition-colors cursor-pointer"
        >
          Clear Filters
        </button>
      </div>

      {/* Category Filter */}
      <div>
        <h4 className="text-xs uppercase font-bold tracking-widest text-gray-400 mb-4">
          Categories
        </h4>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => onSelectCategory('')}
            className={`text-left text-sm transition-colors cursor-pointer ${
              !selectedCategory || selectedCategory === 'all'
                ? 'font-bold text-[#10B981] tracking-wide'
                : 'text-gray-400 hover:text-[#F3F4F6]'
            }`}
          >
            All Collections
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.slug)}
              className={`text-left text-sm transition-colors flex items-center justify-between cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'font-bold text-[#10B981] tracking-wide'
                  : 'text-gray-400 hover:text-[#F3F4F6]'
              }`}
            >
              <span>{cat.name}</span>
              {cat.product_count !== undefined && (
                <span className="text-xs opacity-60">({cat.product_count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Brand Filter (optional) */}
      <div className="pt-4 border-t border-[#1E2922]">
        <h4 className="text-xs uppercase font-bold tracking-widest text-gray-400 mb-4">
          Brand
        </h4>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onSelectBrand?.('')}
            className={`text-left text-sm transition-colors cursor-pointer ${
              !selectedBrand
                ? 'font-bold text-[#10B981]'
                : 'text-gray-400 hover:text-[#F3F4F6]'
            }`}
          >
            All Brands
          </button>
          {brands.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onSelectBrand?.(b)}
              className={`text-left text-sm transition-colors cursor-pointer ${
                selectedBrand === b
                  ? 'font-bold text-[#10B981]'
                  : 'text-gray-400 hover:text-[#F3F4F6]'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range Filter */}
      <div className="pt-4 border-t border-[#1E2922]">
        <h4 className="text-xs uppercase font-bold tracking-widest text-gray-400 mb-4">
          Price Range (₹)
        </h4>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <label className="text-[10px] uppercase text-gray-400 block mb-1">Min Price</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={minPrice || ''}
              onChange={(e) => onPriceChange(e.target.value, maxPrice)}
              className="w-full bg-[#161D19] text-[#F3F4F6] text-xs px-3 py-2 border border-[#1E2922] focus:outline-none focus:border-[#10B981]"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-gray-400 block mb-1">Max Price</label>
            <input
              type="number"
              min="0"
              placeholder="1000"
              value={maxPrice || ''}
              onChange={(e) => onPriceChange(minPrice, e.target.value)}
              className="w-full bg-[#161D19] text-[#F3F4F6] text-xs px-3 py-2 border border-[#1E2922] focus:outline-none focus:border-[#10B981]"
            />
          </div>
        </div>
      </div>

      {/* Collections & Features Filter */}
      <div className="pt-4 border-t border-[#1E2922]">
        <h4 className="text-xs uppercase font-bold tracking-widest text-gray-400 mb-4">
          Collections
        </h4>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer select-none text-sm text-[#F3F4F6]">
            <input
              type="checkbox"
              checked={Boolean(isNew)}
              onChange={(e) => onToggleNew(e.target.checked)}
              className="accent-[#10B981] w-4 h-4 rounded-none cursor-pointer"
            />
            <span>New Arrivals</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer select-none text-sm text-[#F3F4F6]">
            <input
              type="checkbox"
              checked={Boolean(isFeatured)}
              onChange={(e) => onToggleFeatured(e.target.checked)}
              className="accent-[#10B981] w-4 h-4 rounded-none cursor-pointer"
            />
            <span>Featured Collection</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer select-none text-sm text-[#F3F4F6]">
            <input
              type="checkbox"
              checked={Boolean(isBestSeller)}
              onChange={(e) => onToggleBestSeller(e.target.checked)}
              className="accent-[#10B981] w-4 h-4 rounded-none cursor-pointer"
            />
            <span>Best Sellers</span>
          </label>
        </div>
      </div>
    </aside>
  );
};

export default FilterSidebar;
