import React from 'react';
import { STATUS_TONES } from './pharmacyUtils';

export function StatusBadge({ status }) {
  const tone = STATUS_TONES[status] || 'bg-gray-100 text-gray-600';
  const label = String(status || '').replace(/_/g, ' ');
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  );
}

export function Banner({ tone, children }) {
  const styles = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <div className={`text-xs font-medium px-4 py-3 rounded-xl border ${styles}`}>
      {children}
    </div>
  );
}
