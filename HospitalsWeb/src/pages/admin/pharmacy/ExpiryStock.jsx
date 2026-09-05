import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import { formatCurrency, formatDate } from './pharmacyUtils';
import { Banner } from './PharmacyUI';
import PageHeader from '../../../components/PageHeader';

const WINDOWS = [30, 60, 90, 180];

export default function ExpiryStock() {
  const [days, setDays] = useState(90);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await apiFetch(`/pharmacy/reports/expiring?days=${days}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load expiry report.');
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const expiredCount = rows.filter((r) => r.days_to_expiry < 0).length;
  const soonCount = rows.filter((r) => r.days_to_expiry >= 0 && r.days_to_expiry <= 30).length;

  const rowTone = (d) => {
    if (d < 0) return 'bg-rose-50/60';
    if (d <= 30) return 'bg-amber-50/60';
    return '';
  };

  return (
    <div className="space-y-4">
      <PageHeader
        category="Pharmacy"
        title="Expiry Stock"
        subtitle="Batches approaching or past their expiry date."
      />
      {errorMsg && <Banner tone="error">{errorMsg}</Banner>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Already Expired" value={expiredCount} tone="bg-rose-50 text-rose-600 border-rose-100" />
        <SummaryCard label="Expiring in 30 Days" value={soonCount} tone="bg-amber-50 text-amber-600 border-amber-100" />
        <SummaryCard label={`Within ${days} Days (Total)`} value={rows.length} tone="bg-blue-50 text-blue-600 border-blue-100" />
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-2">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">Window:</span>
        {WINDOWS.map((w) => (
          <button
            key={w}
            onClick={() => setDays(w)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${days === w ? 'bg-[#1e40af] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {w} days
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700 min-w-[800px]">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3.5">Medicine</th>
              <th className="p-3.5">Batch #</th>
              <th className="p-3.5">Qty in Stock</th>
              <th className="p-3.5">Expiry Date</th>
              <th className="p-3.5">Days to Expiry</th>
              <th className="p-3.5">Value at Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-400">Nothing expiring in this window.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className={`hover:bg-gray-100/60 ${rowTone(r.days_to_expiry)}`}>
                <td className="p-3.5 font-bold text-gray-900">{r.medicine_name}<div className="text-[11px] font-normal text-gray-400">{r.generic_name}</div></td>
                <td className="p-3.5">{r.batch_number}</td>
                <td className="p-3.5 font-semibold">{r.qty_in_stock} {r.unit || ''}</td>
                <td className="p-3.5">{formatDate(r.expiry_date)}</td>
                <td className="p-3.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    r.days_to_expiry < 0 ? 'bg-rose-100 text-rose-700' : r.days_to_expiry <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {r.days_to_expiry < 0 ? `Expired ${Math.abs(r.days_to_expiry)}d ago` : `${r.days_to_expiry}d left`}
                  </span>
                </td>
                <td className="p-3.5">{formatCurrency(r.qty_in_stock * r.purchase_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  return (
    <div className={`p-5 rounded-xl border shadow-sm flex items-center justify-between ${tone}`}>
      <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-extrabold">{value}</span>
    </div>
  );
}
