import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';

const today = () => new Date().toISOString().slice(0, 10);

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm ${cls}`}>{msg}</div>;
}

const emptyItem = { medicine_id: '', medicine_name: '', dose_morning: 1, dose_afternoon: 0, dose_night: 1, duration_days: 5, food_instruction: 'after_food', notes: '' };

export default function ConsultationRx() {
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

  useEffect(() => { loadQueue(); }, [loadQueue]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Patient &amp; Hospital &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Consultation &amp; Rx</span>
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Structured prescriptions let pharmacy auto-suggest the exact medicines prescribed.</p>
      </div>

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

function ConsultationPanel({ appointment, onSaved, onError }) {
  const [existing, setExisting] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [diagnosis, setDiagnosis] = useState('');
  const [complaints, setComplaints] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [isSaving, setIsSaving] = useState(false);

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
      const { data } = await apiFetch(`/pharmacy/medicines?search=${encodeURIComponent(term)}&limit=8`, { withMeta: true });
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, candidates: data || [] } : it)));
    } catch {
      /* ignore search errors, keep typing */
    }
  };

  const pickMedicine = (idx, med) => {
    setItems((prev) => prev.map((it, i) => (i === idx
      ? { ...it, medicine_id: med.id, medicine_name: med.name, candidates: [] }
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

  if (isLoading) {
    return <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-8 text-center text-xs text-gray-400">Loading…</div>;
  }

  if (existing) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-gray-900">
          Consultation Already Recorded — <span className="text-blue-600">{appointment.patient_name}</span>
        </h2>
        <div className="text-xs text-gray-600 space-y-1">
          <div><span className="font-semibold text-gray-800">Diagnosis:</span> {existing.diagnosis || '—'}</div>
          <div><span className="font-semibold text-gray-800">Complaints:</span> {existing.complaints || '—'}</div>
          <div><span className="font-semibold text-gray-800">Doctor:</span> {existing.doctor_name || '—'}</div>
          {existing.follow_up_date && <div><span className="font-semibold text-gray-800">Follow-up:</span> {String(existing.follow_up_date).slice(0, 10)}</div>}
        </div>
        {existing.prescription_items?.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prescribed</div>
            <div className="flex flex-wrap gap-1.5">
              {existing.prescription_items.map((it, i) => (
                <span key={i} className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-medium">
                  {it.medicine_name} — M{it.dose_morning}/A{it.dose_afternoon}/N{it.dose_night} × {it.duration_days}d ({it.food_instruction.replace(/_/g, ' ')})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Token #{String(appointment.token_number).padStart(2, '0')} — {appointment.patient_name}</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">{appointment.age_years} Yrs / {appointment.gender} · {appointment.mobile}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Diagnosis</label>
          <textarea rows="2" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Complaints</label>
          <textarea rows="2" value={complaints} onChange={(e) => setComplaints(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Doctor Notes</label>
          <textarea rows="2" value={doctorNotes} onChange={(e) => setDoctorNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">Follow-up Date</label>
          <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
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
                placeholder="Search medicine..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
              />
              {it.medicine_id && <span className="absolute right-2 top-2.5 text-emerald-500 text-[10px] font-bold">✓ linked</span>}
              {it.candidates?.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-md max-h-40 overflow-y-auto">
                  {it.candidates.map((med) => (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => pickMedicine(idx, med)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer"
                    >
                      {med.name} {med.strength && <span className="text-gray-400">({med.strength})</span>}
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

      <button
        type="submit"
        disabled={isSaving}
        className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-6 py-2.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
      >
        {isSaving ? 'Saving…' : 'Save Consultation & Prescription'}
      </button>
    </form>
  );
}
