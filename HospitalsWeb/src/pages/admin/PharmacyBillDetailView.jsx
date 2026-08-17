import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const displayDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function PharmacyBillDetailView({ billId, onBack, onError }) {
  const [bill, setBill] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch(`/pharmacy/bills/${billId}`);
      setBill(data);
    } catch (err) {
      onError(err, 'Failed to load pharmacy bill.');
    } finally {
      setIsLoading(false);
    }
  }, [billId]);

  useEffect(() => { load(); }, [load]);

  if (isLoading || !bill) {
    return (
      <div className="space-y-6">
        <BackHeader onBack={onBack} title={`Pharmacy Bill #${billId}`} />
        <div className="p-8 text-center text-xs text-gray-400 bg-white rounded-xl border border-gray-200/80">Loading…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackHeader
        onBack={onBack}
        title={bill.bill_number}
        subtitle={`${displayDate(bill.bill_date)} · ${bill.patient_name}`}
        badge={
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
            bill.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>{bill.payment_status}</span>
        }
      />

      <Section title={`Medicines (${bill.items?.length || 0})`}>
        {!bill.items || bill.items.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500">No line items on this bill.</div>
        ) : (
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="p-3">Medicine</th>
                <th className="p-3">Batch</th>
                <th className="p-3 text-center">Qty</th>
                <th className="p-3 text-right">Unit Price</th>
                <th className="p-3 text-right">Discount</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bill.items.map((it) => (
                <tr key={it.id}>
                  <td className="p-3 font-semibold text-gray-900">
                    {it.medicine_name}
                    {it.generic_name && <span className="text-gray-400 font-normal"> ({it.generic_name})</span>}
                  </td>
                  <td className="p-3 text-gray-500">{it.batch_number || '—'}</td>
                  <td className="p-3 text-center">{it.quantity} {it.unit || ''}</td>
                  <td className="p-3 text-right">{money(it.unit_price)}</td>
                  <td className="p-3 text-right">{it.discount_percent ? `${it.discount_percent}%` : '—'}</td>
                  <td className="p-3 text-right font-semibold text-gray-900">{money(it.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Bill Summary">
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <ChargeTile label="Total Amount" value={money(bill.total_amount)} />
          <ChargeTile label="Discount" value={money(bill.discount_amount)} />
          <ChargeTile label="Tax" value={money(bill.tax_amount)} />
          <ChargeTile label="Net Amount" value={money(bill.net_amount)} />
        </div>
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
          <span className="text-gray-500">Paid: {money(bill.paid_amount)}</span>
          <span className="font-bold text-gray-900">Balance: {money(bill.balance_amount)}</span>
        </div>
      </Section>
    </div>
  );
}

function ChargeTile({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-bold text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}

function BackHeader({ onBack, title, subtitle, badge }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-200/80 transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="flex-1">
        <h1 className="text-xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
          {title} {badge}
        </h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
