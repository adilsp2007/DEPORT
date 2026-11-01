import React from 'react';
import { Users, Clock } from 'lucide-react';

export const AdminUsersPlaceholderPage = () => {
  return (
    <div className="bg-[#131915] border border-[#1E2922] p-8 md:p-12 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/30 flex items-center justify-center mx-auto">
        <Users size={32} />
      </div>
      <h2 className="font-serif text-2xl font-bold text-[#F3F4F6]">
        User Management Module
      </h2>
      <p className="text-xs text-gray-400 max-w-md mx-auto font-light leading-relaxed">
        Full User Management (listing, search, filters, user details modal, block/unblock, and deletion safeguards) will be activated in Phase 4.
      </p>
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#10B981] bg-[#10B981]/10 px-4 py-2 border border-[#10B981]/30">
        <Clock size={16} /> Ready for Phase 4 Implementation
      </div>
    </div>
  );
};

export default AdminUsersPlaceholderPage;
