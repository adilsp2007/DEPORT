import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import FilterSidebar from '../components/FilterSidebar';
import FilterDrawer from '../components/FilterDrawer';
import ProductCard from '../components/ProductCard';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import {
  SlidersHorizontal,
  ChevronDown,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Tag
} from 'lucide-react';

export const ShopPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse URL query parameters
  const rawCategoryParam = searchParams.get('category') || '';
  const categoryParam = rawCategoryParam.toLowerCase() === 'all' ? '' : rawCategoryParam;
  const searchParam = searchParams.get('search') || '';
  const brandParam = searchParams.get('brand') || '';
  const minPriceParam = searchParams.get('min_price') || '';
  const maxPriceParam = searchParams.get('max_price') || '';
  const isNewParam = searchParams.get('is_new') === 'true';
  const isFeaturedParam = searchParams.get('is_featured') === 'true';
  const isBestSellerParam = searchParams.get('is_best_seller') === 'true';
  const sortParam = searchParams.get('sort') || 'newest';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchParam);

  // Sync local search when URL changes
  React.useEffect(() => {
    setLocalSearch(searchParam);
  }, [searchParam]);

  // Construct query object for API hook
  const apiParams = useMemo(() => {
    const params = {};
    if (categoryParam) params.category = categoryParam;
    if (searchParam) params.search = searchParam;
    if (brandParam) params.brand = brandParam;
    if (minPriceParam) params.min_price = minPriceParam;
    if (maxPriceParam) params.max_price = maxPriceParam;
    if (isNewParam) params.is_new = 'true';
    if (isFeaturedParam) params.is_featured = 'true';
    if (isBestSellerParam) params.is_best_seller = 'true';
    if (sortParam) params.sort = sortParam;
    if (pageParam > 1) params.page = pageParam;
    return params;
  }, [
    categoryParam,
    searchParam,
    brandParam,
    minPriceParam,
    maxPriceParam,
    isNewParam,
    isFeaturedParam,
    isBestSellerParam,
    sortParam,
    pageParam,
  ]);

  // Fetch products from backend API
  const { data, isLoading, isError, refetch } = useProducts(apiParams);

  const products = data?.results || [];
  const totalCount = data?.count || 0;
  const pageSize = 12;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Helper to update search params while preserving existing filters
  const updateParams = (updates) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === false) {
        newParams.delete(key);
      } else {
        newParams.set(key, String(value));
      }
    });
    // Reset page to 1 when filters change (unless updating page itself)
    if (!('page' in updates)) {
      newParams.delete('page');
    }
    setSearchParams(newParams);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    updateParams({ search: localSearch.trim() });
  };

  const handleClearSearch = () => {
    setLocalSearch('');
    updateParams({ search: '' });
  };

  const handleResetFilters = () => {
    setLocalSearch('');
    setSearchParams({});
  };

  // Determine active filter badges
  const activeFilters = useMemo(() => {
    const list = [];
    if (searchParam) list.push({ key: 'search', label: `Search: "${searchParam}"` });
    if (categoryParam) list.push({ key: 'category', label: `Category: ${categoryParam}` });
    if (brandParam) list.push({ key: 'brand', label: `Brand: ${brandParam}` });
    if (minPriceParam || maxPriceParam) {
      list.push({
        key: 'price',
        label: `Price: ₹${minPriceParam || 0} - ${maxPriceParam ? `₹${maxPriceParam}` : 'Any'}`
      });
    }
    if (isNewParam) list.push({ key: 'is_new', label: 'New Arrivals' });
    if (isFeaturedParam) list.push({ key: 'is_featured', label: 'Featured' });
    if (isBestSellerParam) list.push({ key: 'is_best_seller', label: 'Best Sellers' });
    return list;
  }, [searchParam, categoryParam, brandParam, minPriceParam, maxPriceParam, isNewParam, isFeaturedParam, isBestSellerParam]);

  const handleRemoveBadge = (key) => {
    if (key === 'search') handleClearSearch();
    else if (key === 'price') updateParams({ min_price: null, max_price: null });
    else updateParams({ [key]: null });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16 text-[#F3F4F6]">
      {/* Header Banner */}
      <div className="mb-8 text-center md:text-left border-b border-[#1E2922] pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#10B981] font-bold block mb-2">
            LUXURY LEATHER GOODS
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#F3F4F6] font-normal">
            {searchParam
              ? `Results for "${searchParam}"`
              : categoryParam
              ? `${categoryParam.replace('-', ' ').toUpperCase()} COLLECTION`
              : 'All Collections'}
          </h1>
          <p className="text-gray-400 text-sm mt-3 font-light max-w-xl">
            Explore our handcrafted luxury bags, engineered with lifetime Italian leather and signature craftsmanship.
          </p>
        </div>

        {/* Backend Search with Clear Button */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search catalog..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full bg-[#131915] text-[#F3F4F6] text-xs px-4 py-2.5 pl-10 pr-20 border border-[#1E2922] focus:outline-none focus:border-[#10B981] placeholder-gray-500"
          />
          {localSearch && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-gray-400 hover:text-white p-1 cursor-pointer"
                title="Cancel search"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Active Filter Chips / Enhancement */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-[#131915] border border-[#1E2922]">
          <span className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mr-1">
            Active Filters:
          </span>
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[#161D19] border border-[#10B981]/40 text-[#10B981]"
            >
              <span>{filter.label}</span>
              <button
                type="button"
                onClick={() => handleRemoveBadge(filter.key)}
                className="hover:text-white cursor-pointer ml-0.5"
                title="Remove filter"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs uppercase tracking-wider text-rose-400 hover:underline ml-auto font-semibold cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Main Shop Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Desktop Filter Sidebar (Left 3 columns) */}
        <div className="hidden lg:block lg:col-span-3 sticky top-28 bg-[#131915] p-6 border border-[#1E2922] shadow-xs">
          <FilterSidebar
            selectedCategory={categoryParam}
            onSelectCategory={(cat) => updateParams({ category: cat })}
            selectedBrand={brandParam}
            onSelectBrand={(b) => updateParams({ brand: b })}
            minPrice={minPriceParam}
            maxPrice={maxPriceParam}
            onPriceChange={(minP, maxP) => updateParams({ min_price: minP, max_price: maxP })}
            isNew={isNewParam}
            onToggleNew={(val) => updateParams({ is_new: val ? 'true' : null })}
            isFeatured={isFeaturedParam}
            onToggleFeatured={(val) => updateParams({ is_featured: val ? 'true' : null })}
            isBestSeller={isBestSellerParam}
            onToggleBestSeller={(val) => updateParams({ is_best_seller: val ? 'true' : null })}
            onReset={handleResetFilters}
          />
        </div>

        {/* Product Grid Area (Right 9 columns) */}
        <div className="lg:col-span-9 flex flex-col gap-6">
          {/* Controls Header (Mobile Filter Button & Sort Dropdown) */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#131915] p-4 border border-[#1E2922]">
            {/* Mobile Filter Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(true)}
              className="lg:hidden inline-flex items-center gap-2 text-xs uppercase font-bold tracking-widest text-[#F3F4F6] border border-[#1E2922] px-4 py-2.5 hover:border-[#10B981] cursor-pointer"
            >
              <SlidersHorizontal size={16} />
              Filter & Sort
            </button>

            {/* Product Count Display */}
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
              Showing <span className="text-[#10B981] font-bold">{totalCount}</span> Products
            </span>

            {/* Sorting Select (Price low to high, high to low, A-Z, Z-A) */}
            <div className="flex items-center gap-2">
              <label htmlFor="sort-select" className="text-xs uppercase font-semibold text-gray-400 hidden sm:block">
                Sort By:
              </label>
              <div className="relative">
                <select
                  id="sort-select"
                  value={sortParam}
                  onChange={(e) => updateParams({ sort: e.target.value })}
                  className="appearance-none bg-[#161D19] text-[#F3F4F6] text-xs uppercase tracking-wider font-semibold py-2.5 pl-4 pr-9 border border-[#1E2922] focus:outline-none focus:border-[#10B981] cursor-pointer"
                >
                  <option value="newest" className="bg-[#161D19] text-[#F3F4F6]">Newest Arrivals</option>
                  <option value="price_low" className="bg-[#161D19] text-[#F3F4F6]">Price: Low to High</option>
                  <option value="price_high" className="bg-[#161D19] text-[#F3F4F6]">Price: High to Low</option>
                  <option value="name_asc" className="bg-[#161D19] text-[#F3F4F6]">Alphabetical: A to Z</option>
                  <option value="name_desc" className="bg-[#161D19] text-[#F3F4F6]">Alphabetical: Z to A</option>
                  <option value="popular" className="bg-[#161D19] text-[#F3F4F6]">Most Popular</option>
                  <option value="best_selling" className="bg-[#161D19] text-[#F3F4F6]">Best Selling</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
            </div>
          </div>

          {/* Loading Skeletons */}
          {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 9 }).map((_, idx) => (
                <ProductCardSkeleton key={idx} />
              ))}
            </div>
          )}

          {/* Error State */}
          {!isLoading && isError && (
            <div className="bg-[#131915] border border-rose-900/50 p-8 text-center my-4 space-y-4">
              <RefreshCw size={36} className="text-rose-500 mx-auto" />
              <h3 className="font-serif text-xl text-[#F3F4F6]">Unable to load products.</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">Please check your network connection and try again.</p>
              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={() => refetch()}
                className="mx-auto"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isError && products.length === 0 && (
            <EmptyState
              icon={RefreshCw}
              title="No Bags Found"
              description="No active products match your current filters. Try resetting search or pricing."
              actionLabel="Clear Filters"
              onAction={handleResetFilters}
            />
          )}

          {/* Product Cards Grid */}
          {!isLoading && !isError && products.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-8 border-t border-[#1E2922] mt-6">
                  <button
                    type="button"
                    disabled={pageParam <= 1}
                    onClick={() => updateParams({ page: pageParam - 1 })}
                    className="p-2 border border-[#1E2922] text-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#10B981] transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    const isActive = pageNum === pageParam;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => updateParams({ page: pageNum })}
                        className={`w-9 h-9 text-xs font-semibold uppercase transition-all border cursor-pointer ${
                          isActive
                            ? 'bg-[#10B981] text-black border-[#10B981]'
                            : 'bg-[#131915] text-[#F3F4F6] border-[#1E2922] hover:border-[#10B981]'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={pageParam >= totalPages}
                    onClick={() => updateParams({ page: pageParam + 1 })}
                    className="p-2 border border-[#1E2922] text-[#F3F4F6] disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#10B981] transition-colors cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      <FilterDrawer
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        selectedCategory={categoryParam}
        onSelectCategory={(cat) => updateParams({ category: cat })}
        selectedBrand={brandParam}
        onSelectBrand={(b) => updateParams({ brand: b })}
        minPrice={minPriceParam}
        maxPrice={maxPriceParam}
        onPriceChange={(minP, maxP) => updateParams({ min_price: minP, max_price: maxP })}
        isNew={isNewParam}
        onToggleNew={(val) => updateParams({ is_new: val ? 'true' : null })}
        isFeatured={isFeaturedParam}
        onToggleFeatured={(val) => updateParams({ is_featured: val ? 'true' : null })}
        isBestSeller={isBestSellerParam}
        onToggleBestSeller={(val) => updateParams({ is_best_seller: val ? 'true' : null })}
        onReset={handleResetFilters}
      />
    </div>
  );
};

export default ShopPage;
