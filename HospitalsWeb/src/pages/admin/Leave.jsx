import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import { hasPermission } from '../../util/permissions';
import PageHeader from '../../components/PageHeader';
import EmployeePicker from '../../components/EmployeePicker';

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

export default function Leave({ user }) {
  const availableTabs = [
    { value: 'requests', label: 'Requests', show: true },
    { value: 'balances', label: 'Balances', show: hasPermission(user, 'leave.view') },
    { value: 'types', label: 'Leave Types', show: hasPermission(user, 'leave.create') || hasPermission(user, 'leave.edit') || hasPermission(user, 'leave.delete') },
    { value: 'holidays', label: 'Holidays', show: hasPermission(user, 'leave.create_holiday') || hasPermission(user, 'leave.view') },
  ].filter((t) => t.show);

  const [tab, setTab] = useState(() => availableTabs[0]?.value || 'requests');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  return (
    <div className="space-y-6">
      <PageHeader
        category="Staff & Salary"
        title="Leave"
        subtitle="Applications, the two-step approval chain, balances, and holidays."
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={availableTabs}
      />

      {tab === 'requests' && <Requests user={user} onError={fail} onSuccess={flash} />}
      {tab === 'balances' && <Balances user={user} onError={fail} onSuccess={flash} />}
      {tab === 'types' && <LeaveTypes user={user} onError={fail} onSuccess={flash} />}
      {tab === 'holidays' && <Holidays user={user} onError={fail} onSuccess={flash} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   REQUESTS
═══════════════════════════════════════════════════════════════════════ */

function Requests({ user, onError, onSuccess }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);

  const [showApply, setShowApply] = useState(false);
  const [applyForm, setApplyForm] = useState({
    employee_id: '',
    leave_type_id: '',
    duration_type: 'full_day',
    from_date: today(),
    to_date: today(),
    reason: '',
  });
  const [isApplying, setIsApplying] = useState(false);
  const [selectedBalanceInfo, setSelectedBalanceInfo] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const [showAbsence, setShowAbsence] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({ employee_id: '', date: today() });
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    apiFetch('/leave/types')
      .then((d) => setLeaveTypes(Array.isArray(d) ? d.filter((t) => t.is_active) : []))
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

  // Fetch live balance info when employee and leave type are selected
  useEffect(() => {
    if (!applyForm.employee_id || !applyForm.leave_type_id) {
      setSelectedBalanceInfo(null);
      return;
    }
    let cancelled = false;
    setLoadingBalance(true);
    const yr = new Date(applyForm.from_date || today()).getFullYear();
    apiFetch(`/leave/balances?employeeId=${applyForm.employee_id}&year=${yr}`)
      .then((balances) => {
        if (cancelled) return;
        const b = Array.isArray(balances) ? balances.find((x) => Number(x.leave_type_id) === Number(applyForm.leave_type_id)) : null;
        setSelectedBalanceInfo(b || null);
      })
      .catch(() => {
        if (!cancelled) setSelectedBalanceInfo(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingBalance(false);
      });
    return () => { cancelled = true; };
  }, [applyForm.employee_id, applyForm.leave_type_id, applyForm.from_date]);

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

  // Direct administrator approval bypass (approves reporting person tier, then HR tier)
  const adminDirectApprove = async (id) => {
    try {
      setBusyId(id);
      await apiFetch(`/leave/requests/${id}/review-reporting`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
      const res = await apiFetch(`/leave/requests/${id}/review-hr`, { method: 'PATCH', body: JSON.stringify({ status: 'approved' }) });
      onSuccess(res.message || 'Admin direct approval recorded.');
      await load();
    } catch (err) {
      onError(err, 'Failed to perform direct administrator approval.');
    } finally {
      setBusyId(null);
    }
  };

  const calculateDays = () => {
    if (applyForm.duration_type === 'first_half' || applyForm.duration_type === 'second_half') {
      return 0.5;
    }
    if (!applyForm.from_date || !applyForm.to_date) return 1;
    const diff = (new Date(applyForm.to_date) - new Date(applyForm.from_date)) / 86400000;
    return Math.max(1, Math.round(diff) + 1);
  };

  const submitApply = async (e) => {
    e.preventDefault();
    if (!applyForm.employee_id || !applyForm.leave_type_id || !applyForm.from_date) {
      onError(null, 'Employee, leave type and date are required.');
      return;
    }
    const daysCount = calculateDays();
    const toDate = applyForm.duration_type !== 'full_day' ? applyForm.from_date : (applyForm.to_date || applyForm.from_date);

    try {
      setIsApplying(true);
      await apiFetch('/leave/requests', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(applyForm.employee_id),
          leave_type_id: Number(applyForm.leave_type_id),
          from_date: applyForm.from_date,
          to_date: toDate,
          duration_type: applyForm.duration_type,
          days_count: daysCount,
          reason: applyForm.reason.trim() || null,
        }),
      });
      onSuccess(`Leave request submitted (${daysCount} ${daysCount === 1 ? 'day' : 'days'}).`);
      setApplyForm({ employee_id: '', leave_type_id: '', duration_type: 'full_day', from_date: today(), to_date: today(), reason: '' });
      setSelectedBalanceInfo(null);
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

  const selectedLeaveTypeObj = leaveTypes.find((t) => Number(t.id) === Number(applyForm.leave_type_id));
  const isLossOfPay = selectedLeaveTypeObj && (Number(selectedLeaveTypeObj.id) === 3 || selectedLeaveTypeObj.name.toLowerCase().includes('loss of pay'));

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
          {hasPermission(user, 'leave.record_absence') && (
            <button
              onClick={() => setShowAbsence((v) => !v)}
              className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              {showAbsence ? 'Cancel' : 'Record Unexplained Absence'}
            </button>
          )}
          {hasPermission(user, 'leave.create') && (
            <button
              onClick={() => setShowApply((v) => !v)}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
            >
              {showApply ? 'Cancel' : '+ Apply for Leave'}
            </button>
          )}
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
          <div className="md:col-span-2 text-xs font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center justify-between">
            <span>Apply for Leave</span>
            <span className="text-[11px] font-semibold text-gray-500">Calculated: <strong className="text-blue-700">{calculateDays()} Day(s)</strong></span>
          </div>

          <EmployeePicker value={applyForm.employee_id} onChange={(v) => setApplyForm((f) => ({ ...f, employee_id: v }))} />

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Leave Type</label>
              {loadingBalance ? (
                <span className="text-[10px] text-gray-400">Checking quota…</span>
              ) : isLossOfPay ? (
                <span className="text-[10px] font-bold text-orange-600">Unpaid / Loss of Pay</span>
              ) : selectedBalanceInfo ? (
                <span className={`text-[10px] font-bold ${Number(selectedBalanceInfo.balance_days) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  Available: {selectedBalanceInfo.balance_days} d (Alloc: {selectedBalanceInfo.allocated_days}d)
                </span>
              ) : applyForm.employee_id && applyForm.leave_type_id ? (
                <span className="text-[10px] text-gray-400">No quota record</span>
              ) : null}
            </div>
            <select
              value={applyForm.leave_type_id}
              onChange={(e) => setApplyForm((f) => ({ ...f, leave_type_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            >
              <option value="">Select…</option>
              {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Duration Selector: Full Day vs Half Day */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Duration Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'full_day', label: 'Full Day (1.0)', sub: 'Complete standard shift' },
                { id: 'first_half', label: 'First Half (0.5)', sub: 'Morning shift session' },
                { id: 'second_half', label: 'Second Half (0.5)', sub: 'Afternoon / evening session' },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setApplyForm((f) => ({
                      ...f,
                      duration_type: d.id,
                      to_date: d.id !== 'full_day' ? f.from_date : f.to_date,
                    }));
                  }}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                    applyForm.duration_type === d.id
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                      : 'border-gray-200 bg-gray-50/40 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-xs font-bold">{d.label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{d.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {applyForm.duration_type !== 'full_day' ? 'Date' : 'From Date'}
            </label>
            <input
              type="date"
              value={applyForm.from_date}
              onChange={(e) => {
                const val = e.target.value;
                setApplyForm((f) => ({
                  ...f,
                  from_date: val,
                  to_date: f.duration_type !== 'full_day' ? val : f.to_date,
                }));
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              To Date {applyForm.duration_type !== 'full_day' && <span className="text-gray-400 lowercase">(locked for half-day)</span>}
            </label>
            <input
              type="date"
              value={applyForm.duration_type !== 'full_day' ? applyForm.from_date : applyForm.to_date}
              disabled={applyForm.duration_type !== 'full_day'}
              onChange={(e) => setApplyForm((f) => ({ ...f, to_date: e.target.value }))}
              className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold ${
                applyForm.duration_type !== 'full_day' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'
              }`}
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reason</label>
            <textarea
              rows="2"
              value={applyForm.reason}
              placeholder="State reason for absence or leave coverage…"
              onChange={(e) => setApplyForm((f) => ({ ...f, reason: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-between pt-2">
            <div className="text-[11px] text-gray-500">
              Deduction: <strong className="text-gray-900">{calculateDays()} day(s)</strong> {applyForm.duration_type !== 'full_day' ? `(${applyForm.duration_type === 'first_half' ? 'First Half' : 'Second Half'})` : ''}
            </div>
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
            {rows.map((r) => {
              const daysCount = Number(r.days_count || (r.is_half_day ? 0.5 : 1));
              return (
                <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-900">{r.full_name}</span>
                      <span className="text-gray-400 text-xs font-medium">({r.employee_code})</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-700 font-semibold">{r.leave_type_name}</span>
                      {r.duration_type === 'first_half' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          First Half · 0.5d
                        </span>
                      ) : r.duration_type === 'second_half' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Second Half · 0.5d
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {daysCount} {daysCount === 1 ? 'day' : 'days'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      {r.from_date} → {r.to_date}
                      {' · '}reporting person: <span className="capitalize font-semibold">{r.reporting_person_status}</span>
                      {' · '}HR: <span className="capitalize font-semibold">{r.hr_status}</span>
                    </div>
                    {r.reason && <div className="text-[11px] text-gray-600 mt-1 italic">"{r.reason}"</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    {resultBadge(r.result)}
                    {r.reporting_person_status === 'pending' && hasPermission(user, 'leave.review_reporting') && (
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
                    {r.reporting_person_status === 'approved' && r.hr_status === 'pending' && hasPermission(user, 'leave.review_hr') && (
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
                    {/* Admin Direct Approval Bypass when reporting person is pending */}
                    {r.reporting_person_status === 'pending' && (hasPermission(user, 'leave.review_hr') || user?.role === 'Administrator') && (
                      <button
                        onClick={() => adminDirectApprove(r.id)}
                        disabled={busyId === r.id}
                        className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded cursor-pointer disabled:opacity-50"
                        title="Direct administrator bypass approval"
                      >
                        ⚡ Admin Direct
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   BALANCES — HOSPITAL-WIDE LEAVE & COMP-OFF DIRECTORY
═══════════════════════════════════════════════════════════════════════ */

function Balances({ user, onError, onSuccess }) {
  const [year, setYear] = useState(currentYear());
  const [rows, setRows] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');

  // Modals
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [allocateForm, setAllocateForm] = useState({ employee_id: '', leave_type_id: '', allocated_days: '12' });
  const [isAllocating, setIsAllocating] = useState(false);

  const [showCompOffModal, setShowCompOffModal] = useState(false);
  const [compOffForm, setCompOffForm] = useState({ employee_id: '', worked_date: today(), expires_in_days: 90, reason: '' });
  const [isAwardingCompOff, setIsAwardingCompOff] = useState(false);

  useEffect(() => {
    apiFetch('/leave/types')
      .then((d) => setLeaveTypes(Array.isArray(d) ? d : []))
      .catch((err) => onError(err, 'Failed to load leave types.'));
  }, []);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch(`/leave/balances?year=${year}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err, 'Failed to load organization balances.');
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  // Aggregate by employee
  const employeeBalancesList = React.useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.employee_id)) {
        map.set(r.employee_id, {
          employee_id: r.employee_id,
          full_name: r.full_name,
          employee_code: r.employee_code,
          department_name: r.department_name || 'General',
          designation_name: r.designation_name || '',
          types: {},
          total_allocated: 0,
          total_used: 0,
          total_remaining: 0,
        });
      }
      const emp = map.get(r.employee_id);
      const alloc = Number(r.allocated_days) || 0;
      const used = Number(r.used_days) || 0;
      const rem = Number(r.balance_days) || (alloc - used);

      emp.types[r.leave_type_id] = {
        name: r.leave_type_name,
        allocated: alloc,
        used: used,
        remaining: rem,
      };

      emp.total_allocated += alloc;
      emp.total_used += used;
      emp.total_remaining += rem;
    });
    return Array.from(map.values());
  }, [rows]);

  // Unique departments for filter
  const departments = React.useMemo(() => {
    const set = new Set();
    employeeBalancesList.forEach((e) => {
      if (e.department_name) set.add(e.department_name);
    });
    return ['All', ...Array.from(set).sort()];
  }, [employeeBalancesList]);

  // Filtered employees
  const filteredEmployees = React.useMemo(() => {
    return employeeBalancesList.filter((emp) => {
      if (selectedDept !== 'All' && emp.department_name !== selectedDept) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (emp.full_name || '').toLowerCase().includes(q);
        const matchesCode = (emp.employee_code || '').toLowerCase().includes(q);
        const matchesDept = (emp.department_name || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDept) return false;
      }
      return true;
    });
  }, [employeeBalancesList, selectedDept, searchQuery]);

  // KPI aggregates
  const totalEmployees = employeeBalancesList.length;
  const totalAllocatedDays = employeeBalancesList.reduce((sum, e) => sum + e.total_allocated, 0);
  const totalUsedDays = employeeBalancesList.reduce((sum, e) => sum + e.total_used, 0);
  const totalRemainingDays = employeeBalancesList.reduce((sum, e) => sum + e.total_remaining, 0);

  // Submit Quota Allocation
  const handleAllocate = async (e) => {
    e.preventDefault();
    if (!allocateForm.employee_id || !allocateForm.leave_type_id || allocateForm.allocated_days === '') {
      onError(null, 'Employee, leave type and days are required.');
      return;
    }
    try {
      setIsAllocating(true);
      await apiFetch('/leave/balances', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(allocateForm.employee_id),
          leave_type_id: Number(allocateForm.leave_type_id),
          year,
          allocated_days: Number(allocateForm.allocated_days),
        }),
      });
      onSuccess('Leave quota allocated successfully.');
      setShowAllocateModal(false);
      await load();
    } catch (err) {
      onError(err, 'Failed to allocate the balance.');
    } finally {
      setIsAllocating(false);
    }
  };

  // Submit Comp-Off Award
  const handleAwardCompOff = async (e) => {
    e.preventDefault();
    if (!compOffForm.employee_id || !compOffForm.worked_date) {
      onError(null, 'Employee and worked date are required.');
      return;
    }
    try {
      setIsAwardingCompOff(true);
      await apiFetch('/leave/balances/comp-off', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(compOffForm.employee_id),
          worked_date: compOffForm.worked_date,
          expires_in_days: Number(compOffForm.expires_in_days) || 90,
          reason: compOffForm.reason.trim() || 'Holiday / Overtime coverage',
        }),
      });
      onSuccess('Compensatory off credited (valid for 90 days).');
      setShowCompOffModal(false);
      setCompOffForm({ employee_id: '', worked_date: today(), expires_in_days: 90, reason: '' });
      await load();
    } catch (err) {
      onError(err, 'Failed to credit compensatory off.');
    } finally {
      setIsAwardingCompOff(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Ribbon */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            >
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Search Staff</label>
            <input
              type="text"
              placeholder="Search by name or code…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-auto">
          {hasPermission(user, 'leave.set_balance') && (
            <>
              <button
                onClick={() => {
                  setCompOffForm({ employee_id: '', worked_date: today(), expires_in_days: 90, reason: '' });
                  setShowCompOffModal(true);
                }}
                className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
              >
                + Award Comp-Off
              </button>
              <button
                onClick={() => {
                  setAllocateForm({ employee_id: '', leave_type_id: '', allocated_days: '12' });
                  setShowAllocateModal(true);
                }}
                className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                + Allocate Quota
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Active Employees</span>
          <span className="text-xl font-extrabold text-gray-900 mt-1 block">{totalEmployees}</span>
          <span className="text-[10px] text-gray-500 font-medium">with {year} quotas</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Total Allocated</span>
          <span className="text-xl font-extrabold text-blue-900 mt-1 block">{totalAllocatedDays.toFixed(1)} d</span>
          <span className="text-[10px] text-gray-500 font-medium">hospital-wide quota</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Total Consumed</span>
          <span className="text-xl font-extrabold text-amber-700 mt-1 block">{totalUsedDays.toFixed(1)} d</span>
          <span className="text-[10px] text-gray-500 font-medium">approved leave days</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Total Remaining</span>
          <span className="text-xl font-extrabold text-emerald-700 mt-1 block">{totalRemainingDays.toFixed(1)} d</span>
          <span className="text-[10px] text-gray-500 font-medium">available balances</span>
        </div>
      </div>

      {/* Organization Balances Directory Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div>
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Leave Balances Directory ({year})</h2>
            <span className="text-[11px] text-gray-500">{filteredEmployees.length} of {totalEmployees} employees</span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-gray-400">Loading leave balances…</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500">No employee leave records found for {year}.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[850px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">Employee</th>
                  <th className="text-center px-3 py-2.5">Casual Leave (CL)</th>
                  <th className="text-center px-3 py-2.5">Privilege Leave (PL)</th>
                  <th className="text-center px-3 py-2.5">Sick Leave (SL)</th>
                  <th className="text-center px-3 py-2.5">Total Remaining</th>
                  <th className="text-right px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEmployees.map((emp) => {
                  const cl = emp.types[1]; // Casual Leave
                  const pl = emp.types[2]; // Privilege Leave
                  const sl = emp.types[4]; // Sick Leave

                  return (
                    <tr key={emp.employee_id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{emp.full_name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {emp.employee_code} · <span className="text-gray-600 font-sans">{emp.department_name}</span>
                          {emp.designation_name ? ` · ${emp.designation_name}` : ''}
                        </div>
                      </td>

                      {/* CL Column */}
                      <td className="px-3 py-3 text-center">
                        {cl ? (
                          <div>
                            <span className={`font-bold ${cl.remaining <= 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                              {cl.remaining} d
                            </span>
                            <div className="text-[10px] text-gray-400">
                              used {cl.used} / {cl.allocated}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* PL Column */}
                      <td className="px-3 py-3 text-center">
                        {pl ? (
                          <div>
                            <span className={`font-bold ${pl.remaining <= 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                              {pl.remaining} d
                            </span>
                            <div className="text-[10px] text-gray-400">
                              used {pl.used} / {pl.allocated}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* SL Column */}
                      <td className="px-3 py-3 text-center">
                        {sl ? (
                          <div>
                            <span className={`font-bold ${sl.remaining <= 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                              {sl.remaining} d
                            </span>
                            <div className="text-[10px] text-gray-400">
                              used {sl.used} / {sl.allocated}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Total Column */}
                      <td className="px-3 py-3 text-center font-extrabold text-gray-900 bg-gray-50/50">
                        <span className={emp.total_remaining <= 0 ? 'text-rose-600' : 'text-blue-900'}>
                          {emp.total_remaining.toFixed(1)} d
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        {hasPermission(user, 'leave.set_balance') && (
                          <>
                            <button
                              onClick={() => {
                                setCompOffForm((f) => ({ ...f, employee_id: emp.employee_id }));
                                setShowCompOffModal(true);
                              }}
                              className="text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-1 rounded cursor-pointer transition-colors"
                              title="Award comp-off credit for Sunday/Holiday duty"
                            >
                              + Comp-Off
                            </button>
                            <button
                              onClick={() => {
                                setAllocateForm({ employee_id: emp.employee_id, leave_type_id: '1', allocated_days: '12' });
                                setShowAllocateModal(true);
                              }}
                              className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded cursor-pointer transition-colors"
                              title="Adjust or allocate quota"
                            >
                              Adjust Quota
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Award Comp-Off Credit */}
      {showCompOffModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Award Compensatory Off Credit</h3>
                <p className="text-[11px] text-gray-500">Credited for working on Sundays, holidays, or emergency shifts.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCompOffModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAwardCompOff} className="space-y-3.5 text-xs">
              <EmployeePicker
                value={compOffForm.employee_id}
                onChange={(v) => setCompOffForm((f) => ({ ...f, employee_id: v }))}
              />

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Date Worked</label>
                <input
                  type="date"
                  value={compOffForm.worked_date}
                  onChange={(e) => setCompOffForm((f) => ({ ...f, worked_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Validity (Days)</label>
                <input
                  type="number"
                  value={compOffForm.expires_in_days}
                  onChange={(e) => setCompOffForm((f) => ({ ...f, expires_in_days: e.target.value }))}
                  placeholder="90"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg font-semibold"
                />
                <span className="text-[10px] text-gray-400">Hospital standard is 90 days from worked date.</span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Reason / Shift Details</label>
                <textarea
                  rows="2"
                  value={compOffForm.reason}
                  placeholder="e.g. Covered Emergency ICU duty on Sunday / Pongal"
                  onChange={(e) => setCompOffForm((f) => ({ ...f, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompOffModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAwardingCompOff}
                  className="px-5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isAwardingCompOff ? 'Crediting…' : 'Credit Comp-Off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Allocate / Adjust Quota */}
      {showAllocateModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Allocate / Adjust Leave Quota</h3>
                <p className="text-[11px] text-gray-500">Assign annual leave quota for year {year}.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllocateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAllocate} className="space-y-3.5 text-xs">
              <EmployeePicker
                value={allocateForm.employee_id}
                onChange={(v) => setAllocateForm((f) => ({ ...f, employee_id: v }))}
              />

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Leave Type</label>
                <select
                  value={allocateForm.leave_type_id}
                  onChange={(e) => setAllocateForm((f) => ({ ...f, leave_type_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg font-semibold bg-white"
                >
                  <option value="">Select leave type…</option>
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.quota_days} standard)</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Allocated Days for {year}</label>
                <input
                  type="number"
                  step="0.5"
                  value={allocateForm.allocated_days}
                  onChange={(e) => setAllocateForm((f) => ({ ...f, allocated_days: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAllocating}
                  className="px-5 py-2 text-xs font-bold bg-[#1e40af] hover:bg-[#1c399b] text-white rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isAllocating ? 'Saving…' : 'Save Quota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   LEAVE TYPES
═══════════════════════════════════════════════════════════════════════ */

function LeaveTypes({ user, onError, onSuccess }) {
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
    if (!hasPermission(user, 'leave.edit')) return;
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
        {hasPermission(user, 'leave.create') && (
          <button
            onClick={() => {
              if (showForm) { setShowForm(false); setEditingType(null); }
              else { openNewForm(); }
            }}
            className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
          >
            {showForm ? 'Cancel' : '+ New Leave Type'}
          </button>
        )}
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
          <div className="md:col-span-2 text-[11px] text-gray-500 bg-blue-50/60 border border-blue-100 rounded-lg p-2.5">
            <span className="font-bold text-blue-900">Hospital Leave Policy:</span> Casual Leave (CL), Sick Leave (SL), and Loss of Pay (LOP) natively support half-day leave applications (0.5 day deduction for First Half or Second Half). Privilege Leave (PL) is reserved for full-day planned leaves.
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
              {rows.map((t) => {
                const norm = (t.name || '').toLowerCase().trim();
                const isSystem = ['casual leave', 'cl', 'privilege leave', 'pl', 'loss of pay', 'lop', 'sick leave', 'sl', 'weekly off', 'week off', 'wh'].includes(norm) || Number(t.id) <= 5;

                return (
                  <tr key={t.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-2.5 font-bold text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{t.name}</span>
                        {isSystem && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            Default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-700">{t.quota_days}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500 capitalize">{t.quota_period}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500">
                      {t.can_carry_forward ? `up to ${t.max_carry_forward_days}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => toggleActive(t)}
                        disabled={!hasPermission(user, 'leave.edit')}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          t.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}
                      >
                        {t.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-3 font-semibold whitespace-nowrap">
                      {hasPermission(user, 'leave.edit') && (
                        <button
                          onClick={() => openEditForm(t)}
                          className="text-blue-600 hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                      {isSystem ? (
                        <span className="text-gray-400 text-[11px] cursor-not-allowed" title="System default leave types cannot be deleted">
                          Locked
                        </span>
                      ) : hasPermission(user, 'leave.delete') && (
                        <button
                          onClick={() => setDeletingType(t)}
                          className="text-rose-600 hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
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

function Holidays({ user, onError, onSuccess }) {
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
        {hasPermission(user, 'leave.create_holiday') && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="ml-auto bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
          >
            {showForm ? 'Cancel' : '+ Add Holiday'}
          </button>
        )}
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
