import React from 'react';
import { FolderTree, Clock } from 'lucide-react';

export const AdminCategoriesPlaceholderPage = () => {
  return (
    <div className="bg-[#131915] border border-[#1E2922] p-8 md:p-12 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto">
        <FolderTree size={32} />
      </div>
      <h2 className="font-serif text-2xl font-bold text-[#F3F4F6]">
        Category Management Module
      </h2>
      <p className="text-xs text-gray-400 max-w-md mx-auto font-light leading-relaxed">
        Category organization and sub-category management module placeholder.
      </p>
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 bg-blue-500/10 px-4 py-2 border border-blue-500/30">
        <Clock size={16} /> Category Module Placeholder
      </div>
    </div>
  );
};

export default AdminCategoriesPlaceholderPage;
