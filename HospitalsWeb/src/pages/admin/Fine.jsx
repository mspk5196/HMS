import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import PageHeader from '../../components/PageHeader';
import EmployeePicker from '../../components/EmployeePicker';

const today = () => new Date().toISOString().slice(0, 10);

const CALC_BASIS_OPTIONS = [
  { value: 'flat', label: 'Flat amount' },
  { value: 'per_day', label: 'Per day' },
  { value: 'percent_of_day_salary', label: '% of day salary' },
];

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200/80 shadow-sm w-fit">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
            active === t.value ? 'bg-[#1e40af] text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm ${cls}`}>{msg}</div>;
}

export default function Fine() {
  const [tab, setTab] = useState('fines');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  return (
    <div className="space-y-6">
      <PageHeader
        category="Staff & Salary"
        title="Fine"
        subtitle="Deductions on top of LOP — configured per fine type, automatic or manually imposed."
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[{ value: 'fines', label: 'Fines' }, { value: 'types', label: 'Fine Types' }]}
      />

      {tab === 'fines' && <Fines onError={fail} onSuccess={flash} />}
      {tab === 'types' && <FineTypes onError={fail} onSuccess={flash} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FINES
═══════════════════════════════════════════════════════════════════════ */

function Fines({ onError, onSuccess }) {
  const [statusFilter, setStatusFilter] = useState('active');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [fineTypes, setFineTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employee_id: '', fine_type_id: '', amount: '', fine_date: today(), reason: '' });
  const [isSaving, setIsSaving] = useState(false);

  const [actioningId, setActioningId] = useState(null);
  const [actionKind, setActionKind] = useState(null); // 'waive' | 'cancel'
  const [actionReason, setActionReason] = useState('');

  useEffect(() => {
    apiFetch('/salary/fine-types').then((d) => setFineTypes(Array.isArray(d) ? d.filter((t) => t.is_active) : []))
      .catch((err) => onError(err, 'Failed to load fine types.'));
  }, []);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.set('status', statusFilter);
      const { data, meta: m } = await apiFetch(`/salary/fines?${params.toString()}`, { withMeta: true });
      setRows(Array.isArray(data) ? data : []);
      setMeta(m || { total: 0 });
    } catch (err) {
      onError(err, 'Failed to load fines.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const money = (v) => Number(v).toLocaleString('en-IN');

  const submit = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.fine_type_id || !form.amount || !form.fine_date) {
      onError(null, 'Employee, fine type, amount and date are required.');
      return;
    }
    try {
      setIsSaving(true);
      await apiFetch('/salary/fines', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(form.employee_id),
          fine_type_id: Number(form.fine_type_id),
          amount: Number(form.amount),
          fine_date: form.fine_date,
          reason: form.reason.trim() || null,
        }),
      });
      onSuccess('Fine created.');
      setForm({ employee_id: '', fine_type_id: '', amount: '', fine_date: today(), reason: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      onError(err, 'Failed to create the fine.');
    } finally {
      setIsSaving(false);
    }
  };

  const startAction = (id, kind) => { setActioningId(id); setActionKind(kind); setActionReason(''); };

  const submitAction = async () => {
    if (!actionReason.trim()) { onError(null, 'A reason is required.'); return; }
    try {
      setBusyId(actioningId);
      await apiFetch(`/salary/fines/${actioningId}/${actionKind}`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: actionReason.trim() }),
      });
      onSuccess(`Fine ${actionKind === 'waive' ? 'waived' : 'cancelled'}.`);
      setActioningId(null);
      await load();
    } catch (err) {
      onError(err, `Failed to ${actionKind} the fine.`);
    } finally {
      setBusyId(null);
    }
  };

  const statusStyle = {
    active: 'bg-amber-50 text-amber-700 border-amber-200',
    waived: 'bg-blue-50 text-blue-700 border-blue-200',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
    deducted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {['active', 'waived', 'cancelled', 'deducted', ''].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors capitalize ${
                statusFilter === s ? 'bg-[#1e40af] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="sm:ml-auto bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Fine'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <EmployeePicker value={form.employee_id} onChange={(v) => setForm((f) => ({ ...f, employee_id: v }))} />
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fine Type</label>
            <select
              value={form.fine_type_id}
              onChange={(e) => {
                const ft = fineTypes.find((t) => String(t.id) === e.target.value);
                setForm((f) => ({ ...f, fine_type_id: e.target.value, amount: ft ? ft.default_amount : f.amount }));
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            >
              <option value="">Select…</option>
              {fineTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount (₹)</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</label>
            <input
              type="date"
              value={form.fine_date}
              onChange={(e) => setForm((f) => ({ ...f, fine_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reason</label>
            <textarea
              rows="2"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Create Fine'}
            </button>
          </div>
        </form>
      )}

      {actioningId && (
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm space-y-3">
          <div className="text-xs font-bold text-gray-900 capitalize">{actionKind} fine #{actioningId} — reason required</div>
          <textarea
            rows="2"
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder="Why is this fine being adjusted?"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={submitAction}
              disabled={busyId === actioningId}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50"
            >
              Confirm {actionKind}
            </button>
            <button onClick={() => setActioningId(null)} className="text-xs font-semibold text-gray-500 hover:underline cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Fines</h2>
          <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{meta.total} total</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No fines match this filter.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((f) => (
              <div key={f.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    {f.full_name} <span className="text-gray-400 font-medium">({f.employee_code})</span>
                    {' — '}<span className="text-gray-600 font-semibold">{f.fine_type_name}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {f.fine_date} · ₹{money(f.amount)}
                    {!!f.is_auto_generated && <span className="ml-2 text-rose-500 font-semibold">Auto-generated</span>}
                  </div>
                  {f.reason && <div className="text-[11px] text-gray-600 mt-1 italic">"{f.reason}"</div>}
                  {f.waiver_reason && <div className="text-[11px] text-blue-600 mt-1">Waiver/cancel note: {f.waiver_reason}</div>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${statusStyle[f.status] || ''}`}>
                    {f.status}
                  </span>
                  {f.status === 'active' && (
                    <>
                      <button onClick={() => startAction(f.id, 'waive')} className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer">
                        Waive
                      </button>
                      <button onClick={() => startAction(f.id, 'cancel')} className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer">
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FINE TYPES
═══════════════════════════════════════════════════════════════════════ */

function FineTypes({ onError, onSuccess }) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', default_amount: '', trigger_rule: 'manual', calculation_basis: 'flat', description: '',
  });

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch('/salary/fine-types');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err, 'Failed to load fine types.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (type) => {
    try {
      await apiFetch(`/salary/fine-types/${type.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !type.is_active }) });
      onSuccess(`${type.name} ${type.is_active ? 'deactivated' : 'activated'}.`);
      await load();
    } catch (err) {
      onError(err, 'Failed to update the fine type.');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.default_amount === '') {
      onError(null, 'Name and default amount are required.');
      return;
    }
    try {
      setIsSaving(true);
      await apiFetch('/salary/fine-types', {
        method: 'POST',
        body: JSON.stringify({ ...form, default_amount: Number(form.default_amount) }),
      });
      onSuccess('Fine type created.');
      setForm({ name: '', default_amount: '', trigger_rule: 'manual', calculation_basis: 'flat', description: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      onError(err, 'Failed to create the fine type.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl px-4 py-3 text-[11px] text-blue-800">
        Fine types are admin-editable rules, not hardcoded logic — Late-in time, Labour Welfare, Punch Miss, Night Duty Leave, ID Card, Uniform, Attendance Signature, Food Contribution, and the automatic unapproved-absence trigger all live here.
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Fine Type'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Uniform Violation"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Default Amount (₹ or %)</label>
            <input
              type="number"
              value={form.default_amount}
              onChange={(e) => setForm((f) => ({ ...f, default_amount: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trigger</label>
            <select
              value={form.trigger_rule}
              onChange={(e) => setForm((f) => ({ ...f, trigger_rule: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            >
              <option value="manual">Manual only</option>
              <option value="unapproved_absence_no_leave">Automatic — unapproved absence, no leave left</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Calculation Basis</label>
            <select
              value={form.calculation_basis}
              onChange={(e) => setForm((f) => ({ ...f, calculation_basis: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            >
              {CALC_BASIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Description</label>
            <textarea
              rows="2"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Create Fine Type'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No fine types configured.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-center px-3 py-2.5">Default</th>
                <th className="text-center px-3 py-2.5">Basis</th>
                <th className="text-center px-3 py-2.5">Trigger</th>
                <th className="text-center px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 font-bold text-gray-900">{t.name}</td>
                  <td className="px-3 py-2.5 text-center text-gray-700">
                    {t.calculation_basis === 'percent_of_day_salary' ? `${t.default_amount}%` : `₹${Number(t.default_amount).toLocaleString('en-IN')}`}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-500">
                    {CALC_BASIS_OPTIONS.find((o) => o.value === t.calculation_basis)?.label || t.calculation_basis}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-500">
                    {t.trigger_rule === 'manual' ? 'Manual' : 'Automatic'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={() => toggleActive(t)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border cursor-pointer ${
                        t.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}
                    >
                      {t.is_active ? 'Active' : 'Inactive'}
                    </button>
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
