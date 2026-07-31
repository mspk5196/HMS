import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';

const genderLabel = { male: 'Male', female: 'Female', other: 'Other' };

const displayDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm ${cls}`}>{msg}</div>;
}

/**
 * Must live at module scope, not inside PatientForm — a component defined
 * inside another component's body is a new function identity every render,
 * so React remounts the DOM node on every keystroke and the input loses focus.
 */
function Field({ label, children, error, required }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

const emptyForm = {
  full_name: '', age_years: '', date_of_birth: '', gender: 'male',
  mobile_number: '', address: '', blood_group: '', notes: '',
};

export default function PatientRecords() {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'form' | 'history'
  const [editing, setEditing] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);

  const [searchMode, setSearchMode] = useState('browse'); // 'browse' | 'mobile'
  const [searchText, setSearchText] = useState('');
  const [mobileQuery, setMobileQuery] = useState('');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  const loadBrowse = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (searchText.trim()) params.set('search', searchText.trim());
      const { data, meta: m } = await apiFetch(`/patient/patients?${params.toString()}`, { withMeta: true });
      setRows(Array.isArray(data) ? data : []);
      setMeta(m || { total: 0 });
    } catch (err) {
      fail(err, 'Failed to load patients.');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchText]);

  const loadByMobile = useCallback(async () => {
    if (!mobileQuery.trim()) { setRows([]); setMeta({ total: 0 }); return; }
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await apiFetch(`/patient/patients/by-mobile/${encodeURIComponent(mobileQuery.trim())}`);
      setRows(Array.isArray(data) ? data : []);
      setMeta({ total: data.length });
    } catch (err) {
      fail(err, 'Failed to search by mobile.');
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [mobileQuery]);

  useEffect(() => {
    if (viewMode !== 'list') return;
    if (searchMode === 'browse') loadBrowse();
    else loadByMobile();
  }, [viewMode, searchMode, loadBrowse, loadByMobile]);

  const startAdd = () => { setEditing(null); setViewMode('form'); };
  const startEdit = (p) => { setEditing(p); setViewMode('form'); };
  const openHistory = (p) => { setHistoryFor(p); setViewMode('history'); };
  const backToList = () => { setEditing(null); setHistoryFor(null); setViewMode('list'); };

  const refreshCurrent = () => (searchMode === 'browse' ? loadBrowse() : loadByMobile());

  if (viewMode === 'form') {
    return (
      <PatientForm
        initial={editing}
        onBack={backToList}
        onSaved={async (msg) => { flash(msg); backToList(); }}
        onError={(err, fb) => fail(err, fb)}
      />
    );
  }

  if (viewMode === 'history' && historyFor) {
    return <PatientHistory patient={historyFor} onBack={backToList} onError={fail} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            Patient &amp; Hospital &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Patient Records</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            One mobile number can belong to a whole family — search by mobile to see everyone linked to it.
          </p>
        </div>
        <button
          onClick={startAdd}
          className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
        >
          + Register New Patient
        </button>
      </div>

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setSearchMode('browse')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              searchMode === 'browse' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500'
            }`}
          >
            Browse All
          </button>
          <button
            onClick={() => setSearchMode('mobile')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              searchMode === 'mobile' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500'
            }`}
          >
            Search by Mobile
          </button>
        </div>

        {searchMode === 'browse' ? (
          <input
            type="text"
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
            placeholder="Search name, mobile, or patient ID..."
            className="flex-1 min-w-[220px] px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        ) : (
          <input
            type="text"
            value={mobileQuery}
            onChange={(e) => setMobileQuery(e.target.value)}
            placeholder="Enter mobile number..."
            className="flex-1 min-w-[220px] px-3.5 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            {searchMode === 'mobile' && !mobileQuery.trim()
              ? 'Enter a mobile number to see everyone linked to it.'
              : 'No patients found.'}
          </div>
        ) : (
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="p-3.5">Patient</th>
                <th className="p-3.5">Age / Gender</th>
                <th className="p-3.5">Mobile</th>
                <th className="p-3.5">Blood Group</th>
                <th className="p-3.5">Registered</th>
                <th className="p-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="p-3.5">
                    <div className="font-bold text-gray-900">{p.full_name}</div>
                    <div className="text-[10px] text-gray-400">Patient #{p.id}</div>
                  </td>
                  <td className="p-3.5 font-semibold">{p.age_years ?? '—'} Yrs / {genderLabel[p.gender] || p.gender}</td>
                  <td className="p-3.5">{p.mobile_number}</td>
                  <td className="p-3.5 font-medium">{p.blood_group || '—'}</td>
                  <td className="p-3.5 text-gray-500">{displayDate(p.created_at)}</td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <button onClick={() => startEdit(p)} className="text-blue-600 font-bold hover:underline cursor-pointer">Edit</button>
                      <button onClick={() => openHistory(p)} className="text-gray-600 font-bold hover:underline cursor-pointer">History</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {searchMode === 'browse' && rows.length > 0 && (
          <div className="p-3 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-[11px] font-semibold text-gray-500">
              Page {page} of {meta.pages || 1} · {meta.total} total
            </span>
            <button
              onClick={() => setPage((p) => Math.min(meta.pages || 1, p + 1))}
              disabled={page >= (meta.pages || 1)}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   REGISTER / EDIT
═══════════════════════════════════════════════════════════════════════ */

function PatientForm({ initial, onBack, onSaved, onError }) {
  const [form, setForm] = useState(() => initial ? {
    full_name: initial.full_name || '',
    age_years: initial.age_years ?? '',
    date_of_birth: initial.date_of_birth ? String(initial.date_of_birth).slice(0, 10) : '',
    gender: initial.gender || 'male',
    mobile_number: initial.mobile_number || '',
    address: initial.address || '',
    blood_group: initial.blood_group || '',
    notes: initial.notes || '',
  } : emptyForm);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Name is required.';
    if (!form.mobile_number.trim()) e.mobile_number = 'Mobile number is required.';
    if (!form.gender) e.gender = 'Gender is required.';
    if (!form.age_years && !form.date_of_birth) e.age_years = 'Enter age or date of birth.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setIsSaving(true);
      const payload = {
        full_name: form.full_name.trim(),
        age_years: form.age_years === '' ? null : Number(form.age_years),
        date_of_birth: form.date_of_birth || null,
        gender: form.gender,
        mobile_number: form.mobile_number.trim(),
        address: form.address.trim() || null,
        blood_group: form.blood_group.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (initial) {
        await apiFetch(`/patient/patients/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        onSaved(`${payload.full_name} updated.`);
      } else {
        await apiFetch('/patient/patients', { method: 'POST', body: JSON.stringify(payload) });
        onSaved(`${payload.full_name} registered.`);
      }
    } catch (err) {
      onError(err, 'Failed to save the patient.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = (err) =>
    `w-full px-3.5 py-2.5 border rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
      err ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
    }`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-200/80 transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Patient &amp; Hospital &nbsp;&gt;&nbsp; Patient Records &nbsp;&gt;&nbsp;{' '}
          <span className="text-blue-600 font-semibold">{initial ? 'Edit Patient' : 'Register New Patient'}</span>
        </h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Field label="Full Name" required error={errors.full_name}>
              <input type="text" value={form.full_name} onChange={(e) => setField('full_name')(e.target.value)} className={inputCls(errors.full_name)} />
            </Field>
          </div>
          <Field label="Mobile Number" required error={errors.mobile_number}>
            <input type="text" value={form.mobile_number} onChange={(e) => setField('mobile_number')(e.target.value)} className={inputCls(errors.mobile_number)} />
          </Field>
          <Field label="Gender" required error={errors.gender}>
            <select value={form.gender} onChange={(e) => setField('gender')(e.target.value)} className={inputCls(errors.gender)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Age (years)" error={errors.age_years}>
            <input type="number" value={form.age_years} onChange={(e) => setField('age_years')(e.target.value)} className={inputCls(errors.age_years)} />
          </Field>
          <Field label="Date of Birth">
            <input type="date" value={form.date_of_birth} onChange={(e) => setField('date_of_birth')(e.target.value)} className={inputCls()} />
          </Field>
          <Field label="Blood Group">
            <input type="text" placeholder="e.g. O+" value={form.blood_group} onChange={(e) => setField('blood_group')(e.target.value)} className={inputCls()} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Address">
              <input type="text" value={form.address} onChange={(e) => setField('address')(e.target.value)} className={inputCls()} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Notes">
              <textarea rows="2" value={form.notes} onChange={(e) => setField('notes')(e.target.value)} className={inputCls()} />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <button type="button" onClick={onBack} className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
            {isSaving ? 'Saving…' : initial ? 'Save Changes' : 'Register Patient'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FULL PATIENT HISTORY
═══════════════════════════════════════════════════════════════════════ */

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

function PatientHistory({ patient, onBack, onError }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const d = await apiFetch(`/patient/patients/${patient.id}/history`);
        setData(d);
      } catch (err) {
        onError(err, 'Failed to load patient history.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [patient.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-200/80 transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Patient History — <span className="text-blue-600">{patient.full_name}</span>
        </h1>
      </div>

      {isLoading || !data ? (
        <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-4">
          <Section title={`Appointments (${data.appointments.length})`}>
            {data.appointments.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">No appointments yet.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.appointments.map((a) => (
                  <div key={a.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-gray-900">Token #{a.token_number}</span>{' '}
                      <span className="text-gray-500">— {displayDate(a.appointment_date)} · Dr. {a.doctor_name || '—'}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize">{a.status.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={`Admissions (${data.admissions.length})`}>
            {data.admissions.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">No admissions.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.admissions.map((a) => (
                  <div key={a.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-gray-900">Admission #{a.id}</span>{' '}
                      <span className="text-gray-500">— {displayDate(a.admission_datetime)} · Dr. {a.doctor_name || '—'}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      a.status === 'discharged' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>{a.status}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={`Consultations & Prescriptions (${data.consultations.length})`}>
            {data.consultations.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">No consultations recorded.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.consultations.map((c) => {
                  const items = data.prescriptions.filter((p) => p.consultation_id === c.id);
                  return (
                    <div key={c.id} className="p-3.5 text-xs space-y-1.5">
                      <div className="font-bold text-gray-900">{displayDate(c.appointment_date)} · Dr. {c.doctor_name || '—'}</div>
                      <div className="text-gray-600">Diagnosis: {c.diagnosis || '—'}</div>
                      {items.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {items.map((it, i) => (
                            <span key={i} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium">
                              {it.medicine_name} — M{it.dose_morning}/A{it.dose_afternoon}/N{it.dose_night} × {it.duration_days}d
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title={`Pharmacy Bills (${data.pharmacyBills.length})`}>
            {data.pharmacyBills.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">No pharmacy bills.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.pharmacyBills.map((b) => (
                  <div key={b.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-gray-900">{b.bill_number}</span>{' '}
                      <span className="text-gray-500">— {displayDate(b.bill_date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700">₹{Number(b.net_amount).toLocaleString('en-IN')}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        b.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>{b.payment_status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={`Discharge Summaries (${data.discharges.length})`}>
            {data.discharges.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">No discharge records.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.discharges.map((d) => (
                  <div key={d.id} className="p-3.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">{displayDate(d.discharge_datetime)}</span>
                      <span className="font-semibold text-gray-700">
                        ₹{Number(d.final_bill_amount).toLocaleString('en-IN')} · balance ₹{Number(d.balance_due).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="text-gray-600">{d.diagnosis_summary || '—'}</div>
                    {d.follow_up_date && <div className="text-[11px] text-blue-600">Follow-up: {displayDate(d.follow_up_date)}</div>}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
