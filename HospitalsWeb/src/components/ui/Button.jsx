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
  const base = 'ui-btn';

  const variants = {
    primary:   'ui-btn-primary',
    secondary: 'ui-btn-secondary',
    outline:   'ui-btn-outline',
    danger:    'ui-btn-danger',
    success:   'ui-btn-success',
    ghost:     'ui-btn-ghost',
  };

  const sizes = {
    xs: 'ui-btn-xs',
    sm: 'ui-btn-sm',
    md: 'ui-btn-md',
    lg: 'ui-btn-lg',
  };

  return (
    <button
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${fullWidth ? 'ui-btn-full' : ''} ${className}`}
      disabled={isLoading || props.disabled}
      style={{ borderRadius: '8px' }}
      {...props}
    >
      {isLoading ? (
        <svg className="ui-btn-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
