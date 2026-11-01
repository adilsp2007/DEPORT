import React from 'react';
import Button from './Button';

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-4 bg-[#131915] border border-[#1E2922] max-w-xl mx-auto my-8 ${className}`}>
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-[#161D19] flex items-center justify-center text-[#10B981] border border-[#10B981]/20 mb-6">
          <Icon size={32} strokeWidth={1.5} />
        </div>
      )}
      <h3 className="font-serif text-2xl text-[#F3F4F6] mb-3">{title}</h3>
      {description && (
        <p className="text-gray-400 text-sm max-w-md mb-8 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" icon={actionIcon} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
