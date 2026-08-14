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

export default function ConsultationDetailView({ consultationId, onBack, onError }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(`/consultation/consultations/${consultationId}`);
      setData(res?.data ?? res);
    } catch (err) {
      onError(err, 'Failed to load consultation details.');
    } finally {
      setIsLoading(false);
    }
  }, [consultationId]);

  useEffect(() => { load(); }, [load]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <BackHeader onBack={onBack} title={`Consultation #${consultationId}`} />
        <div className="p-8 text-center text-xs text-gray-400 bg-white rounded-xl border border-gray-200/80">Loading…</div>
      </div>
    );
  }

  const balance = Math.max(0, Number(data.doctor_fee || 0) - Number(data.amount_paid || 0));

  return (
    <div className="space-y-6">
      <BackHeader
        onBack={onBack}
        title={`Consultation — ${data.patient_name}`}
        subtitle={`${displayDate(data.appointment_date)} · Dr. ${data.doctor_name || '—'}`}
      />

      <Section title="Clinical Details">
        <div className="p-4 text-xs space-y-2.5">
          <div><span className="font-semibold text-gray-700">Complaints:</span> {data.complaints || '—'}</div>
          <div><span className="font-semibold text-gray-700">Diagnosis:</span> {data.diagnosis || '—'}</div>
          <div><span className="font-semibold text-gray-700">Doctor's Advice / Notes:</span> {data.doctor_notes || '—'}</div>
          {data.follow_up_date && (
            <div className="text-blue-600 font-semibold">Follow-up: {displayDate(data.follow_up_date)}</div>
          )}
        </div>
      </Section>

      <Section title={`Medicines Prescribed (${data.prescription_items?.length || 0})`}>
        {!data.prescription_items || data.prescription_items.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500">No medicines prescribed.</div>
        ) : (
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="p-3">Medicine</th>
                <th className="p-3 text-center">Morning</th>
                <th className="p-3 text-center">Afternoon</th>
                <th className="p-3 text-center">Night</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Food</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.prescription_items.map((it) => (
                <tr key={it.id}>
                  <td className="p-3 font-semibold text-gray-900">
                    {it.medicine_name}
                    {it.generic_name && <span className="text-gray-400 font-normal"> ({it.generic_name})</span>}
                  </td>
                  <td className="p-3 text-center">{it.dose_morning}</td>
                  <td className="p-3 text-center">{it.dose_afternoon}</td>
                  <td className="p-3 text-center">{it.dose_night}</td>
                  <td className="p-3">{it.duration_days} day(s)</td>
                  <td className="p-3 capitalize">{it.food_instruction?.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-gray-500">{it.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Charges">
        <div className="p-4 grid grid-cols-3 gap-3 text-xs">
          <ChargeTile label="Consultation Fee" value={money(data.doctor_fee)} />
          <ChargeTile label="Amount Paid" value={money(data.amount_paid)} />
          <ChargeTile label="Balance Due" value={money(balance)} />
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

function BackHeader({ onBack, title, subtitle }) {
  return (
    <div className="flex items-center gap-3">
      <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-200/80 transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
