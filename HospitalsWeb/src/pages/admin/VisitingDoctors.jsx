import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import { hasPermission } from '../../util/permissions';
import PageHeader from '../../components/PageHeader';

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm ${cls}`}>{msg}</div>;
}

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

const emptyForm = { full_name: '', qualification: '', specialization: '', mobile: '', notes: '' };
const inputCls = (err) =>
  `w-full px-3.5 py-2.5 border rounded-lg text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
    err ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-white'
  }`;

export default function VisitingDoctors({ user }) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };
  const fail = (err, fb) => setErrorMsg(err?.message || fb);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const res = await apiFetch(`/visiting-doctors?activeOnly=${!showInactive}`);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      fail(err, 'Failed to load visiting doctors.');
    } finally {
      setIsLoading(false);
    }
  }, [showInactive]);

  useEffect(() => { load(); }, [load]);

  const handleDeactivate = async (doc) => {
    if (!window.confirm(`Deactivate Dr. ${doc.full_name}? They will no longer appear in doctor lists.`)) return;
    try {
      await apiFetch(`/visiting-doctors/${doc.id}`, { method: 'DELETE' });
      flash(`Dr. ${doc.full_name} deactivated.`);
      await load();
    } catch (err) {
      fail(err, 'Failed to deactivate.');
    }
  };

  const handleReactivate = async (doc) => {
    try {
      await apiFetch(`/visiting-doctors/${doc.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: true }) });
      flash(`Dr. ${doc.full_name} reactivated.`);
      await load();
    } catch (err) {
      fail(err, 'Failed to reactivate.');
    }
  };

  if (showForm) {
    return (
      <DoctorForm
        initial={editing}
        onBack={() => { setShowForm(false); setEditing(null); }}
        onSaved={async (msg) => { flash(msg); setShowForm(false); setEditing(null); await load(); }}
        onError={fail}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        category="Patient & Hospital"
        title="Visiting / External Doctors"
        subtitle="Doctors who come for specific patients but are not on staff. Used to link visiting doctors to consultations and set per-visit fees."
        actions={
          hasPermission(user, 'visiting_doctor.create') && (
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
            >
              + Add Visiting Doctor
            </button>
          )
        }
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <div className="bg-white p-3 rounded-xl border border-gray-200/80 shadow-sm flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-500">{rows.length} doctor{rows.length === 1 ? '' : 's'}</span>
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show Deactivated
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No visiting doctors registered yet.</div>
        ) : (
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="p-3.5">Doctor</th>
                <th className="p-3.5">Specialization</th>
                <th className="p-3.5">Mobile</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((d) => (
                <tr key={d.id} className={`hover:bg-gray-50/80 transition-colors ${!d.is_active ? 'opacity-50' : ''}`}>
                  <td className="p-3.5">
                    <div className="font-bold text-gray-900">Dr. {d.full_name}</div>
                    {d.qualification && <div className="text-[10px] text-gray-400">{d.qualification}</div>}
                  </td>
                  <td className="p-3.5">{d.specialization || '—'}</td>
                  <td className="p-3.5">{d.mobile || '—'}</td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      d.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3.5 text-right space-x-3 whitespace-nowrap">
                    {hasPermission(user, 'visiting_doctor.edit') && d.is_active && (
                      <button onClick={() => { setEditing(d); setShowForm(true); }} className="text-blue-600 font-bold hover:underline cursor-pointer">Edit</button>
                    )}
                    {hasPermission(user, 'visiting_doctor.delete') && d.is_active && (
                      <button onClick={() => handleDeactivate(d)} className="text-rose-600 font-bold hover:underline cursor-pointer">Deactivate</button>
                    )}
                    {hasPermission(user, 'visiting_doctor.edit') && !d.is_active && (
                      <button onClick={() => handleReactivate(d)} className="text-emerald-600 font-bold hover:underline cursor-pointer">Reactivate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DoctorForm({ initial, onBack, onSaved, onError }) {
  const [form, setForm] = useState(initial ? {
    full_name: initial.full_name || '',
    qualification: initial.qualification || '',
    specialization: initial.specialization || '',
    mobile: initial.mobile || '',
    notes: initial.notes || '',
  } : { ...emptyForm });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Doctor name is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    try {
      setIsSaving(true);
      const payload = {
        full_name: form.full_name.trim(),
        qualification: form.qualification.trim() || null,
        specialization: form.specialization.trim() || null,
        mobile: form.mobile.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (initial) {
        await apiFetch(`/visiting-doctors/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        onSaved(`Dr. ${payload.full_name} updated.`);
      } else {
        await apiFetch('/visiting-doctors', { method: 'POST', body: JSON.stringify(payload) });
        onSaved(`Dr. ${payload.full_name} added.`);
      }
    } catch (err) {
      onError(err, 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        category="Patient & Hospital"
        parent="Visiting Doctors"
        title={initial ? 'Edit Visiting Doctor' : 'Add Visiting Doctor'}
        subtitle="Doctors who visit for specific patients — not on permanent staff."
        onBack={onBack}
      />

      <form onSubmit={submit} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <Field label="Full Name" required error={errors.full_name}>
              <input type="text" value={form.full_name} onChange={setField('full_name')} className={inputCls(errors.full_name)} placeholder="e.g. Suresh Menon" />
            </Field>
          </div>
          <Field label="Qualification">
            <input type="text" value={form.qualification} onChange={setField('qualification')} className={inputCls()} placeholder="e.g. MBBS, MS (Ortho)" />
          </Field>
          <Field label="Specialization">
            <input type="text" value={form.specialization} onChange={setField('specialization')} className={inputCls()} placeholder="e.g. Orthopedics" />
          </Field>
          <Field label="Mobile">
            <input type="text" value={form.mobile} onChange={setField('mobile')} className={inputCls()} placeholder="Contact number" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Notes">
              <textarea rows="2" value={form.notes} onChange={setField('notes')} className={inputCls()} placeholder="Any additional info…" />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <button type="button" onClick={onBack} className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer disabled:opacity-50">
            {isSaving ? 'Saving…' : initial ? 'Save Changes' : 'Add Doctor'}
          </button>
        </div>
      </form>
    </div>
  );
}
