import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString('en-IN', { month: 'long' }));
const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

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

export default function Payroll() {
  const [tab, setTab] = useState('runs');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 6000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          Staff &amp; Salary &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">Payroll</span>
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Monthly runs, per-employee payslips, overtime, and the PF/ESI constants that drive them.
        </p>
      </div>

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'runs', label: 'Payroll Runs' },
          { value: 'overtime', label: 'Overtime' },
          { value: 'config', label: 'PF/ESI Config' },
        ]}
      />

      {tab === 'runs' && <Runs onError={fail} onSuccess={flash} />}
      {tab === 'overtime' && <Overtime onError={fail} onSuccess={flash} />}
      {tab === 'config' && <Config onError={fail} onSuccess={flash} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PAYROLL RUNS
═══════════════════════════════════════════════════════════════════════ */

function Runs({ onError, onSuccess }) {
  const now = new Date();
  const [runs, setRuns] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [isLoading, setIsLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newMonth, setNewMonth] = useState(now.getMonth() + 1);
  const [newYear, setNewYear] = useState(now.getFullYear());
  const [isCreating, setIsCreating] = useState(false);

  const [selectedRunId, setSelectedRunId] = useState(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, meta: m } = await apiFetch('/salary/payroll-runs?limit=24', { withMeta: true });
      setRuns(Array.isArray(data) ? data : []);
      setMeta(m || { total: 0 });
    } catch (err) {
      onError(err, 'Failed to load payroll runs.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createRun = async (e) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      await apiFetch('/salary/payroll-runs', {
        method: 'POST',
        body: JSON.stringify({ period_month: Number(newMonth), period_year: Number(newYear) }),
      });
      onSuccess(`Payroll run created for ${MONTH_NAMES[newMonth - 1]} ${newYear}.`);
      setShowCreate(false);
      await load();
    } catch (err) {
      onError(err, 'Failed to create the run.');
    } finally {
      setIsCreating(false);
    }
  };

  const statusStyle = {
    draft: 'bg-amber-50 text-amber-700 border-amber-200',
    locked: 'bg-blue-50 text-blue-700 border-blue-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  if (selectedRunId) {
    return (
      <RunDetail
        runId={selectedRunId}
        onBack={() => { setSelectedRunId(null); load(); }}
        onError={onError}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
        >
          {showCreate ? 'Cancel' : '+ New Payroll Run'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createRun} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Month</label>
            <select
              value={newMonth}
              onChange={(e) => setNewMonth(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            >
              {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Year</label>
            <input
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isCreating ? 'Creating…' : 'Create Run'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Payroll Runs</h2>
          <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{meta.total} total</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No payroll runs yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {runs.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900">{MONTH_NAMES[r.period_month - 1]} {r.period_year}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {r.item_count} payslip{r.item_count === 1 ? '' : 's'} · total net {money(r.total_net)}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${statusStyle[r.status] || ''}`}>
                    {r.status}
                  </span>
                  <button
                    onClick={() => setSelectedRunId(r.id)}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Open
                  </button>
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
   RUN DETAIL — items table + calculate/lock + payslip
═══════════════════════════════════════════════════════════════════════ */

function RunDetail({ runId, onBack, onError, onSuccess }) {
  const [run, setRun] = useState(null);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [payslipFor, setPayslipFor] = useState(null);
  const [payslip, setPayslip] = useState(null);

  const loadRun = useCallback(async () => {
    try {
      const data = await apiFetch(`/salary/payroll-runs/${runId}`);
      setRun(data);
    } catch (err) {
      onError(err, 'Failed to load the payroll run.');
    }
  }, [runId]);

  const loadItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, meta: m } = await apiFetch(`/salary/payroll-runs/${runId}/items?page=${page}&limit=25`, { withMeta: true });
      setItems(Array.isArray(data) ? data : []);
      setMeta(m || { total: 0 });
    } catch (err) {
      onError(err, 'Failed to load payslips.');
    } finally {
      setIsLoading(false);
    }
  }, [runId, page]);

  useEffect(() => { loadRun(); }, [loadRun]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const calculate = async () => {
    try {
      setBusy(true);
      const res = await apiFetch(`/salary/payroll-runs/${runId}/calculate`, { method: 'POST' });
      onSuccess(res.message);
      await Promise.all([loadRun(), loadItems()]);
    } catch (err) {
      onError(err, 'Failed to calculate the run.');
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    if (!window.confirm('Locking a payroll run is final — it marks every fine in it as deducted and prevents recalculation. Continue?')) return;
    try {
      setBusy(true);
      const res = await apiFetch(`/salary/payroll-runs/${runId}/lock`, { method: 'POST' });
      onSuccess(res.message);
      await loadRun();
    } catch (err) {
      onError(err, 'Failed to lock the run.');
    } finally {
      setBusy(false);
    }
  };

  const openPayslip = async (employeeId) => {
    try {
      setPayslipFor(employeeId);
      const data = await apiFetch(`/salary/payroll-runs/${runId}/payslip/${employeeId}`);
      setPayslip(data);
    } catch (err) {
      onError(err, 'Failed to load the payslip.');
      setPayslipFor(null);
    }
  };

  if (payslipFor && payslip) {
    return <PayslipView payslip={payslip} onBack={() => { setPayslipFor(null); setPayslip(null); }} />;
  }

  if (!run) {
    return <div className="p-8 text-center text-xs text-gray-400">Loading…</div>;
  }

  const totalPages = meta.pages || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-200/80 transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-base font-bold text-gray-900">{MONTH_NAMES[run.period_month - 1]} {run.period_year}</h2>
          <p className="text-[11px] text-gray-500">Status: <span className="capitalize font-semibold">{run.status}</span></p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={calculate}
            disabled={busy || run.status !== 'draft'}
            className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Calculate'}
          </button>
          <button
            onClick={lock}
            disabled={busy || run.status !== 'draft'}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50"
          >
            Lock &amp; Confirm
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            No payslips yet — click <strong>Calculate</strong> to run the salary engine for every active employee.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">Employee</th>
                  <th className="text-center px-3 py-2.5">Present</th>
                  <th className="text-center px-3 py-2.5">LOP</th>
                  <th className="text-center px-3 py-2.5">Gross</th>
                  <th className="text-center px-3 py-2.5">PF (Emp)</th>
                  <th className="text-center px-3 py-2.5">ESI (Emp)</th>
                  <th className="text-center px-3 py-2.5">Fines</th>
                  <th className="text-center px-3 py-2.5">Net Pay</th>
                  <th className="text-center px-3 py-2.5">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-gray-900">{it.full_name}</div>
                      <div className="text-[10px] text-gray-400">{it.employee_code} · {it.department_name || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-700">{it.days_present}</td>
                    <td className={`px-3 py-2.5 text-center font-semibold ${Number(it.days_lop) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{it.days_lop}</td>
                    <td className="px-3 py-2.5 text-center text-gray-700">{money(it.gross_pay)}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500">{money(it.pf_employee_amount)}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500">{money(it.esi_employee_amount)}</td>
                    <td className={`px-3 py-2.5 text-center ${Number(it.fines_amount) > 0 ? 'text-rose-600 font-semibold' : 'text-gray-400'}`}>{money(it.fines_amount)}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-gray-900">{money(it.net_pay)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => openPayslip(it.employee_id)} className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {items.length > 0 && (
          <div className="p-3 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-[11px] font-semibold text-gray-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
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
   PAYSLIP VIEW
═══════════════════════════════════════════════════════════════════════ */

function PayslipRow({ label, value, strong }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${strong ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
      <span className="text-xs">{label}</span>
      <span className="text-xs">{value}</span>
    </div>
  );
}

function PayslipView({ payslip, onBack }) {
  const { run, item, day_rate } = payslip;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-200/80 transition-colors cursor-pointer text-gray-500 hover:text-gray-800">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-base font-bold text-gray-900">
          Payslip — {item.full_name} — {MONTH_NAMES[run.period_month - 1]} {run.period_year}
        </h2>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 max-w-xl print:shadow-none">
        <div className="grid grid-cols-2 gap-y-1 gap-x-6 pb-4 border-b border-gray-100 text-xs">
          <div><span className="text-gray-400">Employee Code</span><br /><span className="font-semibold text-gray-800">{item.employee_code}</span></div>
          <div><span className="text-gray-400">Department</span><br /><span className="font-semibold text-gray-800">{item.department_name || '—'}</span></div>
          <div><span className="text-gray-400">Role</span><br /><span className="font-semibold text-gray-800">{item.role_name || '—'}</span></div>
          <div><span className="text-gray-400">Day Rate</span><br /><span className="font-semibold text-gray-800">{money(day_rate)}</span></div>
        </div>

        <div className="py-3 border-b border-gray-100">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Attendance</div>
          <PayslipRow label="Days present" value={item.days_present} />
          <PayslipRow label="Paid leave days" value={item.days_paid_leave} />
          <PayslipRow label="LOP days" value={item.days_lop} />
          <PayslipRow label="Shifts worked" value={item.shifts_worked} />
        </div>

        <div className="py-3 border-b border-gray-100">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Earnings</div>
          <PayslipRow label="Monthly salary" value={money(item.base_salary_component)} />
          <PayslipRow label="Night shift allowance" value={money(item.night_shift_component)} />
          <PayslipRow label="Paid extra days" value={money(item.overtime_amount)} />
          <PayslipRow label="Gross pay" value={money(item.gross_pay)} strong />
        </div>

        <div className="py-3 border-b border-gray-100">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Deductions</div>
          <PayslipRow label="LOP" value={money(item.lop_amount)} />
          <PayslipRow label="Late buffer excess" value={money(item.buffer_late_deduction)} />
          <PayslipRow label="Fines" value={money(item.fines_amount)} />
          <PayslipRow label="PF (employee)" value={money(item.pf_employee_amount)} />
          <PayslipRow label="ESI (employee)" value={money(item.esi_employee_amount)} />
        </div>

        <div className="py-3 border-b border-gray-100">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Employer Contribution (not deducted from pay)</div>
          <PayslipRow label="PF (employer)" value={money(item.pf_employer_amount)} />
          <PayslipRow label="ESI (employer)" value={money(item.esi_employer_amount)} />
        </div>

        <div className="pt-3 flex items-center justify-between">
          <span className="text-sm font-extrabold text-gray-900">Net Pay</span>
          <span className="text-lg font-extrabold text-emerald-700">{money(item.net_pay)}</span>
        </div>

        <button
          onClick={() => window.print()}
          className="mt-4 w-full border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors print:hidden"
        >
          Print Payslip
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   OVERTIME
═══════════════════════════════════════════════════════════════════════ */

function Overtime({ onError, onSuccess }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: '', entry_date: new Date().toISOString().slice(0, 10), entry_type: 'extra_day', hours: '', notes: '',
  });

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, meta: m } = await apiFetch('/salary/overtime?limit=50', { withMeta: true });
      setRows(Array.isArray(data) ? data : []);
      setMeta(m || { total: 0 });
    } catch (err) {
      onError(err, 'Failed to load overtime entries.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.entry_date) {
      onError(null, 'Employee and date are required.');
      return;
    }
    if (form.entry_type === 'hourly' && !form.hours) {
      onError(null, 'Hours are required for hourly overtime.');
      return;
    }
    try {
      setIsSaving(true);
      const res = await apiFetch('/salary/overtime', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(form.employee_id),
          entry_date: form.entry_date,
          entry_type: form.entry_type,
          hours: form.entry_type === 'hourly' ? Number(form.hours) : undefined,
          notes: form.notes.trim() || null,
        }),
      });
      onSuccess(res.message);
      setForm({ employee_id: '', entry_date: new Date().toISOString().slice(0, 10), entry_type: 'extra_day', hours: '', notes: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      onError(err, 'Failed to record the entry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl px-4 py-3 text-[11px] text-blue-800">
        An extra full day worked (e.g. covering someone's week-off) is paid at that month's day rate when payroll runs. Hourly overtime is logged for the record only and never adds to salary.
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Entry'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <EmployeePicker value={form.employee_id} onChange={(v) => setForm((f) => ({ ...f, employee_id: v }))} />
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</label>
            <input
              type="date"
              value={form.entry_date}
              onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</label>
            <select
              value={form.entry_type}
              onChange={(e) => setForm((f) => ({ ...f, entry_type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            >
              <option value="extra_day">Extra day worked (paid)</option>
              <option value="hourly">Hourly overtime (unpaid, logged only)</option>
            </select>
          </div>
          {form.entry_type === 'hourly' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hours</label>
              <input
                type="number"
                step="0.5"
                value={form.hours}
                onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
              />
            </div>
          )}
          <div className="md:col-span-2 space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Notes</label>
            <textarea
              rows="2"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Record Entry'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Overtime Entries</h2>
          <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{meta.total} total</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No overtime entries recorded.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-gray-900">{r.full_name} <span className="text-gray-400 font-medium">({r.employee_code})</span></div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {r.entry_date}
                    {' · '}{r.entry_type === 'extra_day' ? 'Extra day (paid at day rate)' : `${r.hours}h logged (unpaid)`}
                  </div>
                  {r.notes && <div className="text-[11px] text-gray-600 mt-1 italic">"{r.notes}"</div>}
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  r.entry_type === 'extra_day' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
                }`}>
                  {r.entry_type === 'extra_day' ? 'Paid' : 'Unpaid'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PF/ESI CONFIG
═══════════════════════════════════════════════════════════════════════ */

const CONFIG_LABELS = {
  PF_EMPLOYEE_PERCENT: 'PF — employee contribution (%)',
  PF_EMPLOYER_EPF_PERCENT: 'PF — employer EPF share (%)',
  PF_EMPLOYER_EPS_PERCENT: 'PF — employer EPS share (%)',
  PF_WAGE_CEILING: 'PF wage ceiling (₹)',
  ESI_EMPLOYEE_PERCENT: 'ESI — employee contribution (%)',
  ESI_EMPLOYER_PERCENT: 'ESI — employer contribution (%)',
  ESI_GROSS_CEILING: 'ESI gross ceiling (₹)',
  STANDARD_SHIFT_MINUTES: 'Standard shift length (minutes)',
};

function Config({ onError, onSuccess }) {
  const [config, setConfig] = useState({});
  const [form, setForm] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch('/salary/config');
      setConfig(data || {});
      setForm(data || {});
    } catch (err) {
      onError(err, 'Failed to load payroll config.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changed = Object.keys(form).some((k) => String(form[k]) !== String(config[k]));

  const save = async (e) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const diff = {};
      for (const k of Object.keys(form)) {
        if (String(form[k]) !== String(config[k])) diff[k] = form[k];
      }
      await apiFetch('/salary/config', { method: 'PATCH', body: JSON.stringify(diff) });
      onSuccess('Payroll configuration updated. New calculations will use these values.');
      await load();
    } catch (err) {
      onError(err, 'Failed to save the configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-3 text-[11px] text-amber-800">
        These constants drive every payslip calculation — changing one affects the next time a run is calculated, not runs already locked.
      </div>

      <form onSubmit={save} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-4">
        {isLoading ? (
          <div className="text-center text-xs text-gray-400 py-8">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(CONFIG_LABELS).map((key) => (
              <div key={key} className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{CONFIG_LABELS[key]}</label>
                <input
                  type="number"
                  step="0.01"
                  value={form[key] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
                />
              </div>
            ))}
          </div>
        )}
        <button
          type="submit"
          disabled={isSaving || !changed}
          className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
