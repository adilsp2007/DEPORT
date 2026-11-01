import React from 'react';
import LoadingSpinner from './LoadingSpinner';

export const AuthLoadingScreen = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0B0F0D] text-[#F3F4F6]">
      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
        <span className="font-serif text-3xl md:text-4xl tracking-widest text-[#F3F4F6]">
          DEPORT
        </span>
        <span className="text-[10px] uppercase tracking-[0.3em] text-[#10B981] font-semibold -mt-2">
          Carry Your Style
        </span>
        <div className="mt-6 flex flex-col items-center gap-2">
          <LoadingSpinner size="md" />
          <span className="text-xs uppercase tracking-widest text-gray-400 mt-2 font-medium">
            Loading...
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuthLoadingScreen;
