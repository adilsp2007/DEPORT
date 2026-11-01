import React from 'react';

export const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${sizeClasses[size]} border-[#10B981]/20 border-t-[#10B981] rounded-full animate-spin`}
      />
    </div>
  );
};

export default LoadingSpinner;
