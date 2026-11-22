import React from 'react';

export const Input = ({
  label,
  type = 'text',
  error,
  placeholder,
  value,
  onChange,
  name,
  id,
  required = false,
  className = '',
  icon: Icon,
  rightElement,
  ...props
}) => {
  const inputId = id || name || `input-${Math.random().toString(36).substring(2, 9)}`;
  const errorMessage = Array.isArray(error)
    ? error[0]
    : error && typeof error === 'object'
    ? Object.values(error)[0]
    : error;
  const hasError = Boolean(errorMessage);

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-xs uppercase tracking-wider font-semibold text-[#E5E7EB]">
          {label} {required && <span className="text-[#10B981]">*</span>}
        </label>
      )}
      
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-[#10B981] pointer-events-none">
            <Icon size={18} />
          </div>
        )}
        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className={`
            w-full bg-[#161D19] text-[#F3F4F6] text-sm px-4 py-3 border transition-all duration-200 focus:outline-none placeholder-gray-400 placeholder:opacity-85
            ${Icon ? 'pl-11' : ''}
            ${rightElement ? 'pr-11' : ''}
            ${hasError 
              ? 'border-rose-500 focus:border-rose-500 focus:ring-1 focus:ring-rose-500' 
              : 'border-[#10B981]/30 focus:border-[#10B981] focus:ring-1 focus:ring-[#10B981]'
            }
          `}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3.5 flex items-center">
            {rightElement}
          </div>
        )}
      </div>

      {hasError && (
        <span className="text-xs text-rose-400 font-medium tracking-wide">
          {errorMessage}
        </span>
      )}
    </div>
  );
};

export default Input;
