import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';

const today = () => new Date().toISOString().slice(0, 10);
const currentYear = () => new Date().getFullYear();

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-gray-200/80 shadow-sm w-fit flex-wrap">
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

/** Numeric employee-id field that resolves and shows the matching name. */
function EmployeePicker({ value, onChange, label = 'Employee ID' }) {
  const [name, setName] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!value) { setName(''); return; }
    let cancelled = false;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const emp = await apiFetch(`/hr/employees/${value}`);
        if (!cancelled) setName(`${emp.full_name} (${emp.employee_code})`);
      } catch {
        if (!cancelled) setName('Not found');
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value]);

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 94"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
      />
      {value && (
        <p className={`text-[10px] ${name === 'Not found' ? 'text-rose-500' : 'text-gray-400'}`}>
          {checking ? 'checking…' : name}
        </p>
      )}
    </div>
  );
}

export default function Leave() {
  const [tab, setTab] = useState('requests');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Staff &amp; Salary &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Leave</span>
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Applications, the two-step approval chain, balances, and holidays.
        </p>
      </div>

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'requests', label: 'Requests' },
          { value: 'balances', label: 'Balances' },
          { value: 'types', label: 'Leave Types' },
          { value: 'holidays', label: 'Holidays' },
        ]}
      />

      {tab === 'requests' && <Requests onError={fail} onSuccess={flash} />}
      {tab === 'balances' && <Balances onError={fail} onSuccess={flash} />}
      {tab === 'types' && <LeaveTypes onError={fail} onSuccess={flash} />}
      {tab === 'holidays' && <Holidays onError={fail} onSuccess={flash} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   REQUESTS
═══════════════════════════════════════════════════════════════════════ */

function Requests({ onError, onSuccess }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);

  const [showApply, setShowApply] = useState(false);
  const [applyForm, setApplyForm] = useState({ employee_id: '', leave_type_id: '', from_date: today(), to_date: today(), reason: '' });
  const [isApplying, setIsApplying] = useState(false);

  const [showAbsence, setShowAbsence] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({ employee_id: '', date: today() });
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    apiFetch('/leave/types').then((d) => setLeaveTypes(Array.isArray(d) ? d.filter((t) => t.is_active) : []))
      .catch((err) => onError(err, 'Failed to load leave types.'));
  }, []);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.set('status', statusFilter);
      const { data, meta: m } = await apiFetch(`/leave/requests?${params.toString()}`, { withMeta: true });
      setRows(Array.isArray(data) ? data : []);
      setMeta(m || { total: 0 });
    } catch (err) {
      onError(err, 'Failed to load leave requests.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const approveReporting = async (id, status) => {
    try {
      setBusyId(id);
      await apiFetch(`/leave/requests/${id}/review-reporting`, { method: 'PATCH', body: JSON.stringify({ status }) });
      onSuccess(`Reporting-person review recorded: ${status}.`);
      await load();
    } catch (err) {
      onError(err, 'Failed to review as reporting person.');
    } finally {
      setBusyId(null);
    }
  };

  const approveHR = async (id, status) => {
    try {
      setBusyId(id);
      const res = await apiFetch(`/leave/requests/${id}/review-hr`, { method: 'PATCH', body: JSON.stringify({ status }) });
      onSuccess(res.message || 'HR review recorded.');
      await load();
    } catch (err) {
      onError(err, 'Failed to review as HR.');
    } finally {
      setBusyId(null);
    }
  };

  const submitApply = async (e) => {
    e.preventDefault();
    if (!applyForm.employee_id || !applyForm.leave_type_id || !applyForm.from_date || !applyForm.to_date) {
      onError(null, 'Employee, leave type and dates are required.');
      return;
    }
    try {
      setIsApplying(true);
      await apiFetch('/leave/requests', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(applyForm.employee_id),
          leave_type_id: Number(applyForm.leave_type_id),
          from_date: applyForm.from_date,
          to_date: applyForm.to_date,
          reason: applyForm.reason.trim() || null,
        }),
      });
      onSuccess('Leave request submitted.');
      setApplyForm({ employee_id: '', leave_type_id: '', from_date: today(), to_date: today(), reason: '' });
      setShowApply(false);
      await load();
    } catch (err) {
      onError(err, 'Failed to submit the request.');
    } finally {
      setIsApplying(false);
    }
  };

  const submitAbsence = async (e) => {
    e.preventDefault();
    if (!absenceForm.employee_id || !absenceForm.date) {
      onError(null, 'Employee and date are required.');
      return;
    }
    try {
      setIsRecording(true);
      const res = await apiFetch('/leave/absences/unexplained', {
        method: 'POST',
        body: JSON.stringify({ employee_id: Number(absenceForm.employee_id), date: absenceForm.date }),
      });
      onSuccess(res.message);
      setAbsenceForm({ employee_id: '', date: today() });
      setShowAbsence(false);
    } catch (err) {
      onError(err, 'Failed to record the absence.');
    } finally {
      setIsRecording(false);
    }
  };

  const resultBadge = (r) => {
    const styles = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      paid_leave: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      lop: 'bg-orange-50 text-orange-700 border-orange-200',
      rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    const labels = { pending: 'Pending', paid_leave: 'Paid Leave', lop: 'LOP', rejected: 'Rejected' };
    return (
      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${styles[r] || styles.pending}`}>
        {labels[r] || r}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { v: '', l: 'All' },
            { v: 'pending_reporting', l: 'Awaiting Reporting Person' },
            { v: 'pending_hr', l: 'Awaiting HR' },
            { v: 'paid_leave', l: 'Paid Leave' },
            { v: 'lop', l: 'LOP' },
            { v: 'rejected', l: 'Rejected' },
          ].map((o) => (
            <button
              key={o.v || 'all'}
              onClick={() => setStatusFilter(o.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                statusFilter === o.v ? 'bg-[#1e40af] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowAbsence((v) => !v)}
            className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            {showAbsence ? 'Cancel' : 'Record Unexplained Absence'}
          </button>
          <button
            onClick={() => setShowApply((v) => !v)}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
          >
            {showApply ? 'Cancel' : '+ Apply for Leave'}
          </button>
        </div>
      </div>

      {showAbsence && (
        <form onSubmit={submitAbsence} className="bg-white p-5 rounded-xl border border-rose-200 shadow-sm space-y-4">
          <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            Use this only when no leave application exists for the date at all. If the balance is exhausted this marks the day LOP and automatically imposes a fine; if balance remains it is LOP only, no fine.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <EmployeePicker value={absenceForm.employee_id} onChange={(v) => setAbsenceForm((f) => ({ ...f, employee_id: v }))} />
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={absenceForm.date}
                onChange={(e) => setAbsenceForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
              />
            </div>
            <button
              type="submit"
              disabled={isRecording}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50 h-fit"
            >
              {isRecording ? 'Recording…' : 'Record Absence'}
            </button>
          </div>
        </form>
      )}

      {showApply && (
        <form onSubmit={submitApply} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <EmployeePicker value={applyForm.employee_id} onChange={(v) => setApplyForm((f) => ({ ...f, employee_id: v }))} />
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Leave Type</label>
            <select
              value={applyForm.leave_type_id}
              onChange={(e) => setApplyForm((f) => ({ ...f, leave_type_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            >
              <option value="">Select…</option>
              {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">From</label>
            <input
              type="date"
              value={applyForm.from_date}
              onChange={(e) => setApplyForm((f) => ({ ...f, from_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">To</label>
            <input
              type="date"
              value={applyForm.to_date}
              onChange={(e) => setApplyForm((f) => ({ ...f, to_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reason</label>
            <textarea
              rows="2"
              value={applyForm.reason}
              onChange={(e) => setApplyForm((f) => ({ ...f, reason: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isApplying}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isApplying ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Leave Requests</h2>
          <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{meta.total} total</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No leave requests match this filter.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    {r.full_name} <span className="text-gray-400 font-medium">({r.employee_code})</span>
                    {' — '}<span className="text-gray-600 font-semibold">{r.leave_type_name}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {r.from_date} → {r.to_date}
                    {' · '}reporting person: <span className="capitalize font-semibold">{r.reporting_person_status}</span>
                    {' · '}HR: <span className="capitalize font-semibold">{r.hr_status}</span>
                  </div>
                  {r.reason && <div className="text-[11px] text-gray-600 mt-1 italic">"{r.reason}"</div>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {resultBadge(r.result)}
                  {r.reporting_person_status === 'pending' && (
                    <>
                      <button
                        onClick={() => approveReporting(r.id, 'approved')}
                        disabled={busyId === r.id}
                        className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        RP Approve
                      </button>
                      <button
                        onClick={() => approveReporting(r.id, 'rejected')}
                        disabled={busyId === r.id}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        RP Reject
                      </button>
                    </>
                  )}
                  {r.reporting_person_status === 'approved' && r.hr_status === 'pending' && (
                    <>
                      <button
                        onClick={() => approveHR(r.id, 'approved')}
                        disabled={busyId === r.id}
                        className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        HR Approve
                      </button>
                      <button
                        onClick={() => approveHR(r.id, 'rejected')}
                        disabled={busyId === r.id}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        HR Reject
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
   BALANCES
═══════════════════════════════════════════════════════════════════════ */

function Balances({ onError, onSuccess }) {
  const [employeeId, setEmployeeId] = useState('');
  const [year, setYear] = useState(currentYear());
  const [rows, setRows] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [allocTypeId, setAllocTypeId] = useState('');
  const [allocDays, setAllocDays] = useState('');
  const [isAllocating, setIsAllocating] = useState(false);

  useEffect(() => {
    apiFetch('/leave/types').then((d) => setLeaveTypes(Array.isArray(d) ? d : []))
      .catch((err) => onError(err, 'Failed to load leave types.'));
  }, []);

  const load = useCallback(async () => {
    if (!employeeId) { setRows([]); return; }
    try {
      setIsLoading(true);
      const data = await apiFetch(`/leave/balances?employeeId=${employeeId}&year=${year}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err, 'Failed to load balances.');
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, year]);

  useEffect(() => { load(); }, [load]);

  const allocate = async (e) => {
    e.preventDefault();
    if (!employeeId || !allocTypeId || allocDays === '') {
      onError(null, 'Employee, leave type and days are required.');
      return;
    }
    try {
      setIsAllocating(true);
      await apiFetch('/leave/balances', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(employeeId), leave_type_id: Number(allocTypeId), year, allocated_days: Number(allocDays),
        }),
      });
      onSuccess('Leave balance allocated.');
      setAllocDays('');
      await load();
    } catch (err) {
      onError(err, 'Failed to allocate the balance.');
    } finally {
      setIsAllocating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-40"><EmployeePicker value={employeeId} onChange={setEmployeeId} /></div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
          />
        </div>
      </div>

      {employeeId && (
        <form onSubmit={allocate} className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-end gap-4">
          <div className="space-y-1 flex-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Allocate Leave Type</label>
            <select
              value={allocTypeId}
              onChange={(e) => setAllocTypeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            >
              <option value="">Select…</option>
              {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Days for {year}</label>
            <input
              type="number"
              step="0.5"
              value={allocDays}
              onChange={(e) => setAllocDays(e.target.value)}
              className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <button
            type="submit"
            disabled={isAllocating}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isAllocating ? 'Saving…' : 'Allocate'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Balances{employeeId ? ` — Employee #${employeeId}` : ''}</h2>
        </div>
        {!employeeId ? (
          <div className="p-8 text-center text-xs text-gray-500">Enter an employee ID above to view and allocate balances.</div>
        ) : isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No balances allocated for {year} yet.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5">Leave Type</th>
                <th className="text-center px-3 py-2.5">Allocated</th>
                <th className="text-center px-3 py-2.5">Used</th>
                <th className="text-center px-3 py-2.5">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 font-bold text-gray-900">{r.leave_type_name}</td>
                  <td className="px-3 py-2.5 text-center text-gray-600">{r.allocated_days}</td>
                  <td className="px-3 py-2.5 text-center text-amber-600 font-semibold">{r.used_days}</td>
                  <td className={`px-3 py-2.5 text-center font-bold ${Number(r.balance_days) <= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {r.balance_days}
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

/* ═══════════════════════════════════════════════════════════════════════
   LEAVE TYPES
═══════════════════════════════════════════════════════════════════════ */

function LeaveTypes({ onError, onSuccess }) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deletingType, setDeletingType] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', quota_days: '', quota_period: 'yearly', is_lop_applicable: true, can_carry_forward: false, max_carry_forward_days: '',
  });

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch('/leave/types');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err, 'Failed to load leave types.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNewForm = () => {
    setEditingType(null);
    setForm({ name: '', quota_days: '', quota_period: 'yearly', is_lop_applicable: true, can_carry_forward: false, max_carry_forward_days: '' });
    setShowForm(true);
  };

  const openEditForm = (t) => {
    setEditingType(t);
    setForm({
      name: t.name || '',
      quota_days: t.quota_days ?? '',
      quota_period: t.quota_period || 'yearly',
      is_lop_applicable: !!t.is_lop_applicable,
      can_carry_forward: !!t.can_carry_forward,
      max_carry_forward_days: t.max_carry_forward_days ?? '',
    });
    setShowForm(true);
  };

  const toggleActive = async (type) => {
    try {
      await apiFetch(`/leave/types/${type.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !type.is_active }) });
      onSuccess(`${type.name} ${type.is_active ? 'deactivated' : 'activated'}.`);
      await load();
    } catch (err) {
      onError(err, 'Failed to update the leave type.');
    }
  };

  const handleDelete = async () => {
    if (!deletingType) return;
    try {
      setIsSaving(true);
      await apiFetch(`/leave/types/${deletingType.id}`, { method: 'DELETE' });
      onSuccess(`Leave type "${deletingType.name}" deleted (deactivated).`);
      setDeletingType(null);
      await load();
    } catch (err) {
      onError(err, 'Failed to delete leave type.');
    } finally {
      setIsSaving(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.quota_days === '') {
      onError(null, 'Name and quota days are required.');
      return;
    }
    try {
      setIsSaving(true);
      const payload = {
        name: form.name.trim(),
        quota_days: Number(form.quota_days),
        quota_period: form.quota_period,
        is_lop_applicable: form.is_lop_applicable,
        can_carry_forward: form.can_carry_forward,
        max_carry_forward_days: form.can_carry_forward ? Number(form.max_carry_forward_days || 0) : 0,
      };

      if (editingType) {
        await apiFetch(`/leave/types/${editingType.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        onSuccess(`Leave type "${form.name.trim()}" updated.`);
      } else {
        await apiFetch('/leave/types', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onSuccess('Leave type created.');
      }

      setForm({ name: '', quota_days: '', quota_period: 'yearly', is_lop_applicable: true, can_carry_forward: false, max_carry_forward_days: '' });
      setEditingType(null);
      setShowForm(false);
      await load();
    } catch (err) {
      onError(err, `Failed to ${editingType ? 'update' : 'create'} the leave type.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            if (showForm) { setShowForm(false); setEditingType(null); }
            else { openNewForm(); }
          }}
          className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Leave Type'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">
            {editingType ? `Edit Leave Type — ${editingType.name}` : 'Add New Leave Type'}
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Sick Leave"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quota Days</label>
            <input
              type="number"
              step="0.5"
              value={form.quota_days}
              onChange={(e) => setForm((f) => ({ ...f, quota_days: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quota Period</label>
            <select
              value={form.quota_period}
              onChange={(e) => setForm((f) => ({ ...f, quota_period: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="space-y-2 pt-5">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.can_carry_forward} onChange={(e) => setForm((f) => ({ ...f, can_carry_forward: e.target.checked }))} />
              Allow carry-forward
            </label>
          </div>
          {form.can_carry_forward && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Max Carry-Forward Days</label>
              <input
                type="number"
                step="0.5"
                value={form.max_carry_forward_days}
                onChange={(e) => setForm((f) => ({ ...f, max_carry_forward_days: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
              />
            </div>
          )}
          <div className="md:col-span-2 text-[11px] text-gray-400 italic">
            Half-day leave is not supported by this system and cannot be enabled.
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingType(null); }}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : editingType ? 'Update Leave Type' : 'Create Leave Type'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No leave types configured.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-center px-3 py-2.5">Quota</th>
                <th className="text-center px-3 py-2.5">Period</th>
                <th className="text-center px-3 py-2.5">Carry-Forward</th>
                <th className="text-center px-3 py-2.5">Status</th>
                <th className="text-right px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 font-bold text-gray-900">{t.name}</td>
                  <td className="px-3 py-2.5 text-center text-gray-700">{t.quota_days}</td>
                  <td className="px-3 py-2.5 text-center text-gray-500 capitalize">{t.quota_period}</td>
                  <td className="px-3 py-2.5 text-center text-gray-500">
                    {t.can_carry_forward ? `up to ${t.max_carry_forward_days}` : '—'}
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
                  <td className="px-4 py-2.5 text-right space-x-3 font-semibold whitespace-nowrap">
                    <button
                      onClick={() => openEditForm(t)}
                      className="text-blue-600 hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingType(t)}
                      className="text-rose-600 hover:underline cursor-pointer"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Soft Delete Modal */}
      {deletingType && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-gray-100">
            <h3 className="text-base font-bold text-gray-900">Delete Leave Type</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-gray-900">"{deletingType.name}"</span>? This will deactivate the leave type (soft delete).
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingType(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Deleting…' : 'Delete (Deactivate)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HOLIDAYS
═══════════════════════════════════════════════════════════════════════ */

function Holidays({ onError, onSuccess }) {
  const [year, setYear] = useState(currentYear());
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ name: '', holiday_date: today(), is_optional: false });

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch(`/leave/holidays?year=${year}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err, 'Failed to load holidays.');
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.holiday_date) {
      onError(null, 'Name and date are required.');
      return;
    }
    try {
      setIsSaving(true);
      await apiFetch('/leave/holidays', { method: 'POST', body: JSON.stringify(form) });
      onSuccess('Holiday added.');
      setForm({ name: '', holiday_date: today(), is_optional: false });
      setShowForm(false);
      await load();
    } catch (err) {
      onError(err, 'Failed to add the holiday.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
          />
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="ml-auto bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Holiday'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Pongal"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</label>
            <input
              type="date"
              value={form.holiday_date}
              onChange={(e) => setForm((f) => ({ ...f, holiday_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.is_optional} onChange={(e) => setForm((f) => ({ ...f, is_optional: e.target.checked }))} />
              Optional
            </label>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No holidays configured for {year}.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((h) => (
              <div key={h.id} className="p-4 flex items-center justify-between">
                <div className="text-xs font-bold text-gray-900">{h.name}</div>
                <div className="text-[11px] text-gray-500">
                  {new Date(h.holiday_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {!!h.is_optional && <span className="ml-2 text-amber-600 font-semibold">Optional</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
