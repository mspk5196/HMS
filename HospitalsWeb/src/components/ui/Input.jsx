import React, { forwardRef } from 'react';

export const Input = forwardRef(function Input({
  label,
  icon: Icon,
  error,
  containerClassName = '',
  className = '',
  ...props
}, ref) {
  return (
    <div className={`${containerClassName}`}>
      {label && (
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#767c83] mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#767c83] pointer-events-none">
            <Icon size={14} />
          </span>
        )}
        <input
          ref={ref}
          className={`field ${Icon ? 'pl-8' : ''} ${error ? 'border-red-400' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
});
