import React from 'react';
import { Package, ArrowUpDown, Award } from 'lucide-react';
import { formatINR } from '../../../utils/currencyUtils';

export const TopSellingProductsTable = ({
  products = [],
  sortOption = 'units_sold_desc',
  onSortChange,
  isLoading = false
}) => {
  const sortOptions = [
    { id: 'units_sold_desc', label: 'Highest Sold' },
    { id: 'revenue_desc', label: 'Highest Revenue' },
    { id: 'units_sold_asc', label: 'Lowest Sold' }
  ];

  return (
    <div className="bg-[#131915] border border-[#1E2922] p-5 sm:p-6 shadow-sm flex flex-col justify-between">
      {/* Header & Sort Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#1E2922]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Award size={16} />
            </span>
            <h3 className="font-serif text-lg font-bold text-[#F3F4F6]">
              Top-Selling Products
            </h3>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Top catalog performers ranked by order volume and revenue
          </p>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          <span className="text-gray-400 text-[11px] uppercase tracking-wider flex items-center gap-1">
            <ArrowUpDown size={12} />
            <span>Sort by:</span>
          </span>
          <div className="flex bg-[#161D19] border border-[#1E2922] p-0.5">
            {sortOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSortChange && onSortChange(opt.id)}
                disabled={isLoading}
                className={`px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                  sortOption === opt.id
                    ? 'bg-[#10B981] text-black font-bold'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table / List */}
      <div className="overflow-x-auto">
        {!products || products.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 space-y-2">
            <Package size={28} className="mx-auto text-gray-600" />
            <p>No products sold in the selected period.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E2922] text-[10px] uppercase tracking-wider text-gray-400">
                <th className="pb-3 font-semibold">Rank & Product</th>
                <th className="pb-3 font-semibold hidden md:table-cell">Category</th>
                <th className="pb-3 font-semibold text-center">Units Sold</th>
                <th className="pb-3 font-semibold text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2922]/50">
              {products.map((prod, index) => (
                <tr key={prod.id || `${prod.name}-${index}`} className="hover:bg-[#161D19]/60 transition-colors">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-gray-500 w-4 text-center">
                        #{index + 1}
                      </span>
                      <div className="w-10 h-10 bg-[#161D19] border border-[#1E2922] shrink-0 overflow-hidden flex items-center justify-center">
                        {prod.image ? (
                          <img
                            src={prod.image}
                            alt={prod.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <Package size={16} className="text-gray-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate max-w-xs sm:max-w-md">
                          {prod.name}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          SKU: {prod.sku}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3 hidden md:table-cell text-gray-300">
                    <span className="px-2 py-0.5 bg-[#161D19] border border-[#1E2922] text-[10px] uppercase font-semibold text-gray-300">
                      {prod.category_name}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-center">
                    <span className="font-mono font-bold text-white text-xs px-2.5 py-1 bg-[#161D19] border border-[#1E2922]">
                      {prod.units_sold}
                    </span>
                  </td>

                  <td className="py-3 pl-3 text-right">
                    <span className="font-mono font-bold text-[#10B981] text-xs">
                      {formatINR(prod.total_revenue)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TopSellingProductsTable;

