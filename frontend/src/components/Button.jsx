import React from 'react';

export const Button = ({
  children,
  variant = 'primary', // 'primary', 'secondary', 'outline', 'gold', 'ghost', 'danger'
  size = 'md', // 'sm', 'md', 'lg'
  fullWidth = false,
  icon: Icon,
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium tracking-wide transition-all duration-300 rounded-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none';
  
  const sizeStyles = {
    sm: 'px-4 py-2 text-xs uppercase tracking-wider',
    md: 'px-6 py-3 text-sm uppercase tracking-widest',
    lg: 'px-8 py-4 text-base uppercase tracking-widest'
  };

  const variantStyles = {
    primary: 'bg-[#10B981] text-black font-semibold hover:bg-[#059669] hover:text-white shadow-sm active:scale-[0.99]',
    secondary: 'bg-[#161D19] text-[#F3F4F6] border border-[#10B981]/30 hover:border-[#10B981] hover:bg-[#10B981] hover:text-black',
    outline: 'border border-[#10B981] text-[#10B981] bg-transparent hover:bg-[#10B981] hover:text-black font-semibold',
    gold: 'bg-[#10B981] text-black font-semibold hover:bg-[#059669] hover:text-white shadow-sm active:scale-[0.99]',
    ghost: 'text-[#F3F4F6] hover:text-[#10B981] bg-transparent hover:bg-white/5',
    danger: 'bg-rose-700 text-white hover:bg-rose-800'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${baseStyles}
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          {Icon && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />}
          {children}
        </span>
      )}
    </button>
  );
};

export default Button;
