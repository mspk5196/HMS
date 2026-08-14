import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const displayDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const displayDateTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

function Section({ title, children, right }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

const emptyNoteForm = {
  note_date: new Date().toISOString().slice(0, 10),
  bp: '', pulse: '', temperature: '', spo2: '', advice: '',
};

export default function AdmissionDetailView({ admissionId, onBack, onError }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState(emptyNoteForm);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const d = await apiFetch(`/patient/admissions/${admissionId}/timeline`);
      setData(d);
    } catch (err) {
      onError(err, 'Failed to load admission details.');
    } finally {
      setIsLoading(false);
    }
  }, [admissionId]);

  useEffect(() => { load(); }, [load]);

  const submitNote = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await apiFetch(`/patient/admissions/${admissionId}/notes`, {
        method: 'POST',
        body: JSON.stringify({
          note_date: noteForm.note_date,
          bp: noteForm.bp || null,
          pulse: noteForm.pulse ? Number(noteForm.pulse) : null,
          temperature: noteForm.temperature ? Number(noteForm.temperature) : null,
          spo2: noteForm.spo2 ? Number(noteForm.spo2) : null,
          advice: noteForm.advice || null,
        }),
      });
      setNoteForm(emptyNoteForm);
      setShowNoteForm(false);
      await load();
    } catch (err) {
      onError(err, 'Failed to add daily note.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <BackHeader onBack={onBack} title={`Admission #${admissionId}`} />
        <div className="p-8 text-center text-xs text-gray-400 bg-white rounded-xl border border-gray-200/80">Loading…</div>
      </div>
    );
  }

  const { admission, beds, dailyNotes, medicineBills, charges, discharge } = data;

  // Group medicine bills by date
  const billsByDate = {};
  for (const item of medicineBills) {
    const key = item.bill_date;
    if (!billsByDate[key]) billsByDate[key] = [];
    billsByDate[key].push(item);
  }

  return (
    <div className="space-y-6">
      <BackHeader
        onBack={onBack}
        title={`Admission #${admission.id} — ${admission.patient_name}`}
        subtitle={`${displayDateTime(admission.admission_datetime)} · Dr. ${admission.doctor_name || '—'}`}
        badge={
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
            admission.status === 'discharged' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>{admission.status.replace(/_/g, ' ')}</span>
        }
      />

      {/* Room / Bed Occupancy */}
      <Section title={`Room & Bed Occupancy (${beds.length})`}>
        {beds.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500">No bed assigned.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {beds.map((b) => (
              <div key={b.id} className="p-3.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-gray-900">{b.ward_name} · Room {b.room_number} · Bed {b.bed_label}</span>{' '}
                  <span className="text-gray-500">({b.room_type_name})</span>
                  <div className="text-gray-400 text-[11px] mt-0.5">
                    {displayDateTime(b.occupied_from)} → {b.occupied_to ? displayDateTime(b.occupied_to) : 'Present'}
                  </div>
                </div>
                <span className="font-semibold text-gray-700">₹{Number(b.daily_rate).toLocaleString('en-IN')}/day</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Day-wise Doctor's Notes & Vitals */}
      <Section
        title={`Doctor's Notes & Vitals (${dailyNotes.length})`}
        right={
          <button
            onClick={() => setShowNoteForm((s) => !s)}
            className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
          >
            {showNoteForm ? 'Cancel' : '+ Add Note'}
          </button>
        }
      >
        {showNoteForm && (
          <form onSubmit={submitNote} className="p-4 bg-gray-50/60 border-b border-gray-100 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Date</label>
                <input
                  type="date"
                  required
                  value={noteForm.note_date}
                  onChange={(e) => setNoteForm((f) => ({ ...f, note_date: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase">BP</label>
                <input
                  type="text"
                  placeholder="120/80"
                  value={noteForm.bp}
                  onChange={(e) => setNoteForm((f) => ({ ...f, bp: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Pulse</label>
                <input
                  type="number"
                  min="0"
                  value={noteForm.pulse}
                  onChange={(e) => setNoteForm((f) => ({ ...f, pulse: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Temp (°F)</label>
                <input
                  type="number"
                  step="0.1"
                  value={noteForm.temperature}
                  onChange={(e) => setNoteForm((f) => ({ ...f, temperature: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase">SpO2 (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={noteForm.spo2}
                  onChange={(e) => setNoteForm((f) => ({ ...f, spo2: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Doctor's Advice / Observation</label>
              <textarea
                rows="2"
                value={noteForm.advice}
                onChange={(e) => setNoteForm((f) => ({ ...f, advice: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold bg-[#1e40af] hover:bg-[#1c399b] text-white rounded-lg cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </form>
        )}

        {dailyNotes.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500">No daily notes recorded yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {dailyNotes.map((n) => (
              <div key={n.id} className="p-3.5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900">{displayDate(n.note_date)}</span>
                  <span className="text-gray-500">Dr. {n.doctor_name || '—'}</span>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
                  {n.bp && <span className="bg-gray-100 px-2 py-0.5 rounded-md">BP: {n.bp}</span>}
                  {n.pulse != null && <span className="bg-gray-100 px-2 py-0.5 rounded-md">Pulse: {n.pulse}</span>}
                  {n.temperature != null && <span className="bg-gray-100 px-2 py-0.5 rounded-md">Temp: {n.temperature}°F</span>}
                  {n.spo2 != null && <span className="bg-gray-100 px-2 py-0.5 rounded-md">SpO2: {n.spo2}%</span>}
                </div>
                {n.advice && <div className="text-gray-600 pt-1">{n.advice}</div>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Medicines Given (date-wise) */}
      <Section title={`Medicines Given (${medicineBills.length})`}>
        {Object.keys(billsByDate).length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500">No medicines billed to this admission.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {Object.entries(billsByDate).map(([date, items]) => (
              <div key={date} className="p-3.5 text-xs space-y-1.5">
                <div className="font-bold text-gray-900">{displayDate(date)}</div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((it, i) => (
                    <span key={i} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium">
                      {it.medicine_name} × {it.quantity} — {money(it.subtotal)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Charges */}
      <Section title="Charges Summary">
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <ChargeTile label="Room Charges" value={money(charges.room_charges)} />
          <ChargeTile label="Pharmacy Charges" value={money(charges.pharmacy_charges)} />
          <ChargeTile label="Doctor Fee" value={charges.doctor_fee != null ? money(charges.doctor_fee) : '—'} />
          <ChargeTile label="Other Charges" value={charges.other_charges != null ? money(charges.other_charges) : '—'} />
        </div>
        {charges.room_charge_breakdown?.length > 0 && (
          <div className="px-4 pb-4 text-[11px] text-gray-500 space-y-1">
            {charges.room_charge_breakdown.map((b, i) => (
              <div key={i}>Segment {i + 1}: {b.nights} night(s) × ₹{b.daily_rate} = {money(b.charge)}</div>
            ))}
          </div>
        )}
        {charges.final_bill_amount != null && (
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex justify-end">
            <span className="text-sm font-bold text-gray-900">Final Bill: {money(charges.final_bill_amount)}</span>
          </div>
        )}
      </Section>

      {/* Discharge Summary — folded into this same page, not a separate history section */}
      {discharge && (
        <Section title="Discharge Summary">
          <div className="p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900">{displayDateTime(discharge.discharge_datetime)}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                discharge.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>{discharge.payment_status}</span>
            </div>
            <div><span className="font-semibold text-gray-700">Diagnosis:</span> {discharge.diagnosis_summary || '—'}</div>
            <div><span className="font-semibold text-gray-700">Treatment Summary:</span> {discharge.treatment_summary || '—'}</div>
            <div><span className="font-semibold text-gray-700">Doctor's Advice:</span> {discharge.doctor_advice || '—'}</div>
            <div><span className="font-semibold text-gray-700">Condition:</span> <span className="capitalize">{discharge.discharge_condition || '—'}</span></div>
            {discharge.follow_up_date && (
              <div className="text-blue-600 font-semibold">Follow-up: {displayDate(discharge.follow_up_date)}</div>
            )}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-gray-500">Paid: {money(discharge.amount_paid)}</span>
              <span className="font-bold text-gray-900">Balance Due: {money(discharge.balance_due)}</span>
            </div>
          </div>
        </Section>
      )}
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
