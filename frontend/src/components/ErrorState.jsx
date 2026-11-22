import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';

export const ErrorState = ({
  title = 'Unable to Load Content',
  message = 'Something went wrong while retrieving information.',
  onRetry,
  retryLabel = 'Try Again',
  loading = false,
  className = ''
}) => {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center py-12 px-6 bg-[#131915] border border-rose-900/30 rounded-xs max-w-lg mx-auto my-6 ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-[#EF4444] mb-4">
        <AlertCircle size={28} strokeWidth={1.5} />
      </div>

      <h3 className="font-serif text-xl font-medium text-[#F3F4F6] mb-2">
        {title}
      </h3>

      <p className="text-gray-300 text-sm max-w-md mb-6 leading-relaxed">
        {message}
      </p>

      {onRetry && (
        <Button
          variant="secondary"
          onClick={onRetry}
          disabled={loading}
          icon={RefreshCw}
          className="border-[#1E2922] hover:border-[#10B981] hover:text-[#10B981] transition-colors"
        >
          {loading ? 'Retrying...' : retryLabel}
        </Button>
      )}
    </div>
  );
};

export default ErrorState;

