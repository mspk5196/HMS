import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import EmployeeBiometricPunches from './EmployeeBiometricPunches';

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'late_present', label: 'Late Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'lop', label: 'LOP' },
  { value: 'week_off', label: 'Week Off' },
  { value: 'holiday', label: 'Holiday' },
];

const STATUS_STYLE = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  late_present: 'bg-amber-50 text-amber-700 border-amber-200',
  absent: 'bg-rose-50 text-rose-700 border-rose-200',
  on_leave: 'bg-blue-50 text-blue-700 border-blue-200',
  lop: 'bg-orange-50 text-orange-700 border-orange-200',
  week_off: 'bg-gray-100 text-gray-600 border-gray-200',
  holiday: 'bg-purple-50 text-purple-700 border-purple-200',
};

const fmtTime = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const fmtMinutes = (m) => {
  const n = Number(m || 0);
  if (!n) return '0m';
  const h = Math.floor(n / 60);
  const rem = n % 60;
  return h ? `${h}h${String(rem).padStart(2, '0')}m` : `${rem}m`;
};

/** Tiny pill-tab bar shared by every sub-view on this page. */
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

export default function Attendance() {
  const [tab, setTab] = useState('daily'); // 'daily' | 'corrections' | 'buffer' | 'windows'
  const [departments, setDepartments] = useState([]);
  const [staffRoles, setStaffRoles] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  useEffect(() => {
    (async () => {
      try {
        const [depts, roles] = await Promise.all([
          apiFetch('/hr/departments'),
          apiFetch('/hr/staff-roles'),
        ]);
        setDepartments(Array.isArray(depts) ? depts : []);
        setStaffRoles(Array.isArray(roles) ? roles : []);
      } catch (err) {
        fail(err, 'Failed to load departments/roles.');
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            Staff &amp; Salary &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Attendance</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Daily punches, corrections, the monthly late-buffer pool, and biometric window overrides.
          </p>
        </div>
      </div>

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'daily', label: 'Daily Log' },
          { value: 'punches', label: 'Employee Punch Logs' },
          { value: 'devices', label: 'Biometric Devices & Sync' },
          { value: 'corrections', label: 'Corrections' },
          { value: 'buffer', label: 'Buffer Pool' },
          { value: 'windows', label: 'Biometric Windows' },
        ]}
      />

      {tab === 'daily' && (
        <DailyLog departments={departments} onError={(e) => fail(e)} onSuccess={flash} />
      )}
      {tab === 'punches' && (
        <EmployeeBiometricPunches />
      )}
      {tab === 'devices' && (
        <BiometricDevices onError={(e) => fail(e)} onSuccess={flash} />
      )}
      {tab === 'corrections' && (
        <Corrections onError={(e) => fail(e)} onSuccess={flash} />
      )}
      {tab === 'buffer' && (
        <BufferPool departments={departments} onError={(e) => fail(e)} />
      )}
      {tab === 'windows' && (
        <BiometricWindows staffRoles={staffRoles} onError={(e) => fail(e)} onSuccess={flash} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DAILY LOG
═══════════════════════════════════════════════════════════════════════ */

function DailyLog({ departments, onError, onSuccess }) {
  const [date, setDate] = useState(today());
  const [deptFilter, setDeptFilter] = useState('');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [markingId, setMarkingId] = useState(null);
  const [markStatus, setMarkStatus] = useState('present');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ date, limit: '200' });
      if (deptFilter) params.set('departmentId', deptFilter);
      const { data, meta: m } = await apiFetch(`/attendance?${params.toString()}`, { withMeta: true });
      setRows(Array.isArray(data) ? data : []);
      setMeta(m || { total: 0 });
    } catch (err) {
      onError(err, 'Failed to load attendance.');
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [date, deptFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSyncBiometric = async () => {
    try {
      setIsSyncing(true);
      const results = await apiFetch('/attendance/devices/sync-all', { method: 'POST' });
      const totalNew = Array.isArray(results) ? results.reduce((sum, r) => sum + (r.newPunchesInserted || 0), 0) : 0;
      onSuccess(`Biometric sync complete! ${totalNew} new punches downloaded.`);
      await load();
    } catch (err) {
      onError(err, 'Biometric sync failed. Please check device IP and network connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleProcess = async () => {
    try {
      setIsProcessing(true);
      const res = await apiFetch('/attendance/process', {
        method: 'POST',
        body: JSON.stringify({ date }),
      });
      onSuccess(`Processed ${res.data.processed} punch record(s) for ${date}${res.data.skipped ? `, ${res.data.skipped} skipped (no valid punch)` : ''}.`);
      await load();
    } catch (err) {
      onError(err, 'Failed to process attendance.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startMark = (employeeId) => { setMarkingId(employeeId); setMarkStatus('present'); };

  const saveMark = async (employeeId) => {
    try {
      setIsSaving(true);
      await apiFetch('/attendance/mark', {
        method: 'POST',
        body: JSON.stringify({ employee_id: employeeId, date, status: markStatus }),
      });
      onSuccess('Attendance marked manually.');
      setMarkingId(null);
      await load();
    } catch (err) {
      onError(err, 'Failed to mark attendance.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Dept</span>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="sm:ml-auto flex items-center gap-2.5">
          <button
            onClick={handleSyncBiometric}
            disabled={isSyncing || isProcessing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5"
            title="Connect to local eSSL biometric device and download latest punches"
          >
            {isSyncing ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Syncing…
              </>
            ) : (
              <>⚡ Sync Biometric</>
            )}
          </button>
          <button
            onClick={handleProcess}
            disabled={isProcessing || isSyncing}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50"
            title="Read raw biometric punches for this date and compute the daily summary"
          >
            {isProcessing ? 'Processing…' : 'Process Punches'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Daily Summary</h2>
          <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {meta.total} record{meta.total === 1 ? '' : 's'}
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            No attendance summary for this date yet. Import punches, then click "Process Punches".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">Employee</th>
                  <th className="text-left px-3 py-2.5">Shift</th>
                  <th className="text-center px-3 py-2.5">In</th>
                  <th className="text-center px-3 py-2.5">Out</th>
                  <th className="text-center px-3 py-2.5">Worked</th>
                  <th className="text-center px-3 py-2.5">Break</th>
                  <th className="text-center px-3 py-2.5">Late</th>
                  <th className="text-center px-3 py-2.5">Status</th>
                  <th className="text-center px-3 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-gray-900">{r.full_name}</div>
                      <div className="text-[10px] text-gray-400">{r.employee_code} · {r.department_name || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{r.shift_name || '—'}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-gray-800">{fmtTime(r.first_punch_in)}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-gray-800">{fmtTime(r.last_punch_out)}</td>
                    <td className="px-3 py-2.5 text-center text-gray-700">{fmtMinutes(r.worked_minutes)}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500">{fmtMinutes(r.break_minutes)}</td>
                    <td className={`px-3 py-2.5 text-center font-semibold ${Number(r.late_minutes) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {fmtMinutes(r.late_minutes)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {r.status}
                        </span>
                        {!!r.is_missed_punch && (
                          <span className="text-[9px] font-semibold text-rose-500">missed punch</span>
                        )}
                        {!!r.is_manually_marked && (
                          <span className="text-[9px] font-semibold text-blue-500">manual</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {markingId === r.employee_id ? (
                        <div className="flex items-center gap-1 justify-center">
                          <select
                            value={markStatus}
                            onChange={(e) => setMarkStatus(e.target.value)}
                            className="px-2 py-1 border border-gray-200 rounded text-[10px] font-semibold bg-white"
                          >
                            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <button
                            onClick={() => saveMark(r.employee_id)}
                            disabled={isSaving}
                            className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setMarkingId(null)}
                            className="text-[10px] font-bold text-gray-400 hover:underline cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startMark(r.employee_id)}
                          className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          Mark manually
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CORRECTION REQUESTS
═══════════════════════════════════════════════════════════════════════ */

function Corrections({ onError, onSuccess }) {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employee_id: '', attendance_date: today(), requested_in_time: '', requested_out_time: '', reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.set('status', statusFilter);
      const { data, meta: m } = await apiFetch(`/attendance/corrections?${params.toString()}`, { withMeta: true });
      setRows(Array.isArray(data) ? data : []);
      setMeta(m || { total: 0 });
    } catch (err) {
      onError(err, 'Failed to load correction requests.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const review = async (id, status) => {
    try {
      setBusyId(id);
      await apiFetch(`/attendance/corrections/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      onSuccess(`Correction request ${status}.`);
      await load();
    } catch (err) {
      onError(err, 'Failed to review the request.');
    } finally {
      setBusyId(null);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.attendance_date || !form.reason.trim()) {
      onError(null, 'Employee, date and reason are required.');
      return;
    }
    try {
      setIsSubmitting(true);
      await apiFetch('/attendance/corrections', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(form.employee_id),
          attendance_date: form.attendance_date,
          requested_in_time: form.requested_in_time ? `${form.attendance_date} ${form.requested_in_time}:00` : null,
          requested_out_time: form.requested_out_time ? `${form.attendance_date} ${form.requested_out_time}:00` : null,
          reason: form.reason.trim(),
        }),
      });
      onSuccess('Correction request submitted.');
      setForm({ employee_id: '', attendance_date: today(), requested_in_time: '', requested_out_time: '', reason: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      onError(err, 'Failed to submit the request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          {['pending', 'approved', 'rejected', ''].map((s) => (
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
          className="sm:ml-auto bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Request'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Employee ID</label>
            <input
              type="number"
              value={form.employee_id}
              onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
              placeholder="e.g. 94"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</label>
            <input
              type="date"
              value={form.attendance_date}
              onChange={(e) => setForm((f) => ({ ...f, attendance_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Requested In</label>
            <input
              type="time"
              value={form.requested_in_time}
              onChange={(e) => setForm((f) => ({ ...f, requested_in_time: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Requested Out</label>
            <input
              type="time"
              value={form.requested_out_time}
              onChange={(e) => setForm((f) => ({ ...f, requested_out_time: e.target.value }))}
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
              disabled={isSubmitting}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Correction Requests</h2>
          <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{meta.total} total</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No correction requests here.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-gray-900">{r.full_name} <span className="text-gray-400 font-medium">({r.employee_code})</span></div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {r.attendance_date} · requested {fmtTime(r.requested_in_time)} – {fmtTime(r.requested_out_time)}
                  </div>
                  <div className="text-[11px] text-gray-600 mt-1 italic">"{r.reason}"</div>
                  {r.reviewed_by_name && (
                    <div className="text-[10px] text-gray-400 mt-1">Reviewed by {r.reviewed_by_name}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${
                    r.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : r.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {r.status}
                  </span>
                  {r.status === 'pending' && (
                    <>
                      <button
                        onClick={() => review(r.id, 'approved')}
                        disabled={busyId === r.id}
                        className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => review(r.id, 'rejected')}
                        disabled={busyId === r.id}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        Reject
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
   BUFFER POOL
═══════════════════════════════════════════════════════════════════════ */

function BufferPool({ departments, onError }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [deptFilter, setDeptFilter] = useState('');
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ month: String(month), year: String(year) });
      if (deptFilter) params.set('departmentId', deptFilter);
      const data = await apiFetch(`/attendance/buffer?${params.toString()}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err, 'Failed to load the buffer summary.');
    } finally {
      setIsLoading(false);
    }
  }, [month, year, deptFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Period</span>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-white">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('en-IN', { month: 'long' })}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Dept</span>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-white">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Monthly Late-Buffer Pool</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Lateness beyond the shift's daily grace period draws from here. Only what exceeds the pool is chargeable in payroll.
          </p>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No buffer activity recorded for this period.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5">Employee</th>
                <th className="text-center px-3 py-2.5">Allocated</th>
                <th className="text-center px-3 py-2.5">Used</th>
                <th className="text-center px-3 py-2.5">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const exhausted = Number(r.buffer_remaining_minutes) <= 0;
                return (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-gray-900">{r.full_name}</div>
                      <div className="text-[10px] text-gray-400">{r.employee_code} · {r.department_name || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-600">{fmtMinutes(r.buffer_allocated_minutes)}</td>
                    <td className="px-3 py-2.5 text-center text-amber-600 font-semibold">{fmtMinutes(r.buffer_used_minutes)}</td>
                    <td className={`px-3 py-2.5 text-center font-bold ${exhausted ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {fmtMinutes(r.buffer_remaining_minutes)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   BIOMETRIC WINDOW OVERRIDES
═══════════════════════════════════════════════════════════════════════ */

function BiometricWindows({ staffRoles, onError, onSuccess }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    window_date: today(), role_id: '', extended_start: '', extended_end: '', reason: '',
  });

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, meta: m } = await apiFetch('/attendance/biometric-windows?limit=50', { withMeta: true });
      setRows(Array.isArray(data) ? data : []);
      setMeta(m || { total: 0 });
    } catch (err) {
      onError(err, 'Failed to load biometric windows.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.window_date || !form.extended_start || !form.extended_end) {
      onError(null, 'Date, start and end time are required.');
      return;
    }
    try {
      setIsSubmitting(true);
      await apiFetch('/attendance/biometric-windows', {
        method: 'POST',
        body: JSON.stringify({
          window_date: form.window_date,
          role_id: form.role_id ? Number(form.role_id) : null,
          extended_start: form.extended_start,
          extended_end: form.extended_end,
          reason: form.reason.trim() || null,
        }),
      });
      onSuccess('Biometric window override created.');
      setForm({ window_date: today(), role_id: '', extended_start: '', extended_end: '', reason: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      onError(err, 'Failed to create the override.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-3 text-[11px] text-amber-800">
        Use this to widen the accepted punch window for a specific date — e.g. a festival day — for all staff or one role, without changing anyone's normal shift definition.
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Override'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</label>
            <input
              type="date"
              value={form.window_date}
              onChange={(e) => setForm((f) => ({ ...f, window_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Role (optional — blank = everyone)</label>
            <select
              value={form.role_id}
              onChange={(e) => setForm((f) => ({ ...f, role_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            >
              <option value="">All roles</option>
              {staffRoles.map((r) => <option key={r.id} value={r.id}>{r.department_name} · {r.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Window Start</label>
            <input
              type="time"
              value={form.extended_start}
              onChange={(e) => setForm((f) => ({ ...f, extended_start: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Window End</label>
            <input
              type="time"
              value={form.extended_end}
              onChange={(e) => setForm((f) => ({ ...f, extended_end: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reason</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Pongal — extended morning window"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Create Override'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Active &amp; Past Overrides</h2>
          <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{meta.total} total</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No overrides configured.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    {new Date(r.window_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' · '}{r.role_name || 'All roles'}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {String(r.extended_start).slice(0, 5)} – {String(r.extended_end).slice(0, 5)}
                    {r.reason && <span className="italic"> · {r.reason}</span>}
                  </div>
                </div>
                {r.created_by_name && <div className="text-[10px] text-gray-400">by {r.created_by_name}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   BIOMETRIC DEVICES & eSSL SYNC
═══════════════════════════════════════════════════════════════════════ */

function BiometricDevices({ onError, onSuccess }) {
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [form, setForm] = useState({
    name: '',
    ip_address: '',
    port: '4370',
    comm_key: '0',
    device_type: 'essl_standalone',
    location: 'Main Entrance',
    auto_sync_enabled: true,
    sync_interval_mins: '15',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch('/attendance/devices');
      setDevices(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err, 'Failed to load biometric devices.');
      setDevices([]);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleOpenAdd = () => {
    setEditingDevice(null);
    setForm({
      name: '',
      ip_address: '192.168.1.201',
      port: '4370',
      comm_key: '0',
      device_type: 'essl_standalone',
      location: 'Main Entrance Reception',
      auto_sync_enabled: true,
      sync_interval_mins: '15',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (dev) => {
    setEditingDevice(dev);
    setForm({
      name: dev.name || '',
      ip_address: dev.ip_address || '',
      port: String(dev.port || 4370),
      comm_key: dev.comm_key || '0',
      device_type: dev.device_type || 'essl_standalone',
      location: dev.location || '',
      auto_sync_enabled: Boolean(dev.auto_sync_enabled),
      sync_interval_mins: String(dev.sync_interval_mins || 15),
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.ip_address) {
      onError(new Error('Device Name and IP address are required.'));
      return;
    }
    try {
      setIsSubmitting(true);
      if (editingDevice) {
        await apiFetch(`/attendance/devices/${editingDevice.id}`, {
          method: 'PUT',
          body: {
            ...form,
            port: Number(form.port) || 4370,
            sync_interval_mins: Number(form.sync_interval_mins) || 15,
          },
        });
        onSuccess('Biometric device updated successfully.');
      } else {
        await apiFetch('/attendance/devices', {
          method: 'POST',
          body: {
            ...form,
            port: Number(form.port) || 4370,
            sync_interval_mins: Number(form.sync_interval_mins) || 15,
          },
        });
        onSuccess('Biometric device added successfully.');
      }
      setShowModal(false);
      loadDevices();
    } catch (err) {
      onError(err, 'Failed to save biometric device.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove device "${name}"?`)) return;
    try {
      await apiFetch(`/attendance/devices/${id}`, { method: 'DELETE' });
      onSuccess(`Device "${name}" removed.`);
      loadDevices();
    } catch (err) {
      onError(err, 'Failed to delete device.');
    }
  };

  const handleTestConnection = async (id) => {
    try {
      setTestingId(id);
      setTestResult((prev) => ({ ...prev, [id]: null }));
      const res = await apiFetch(`/attendance/devices/${id}/test`, { method: 'POST' });
      setTestResult((prev) => ({ ...prev, [id]: res }));
      if (res?.online) {
        onSuccess(`Connected to eSSL device successfully! (Session #${res.session_id || 'OK'})`);
      } else {
        onError(new Error(res?.error || 'Device is unreachable on LAN.'));
      }
      loadDevices();
    } catch (err) {
      onError(err, 'Connection test failed.');
      setTestResult((prev) => ({ ...prev, [id]: { online: false, error: err.message } }));
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncNow = async (id) => {
    try {
      setSyncingId(id);
      const res = await apiFetch(`/attendance/devices/${id}/sync`, { method: 'POST' });
      onSuccess(
        `Sync complete! Downloaded ${res.totalLogsFetched} records (${res.newPunchesInserted} new punches inserted). Attendance recalculated for affected dates.`
      );
      loadDevices();
    } catch (err) {
      onError(err, 'Sync failed. Check device network connection and power.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    try {
      setIsSyncingAll(true);
      const results = await apiFetch('/attendance/devices/sync-all', { method: 'POST' });
      const totalNew = Array.isArray(results) ? results.reduce((sum, r) => sum + (r.newPunchesInserted || 0), 0) : 0;
      onSuccess(`All active devices synced! ${totalNew} new punches registered.`);
      loadDevices();
    } catch (err) {
      onError(err, 'Failed to sync all devices.');
    } finally {
      setIsSyncingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Local eSSL Biometric Machines</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Connect directly to your local eSSL / ZKTeco devices via LAN TCP/IP (Port 4370) to pull live punch logs.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSyncAll}
            disabled={isSyncingAll || isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSyncingAll ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Syncing All Devices…
              </>
            ) : (
              <>⚡ Sync All Active Devices</>
            )}
          </button>
          <button
            onClick={handleOpenAdd}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5"
          >
            ➕ Add Biometric Device
          </button>
        </div>
      </div>

      {/* Device Cards Grid */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200/80 p-8 text-center text-xs text-gray-400">
          Loading biometric devices…
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 p-8 text-center space-y-3">
          <div className="text-3xl">📟</div>
          <div className="text-xs font-bold text-gray-900">No Biometric Devices Configured</div>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Add your local eSSL biometric device's IP address (e.g. 192.168.1.201) to automatically download attendance punches.
          </p>
          <button
            onClick={handleOpenAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            ➕ Configure First eSSL Device
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {devices.map((dev) => {
            const isSyncingThis = syncingId === dev.id;
            const isTestingThis = testingId === dev.id;
            const res = testResult[dev.id];

            return (
              <div
                key={dev.id}
                className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">{dev.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          dev.status === 'online'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : dev.status === 'unreachable'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        ● {dev.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                      <span>📍 {dev.location || 'Main Hospital Entrance'}</span>
                      <span>·</span>
                      <span className="capitalize">{dev.device_type.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(dev)}
                      className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                      title="Edit Device"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(dev.id, dev.name)}
                      className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Remove Device"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Connection Specs */}
                <div className="bg-gray-50/80 rounded-lg p-3 border border-gray-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 text-[10px] font-bold uppercase block">IP Address &amp; Port</span>
                    <span className="font-mono font-bold text-blue-700">{dev.ip_address}:{dev.port || 4370}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] font-bold uppercase block">Auto-Sync</span>
                    <span className="font-semibold text-gray-700">
                      {dev.auto_sync_enabled ? `Enabled (${dev.sync_interval_mins || 15}m)` : 'Disabled'}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-gray-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-gray-500">
                      Last Synced:{' '}
                      <strong className="text-gray-800">
                        {dev.last_sync_at
                          ? new Date(dev.last_sync_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Never'}
                      </strong>
                    </span>
                    {dev.last_sync_count > 0 && (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                        +{dev.last_sync_count} punches
                      </span>
                    )}
                  </div>
                </div>

                {/* Test Result Banner */}
                {res && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium ${
                      res.online ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {res.online ? `✓ Device Online · Connected on port ${dev.port || 4370}` : `✕ ${res.error}`}
                  </div>
                )}

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleSyncNow(dev.id)}
                    disabled={isSyncingThis || isTestingThis}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSyncingThis ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                        </svg>
                        Downloading Punches…
                      </>
                    ) : (
                      <>⚡ Sync Punches Now</>
                    )}
                  </button>
                  <button
                    onClick={() => handleTestConnection(dev.id)}
                    disabled={isTestingThis || isSyncingThis}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-2 px-3 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isTestingThis ? 'Testing…' : '🔍 Test Connection'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Help & Setup Guide Card */}
      <div className="bg-blue-50/60 rounded-xl border border-blue-100 p-5 space-y-3 text-xs text-blue-900">
        <h3 className="font-bold text-blue-950 flex items-center gap-2 text-sm">
          <span>📖</span> How to Connect your Local eSSL Device
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-[11px]">
          <div className="bg-white/80 p-3 rounded-lg border border-blue-100/80 space-y-1">
            <span className="font-bold text-blue-800 block">1. Device IP Configuration</span>
            <p className="text-gray-600">
              On the eSSL machine, press <strong>M/OK &gt; Comm. &gt; Ethernet</strong>. Set IP (e.g. <code className="text-blue-700">192.168.1.201</code>), Netmask <code className="text-blue-700">255.255.255.0</code>, Port <code className="text-blue-700">4370</code>.
            </p>
          </div>
          <div className="bg-white/80 p-3 rounded-lg border border-blue-100/80 space-y-1">
            <span className="font-bold text-blue-800 block">2. LAN / Wi-Fi Network</span>
            <p className="text-gray-600">
              Ensure this hospital server computer and the eSSL biometric machine are connected to the same local router / subnet.
            </p>
          </div>
          <div className="bg-white/80 p-3 rounded-lg border border-blue-100/80 space-y-1">
            <span className="font-bold text-blue-800 block">3. Employee Code Matching</span>
            <p className="text-gray-600">
              Staff registered on the biometric device (User ID / Enroll ID) must match their <strong>Emp Code</strong> in Neha Hospital staff records.
            </p>
          </div>
        </div>
      </div>

      {/* Add / Edit Device Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingDevice ? `Edit Device: ${editingDevice.name}` : 'Add Local eSSL Biometric Device'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white text-xs font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Device Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. eSSL Main Entrance"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg font-semibold text-gray-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">IP Address</label>
                  <input
                    type="text"
                    required
                    value={form.ip_address}
                    onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))}
                    placeholder="192.168.1.201"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono font-bold text-blue-700"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Port (Default 4370)</label>
                  <input
                    type="number"
                    required
                    value={form.port}
                    onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                    placeholder="4370"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Device Model / Protocol</label>
                  <select
                    value={form.device_type}
                    onChange={(e) => setForm((f) => ({ ...f, device_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg font-semibold bg-white"
                  >
                    <option value="essl_standalone">eSSL Standalone (Port 4370 TCP)</option>
                    <option value="zkteco">ZKTeco Terminal</option>
                    <option value="essl_adms_push">eSSL ADMS Cloud Push</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Comm Key / Password</label>
                  <input
                    type="text"
                    value={form.comm_key}
                    onChange={(e) => setForm((f) => ({ ...f, comm_key: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Physical Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. OPD Reception, Ground Floor"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={form.auto_sync_enabled}
                    onChange={(e) => setForm((f) => ({ ...f, auto_sync_enabled: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  Enable Auto-Sync
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving…' : editingDevice ? 'Update Device' : 'Save Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

