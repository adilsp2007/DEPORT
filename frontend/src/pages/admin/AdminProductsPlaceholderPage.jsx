import React from 'react';
import { Package, Clock } from 'lucide-react';

export const AdminProductsPlaceholderPage = () => {
  return (
    <div className="bg-[#131915] border border-[#1E2922] p-8 md:p-12 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
        <Package size={32} />
      </div>
      <h2 className="font-serif text-2xl font-bold text-[#F3F4F6]">
        Product Management Module
      </h2>
      <p className="text-xs text-gray-400 max-w-md mx-auto font-light leading-relaxed">
        Full product management, stock control, SKU tracking, and image galleries will be developed in upcoming phases.
      </p>
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 bg-amber-500/10 px-4 py-2 border border-amber-500/30">
        <Clock size={16} /> Product Module Placeholder
      </div>
    </div>
  );
};

export default AdminProductsPlaceholderPage;
