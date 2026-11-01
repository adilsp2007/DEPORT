import React from 'react';
import { X } from 'lucide-react';
import FilterSidebar from './FilterSidebar';
import Button from './Button';

export const FilterDrawer = ({ isOpen, onClose, ...filterProps }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-300">
      <div className="w-full max-w-xs bg-[#0B0F0D] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 border-l border-[#1E2922]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1E2922] bg-[#131915]">
          <h3 className="font-serif text-xl font-medium text-[#F3F4F6]">Filter & Sort</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        {/* Scrollable Filters */}
        <div className="flex-1 overflow-y-auto p-6">
          <FilterSidebar {...filterProps} />
        </div>

        {/* Bottom CTA */}
        <div className="p-6 border-t border-[#1E2922] bg-[#131915]">
          <Button variant="primary" fullWidth onClick={onClose}>
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FilterDrawer;
