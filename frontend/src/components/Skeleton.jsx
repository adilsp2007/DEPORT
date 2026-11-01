import React from 'react';

export const Skeleton = ({ className = '', variant = 'rectangular' }) => {
  const variantStyles = {
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    text: 'h-4 rounded-sm'
  };

  return (
    <div
      className={`bg-[#1E1B18]/10 animate-pulse ${variantStyles[variant]} ${className}`}
    />
  );
};

export default Skeleton;
