import React from 'react';

export function Card({ children, className = '', onClick }) {
  return (
    <div
      className={`bg-[var(--panel)] border border-[var(--line)] ${onClick ? 'cursor-pointer hover:border-[var(--primary)]' : ''} ${className}`}
      style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon, className = '' }) {
  return (
    <div className={`flex items-center justify-between px-5 py-4 border-b border-[var(--line-lt)] ${className}`}>
      <div className="flex items-center gap-3">
        {icon && <span className="text-[var(--mute)] w-4 h-4">{icon}</span>}
        <div>
          {title && <h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3>}
          {subtitle && <p className="text-xs text-[var(--mute)] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardContent({ children, className = '', noPadding = false }) {
  return (
    <div className={noPadding ? className : `p-4 ${className}`}>
      {children}
    </div>
  );
}
