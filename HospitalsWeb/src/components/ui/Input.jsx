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
    <div className={`ui-input-container ${containerClassName}`}>
      {label && (
        <label className="ui-input-label">
          {label}
        </label>
      )}
      <div className="ui-input-wrapper">
        {Icon && (
          <span className="ui-input-icon">
            <Icon size={14} />
          </span>
        )}
        <input
          ref={ref}
          className={`field ${Icon ? 'ui-input-with-icon' : ''} ${error ? 'ui-input-error-field' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="ui-input-error">{error}</p>}
    </div>
  );
});
