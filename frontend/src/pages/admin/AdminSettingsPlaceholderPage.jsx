import React from 'react';
import { Settings, Clock } from 'lucide-react';

export const AdminSettingsPlaceholderPage = () => {
  return (
    <div className="bg-[#131915] border border-[#1E2922] p-8 md:p-12 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-gray-500/10 text-gray-300 border border-gray-500/30 flex items-center justify-center mx-auto">
        <Settings size={32} />
      </div>
      <h2 className="font-serif text-2xl font-bold text-[#F3F4F6]">
        Store Settings Module
      </h2>
      <p className="text-xs text-gray-400 max-w-md mx-auto font-light leading-relaxed">
        System configuration, currency, store branding, and notifications module placeholder.
      </p>
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-300 bg-gray-500/10 px-4 py-2 border border-gray-500/30">
        <Clock size={16} /> Settings Module Placeholder
      </div>
    </div>
  );
};

export default AdminSettingsPlaceholderPage;
