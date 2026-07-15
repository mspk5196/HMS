import React from 'react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  className = '',
  isLoading = false,
  fullWidth = false,
  ...props
}) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-semibold cursor-pointer border rounded transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:   'bg-[#1e2227] text-white border-[#1e2227] hover:bg-[#2c3340]',
    secondary: 'bg-[#f0f2f4] text-[#1e2227] border-[#c4c9cf] hover:bg-[#e5e8eb]',
    outline:   'bg-white text-[#1e2227] border-[#c4c9cf] hover:bg-[#f5f6f7]',
    danger:    'bg-[#dc2626] text-white border-[#dc2626] hover:bg-[#b91c1c]',
    success:   'bg-[#059669] text-white border-[#059669] hover:bg-[#047857]',
    ghost:     'bg-transparent text-[#4a5058] border-transparent hover:bg-[#f0f2f4]',
  };

  const sizes = {
    xs: 'px-2 py-1 text-[11px] h-6',
    sm: 'px-3 py-1.5 text-[12px] h-7',
    md: 'px-4 py-2 text-[13px] h-8',
    lg: 'px-5 py-2.5 text-[14px] h-10',
  };

  return (
    <button
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={isLoading || props.disabled}
      style={{ borderRadius: 5 }}
      {...props}
    >
      {isLoading ? (
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="4" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="4" strokeLinecap="round" />
        </svg>
      ) : Icon ? (
        <Icon size={14} />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
