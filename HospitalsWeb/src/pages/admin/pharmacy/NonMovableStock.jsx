import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import { formatDate } from './pharmacyUtils';
import { Banner } from './PharmacyUI';

const WINDOWS = [60, 90, 180, 365];

export default function NonMovableStock() {
  const [days, setDays] = useState(90);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await apiFetch(`/pharmacy/reports/non-movable?days=${days}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load non-movable stock report.');
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Pharmacy &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Non-Movable Stock</span>
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Dead stock — sitting on the shelf with no sales.</p>
      </div>
      {errorMsg && <Banner tone="error">{errorMsg}</Banner>}

      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-gray-500">Stock that hasn't had a single sale in the selected window — candidates to stop reordering or push out via discounts.</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">No sale in:</span>
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setDays(w)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${days === w ? 'bg-[#1e40af] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {w}+ days
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700 min-w-[750px]">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3.5">Medicine</th>
              <th className="p-3.5">Stock on Hand</th>
              <th className="p-3.5">Oldest Batch Received</th>
              <th className="p-3.5">Last Sale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">No dead stock in this window — everything is moving.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.medicine_id} className="hover:bg-gray-50/80">
                <td className="p-3.5 font-bold text-gray-900">{r.name}<div className="text-[11px] font-normal text-gray-400">{r.generic_name}</div></td>
                <td className="p-3.5 font-semibold">{r.total_stock} {r.unit || ''}</td>
                <td className="p-3.5">{formatDate(r.oldest_batch_received_at)}</td>
                <td className="p-3.5">
                  {r.last_sale_date ? (
                    formatDate(r.last_sale_date)
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-600">Never sold</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
