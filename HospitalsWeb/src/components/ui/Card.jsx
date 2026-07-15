import React from 'react';

export function Card({ children, className = '', onClick }) {
  return (
    <div
      className={`bg-white border border-[#c4c9cf] rounded-md ${onClick ? 'cursor-pointer hover:border-[#9ca3af]' : ''} ${className}`}
      style={{ borderRadius: 6 }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon, className = '' }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 border-b border-[#dde1e5] ${className}`}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-[#767c83]" style={{ width: 16, height: 16 }}>{icon}</span>}
        <div>
          {title && <h3 className="text-[13px] font-semibold text-[#1e2227]">{title}</h3>}
          {subtitle && <p className="text-[11px] text-[#767c83] mt-0.5">{subtitle}</p>}
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
