import React from 'react';
import { ShoppingBag, Clock } from 'lucide-react';

export const AdminOrdersPlaceholderPage = () => {
  return (
    <div className="bg-[#131915] border border-[#1E2922] p-8 md:p-12 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center justify-center mx-auto">
        <ShoppingBag size={32} />
      </div>
      <h2 className="font-serif text-2xl font-bold text-[#F3F4F6]">
        Orders Management Module
      </h2>
      <p className="text-xs text-gray-400 max-w-md mx-auto font-light leading-relaxed">
        Order processing, fulfillment tracking, and status update management placeholder.
      </p>
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-purple-400 bg-purple-500/10 px-4 py-2 border border-purple-500/30">
        <Clock size={16} /> Orders Module Placeholder
      </div>
    </div>
  );
};

export default AdminOrdersPlaceholderPage;
