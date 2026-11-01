import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Reusable Admin & Management Pagination Component
 *
 * Features:
 * - "Showing X-Y of Z results" calculation
 * - Configurable "Per Page" dropdown (10, 20, 50)
 * - Smart page number display with ellipsis (...) for long lists
 * - Mobile responsive layout with compact controls on small screens
 * - Disable states for previous/next navigation
 * - Consistent DEPORT dark-luxury aesthetic
 */
export const AdminPagination = ({
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemName = 'results',
  loading = false
}) => {
  if (totalCount === 0 && totalPages <= 1) {
    return null;
  }

  // Calculate "Showing X-Y of Z"
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  // Generate page numbers with ellipsis (...)
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [
        1,
        '...',
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages
      ];
    }

    return [
      1,
      '...',
      currentPage - 1,
      currentPage,
      currentPage + 1,
      '...',
      totalPages
    ];
  };

  const pages = getPageNumbers();

  const handlePrev = () => {
    if (currentPage > 1 && !loading) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages && !loading) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="p-4 border-t border-[#1E2922] bg-[#161D19] flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
      {/* Left side: Results Count & Per Page Selector */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-start">
        <span className="text-gray-400">
          Showing <strong className="text-[#F3F4F6] font-semibold">{startItem}–{endItem}</strong> of{' '}
          <strong className="text-[#F3F4F6] font-semibold">{totalCount}</strong> {itemName}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500 hidden sm:inline">|</span>
            <label htmlFor="per-page-select" className="text-gray-400">
              Per page:
            </label>
            <select
              id="per-page-select"
              value={pageSize}
              disabled={loading}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-[#131915] text-[#F3F4F6] border border-[#1E2922] hover:border-[#10B981]/60 focus:border-[#10B981] px-2 py-1 text-xs outline-none cursor-pointer transition-colors"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-[#131915] text-[#F3F4F6]">
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: Navigation buttons & Page Numbers */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center w-full md:w-auto">
        {/* Previous Button */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentPage <= 1 || loading}
          aria-label="Previous Page"
          className="flex items-center gap-1 px-3 py-1.5 bg-[#131915] text-[#F3F4F6] border border-[#1E2922] hover:border-[#10B981] hover:text-[#10B981] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#1E2922] disabled:hover:text-[#F3F4F6] transition-all cursor-pointer font-medium uppercase tracking-wider text-[11px]"
        >
          <ChevronLeft size={14} />
          <span>Prev</span>
        </button>

        {/* Page Number Buttons */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-7 h-7 flex items-center justify-center text-gray-500 font-mono select-none"
                >
                  …
                </span>
              );
            }

            const isActive = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => !loading && onPageChange(p)}
                disabled={loading}
                aria-current={isActive ? 'page' : undefined}
                className={`w-7 h-7 sm:w-8 sm:h-8 text-xs font-semibold uppercase transition-all border cursor-pointer ${
                  isActive
                    ? 'bg-[#10B981] text-black border-[#10B981] shadow-xs shadow-[#10B981]/20 font-bold'
                    : 'bg-[#131915] text-[#F3F4F6] border-[#1E2922] hover:border-[#10B981] hover:text-[#10B981]'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={handleNext}
          disabled={currentPage >= totalPages || loading}
          aria-label="Next Page"
          className="flex items-center gap-1 px-3 py-1.5 bg-[#131915] text-[#F3F4F6] border border-[#1E2922] hover:border-[#10B981] hover:text-[#10B981] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#1E2922] disabled:hover:text-[#F3F4F6] transition-all cursor-pointer font-medium uppercase tracking-wider text-[11px]"
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default AdminPagination;
