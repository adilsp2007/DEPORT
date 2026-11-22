import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const Toast = ({ message, type = 'success', onClose, duration = 4000 }) => {
  useEffect(() => {
    if (!message || !onClose || duration <= 0) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) return null;

  const typeConfig = {
    success: {
      border: 'border-l-[#10B981]',
      badgeBorder: 'border-[#10B981]/30',
      icon: <CheckCircle2 size={18} className="text-[#10B981] shrink-0" />,
      title: 'Success'
    },
    error: {
      border: 'border-l-[#EF4444]',
      badgeBorder: 'border-[#EF4444]/30',
      icon: <AlertCircle size={18} className="text-[#EF4444] shrink-0" />,
      title: 'Error'
    },
    warning: {
      border: 'border-l-[#F59E0B]',
      badgeBorder: 'border-[#F59E0B]/30',
      icon: <AlertTriangle size={18} className="text-[#F59E0B] shrink-0" />,
      title: 'Notice'
    },
    info: {
      border: 'border-l-[#3B82F6]',
      badgeBorder: 'border-[#3B82F6]/30',
      icon: <Info size={18} className="text-[#3B82F6] shrink-0" />,
      title: 'Info'
    }
  };

  const config = typeConfig[type] || typeConfig.info;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 max-w-md w-full sm:w-auto animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto"
    >
      <div
        className={`flex items-start gap-3 bg-[#131915] text-[#F3F4F6] px-5 py-4 shadow-2xl border border-[#1E2922] border-l-4 ${config.border} rounded-sm min-w-[280px] max-w-md backdrop-blur-md`}
      >
        <div className="pt-0.5">{config.icon}</div>
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-sm font-medium tracking-wide text-[#F3F4F6] break-words leading-snug">
            {message}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss notification"
            className="text-gray-400 hover:text-white transition-colors p-1 -mr-1 -mt-1 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#10B981]"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast;
