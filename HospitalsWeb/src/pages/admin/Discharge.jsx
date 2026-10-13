import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import { hasPermission } from '../../util/permissions';
import PageHeader from '../../components/PageHeader';

const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const displayDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

import TabBar from '../../components/TabBar';
import HospitalDischargeSummary from '../../components/HospitalDischargeSummary';
import FieldDictationButton from '../../components/FieldDictationButton';

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error' ? 'bg-rose-50 border-red-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm ${cls}`}>{msg}</div>;
}

export default function Discharge({ user }) {
  const tabs = [
    { value: 'admitted', label: 'Currently Admitted', show: hasPermission(user, 'admission.view') || hasPermission(user, 'discharge.view') },
    { value: 'discharged', label: 'Discharged / Balances', show: hasPermission(user, 'discharge.view') },
  ].filter((t) => t.show);

  const [tab, setTab] = useState(() => tabs[0]?.value || 'admitted');
  const [processing, setProcessing] = useState(null); // admission being discharged
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  if (processing) {
    return (
      <ProcessDischarge
        user={user}
        admission={processing}
        onBack={() => setProcessing(null)}
        onDone={(msg) => { flash(msg); setProcessing(null); }}
        onError={fail}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        category="Patient & Hospital"
        title="Discharge"
        subtitle="IP discharge summary, doctor approval, room charges, and clearance workflow."
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={tabs}
      />

      {tab === 'admitted' && <AdmittedList user={user} onProcess={setProcessing} onError={fail} />}
      {tab === 'discharged' && <DischargedList user={user} onError={fail} onSuccess={flash} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CURRENTLY ADMITTED
═══════════════════════════════════════════════════════════════════════ */

function AdmittedList({ user, onProcess, onError }) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await apiFetch('/patient/admissions?status=admitted&limit=100', { withMeta: true });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err, 'Failed to load admitted patients.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900">Currently Admitted ({rows.length})</h2>
      </div>
      {isLoading ? (
        <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-500">No patients currently admitted.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((a) => (
            <div key={a.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-gray-900 text-xs flex items-center gap-2">
                  <span>{a.patient_name}</span>
                  <span className="text-gray-400 font-medium">({a.age_years} Yrs / {a.gender})</span>
                  {a.status === 'payment_pending' && (
                    <span className="text-[10px] bg-orange-50 text-orange-700 font-semibold px-2 py-0.5 rounded-full border border-orange-200">
                      ⏳ Awaiting Payment
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Admitted {displayDate(a.admission_datetime)} · Dr. {a.doctor_name || '—'}
                </div>
              </div>
              {hasPermission(user, 'discharge.discharge_patient') && (
                <button
                  onClick={() => onProcess(a)}
                  className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
                >
                  {a.status === 'payment_pending' ? 'Edit Discharge' : 'Process Discharge'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PROCESS DISCHARGE
═══════════════════════════════════════════════════════════════════════ */

function ProcessDischarge({ user, admission, onBack, onDone, onError }) {
  const [preview, setPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    diagnosis_summary: '', treatment_summary: '', doctor_advice: '', discharge_condition: 'recovered',
    follow_up_date: '', doctor_fee: '', other_charges: '', discharge_notes: '',
  });

  useEffect(() => {
    (async () => {
      try {
        setIsLoadingPreview(true);
        const data = await apiFetch(`/patient/admissions/${admission.id}/discharge-preview`);
        setPreview(data);
      } catch (err) {
        onError(err, 'Failed to compute the bill preview.');
      } finally {
        setIsLoadingPreview(false);
      }
    })();
  }, [admission.id]);

  // Pre-fill doctor fee from rate configuration
  useEffect(() => {
    if (!admission.admitting_doctor_id) return;
    (async () => {
      try {
        const rate = await apiFetch(`/payment/fee-rates/${admission.admitting_doctor_id}`);
        if (rate && rate.ipd_daily_fee) {
          setForm((f) => ({ ...f, doctor_fee: String(rate.ipd_daily_fee) }));
        }
      } catch { /* ignore */ }
    })();
  }, [admission.admitting_doctor_id]);

  const doctorFee = Number(form.doctor_fee) || 0;
  const otherCharges = Number(form.other_charges) || 0;
  const estimatedTotal = preview ? preview.room_charges + preview.pharmacy_charges + doctorFee + otherCharges : 0;

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await apiFetch('/patient/discharges', {
        method: 'POST',
        body: JSON.stringify({
          admission_id: admission.id,
          diagnosis_summary: form.diagnosis_summary.trim() || null,
          treatment_summary: form.treatment_summary.trim() || null,
          doctor_advice: form.doctor_advice.trim() || null,
          discharge_condition: form.discharge_condition,
          follow_up_date: form.follow_up_date || null,
          doctor_fee: doctorFee,
          other_charges: otherCharges,
          discharge_notes: form.discharge_notes.trim() || null,
        }),
      });
      onDone(`${admission.patient_name} discharge saved — moved to payment queue.`);
    } catch (err) {
      onError(err, 'Failed to save the discharge.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-200/80 transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Discharge — <span className="text-blue-600">{admission.patient_name}</span>
        </h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-6">
        <div>
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Bill Preview (computed automatically)</div>
          {isLoadingPreview ? (
            <div className="text-xs text-gray-400">Calculating…</div>
          ) : preview ? (
            <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-4 space-y-1.5 text-xs">
              {preview.room_charge_breakdown.map((r, i) => (
                <div key={i} className="flex justify-between text-blue-900">
                  <span>Room — {r.nights} night(s) × {money(r.daily_rate)}</span>
                  <span className="font-semibold">{money(r.charge)}</span>
                </div>
              ))}
              <div className="flex justify-between text-blue-900">
                <span>Pharmacy bills for this admission</span>
                <span className="font-semibold">{money(preview.pharmacy_charges)}</span>
              </div>
              <div className="flex justify-between text-blue-900">
                <span>Doctor Fee</span>
                <span className="font-semibold">{money(doctorFee)}</span>
              </div>
              <div className="flex justify-between text-blue-900">
                <span>Other charges</span>
                <span className="font-semibold">{money(otherCharges)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-blue-200 font-extrabold text-blue-900">
                <span>Estimated Total</span>
                <span>{money(estimatedTotal)}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Diagnosis Summary</label>
              <FieldDictationButton
                language="auto"
                prompt="final diagnosis, discharge condition"
                onTranscribed={(text) => setField('diagnosis_summary')(form.diagnosis_summary ? `${form.diagnosis_summary}, ${text}` : text)}
              />
            </div>
            <textarea rows="2" value={form.diagnosis_summary} onChange={(e) => setField('diagnosis_summary')(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Treatment Given</label>
              <FieldDictationButton
                language="auto"
                prompt="injections, surgery, IV fluids, medications administered"
                onTranscribed={(text) => setField('treatment_summary')(form.treatment_summary ? `${form.treatment_summary}\n${text}` : text)}
              />
            </div>
            <textarea rows="2" value={form.treatment_summary} onChange={(e) => setField('treatment_summary')(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Doctor's Advice</label>
              <FieldDictationButton
                language="auto"
                prompt="diet advice, wound care, rest, follow-up instructions"
                onTranscribed={(text) => setField('doctor_advice')(form.doctor_advice ? `${form.doctor_advice}\n${text}` : text)}
              />
            </div>
            <textarea rows="2" value={form.doctor_advice} onChange={(e) => setField('doctor_advice')(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Condition on Discharge</label>
            <select value={form.discharge_condition} onChange={(e) => setField('discharge_condition')(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white">
              <option value="recovered">Recovered</option>
              <option value="referred">Referred</option>
              <option value="lama">LAMA</option>
              <option value="expired">Expired</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Follow-up Date</label>
            <input type="date" value={form.follow_up_date} onChange={(e) => setField('follow_up_date')(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Doctor Fee (₹) <span className="text-blue-500 font-normal normal-case">(pre-filled from rate settings)</span></label>
            <input type="number" value={form.doctor_fee} onChange={(e) => setField('doctor_fee')(e.target.value)} placeholder="e.g. 500" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Other Charges (₹)</label>
            <input type="number" value={form.other_charges} onChange={(e) => setField('other_charges')(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Discharge Notes</label>
              <FieldDictationButton
                language="auto"
                onTranscribed={(text) => setField('discharge_notes')(form.discharge_notes ? `${form.discharge_notes}\n${text}` : text)}
              />
            </div>
            <textarea rows="2" value={form.discharge_notes} onChange={(e) => setField('discharge_notes')(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs" />
          </div>
        </div>

        <div className="bg-blue-50/60 border border-blue-200 rounded-lg px-3.5 py-2.5 text-[11px] text-blue-800">
          After saving, this discharge will appear in <strong>Collect Payment</strong> page. Payment can be collected from there.
        </div>

        {hasPermission(user, 'discharge.discharge_patient') && (
          <button type="submit" disabled={isSubmitting || isLoadingPreview} className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-6 py-2.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
            {isSubmitting ? 'Saving…' : 'Save & Move to Payment'}
          </button>
        )}
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DISCHARGED / OUTSTANDING BALANCES
═══════════════════════════════════════════════════════════════════════ */

function DischargedList({ onError, onSuccess }) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await apiFetch('/patient/admissions?status=discharged&limit=50', { withMeta: true });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err, 'Failed to load discharged patients.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const viewSummary = (a) => {
    setSummaryData({
      patient_name: a.patient_name,
      age_years: a.age_years,
      gender: a.gender,
      admission_date: displayDate(a.admission_datetime),
      discharge_date: displayDate(a.discharge_datetime || a.updated_at),
      doctor_name: a.doctor_name,
      bed_number: a.bed_number,
      room_name: a.room_name,
      discharge_condition: a.discharge_condition || 'Recovered',
      diagnosis_summary: a.diagnosis_summary || a.provisional_diagnosis,
      treatment_summary: a.treatment_summary,
      doctor_advice: a.doctor_advice,
      discharge_notes: a.discharge_notes,
      follow_up_date: a.follow_up_date ? displayDate(a.follow_up_date) : '',
    });
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Discharged Patients ({rows.length})</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Discharge summaries and payment collection records.</p>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No discharged patients yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((a) => (
              <div key={a.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-gray-900 text-xs">{a.patient_name}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Dr. {a.doctor_name || '—'} · Admitted {displayDate(a.admission_datetime)} · Discharged {displayDate(a.discharge_datetime || a.updated_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => viewSummary(a)}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.656h10.5z" />
                    </svg>
                    Print Summary
                  </button>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-semibold">Discharged</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {summaryData && (
        <HospitalDischargeSummary
          data={summaryData}
          onClose={() => setSummaryData(null)}
        />
      )}
    </>
  );
}
