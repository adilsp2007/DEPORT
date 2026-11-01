import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const Toast = ({ message, type = 'success', onClose }) => {
  if (!message) return null;

  const icons = {
    success: <CheckCircle2 size={18} className="text-[#10B981]" />,
    error: <AlertCircle size={18} className="text-rose-500" />,
    info: <Info size={18} className="text-emerald-400" />
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce-short">
      <div className="flex items-center gap-3 bg-[#131915] text-[#F3F4F6] px-5 py-4 shadow-2xl border-l-4 border-[#10B981] min-w-[280px]">
        {icons[type]}
        <p className="text-sm font-medium tracking-wide flex-1">{message}</p>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast;
