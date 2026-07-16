import React from 'react';

export function Card({ children, className = '', onClick }) {
  return (
    <div
      className={`ui-card ${onClick ? 'ui-card-clickable' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon, className = '' }) {
  return (
    <div className={`ui-card-header ${className}`}>
      <div className="ui-card-header-left">
        {icon && <span className="ui-card-header-icon">{icon}</span>}
        <div className="ui-card-header-text">
          {title && <h3 className="ui-card-title">{title}</h3>}
          {subtitle && <p className="ui-card-subtitle">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="ui-card-header-action">{action}</div>}
    </div>
  );
}

export function CardContent({ children, className = '', noPadding = false }) {
  return (
    <div className={`ui-card-content ${noPadding ? 'no-padding' : ''} ${className}`}>
      {children}
    </div>
  );
}
