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
  const [isGenerating, setIsGenerating] = useState(false);

  const [genMonth, setGenMonth] = useState(now.getMonth() + 1);
  const [genYear, setGenYear] = useState(now.getFullYear());
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

  const handleGeneratePayroll = async (e) => {
    e.preventDefault();
    try {
      setIsGenerating(true);
      const res = await apiFetch('/salary/payroll-runs/generate', {
        method: 'POST',
        body: JSON.stringify({ period_month: Number(genMonth), period_year: Number(genYear) }),
      });
      onSuccess(`Payroll generated for ${MONTH_NAMES[genMonth - 1]} ${genYear}: ${res.calcResult?.calculated || 0} payslip(s) calculated based on attendance & basic salary.`);
      await load();
      if (res.run?.id) {
        setSelectedRunId(res.run.id);
      }
    } catch (err) {
      onError(err, 'Failed to generate payroll for selected month.');
    } finally {
      setIsGenerating(false);
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
    <div className="space-y-6">
      {/* Quick Month Payroll Generator Card */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Payroll Engine</span>
            <h2 className="text-base font-extrabold text-white mt-0.5">Generate Monthly Salary &amp; Payslips</h2>
            <p className="text-xs text-blue-200 mt-1 max-w-xl">
              Calculates gross earnings, attendance-based Loss of Pay (LOP), late buffer deductions, fines, and statutory PF/ESI for every active staff member.
            </p>
          </div>

          <form onSubmit={handleGeneratePayroll} className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md p-2.5 rounded-xl border border-white/20">
            <div className="space-y-0.5">
              <label className="text-[9px] font-bold text-blue-200 uppercase block">Select Month</label>
              <select
                value={genMonth}
                onChange={(e) => setGenMonth(e.target.value)}
                className="px-2.5 py-1.5 bg-white text-gray-900 rounded-lg text-xs font-bold shadow-xs cursor-pointer border border-gray-200"
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-0.5">
              <label className="text-[9px] font-bold text-blue-200 uppercase block">Year</label>
              <input
                type="number"
                value={genYear}
                onChange={(e) => setGenYear(e.target.value)}
                className="w-20 px-2.5 py-1.5 bg-white text-gray-900 rounded-lg text-xs font-bold shadow-xs border border-gray-200"
              />
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="mt-3.5 sm:mt-0 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold px-4 py-2 rounded-lg shadow-md transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 self-end"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  Calculating…
                </>
              ) : (
                <>⚡ Generate &amp; Calculate Payroll</>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Payroll Run History List */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <div>
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Payroll Run History</h2>
            <span className="text-[11px] text-gray-500 font-semibold">{meta.total} Total Monthly Runs on Record</span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading payroll runs…</div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">
            No payroll runs yet. Select a month above and click <strong>Generate &amp; Calculate Payroll</strong>.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {runs.map((r) => (
              <div key={r.id} className="p-4 hover:bg-gray-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm border border-blue-200">
                    📅
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-gray-900">
                      {MONTH_NAMES[r.period_month - 1]} {r.period_year}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      <span className="font-semibold text-gray-700">{r.item_count} payslips calculated</span> · total net payable: <strong className="text-emerald-700">{money(r.total_net)}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${statusStyle[r.status] || ''}`}>
                    {r.status}
                  </span>
                  <button
                    onClick={() => setSelectedRunId(r.id)}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-blue-200"
                  >
                    Open Details &amp; Payslips →
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
  const [itemSearch, setItemSearch] = useState('');
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
      const { data, meta: m } = await apiFetch(`/salary/payroll-runs/${runId}/items?page=${page}&limit=100`, { withMeta: true });
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

  const exportExcel = async () => {
    try {
      setBusy(true);
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const res = await fetch(`${API_URL}/salary/payroll-runs/${runId}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        let errMsg = 'Failed to export payroll';
        try {
          const json = await res.json();
          errMsg = json.message || errMsg;
        } catch {
          /* ignore */
        }
        throw new Error(errMsg);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payroll_${MONTH_NAMES[run.period_month - 1]}_${run.period_year}_Run${runId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      onSuccess('Payroll exported to Excel spreadsheet successfully (overtime excluded).');
    } catch (err) {
      onError(err, 'Failed to export payroll Excel file.');
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

  const filteredItems = itemSearch
    ? items.filter(
        (it) =>
          (it.full_name || '').toLowerCase().includes(itemSearch.toLowerCase()) ||
          (it.employee_code || '').toLowerCase().includes(itemSearch.toLowerCase()) ||
          (it.department_name || '').toLowerCase().includes(itemSearch.toLowerCase())
      )
    : items;

  // Compute Run Summaries
  const totalGross = items.reduce((sum, it) => sum + (Number(it.gross_pay) || 0), 0);
  const totalLop = items.reduce((sum, it) => sum + (Number(it.lop_amount) || 0), 0);
  const totalLateDeduction = items.reduce((sum, it) => sum + (Number(it.buffer_late_deduction) || 0), 0);
  const totalFines = items.reduce((sum, it) => sum + (Number(it.fines_amount) || 0), 0);
  const totalNet = items.reduce((sum, it) => sum + (Number(it.net_pay) || 0), 0);

  const totalPages = meta.pages || 1;

  return (
    <div className="space-y-5">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 transition-colors cursor-pointer text-gray-700 shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-gray-900">
                {MONTH_NAMES[run.period_month - 1]} {run.period_year} Payroll
              </h2>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase ${
                  run.status === 'locked' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {run.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Calculated on biometric attendance, buffer pools, and base salary structures.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={exportExcel}
            disabled={busy || items.length === 0}
            className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5"
            title="Download payroll spreadsheet (.xlsx) without overtime compensations"
          >
            📥 Export Excel
          </button>
          <button
            onClick={calculate}
            disabled={busy || run.status !== 'draft'}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {busy ? 'Recalculating…' : '⚡ Recalculate Payroll'}
          </button>
          <button
            onClick={lock}
            disabled={busy || run.status !== 'draft'}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            🔒 Lock &amp; Confirm Run
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Staff Calculated</span>
          <span className="text-xl font-extrabold text-gray-900 mt-1 block">{items.length}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Gross Salary</span>
          <span className="text-base font-extrabold text-blue-900 mt-1 block">{money(totalGross)}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">LOP Absences</span>
          <span className="text-base font-extrabold text-orange-700 mt-1 block">-{money(totalLop)}</span>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Late Deductions</span>
          <span className="text-base font-extrabold text-amber-700 mt-1 block">-{money(totalLateDeduction)}</span>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Net Payable</span>
          <span className="text-base font-extrabold text-emerald-900 mt-1 block">{money(totalNet)}</span>
        </div>
      </div>

      {/* Main Payslips Table Card */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden space-y-0">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            Employee Payslips ({filteredItems.length} Records)
          </h3>
          <div>
            <input
              type="text"
              placeholder="Search staff / code…"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs bg-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-gray-400">Loading payroll items…</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500 space-y-2">
            <div>No payslips found matching your filters.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[950px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5">Employee</th>
                  <th className="text-center px-3 py-2.5">Present</th>
                  <th className="text-center px-3 py-2.5">LOP Days</th>
                  <th className="text-center px-3 py-2.5">Gross Pay</th>
                  <th className="text-center px-3 py-2.5">LOP Deduction</th>
                  <th className="text-center px-3 py-2.5">Late Deduction</th>
                  <th className="text-center px-3 py-2.5">PF (Emp)</th>
                  <th className="text-center px-3 py-2.5">ESI (Emp)</th>
                  <th className="text-center px-3 py-2.5">Fines</th>
                  <th className="text-center px-3 py-2.5">Net Payable</th>
                  <th className="text-center px-3 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredItems.map((it) => (
                  <tr key={it.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-gray-900">{it.full_name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{it.employee_code} · {it.department_name || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-gray-800">{it.days_present}</td>
                    <td className={`px-3 py-2.5 text-center font-semibold ${Number(it.days_lop) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                      {it.days_lop}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-semibold text-gray-900">{money(it.gross_pay)}</td>
                    <td className={`px-3 py-2.5 text-center font-mono ${Number(it.lop_amount) > 0 ? 'text-orange-600 font-bold' : 'text-gray-400'}`}>
                      {Number(it.lop_amount) > 0 ? `-${money(it.lop_amount)}` : '—'}
                    </td>
                    <td className={`px-3 py-2.5 text-center font-mono ${Number(it.buffer_late_deduction) > 0 ? 'text-amber-700 font-bold' : 'text-gray-400'}`}>
                      {Number(it.buffer_late_deduction) > 0 ? `-${money(it.buffer_late_deduction)}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono text-gray-500">{money(it.pf_employee_amount)}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-gray-500">{money(it.esi_employee_amount)}</td>
                    <td className={`px-3 py-2.5 text-center font-mono ${Number(it.fines_amount) > 0 ? 'text-rose-600 font-bold' : 'text-gray-400'}`}>
                      {Number(it.fines_amount) > 0 ? `-${money(it.fines_amount)}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-extrabold text-emerald-800 bg-emerald-50/40">
                      {money(it.net_pay)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => openPayslip(it.employee_id)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded transition-colors cursor-pointer"
                      >
                        🧾 View Payslip
                      </button>
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
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 transition-colors cursor-pointer text-gray-700 shadow-xs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Salary Payslip — {item.full_name} ({item.employee_code})
            </h2>
            <p className="text-xs text-gray-500">
              Period: {MONTH_NAMES[run.period_month - 1]} {run.period_year}
            </p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>🖨️ Print Official Payslip</span>
        </button>
      </div>

      {/* Printable Payslip Card */}
      <div className="bg-white rounded-2xl border border-gray-300 shadow-md p-8 max-w-2xl mx-auto print:border-none print:shadow-none print:p-2 text-gray-800">
        
        {/* Hospital Header */}
        <div className="text-center pb-4 border-b-2 border-blue-900 space-y-1">
          <h1 className="text-xl font-extrabold text-blue-950 uppercase tracking-wide">NEHA HOSPITAL</h1>
          <p className="text-[11px] text-gray-600 leading-snug">
            47, South Park Street (Kambar Veethi, Ganga Nagar, near Dr. Ravindran Hospital and opposite Palaniammal Girls Higher Secondary School),<br />
            Kutchery Medu, Gobichettipalayam, Tamil Nadu - 638452 | 24 Hours Emergency Service
          </p>
          <div className="inline-block bg-blue-50 text-blue-900 font-extrabold text-xs px-4 py-1 rounded-full uppercase tracking-wider mt-1 border border-blue-200">
            Salary Payslip for {MONTH_NAMES[run.period_month - 1]} {run.period_year}
          </div>
        </div>

        {/* Employee Info Box */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2.5 gap-x-4 py-4 border-b border-gray-200 text-xs">
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase">Employee Name</span>
            <div className="font-extrabold text-gray-900 text-sm">{item.full_name}</div>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase">Employee Code</span>
            <div className="font-mono font-bold text-blue-800">{item.employee_code}</div>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase">Department</span>
            <div className="font-semibold text-gray-800">{item.department_name || 'General'}</div>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase">Designation / Role</span>
            <div className="font-semibold text-gray-800">{item.role_name || 'Staff'}</div>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase">Daily Day Rate</span>
            <div className="font-mono font-bold text-gray-900">{money(day_rate)}</div>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase">Bank Account / UAN</span>
            <div className="font-mono text-gray-700">{item.bank_account_no || item.uan_number || '—'}</div>
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="py-3 border-b border-gray-200 bg-gray-50/60 px-3 rounded-xl my-3 text-xs">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Monthly Attendance Record</div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-white p-2 rounded-lg border border-gray-200">
              <span className="text-[10px] text-gray-400 block">Days Present</span>
              <span className="font-extrabold text-emerald-800 text-sm">{item.days_present}</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-gray-200">
              <span className="text-[10px] text-gray-400 block">Paid Leaves</span>
              <span className="font-bold text-blue-800 text-sm">{item.days_paid_leave}</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-gray-200">
              <span className="text-[10px] text-gray-400 block">LOP Absences</span>
              <span className={`font-bold text-sm ${Number(item.days_lop) > 0 ? 'text-orange-600' : 'text-gray-600'}`}>{item.days_lop}</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-gray-200">
              <span className="text-[10px] text-gray-400 block">Shifts Worked</span>
              <span className="font-bold text-gray-800 text-sm">{item.shifts_worked}</span>
            </div>
          </div>
        </div>

        {/* Breakdown: Earnings & Deductions Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2 border-b border-gray-200 text-xs">
          {/* Earnings */}
          <div className="space-y-2 pr-2 sm:border-r border-gray-200">
            <div className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">Earnings (A)</div>
            <PayslipRow label="Base Monthly Salary" value={money(item.base_salary_component)} />
            <PayslipRow label="Night Shift Allowance" value={money(item.night_shift_component)} />
            <PayslipRow label="Paid Extra Days Overtime" value={money(item.overtime_amount)} />
            <div className="pt-2 border-t border-gray-200">
              <PayslipRow label="Gross Earnings" value={money(item.gross_pay)} strong />
            </div>
          </div>

          {/* Deductions */}
          <div className="space-y-2 pl-0 sm:pl-2">
            <div className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider">Deductions (B)</div>
            <PayslipRow label="Loss of Pay (LOP)" value={money(item.lop_amount)} />
            <PayslipRow label="Late Attendance Buffer" value={money(item.buffer_late_deduction)} />
            <PayslipRow label="Disciplinary Fines" value={money(item.fines_amount)} />
            <PayslipRow label="Employee PF (12%)" value={money(item.pf_employee_amount)} />
            <PayslipRow label="Employee ESI (0.75%)" value={money(item.esi_employee_amount)} />
            <div className="pt-2 border-t border-gray-200">
              <PayslipRow
                label="Total Deductions"
                value={money(
                  (Number(item.lop_amount) || 0) +
                  (Number(item.buffer_late_deduction) || 0) +
                  (Number(item.fines_amount) || 0) +
                  (Number(item.pf_employee_amount) || 0) +
                  (Number(item.esi_employee_amount) || 0)
                )}
                strong
              />
            </div>
          </div>
        </div>

        {/* Employer Statutory Contributions */}
        <div className="py-2.5 border-b border-gray-200 text-xs">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Employer Contribution (Non-Deductible)</div>
          <div className="grid grid-cols-2 gap-4">
            <PayslipRow label="Employer PF (12%)" value={money(item.pf_employer_amount)} />
            <PayslipRow label="Employer ESI (3.25%)" value={money(item.esi_employer_amount)} />
          </div>
        </div>

        {/* Net Salary Payable */}
        <div className="py-4 flex items-center justify-between bg-emerald-50/80 px-4 rounded-xl my-4 border border-emerald-200">
          <div>
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Net Take-Home Pay (A - B)</span>
            <span className="text-xs text-gray-600 font-medium">Disbursed to registered bank account</span>
          </div>
          <span className="text-xl font-extrabold text-emerald-900">{money(item.net_pay)}</span>
        </div>

        {/* Signatures */}
        <div className="pt-8 grid grid-cols-2 text-center text-xs text-gray-500">
          <div>
            <div className="border-t border-gray-300 w-36 mx-auto pt-1 font-semibold text-gray-700">Employee Signature</div>
          </div>
          <div>
            <div className="border-t border-gray-300 w-36 mx-auto pt-1 font-semibold text-gray-700">Authorized Signatory</div>
          </div>
        </div>
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
