export const formatCurrency = (n) => `₹${Number(n || 0).toFixed(2)}`;

export const formatDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d).slice(0, 10);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const STATUS_TONES = {
  draft: 'bg-gray-100 text-gray-600',
  placed: 'bg-blue-50 text-blue-600',
  partially_received: 'bg-amber-50 text-amber-600',
  received: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-rose-50 text-rose-600',
  open: 'bg-blue-50 text-blue-600',
  closed: 'bg-emerald-50 text-emerald-600',
  pending: 'bg-amber-50 text-amber-600',
  partial: 'bg-amber-50 text-amber-600',
  paid: 'bg-emerald-50 text-emerald-600',
  unpaid: 'bg-rose-50 text-rose-600',
};
