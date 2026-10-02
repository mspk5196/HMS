import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import { hasPermission } from '../../util/permissions';
import PageHeader from '../../components/PageHeader';
import { CheckIcon } from '../../components/Icons';
import HospitalPrescription from '../../components/HospitalPrescription';

const today = () => new Date().toISOString().slice(0, 10);

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm ${cls}`}>{msg}</div>;
}

const emptyItem = { medicine_id: '', medicine_name: '', dose_morning: 1, dose_afternoon: 0, dose_night: 1, duration_days: 5, food_instruction: 'after_food', notes: '' };

export default function ConsultationRx({ user }) {
  const [date, setDate] = useState(today());
  const [queue, setQueue] = useState([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [selected, setSelected] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  const loadQueue = useCallback(async () => {
    try {
      setIsLoadingQueue(true);
      setErrorMsg('');
      const { data } = await apiFetch(`/patient/appointments?date=${date}&limit=100`, { withMeta: true });
      const relevant = (data || []).filter((a) => ['waiting', 'in_consultation', 'completed'].includes(a.status));
      setQueue(relevant);
    } catch (err) {
      fail(err, 'Failed to load the queue.');
    } finally {
      setIsLoadingQueue(false);
    }
  }, [date]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    loadQueue();
    const timer = setInterval(() => {
      loadQueue();
    }, 30000);
    return () => clearInterval(timer);
  }, [loadQueue]);

  return (
    <div className="space-y-6">
      <PageHeader
        category="Patient & Hospital"
        title="Consultation & Rx"
        subtitle="Doctor consultations, vitals, prescriptions, and diagnosis notes."
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900">Today's Queue</h2>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded-lg text-[11px] font-semibold"
            />
          </div>
          {isLoadingQueue ? (
            <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
          ) : queue.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">No patients waiting.</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {queue.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`w-full p-3.5 text-left cursor-pointer transition-colors ${
                    selected?.id === a.id ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-gray-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600">#{String(a.token_number).padStart(2, '0')}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      a.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {a.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-gray-900 mt-0.5">{a.patient_name}</div>
                  <div className="text-[10px] text-gray-400">{a.age_years} Yrs / {a.gender} · Dr. {a.doctor_name || '—'}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
          {!selected ? (
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-10 text-center text-xs text-gray-400">
              Select a patient from the queue to begin.
            </div>
          ) : (
            <ConsultationPanel
              user={user}
              appointment={selected}
              onSaved={async (msg) => { flash(msg); setSelected(null); await loadQueue(); }}
              onError={fail}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CONSULTATION PANEL
═══════════════════════════════════════════════════════════════════════ */

function ConsultationPanel({ user, appointment, onSaved, onError }) {
  const [existing, setExisting] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [diagnosis, setDiagnosis] = useState('');
  const [complaints, setComplaints] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [isSaving, setIsSaving] = useState(false);

  // Vitals
  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [temperature, setTemperature] = useState('');
  const [pulse, setPulse] = useState('');
  const [spo2, setSpo2] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const data = await apiFetch(`/consultation/appointments/${appointment.id}/consultation`);
        setExisting(data);
      } catch {
        setExisting(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [appointment.id]);

  const setItemField = (idx, key, value) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [key]: value } : it)));

  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const searchMedicine = async (idx, term) => {
    setItemField(idx, 'medicine_name', term);
    setItemField(idx, 'medicine_id', '');
    if (!term.trim()) { setItemField(idx, 'candidates', []); return; }
    try {
      const { data } = await apiFetch(`/pharmacy/medicines?search=${encodeURIComponent(term)}&inStockOnly=true&limit=10`, { withMeta: true });
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, candidates: data || [] } : it)));
    } catch {
      /* ignore search errors, keep typing */
    }
  };

  const pickMedicine = (idx, med) => {
    const details = [med.name, med.generic_name ? `(${med.generic_name})` : '', [med.form, med.strength].filter(Boolean).join(' '), med.unit ? `[${med.unit}]` : ''].filter(Boolean).join(' ');
    setItems((prev) => prev.map((it, i) => (i === idx
      ? { ...it, medicine_id: med.id, medicine_name: details, candidates: [] }
      : it)));
  };

  const submit = async (e) => {
    e.preventDefault();
    const validItems = items.filter((it) => it.medicine_id);
    try {
      setIsSaving(true);
      await apiFetch(`/consultation/appointments/${appointment.id}/consultation`, {
        method: 'POST',
        body: JSON.stringify({
          diagnosis: diagnosis.trim() || null,
          complaints: complaints.trim() || null,
          doctor_notes: doctorNotes.trim() || null,
          follow_up_date: followUpDate || null,
          bp_systolic: bpSystolic ? Number(bpSystolic) : null,
          bp_diastolic: bpDiastolic ? Number(bpDiastolic) : null,
          temperature: temperature ? Number(temperature) : null,
          pulse: pulse ? Number(pulse) : null,
          spo2: spo2 ? Number(spo2) : null,
          weight: weight ? Number(weight) : null,
          height: height ? Number(height) : null,
          blood_sugar: bloodSugar ? Number(bloodSugar) : null,
          prescription_items: validItems.map((it) => ({
            medicine_id: it.medicine_id,
            dose_morning: Number(it.dose_morning) || 0,
            dose_afternoon: Number(it.dose_afternoon) || 0,
            dose_night: Number(it.dose_night) || 0,
            duration_days: Number(it.duration_days) || 1,
            food_instruction: it.food_instruction,
            notes: it.notes || null,
          })),
        }),
      });
      onSaved(`Consultation saved for ${appointment.patient_name}.`);
    } catch (err) {
      onError(err, 'Failed to save the consultation.');
    } finally {
      setIsSaving(false);
    }
  };

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  if (isLoading) {
    return <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-8 text-center text-xs text-gray-400">Loading…</div>;
  }

  if (existing) {
    const hasVitals = existing.bp_systolic || existing.temperature || existing.pulse || existing.spo2 || existing.weight;
    return (
      <>
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Consultation Recorded — <span className="text-blue-600">{appointment.patient_name}</span>
              </h2>
              <p className="text-[11px] text-gray-400">Token #{String(appointment.token_number).padStart(2, '0')}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPrescriptionModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.656h10.5z" />
              </svg>
              Print Prescription (Rx)
            </button>
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <div><span className="font-semibold text-gray-800">Diagnosis:</span> {existing.diagnosis || '—'}</div>
            <div><span className="font-semibold text-gray-800">Complaints:</span> {existing.complaints || '—'}</div>
            <div><span className="font-semibold text-gray-800">Doctor:</span> {existing.doctor_name || '—'}</div>
            {existing.doctor_notes && <div><span className="font-semibold text-gray-800">Notes:</span> {existing.doctor_notes}</div>}
            {existing.follow_up_date && <div><span className="font-semibold text-gray-800">Follow-up:</span> {String(existing.follow_up_date).slice(0, 10)}</div>}
          </div>

          {hasVitals && (
            <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              {existing.bp_systolic && <span className="font-semibold text-gray-700">BP: <span className="font-normal">{existing.bp_systolic}/{existing.bp_diastolic} mmHg</span></span>}
              {existing.temperature && <span className="font-semibold text-gray-700">Temp: <span className="font-normal">{existing.temperature}°C</span></span>}
              {existing.pulse && <span className="font-semibold text-gray-700">Pulse: <span className="font-normal">{existing.pulse} bpm</span></span>}
              {existing.spo2 && <span className="font-semibold text-gray-700">SpO₂: <span className="font-normal">{existing.spo2}%</span></span>}
              {existing.weight && <span className="font-semibold text-gray-700">Weight: <span className="font-normal">{existing.weight} kg</span></span>}
              {existing.height && <span className="font-semibold text-gray-700">Height: <span className="font-normal">{existing.height} cm</span></span>}
              {existing.blood_sugar && <span className="font-semibold text-gray-700">Sugar: <span className="font-normal">{existing.blood_sugar} mg/dL</span></span>}
            </div>
          )}

          {existing.prescription_items?.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prescribed</div>
              <div className="flex flex-wrap gap-1.5">
                {existing.prescription_items.map((it, i) => (
                  <span key={i} className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-medium">
                    {it.medicine_name} — M{it.dose_morning}/A{it.dose_afternoon}/N{it.dose_night} × {it.duration_days}d ({it.food_instruction?.replace(/_/g, ' ')})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {showPrescriptionModal && (
          <HospitalPrescription
            data={{
              token_number: appointment.token_number,
              patient_name: appointment.patient_name,
              age_years: appointment.age_years,
              gender: appointment.gender,
              doctor_name: existing.doctor_name || appointment.doctor_name,
              date: existing.created_at ? new Date(existing.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
              diagnosis: existing.diagnosis,
              complaints: existing.complaints,
              notes: existing.doctor_notes,
              follow_up_date: existing.follow_up_date ? String(existing.follow_up_date).slice(0, 10) : '',
              bp_systolic: existing.bp_systolic,
              bp_diastolic: existing.bp_diastolic,
              temperature: existing.temperature,
              pulse: existing.pulse,
              spo2: existing.spo2,
              weight: existing.weight,
              height: existing.height,
              blood_sugar: existing.blood_sugar,
              items: existing.prescription_items || [],
            }}
            onClose={() => setShowPrescriptionModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-6">
      <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">
          Consultation &amp; Prescription — <span className="text-blue-600">{appointment.patient_name}</span>
        </h2>
        <span className="text-xs font-bold text-blue-600">Token #{String(appointment.token_number).padStart(2, '0')}</span>
      </div>

      {/* ── Vitals ───────────────────────────────────────────────────── */}
      <div className="space-y-3 pt-1">
        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2">Patient Vitals <span className="font-normal text-gray-400">(optional)</span></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-gray-400 uppercase">BP Systolic</label>
            <div className="flex items-center gap-1">
              <input type="number" min="50" max="300" value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} placeholder="120" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center font-semibold" />
              <span className="text-[9px] text-gray-400">/</span>
              <input type="number" min="30" max="200" value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} placeholder="80" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center font-semibold" />
            </div>
            <div className="text-[9px] text-gray-400 text-center">mmHg (Sys / Dia)</div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-gray-400 uppercase">Temp (°C)</label>
            <input type="number" step="0.1" min="30" max="45" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="37.0" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center font-semibold" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-gray-400 uppercase">Pulse (bpm)</label>
            <input type="number" min="30" max="250" value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="72" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center font-semibold" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-gray-400 uppercase">SpO₂ (%)</label>
            <input type="number" min="70" max="100" value={spo2} onChange={(e) => setSpo2(e.target.value)} placeholder="98" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center font-semibold" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-gray-400 uppercase">Weight (kg)</label>
            <input type="number" step="0.1" min="1" max="300" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="65" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center font-semibold" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-gray-400 uppercase">Height (cm)</label>
            <input type="number" min="50" max="250" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="165" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center font-semibold" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-gray-400 uppercase">Blood Sugar (mg/dL)</label>
            <input type="number" min="20" max="600" value={bloodSugar} onChange={(e) => setBloodSugar(e.target.value)} placeholder="90" className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center font-semibold" />
          </div>
        </div>
      </div>

      {/* ── Clinical ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Diagnosis</label>
          <input
            type="text"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="e.g. Acute Viral Fever"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Chief Complaints</label>
          <input
            type="text"
            value={complaints}
            onChange={(e) => setComplaints(e.target.value)}
            placeholder="e.g. Fever for 2 days, headache"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Doctor Notes</label>
          <textarea
            rows="2"
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
            placeholder="Clinical observations, advice, lab tests ordered..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Follow-up Date</label>
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
          />
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Structured Prescription</label>
          <button type="button" onClick={addItem} className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer">+ Add Medicine</button>
        </div>

        {items.map((it, idx) => (
          <div key={idx} className="border border-gray-200 rounded-lg p-3.5 space-y-3 relative">
            <div className="relative">
              <input
                type="text"
                value={it.medicine_name}
                onChange={(e) => searchMedicine(idx, e.target.value)}
                placeholder="Search in-stock medicine by name or generic name…"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
              />
              {it.medicine_id && (
                <span className="absolute right-2 top-2.5 text-emerald-600 text-[10px] font-bold flex items-center gap-0.5">
                  <CheckIcon className="w-3 h-3" />
                  <span>linked</span>
                </span>
              )}
              {it.candidates?.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto divide-y divide-gray-100">
                  {it.candidates.map((med) => (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => pickMedicine(idx, med)}
                      className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="font-bold text-gray-900">{med.name}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {med.generic_name && <span className="italic mr-2 text-gray-600">{med.generic_name}</span>}
                          <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                            {[med.form, med.strength, med.unit].filter(Boolean).join(' · ')}
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-2 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          {med.total_stock} {med.unit || 'units'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 items-end">
              {['dose_morning', 'dose_afternoon', 'dose_night'].map((f, i) => (
                <div key={f} className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase">{['Morning', 'Afternoon', 'Night'][i]}</label>
                  <input
                    type="number" min="0" value={it[f]}
                    onChange={(e) => setItemField(idx, f, e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center font-semibold"
                  />
                </div>
              ))}
              <div className="space-y-1 col-span-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase">Days</label>
                <input
                  type="number" min="1" value={it.duration_days}
                  onChange={(e) => setItemField(idx, 'duration_days', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-center font-semibold"
                />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase">Food</label>
                <select
                  value={it.food_instruction}
                  onChange={(e) => setItemField(idx, 'food_instruction', e.target.value)}
                  className="w-full px-1.5 py-1.5 border border-gray-200 rounded text-[10px] font-semibold bg-white"
                >
                  <option value="before_food">Before</option>
                  <option value="after_food">After</option>
                  <option value="anytime">Anytime</option>
                </select>
              </div>
              <div className="col-span-1 flex justify-end">
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="text-rose-500 hover:underline text-[11px] font-bold cursor-pointer">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasPermission(user, 'consultation.create') && (
        <button
          type="submit"
          disabled={isSaving}
          className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-6 py-2.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save Consultation & Prescription'}
        </button>
      )}
    </form>
  );
}
