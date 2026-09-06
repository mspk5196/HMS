import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import PageHeader from '../../components/PageHeader';
import {
  BoltIcon,
  CalendarIcon,
  DownloadIcon,
  SyncIcon,
  LockIcon,
  ReceiptIcon,
  PrintIcon,
  ChartBarIcon,
  DocumentTextIcon,
  LandmarkIcon,
  HospitalIcon,
  XIcon,
  CurrencyRupeeIcon,
} from '../../components/Icons';

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
      <PageHeader
        category="Staff & Salary"
        title="Payroll"
        subtitle="Monthly runs, per-employee payslips, overtime, and the PF/ESI constants that drive them."
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { value: 'runs', label: 'Payroll Runs' },
          { value: 'calc', label: 'Salary & PF/ESI Calculation' },
          { value: 'overtime', label: 'Overtime' },
          { value: 'config', label: 'PF/ESI Config' },
        ]}
      />

      {tab === 'runs' && <Runs onError={fail} onSuccess={flash} />}
      {tab === 'calc' && <SalaryPfEsiCalculation onError={fail} onSuccess={flash} />}
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
                <>
                  <BoltIcon className="w-4 h-4 text-white" />
                  <span>Generate &amp; Calculate Payroll</span>
                </>
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
                    <CalendarIcon className="w-5 h-5 text-blue-700" />
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
  const [showExportModal, setShowExportModal] = useState(false);

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
            onClick={() => setShowExportModal(true)}
            disabled={busy || items.length === 0}
            className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5"
            title="Download payroll spreadsheet (.xlsx) with custom filters"
          >
            <DownloadIcon className="w-4 h-4 text-white" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={calculate}
            disabled={busy || run.status !== 'draft'}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {busy ? 'Recalculating…' : (
              <>
                <SyncIcon className="w-4 h-4 text-white" />
                <span>Recalculate Payroll</span>
              </>
            )}
          </button>
          <button
            onClick={lock}
            disabled={busy || run.status !== 'draft'}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <LockIcon className="w-4 h-4 text-white" />
            <span>Lock &amp; Confirm Run</span>
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
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900">{it.full_name}</span>
                        {(it.payment_mode || 'account') === 'cash' ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Cash</span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-800 border border-blue-200">Bank</span>
                        )}
                      </div>
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
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <ReceiptIcon className="w-3.5 h-3.5 text-blue-600" />
                        <span>View Payslip</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showExportModal && run && (
        <PayrollExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          runId={run.id}
          periodLabel={`${MONTH_NAMES[run.period_month - 1]} ${run.period_year}`}
          items={items}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PAYSLIP VIEW — EXECUTIVE PRINTABLE HOSPITAL GRADE PAYSLIP
═══════════════════════════════════════════════════════════════════════ */

const numberToWordsIndian = (num) => {
  const n = Math.round(Number(num) || 0);
  if (n === 0) return 'Rupees Zero Only';
  if (n < 0) return 'Negative ' + numberToWordsIndian(Math.abs(n));

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanOneThousand = (val) => {
    let str = '';
    if (val >= 100) {
      str += a[Math.floor(val / 100)] + ' Hundred ';
      val %= 100;
    }
    if (val >= 20) {
      str += b[Math.floor(val / 10)] + ' ';
      val %= 10;
    }
    if (val > 0) {
      str += a[val] + ' ';
    }
    return str.trim();
  };

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const remainder = n % 1000;

  let result = '';
  if (crore > 0) result += convertLessThanOneThousand(crore) + ' Crore ';
  if (lakh > 0) result += convertLessThanOneThousand(lakh) + ' Lakh ';
  if (thousand > 0) result += convertLessThanOneThousand(thousand) + ' Thousand ';
  if (remainder > 0) result += convertLessThanOneThousand(remainder);

  return 'Rupees ' + result.trim() + ' Only';
};

function PayslipView({ payslip, onBack }) {
  const { run, item, day_rate } = payslip;

  const totalDaysInMonth = new Date(run.period_year, run.period_month, 0).getDate();
  const periodMonthName = MONTH_NAMES[run.period_month - 1];
  const periodStart = `01 ${periodMonthName.slice(0, 3)} ${run.period_year}`;
  const periodEnd = `${totalDaysInMonth} ${periodMonthName.slice(0, 3)} ${run.period_year}`;

  const basicDa = Number(item.earned_basic) || Math.round(Number(item.base_salary_component || 0) * 0.7);
  const hra = Number(item.earned_hra) || (Number(item.base_salary_component || 0) - basicDa);
  const nightAllowance = Number(item.night_shift_component) || 0;
  const overtimeAmount = Number(item.overtime_amount) || 0;

  const lopAmount = Number(item.lop_amount) || 0;
  const bufferLate = Number(item.buffer_late_deduction) || 0;
  const finesAmount = Number(item.fines_amount) || 0;
  const pfEmployee = Number(item.pf_employee_amount) || 0;
  const esiEmployee = Number(item.esi_employee_amount) || 0;

  const totalDeductions = lopAmount + bufferLate + finesAmount + pfEmployee + esiEmployee;
  const grossPay = Number(item.gross_pay) || (basicDa + hra + nightAllowance + overtimeAmount);
  const netPay = Number(item.net_pay) || (grossPay - totalDeductions);

  const pfEmployer = Number(item.pf_employer_amount) || 0;
  const pfEps = Number(item.pf_employer_eps_amount) || Math.round(Number(item.pf_wage || 0) * 0.0833);
  const pfEpf = Number(item.pf_employer_epf_amount) || (pfEmployer - pfEps);
  const esiEmployer = Number(item.esi_employer_amount) || 0;
  const totalCtc = grossPay + pfEmployer + esiEmployer;

  const payableDays = Math.max(0, totalDaysInMonth - (Number(item.days_lop) || 0));

  const formatJoinDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(d).slice(0, 10);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Print Specific Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          body {
            background: #ffffff !important;
          }
          body * {
            visibility: hidden;
          }
          #printable-payslip, #printable-payslip * {
            visibility: visible;
          }
          #printable-payslip {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen Toolbar (Hidden on Print) */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden bg-white p-4 rounded-xl border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer text-gray-700 shadow-2xs flex items-center gap-1.5 text-xs font-semibold"
            title="Return to payroll run details"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span>Back to Payroll</span>
          </button>
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>Salary Payslip:</span>
              <span className="text-[#1e40af]">{item.full_name}</span>
              <span className="font-mono text-xs text-gray-500 font-normal">({item.employee_code})</span>
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Period: {periodMonthName} {run.period_year} · Net Pay: <strong className="text-emerald-700 font-bold">{money(netPay)}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <PrintIcon className="w-4 h-4 text-white" />
            <span>Print Official Payslip (A4)</span>
          </button>
        </div>
      </div>

      {/* Printable Official Payslip Sheet */}
      <div id="printable-payslip" className="printable-payslip bg-white rounded-xl border border-gray-200 shadow-sm p-8 sm:p-10 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0 print:m-0 text-gray-900 font-sans">
        
        {/* Hospital Header / Letterhead */}
        <div className="pb-5 border-b-2 border-[#1e3a8a] flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            {/* Hospital Crest Emblem */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1e40af] to-[#0f172a] text-white flex items-center justify-center font-extrabold text-xl shadow-md border-2 border-blue-200 shrink-0 print:border-[#1e40af]">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                <circle cx="12" cy="12" r="9" strokeWidth="1.5" strokeDasharray="2 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#1e3a8a] tracking-tight uppercase leading-none">
                NEHA HOSPITAL
              </h1>
              {/* <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                Advanced Multispeciality Healthcare &amp; Research Center
              </p> */}
              <p className="text-[10px] text-gray-600 leading-tight mt-1 max-w-lg">
                47, South Park Street, Kutchery Medu, Gobichettipalayam, Erode District, Tamil Nadu – 638452
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5 font-medium">
                Reg No: TN/ERD/HOSP-2018/492 · Phone: +91 4285 222333 · Emergency 24x7
              </p>
            </div>
          </div>

          <div className="text-right flex flex-col items-center sm:items-end justify-center">
            <span className="inline-block bg-[#1e40af] text-white font-extrabold text-[11px] px-3.5 py-1 rounded-md uppercase tracking-wider print:bg-[#1e40af] print:text-white">
              SALARY PAYSLIP
            </span>
            <span className="text-xs font-bold text-gray-800 mt-1">
              {periodMonthName} {run.period_year}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              Pay Period: {periodStart} – {periodEnd}
            </span>
          </div>
        </div>

        {/* Employee Details Master Box */}
        <div className="my-5 border border-gray-200 rounded-lg overflow-hidden bg-gray-50/40 text-xs">
          <div className="bg-gray-100/80 px-3.5 py-1.5 border-b border-gray-200 font-extrabold text-[10px] text-gray-700 uppercase tracking-wider flex items-center justify-between">
            <span>Employee Identification &amp; Statutory Particulars</span>
            <span className="font-mono text-gray-500 font-semibold lowercase">status: {run.status}</span>
          </div>

          <div className="p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-y-2.5 gap-x-4">
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Employee Name</span>
              <span className="font-extrabold text-gray-900 text-[13px]">{item.full_name}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Employee ID</span>
              <span className="font-mono font-bold text-[#1e40af] text-[13px]">{item.employee_code}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Department</span>
              <span className="font-semibold text-gray-800">{item.department_name || 'General'}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Designation / Role</span>
              <span className="font-semibold text-gray-800">{item.role_name || 'Staff'}</span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Date of Joining</span>
              <span className="font-medium text-gray-700">{formatJoinDate(item.joining_date)}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Shift Model</span>
              <span className="font-semibold text-gray-700">
                {item.shift_category === 'day_and_night'
                  ? 'Day & Night Shift'
                  : item.shift_category === 'night'
                  ? 'Fixed Night Shift'
                  : 'Fixed Day Shift'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Bank Account No</span>
              <span className="font-mono font-bold text-gray-900">
                {item.bank_account_no ? item.bank_account_no : '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Bank Name &amp; IFSC</span>
              <span className="font-medium text-gray-700">
                {item.bank_name || 'Indian Bank'}{item.bank_ifsc ? ` (${item.bank_ifsc})` : ''}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">EPF / UAN Number</span>
              <span className="font-mono font-bold text-gray-800">{item.uan_number || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">ESIC IP Number</span>
              <span className="font-mono font-bold text-gray-800">{item.esi_number || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Disbursement Mode</span>
              <span className="font-bold text-emerald-800 uppercase tracking-wide text-[11px]">
                {item.payment_mode === 'cash' ? '💵 Cash Payment' : '🏦 Bank Transfer'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase block">Daily Calculation Rate</span>
              <span className="font-mono font-bold text-gray-900">{money(day_rate)} / day</span>
            </div>
          </div>
        </div>

        {/* Monthly Attendance Ribbon */}
        <div className="my-4 border border-blue-200/80 rounded-lg overflow-hidden bg-blue-50/30 text-xs">
          <div className="bg-blue-100/60 px-3.5 py-1 border-b border-blue-200 text-[10px] font-extrabold text-blue-900 uppercase tracking-wider flex items-center justify-between">
            <span>Attendance &amp; Working Days Summary</span>
            <span>Total Month Days: {totalDaysInMonth}</span>
          </div>
          <div className="p-2.5 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
            <div className="bg-white p-2 rounded-md border border-gray-200">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Days Present</span>
              <span className="font-extrabold text-emerald-700 text-sm">{item.days_present}</span>
            </div>
            <div className="bg-white p-2 rounded-md border border-gray-200">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Paid Leave</span>
              <span className="font-extrabold text-blue-700 text-sm">{item.days_paid_leave}</span>
            </div>
            <div className="bg-white p-2 rounded-md border border-gray-200">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Payable Days</span>
              <span className="font-extrabold text-gray-900 text-sm">{payableDays}</span>
            </div>
            <div className="bg-white p-2 rounded-md border border-gray-200">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">LOP Absences</span>
              <span className={`font-extrabold text-sm ${lopAmount > 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                {item.days_lop}
              </span>
            </div>
            <div className="bg-white p-2 rounded-md border border-gray-200">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Shifts Worked</span>
              <span className="font-extrabold text-indigo-700 text-sm">{item.shifts_worked}</span>
            </div>
            <div className="bg-white p-2 rounded-md border border-gray-200">
              <span className="text-[10px] text-gray-500 block uppercase font-bold">Overtime Days</span>
              <span className="font-extrabold text-gray-800 text-sm">
                {item.overtime_days || (overtimeAmount > 0 ? Math.round(overtimeAmount / (day_rate || 1)) : 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Dual Column Ledger: Earnings vs Deductions */}
        <div className="my-5 border border-gray-300 rounded-lg overflow-hidden text-xs">
          <div className="grid grid-cols-2 divide-x divide-gray-300 bg-gray-100 font-extrabold text-[11px] uppercase tracking-wider text-gray-800 border-b border-gray-300">
            <div className="px-4 py-2 flex items-center justify-between">
              <span>Earnings (Components)</span>
              <span>Amount (₹)</span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between">
              <span>Deductions</span>
              <span>Amount (₹)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-gray-300">
            {/* Earnings Column */}
            <div className="p-3.5 space-y-2 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-gray-800">
                  <span>Base Fixed Salary</span>
                  <span className="font-mono font-semibold">{money(item.base_salary_component)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-700 pl-3 border-l-2 border-blue-300 text-[11px]">
                  <span>• Basic + DA (70%)</span>
                  <span className="font-mono">{money(basicDa)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-700 pl-3 border-l-2 border-blue-300 text-[11px]">
                  <span>• House Rent Allowance (HRA 30%)</span>
                  <span className="font-mono">{money(hra)}</span>
                </div>

                {nightAllowance > 0 && (
                  <div className="flex items-center justify-between text-indigo-900 font-medium">
                    <span>Night Shift Allowance</span>
                    <span className="font-mono">{money(nightAllowance)}</span>
                  </div>
                )}

                {overtimeAmount > 0 && (
                  <div className="flex items-center justify-between text-emerald-900 font-medium">
                    <span>Paid Extra Days / Overtime</span>
                    <span className="font-mono">{money(overtimeAmount)}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-200 mt-4 flex items-center justify-between font-black text-gray-900 text-xs">
                <span className="uppercase text-[#1e3a8a]">Total Gross Earnings (A)</span>
                <span className="font-mono text-sm text-[#1e3a8a]">{money(grossPay)}</span>
              </div>
            </div>

            {/* Deductions Column */}
            <div className="p-3.5 space-y-2 flex flex-col justify-between bg-rose-50/10">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-gray-800">
                  <div>
                    <span>Employee PF (EPF 12%)</span>
                    {Number(item.pf_wage) > 0 && (
                      <span className="text-[9px] text-gray-400 block font-mono">Wage: {money(item.pf_wage)}</span>
                    )}
                  </div>
                  <span className="font-mono font-semibold">{money(pfEmployee)}</span>
                </div>

                <div className="flex items-center justify-between text-gray-800">
                  <div>
                    <span>Employee ESI (ESIC 0.75%)</span>
                    {Number(item.esi_wage) > 0 && (
                      <span className="text-[9px] text-gray-400 block font-mono">Wage: {money(item.esi_wage)}</span>
                    )}
                  </div>
                  <span className="font-mono font-semibold">{money(esiEmployee)}</span>
                </div>

                {lopAmount > 0 && (
                  <div className="flex items-center justify-between text-rose-800">
                    <span>Loss of Pay Deduction ({item.days_lop} days)</span>
                    <span className="font-mono">{money(lopAmount)}</span>
                  </div>
                )}

                {bufferLate > 0 && (
                  <div className="flex items-center justify-between text-rose-800">
                    <span>Late Attendance Buffer Deduction</span>
                    <span className="font-mono">{money(bufferLate)}</span>
                  </div>
                )}

                {finesAmount > 0 && (
                  <div className="flex items-center justify-between text-rose-800">
                    <span>Salary Advance / Disciplinary Fine</span>
                    <span className="font-mono">{money(finesAmount)}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-200 mt-4 flex items-center justify-between font-black text-rose-900 text-xs">
                <span className="uppercase">Total Deductions (B)</span>
                <span className="font-mono text-sm text-rose-900">{money(totalDeductions)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Net Salary Payable Box */}
        <div className="my-5 border-2 border-emerald-600 rounded-xl p-4 bg-emerald-50/60 print:bg-emerald-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="text-[11px] font-black text-emerald-950 uppercase tracking-wider">
              NET SALARY PAYABLE (A – B)
            </div>
            <div className="font-bold text-gray-800 text-xs">
              {numberToWordsIndian(netPay)}
            </div>
            <div className="text-[10px] text-gray-500 font-medium">
              Disbursement Method: {item.payment_mode === 'cash' ? 'Cash Payment at Hospital Accounts' : `Account Transfer to ${item.bank_name || 'Bank'} (${item.bank_account_no || 'Registered A/C'})`}
            </div>
          </div>

          <div className="text-center sm:text-right shrink-0">
            <div className="text-2xl sm:text-3xl font-black text-emerald-900 tracking-tight font-mono">
              {money(netPay)}
            </div>
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest block mt-0.5">
              Net Take-Home Pay
            </span>
          </div>
        </div>

        {/* Employer Statutory Contributions Memo (Non-Deductible) */}
        <div className="my-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-[11px]">
          <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Employer Statutory Compliance Contributions (Non-Deductible from Salary)</span>
            <span className="font-mono font-bold text-gray-700">Total Monthly CTC: {money(totalCtc)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-600">
            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>Employer PF Contribution (12%):</span>
                <strong className="font-mono text-gray-900">{money(pfEmployer)}</strong>
              </div>
              <div className="text-[10px] text-gray-500 pl-2">
                <span>• EPS (Pension 8.33%): {money(pfEps)}</span> · <span>EPF (Provident 3.67%): {money(pfEpf)}</span>
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>Employer ESI Contribution (3.25%):</span>
                <strong className="font-mono text-gray-900">{money(esiEmployer)}</strong>
              </div>
              <div className="text-[10px] text-gray-500 pl-2">
                <span>• Total Combined ESI Remittance (4.0%): {money(esiEmployee + esiEmployer)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Official Signatures & Declaration */}
        <div className="pt-10 pb-4 grid grid-cols-3 text-center text-xs text-gray-600 border-t border-gray-200 mt-6">
          <div className="space-y-8">
            <div className="h-8"></div>
            <div className="border-t border-gray-400 w-36 mx-auto pt-1 font-bold text-gray-800 text-[11px]">
              Employee Signature
            </div>
          </div>

          <div className="space-y-8">
            <div className="h-8"></div>
            <div className="border-t border-gray-400 w-36 mx-auto pt-1 font-bold text-gray-800 text-[11px]">
              HR &amp; Payroll Officer
            </div>
          </div>

          <div className="space-y-8">
            <div className="h-8 flex items-center justify-center">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest border border-dashed border-gray-300 px-2 py-0.5 rounded">
                Hospital Seal
              </span>
            </div>
            <div className="border-t border-gray-400 w-44 mx-auto pt-1 font-bold text-[#1e3a8a] text-[11px]">
              Authorized Signatory<br />
              <span className="text-[9px] font-normal text-gray-500">For NEHA HOSPITALS</span>
            </div>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="pt-3 border-t border-gray-100 text-[9px] text-gray-400 text-center space-y-0.5 leading-tight">
          <p>This is a computer-generated salary payslip authenticated by Neha Hospital Management System.</p>
          <p>Confidential Document · Questions or discrepancies should be reported to the HR &amp; Accounts department within 7 business days.</p>
        </div>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SALARY & PF/ESI CALCULATION TAB
   Complete dynamic view based on EPF & ESI CALCULATION.xlsx and 06 STAFF ATTENDANCE JUNE-2026.xlsx
═══════════════════════════════════════════════════════════════════════ */

function SalaryPfEsiCalculation({ onError, onSuccess }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [subTab, setSubTab] = useState('statement'); // 'statement' | 'statutory'
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [data, setData] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: runs } = await apiFetch('/salary/payroll-runs?limit=50', { withMeta: true });
      const currentRun = (runs || []).find(
        (r) => Number(r.period_month) === Number(month) && Number(r.period_year) === Number(year)
      );

      if (currentRun) {
        const res = await apiFetch(`/salary/payroll-runs/${currentRun.id}/calculation-summary`);
        setData(res);
      } else {
        setData(null);
      }
    } catch (err) {
      onError(err, 'Failed to load calculation summary.');
    } finally {
      setIsLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const res = await apiFetch('/salary/payroll-runs/generate', {
        method: 'POST',
        body: JSON.stringify({ period_month: Number(month), period_year: Number(year) }),
      });
      onSuccess(`Payroll calculations generated for ${MONTH_NAMES[month - 1]} ${year}.`);
      await loadData();
    } catch (err) {
      onError(err, 'Failed to generate payroll calculation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!data?.run?.id) return;
    try {
      setIsExporting(true);
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const res = await fetch(`${API_URL}/salary/payroll-runs/${data.run.id}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to export Excel workbook');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payroll_Salary_and_EPF_ESI_${MONTH_NAMES[month - 1]}_${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      onSuccess('Multi-sheet Salary & EPF/ESI Excel workbook exported successfully.');
    } catch (err) {
      onError(err, 'Failed to export Excel workbook.');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredItems = (data?.items || []).filter((it) => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (it.full_name || '').toLowerCase().includes(s) ||
      (it.employee_code || '').toLowerCase().includes(s) ||
      (it.uan_number || '').toLowerCase().includes(s) ||
      (it.esi_number || '').toLowerCase().includes(s) ||
      (it.department_name || '').toLowerCase().includes(s)
    );
  });

  const summary = data?.summary;
  const daysInMo = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return (
    <div className="space-y-5">
      {/* Top Header & Controls Card */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4 text-blue-600" />
              <span>Salary &amp; PF / ESI Calculation Statement</span>
              {data?.run && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                  data.run.status === 'locked' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {data.run.status}
                </span>
              )}
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Live breakdown of monthly gross, attendance LOP, statutory 70% Basic/DA, PF (12%), and ESI (0.75% / 3.25%).
            </p>
          </div>

          {/* Month/Year and Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-gray-50 text-gray-900 rounded-lg text-xs font-bold border border-gray-200 cursor-pointer"
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>

            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-20 px-2.5 py-1.5 bg-gray-50 text-gray-900 rounded-lg text-xs font-bold border border-gray-200"
            />

            {!data?.run ? (
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isGenerating ? 'Calculating…' : (
                  <>
                    <BoltIcon className="w-4 h-4 text-white" />
                    <span>Calculate for Month</span>
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || data.run.status !== 'draft'}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  title="Recalculate with latest biometric punches and settings"
                >
                  {isGenerating ? 'Recalculating…' : (
                    <>
                      <SyncIcon className="w-3.5 h-3.5" />
                      <span>Recalculate</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowExportModal(true)}
                  disabled={isExporting}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  title="Export multi-sheet Excel matching hospital statements with custom filters"
                >
                  <DownloadIcon className="w-4 h-4 text-white" />
                  <span>Export Multi-Sheet Excel</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sub-view switcher and Search */}
        <div className="pt-2 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setSubTab('statement')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                subTab === 'statement' ? 'bg-white text-blue-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <DocumentTextIcon className="w-3.5 h-3.5" />
              <span>Salary Statement</span>
            </button>
            <button
              onClick={() => setSubTab('statutory')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                subTab === 'statutory' ? 'bg-white text-blue-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LandmarkIcon className="w-3.5 h-3.5" />
              <span>EPF &amp; ESI Statutory Calculation</span>
            </button>
          </div>

          <input
            type="text"
            placeholder="Search staff, code, UAN, ESI…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1 border border-gray-200 rounded-lg text-xs bg-gray-50 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-64"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-xs text-gray-400">
          Loading calculation data…
        </div>
      ) : !data?.run ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-xs text-gray-500 space-y-3">
          <div className="flex justify-center">
            <CalendarIcon className="w-10 h-10 text-gray-300" />
          </div>
          <div className="font-bold text-gray-800">No Payroll Run on Record for {MONTH_NAMES[month - 1]} {year}</div>
          <p className="text-gray-500 text-[11px] max-w-md mx-auto">
            Click the button below to generate the monthly calculation and payslips for all active staff based on attendance, PF/ESI ceilings, and salaries.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            {isGenerating ? 'Calculating…' : (
              <>
                <BoltIcon className="w-4 h-4 text-white" />
                <span>Generate {MONTH_NAMES[month - 1]} {year} Payroll</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <>
          {/* Statutory Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Staff Calculated</span>
              <span className="text-lg font-extrabold text-gray-900 mt-1 block">{summary?.totalStaff || 0} Members</span>
              <span className="text-[10px] text-gray-400">{summary?.pf?.enrolledCount || 0} PF · {summary?.esi?.coveredCount || 0} ESI</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Gross Wages</span>
              <span className="text-base font-extrabold text-blue-900 mt-1 block">{money(summary?.totalGross)}</span>
              <span className="text-[10px] text-gray-400">Earned: {money(summary?.totalEarnedGross)}</span>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl shadow-xs">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">EPFO Total Remittance</span>
              <span className="text-base font-extrabold text-blue-950 mt-1 block">{money(summary?.pf?.totalEpfoChallan)}</span>
              <span className="text-[10px] text-blue-700 font-medium">Emp {money(summary?.pf?.totalPfEmployee)} + Emplr {money(summary?.pf?.totalPfEmployer)}</span>
            </div>

            <div className="bg-teal-50/70 border border-teal-200 p-3.5 rounded-xl shadow-xs">
              <span className="text-[10px] font-bold text-teal-800 uppercase tracking-wider block">ESI Total Remittance</span>
              <span className="text-base font-extrabold text-teal-950 mt-1 block">{money(summary?.esi?.totalEsiChallan)}</span>
              <span className="text-[10px] text-teal-700 font-medium">Emp {money(summary?.esi?.totalEsiEmployee)} + Emplr {money(summary?.esi?.totalEsiEmployer)}</span>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl shadow-xs col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Net Payable</span>
              <span className="text-base font-extrabold text-emerald-950 mt-1 block">{money(summary?.totalNet)}</span>
              <span className="text-[10px] text-emerald-700 font-medium">Bank disbursement total</span>
            </div>
          </div>

          {/* Sub-view 1: Salary Statement Table */}
          {subTab === 'statement' && (
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Staff Salary Statement ({filteredItems.length} Records) · {daysInMo} Days in Month
                  </h3>
                  <span className="text-[10px] text-gray-500 font-medium">
                    Basic+DA (70%), HRA (30%), Loss of Pay (LOP), Overtime, Statutory PF &amp; ESI
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1250px]">
                  <thead>
                    <tr className="bg-gray-100/70 border-b border-gray-200 text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                      <th className="text-center px-2 py-2.5 w-10">S.No</th>
                      <th className="text-left px-3 py-2.5">Staff &amp; Dept</th>
                      <th className="text-right px-2.5 py-2.5">Fixed Gross</th>
                      <th className="text-right px-2.5 py-2.5">Basic (70%)</th>
                      <th className="text-right px-2.5 py-2.5">HRA (30%)</th>
                      <th className="text-center px-2 py-2.5">Wkd</th>
                      <th className="text-center px-2 py-2.5">LOP</th>
                      <th className="text-right px-2 py-2.5">LOP Amt</th>
                      <th className="text-right px-2.5 py-2.5">Earned Gross</th>
                      <th className="text-right px-2 py-2.5">Fines</th>
                      <th className="text-right px-2.5 py-2.5 bg-blue-50/50">PF Wage</th>
                      <th className="text-right px-2.5 py-2.5 bg-blue-50/50 text-blue-900">PF (12%)</th>
                      <th className="text-right px-2.5 py-2.5 bg-teal-50/50">ESI Wage</th>
                      <th className="text-right px-2.5 py-2.5 bg-teal-50/50 text-teal-900">ESI (0.75%)</th>
                      <th className="text-right px-3 py-2.5 bg-emerald-50/70 font-extrabold text-emerald-950">Net Salary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredItems.map((it, idx) => {
                      const fixed = Number(it.base_salary_component || 0);
                      const basic70 = Math.round(fixed * 0.7);
                      const hra30 = fixed - basic70;
                      const lopDays = Number(it.days_lop || 0);
                      const lopAmt = Number(it.lop_amount || 0);
                      const earnedGross = Math.max(0, Number(it.gross_pay || 0) - lopAmt);

                      return (
                        <tr key={it.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-2 py-2 text-center text-gray-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900">{it.full_name}</span>
                              {(it.payment_mode || 'account') === 'cash' ? (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Cash</span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-800 border border-blue-200">Bank</span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono">
                              {it.employee_code} · {it.department_name || 'General'}
                              {it.bank_account_no && ` · A/c: ${it.bank_account_no}`}
                            </div>
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono font-bold text-gray-900">{money(fixed)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-gray-600">{money(basic70)}</td>
                          <td className="px-2.5 py-2 text-right font-mono text-gray-600">{money(hra30)}</td>
                          <td className="px-2 py-2 text-center font-bold text-gray-800">{it.days_present}</td>
                          <td className={`px-2 py-2 text-center font-semibold ${lopDays > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {lopDays}
                          </td>
                          <td className={`px-2 py-2 text-right font-mono ${lopAmt > 0 ? 'text-orange-600 font-semibold' : 'text-gray-400'}`}>
                            {lopAmt > 0 ? `-${money(lopAmt)}` : '—'}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono font-bold text-gray-900">{money(earnedGross)}</td>
                          <td className={`px-2 py-2 text-right font-mono ${Number(it.fines_amount) > 0 ? 'text-rose-600 font-semibold' : 'text-gray-400'}`}>
                            {Number(it.fines_amount) > 0 ? `-${money(it.fines_amount)}` : '—'}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono text-gray-600 bg-blue-50/20">{money(it.pf_wage)}</td>
                          <td className="px-2.5 py-2 text-right font-mono font-bold text-blue-900 bg-blue-50/30">
                            {Number(it.pf_employee_amount) > 0 ? money(it.pf_employee_amount) : '—'}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono text-gray-600 bg-teal-50/20">{money(it.esi_wage)}</td>
                          <td className="px-2.5 py-2 text-right font-mono font-bold text-teal-900 bg-teal-50/30">
                            {Number(it.esi_employee_amount) > 0 ? money(it.esi_employee_amount) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-extrabold text-emerald-900 bg-emerald-50/50">
                            {money(it.net_pay)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-view 2: EPF & ESI Statutory Calculation (Matches EPF & ESI CALCULATION.xlsx) */}
          {subTab === 'statutory' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ESI Calculation Card */}
                <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-teal-50/60">
                    <div>
                      <h4 className="text-xs font-bold text-teal-950 uppercase tracking-wider">
                        ESI Statutory Calculation (100% Gross)
                      </h4>
                      <span className="text-[10px] text-teal-700 font-semibold">
                        Ceiling: ₹21,000 · Employer 3.25% · Employee 0.75% · Total 4.5%
                      </span>
                    </div>
                    <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ROUNDUP Rule
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-600 uppercase">
                        <tr>
                          <th className="px-2 py-2 text-center w-8">#</th>
                          <th className="px-3 py-2 text-left">Staff</th>
                          <th className="px-2 py-2 text-right">Gross (100%)</th>
                          <th className="px-2 py-2 text-right text-teal-800">Emplr 3.25%</th>
                          <th className="px-2 py-2 text-right text-teal-800">Emp 0.75%</th>
                          <th className="px-2 py-2 text-right font-bold text-teal-950">Total 4.5%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredItems.map((it, idx) => {
                          const esiWage = Number(it.esi_wage || 0);
                          const esiEmp = Number(it.esi_employee_amount || 0);
                          const esiEmplr = Number(it.esi_employer_amount || 0);
                          const esiTotal = esiEmp + esiEmplr;
                          const outOfCover = Number(it.base_salary_component || 0) > 21000;

                          return (
                            <tr key={it.id} className="hover:bg-gray-50/60">
                              <td className="px-2 py-1.5 text-center text-gray-400 font-mono text-[10px]">{idx + 1}</td>
                              <td className="px-3 py-1.5">
                                <div className="font-semibold text-gray-900">{it.full_name}</div>
                                {outOfCover && <span className="text-[9px] text-gray-400 font-bold uppercase">OUT OF COVER (&gt;21k)</span>}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono">{money(esiWage)}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-teal-700">{money(esiEmplr)}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-teal-700">{money(esiEmp)}</td>
                              <td className="px-2 py-1.5 text-right font-mono font-bold text-teal-900">{money(esiTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* PF Calculation Card */}
                <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-blue-50/60">
                    <div>
                      <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                        PF / EPF Statutory Calculation (70% Basic)
                      </h4>
                      <span className="text-[10px] text-blue-700 font-semibold">
                        Ceiling: ₹15,000 · Employee 12% · Employer EPS 8.33% · EPF 3.67%
                      </span>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Max ₹1,800
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-600 uppercase">
                        <tr>
                          <th className="px-2 py-2 text-center w-8">#</th>
                          <th className="px-3 py-2 text-left">Staff</th>
                          <th className="px-2 py-2 text-right">PF Wage (70%)</th>
                          <th className="px-2 py-2 text-right text-blue-800">Emp 12%</th>
                          <th className="px-2 py-2 text-right text-blue-700">EPS 8.33%</th>
                          <th className="px-2 py-2 text-right text-blue-700">EPF 3.67%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredItems.map((it, idx) => {
                          const pfWage = Number(it.pf_wage || 0);
                          const pfEmp = Number(it.pf_employee_amount || 0);
                          const pfEps = Number(it.pf_employer_eps_amount || 0);
                          const pfEpf = Number(it.pf_employer_epf_amount || 0);

                          return (
                            <tr key={it.id} className="hover:bg-gray-50/60">
                              <td className="px-2 py-1.5 text-center text-gray-400 font-mono text-[10px]">{idx + 1}</td>
                              <td className="px-3 py-1.5 font-semibold text-gray-900">{it.full_name}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{money(pfWage)}</td>
                              <td className="px-2 py-1.5 text-right font-mono font-bold text-blue-900">{money(pfEmp)}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-blue-700">{money(pfEps)}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-blue-700">{money(pfEpf)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Statutory Challan Breakdown Box (Matching EPFO Challan) */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-md grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                {/* EPFO Challan Summary */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-extrabold text-blue-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <LandmarkIcon className="w-4 h-4 text-blue-300 shrink-0" />
                      <span>EPFO Statutory Challan Summary (5 Accounts)</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold">{summary?.pf?.enrolledCount || 0} Subscribers</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-gray-300">
                      <span>A/C 01 — Employer EPF (3.67%) + Employee EPF (12%)</span>
                      <span className="font-mono font-bold text-white">{money(summary?.pf?.ac01)}</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>A/C 02 — EPFO Administration Charges (0.5%)</span>
                      <span className="font-mono font-bold text-white">{money(summary?.pf?.ac02)}</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>A/C 10 — Pension Fund EPS (8.33%)</span>
                      <span className="font-mono font-bold text-white">{money(summary?.pf?.ac10)}</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>A/C 21 — EDLI Deposit-Linked Insurance (0.5%)</span>
                      <span className="font-mono font-bold text-white">{money(summary?.pf?.ac21)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/20 flex justify-between items-center text-sm font-extrabold text-emerald-400">
                    <span>Total EPFO Challan Remittance</span>
                    <span className="text-base font-mono">{money(summary?.pf?.totalEpfoChallan)}</span>
                  </div>
                </div>

                {/* ESI Challan Summary */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-extrabold text-teal-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <HospitalIcon className="w-4 h-4 text-teal-300 shrink-0" />
                      <span>ESIC Statutory Challan Summary (4.5%)</span>
                    </span>
                    <span className="text-[10px] text-gray-400 font-semibold">{summary?.esi?.coveredCount || 0} Covered Staff</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-gray-300">
                      <span>Total ESI Eligible Monthly Wages</span>
                      <span className="font-mono font-bold text-white">{money(summary?.esi?.totalEsiWages)}</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>Employee Contribution (0.75% ROUNDUP)</span>
                      <span className="font-mono font-bold text-white">{money(summary?.esi?.totalEsiEmployee)}</span>
                    </div>
                    <div className="flex justify-between text-gray-300">
                      <span>Employer Contribution (3.25% ROUNDUP)</span>
                      <span className="font-mono font-bold text-white">{money(summary?.esi?.totalEsiEmployer)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/20 flex justify-between items-center text-sm font-extrabold text-teal-400">
                    <span>Total ESIC Challan Remittance</span>
                    <span className="text-base font-mono">{money(summary?.esi?.totalEsiChallan)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {showExportModal && data?.run && (
        <PayrollExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          runId={data.run.id}
          periodLabel={`${MONTH_NAMES[month - 1]} ${year}`}
          items={data.items || []}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}
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
  BASIC_PERCENT: 'Basic + DA Share of Monthly Salary (%)',
  HRA_PERCENT: 'HRA Share of Monthly Salary (%)',
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

/* ═══════════════════════════════════════════════════════════════════════
   PAYROLL EXPORT MODAL (With Overtime, PF & Payment Mode Options)
═══════════════════════════════════════════════════════════════════════ */

function PayrollExportModal({ isOpen, onClose, runId, periodLabel, items = [], onSuccess, onError }) {
  const [includeOvertime, setIncludeOvertime] = useState(true);
  const [pfFilter, setPfFilter] = useState('all'); // 'all' | 'pf_only' | 'non_pf'
  const [paymentMode, setPaymentMode] = useState('all'); // 'all' | 'account' | 'cash'
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const totalStaff = items.length;
  const matchCount = items.filter((r) => {
    const isPf = Boolean(Number(r.pf_enrolled) === 1 || Number(r.pf_wage) > 0 || Number(r.pf_employee_amount) > 0);
    if (pfFilter === 'pf_only' && !isPf) return false;
    if (pfFilter === 'non_pf' && isPf) return false;
    const mode = (r.payment_mode || 'account').toLowerCase();
    if (paymentMode === 'account' && mode !== 'account') return false;
    if (paymentMode === 'cash' && mode !== 'cash') return false;
    return true;
  }).length;

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      const params = new URLSearchParams();
      params.set('include_overtime', String(includeOvertime));
      params.set('pf_filter', pfFilter);
      params.set('payment_mode', paymentMode);

      const res = await fetch(`${API_URL}/salary/payroll-runs/${runId}/export?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to export Excel workbook');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      let suffix = '';
      if (pfFilter === 'pf_only') suffix += '_PFOnly';
      else if (pfFilter === 'non_pf') suffix += '_NonPF';
      if (paymentMode === 'account') suffix += '_BankTransfer';
      else if (paymentMode === 'cash') suffix += '_Cash';
      if (!includeOvertime) suffix += '_NoOT';
      a.download = `Payroll_${String(periodLabel || 'Export').replace(/\s+/g, '_')}_Run${runId}${suffix}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      onSuccess?.(`Payroll exported successfully (${matchCount} employees).`);
      onClose();
    } catch (err) {
      onError?.(err, 'Failed to export payroll Excel file.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <DownloadIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Export Payroll Statement (Excel)</h3>
              <p className="text-[11px] text-gray-500">{periodLabel || 'Selected Run'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Content Options */}
        <div className="p-6 space-y-5 text-xs text-gray-700">
          {/* Option 1: Overtime Charges */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Overtime Charges
            </label>
            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              includeOvertime ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
              <input
                type="checkbox"
                checked={includeOvertime}
                onChange={(e) => setIncludeOvertime(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="font-bold text-gray-900 block">Include Overtime Charges</span>
                <span className="text-[11px] text-gray-500 block mt-0.5">
                  When checked, extra day overtime payments are included in earned gross and net payable. When unchecked, overtime amounts are zeroed out.
                </span>
              </div>
            </label>
          </div>

          {/* Option 2: PF Status Filter */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Provident Fund (PF) Staff
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', label: 'All Staff', desc: 'PF & Non-PF' },
                { id: 'pf_only', label: 'PF Only', desc: 'Enrolled in EPF' },
                { id: 'non_pf', label: 'Non-PF Only', desc: 'Exempt / Non-PF' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPfFilter(opt.id)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    pfFilter === opt.id
                      ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`font-bold text-xs ${pfFilter === opt.id ? 'text-blue-900' : 'text-gray-900'}`}>
                    {opt.label}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Option 3: Payment Method Filter */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Disbursement Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'all', label: 'All Modes', icon: LandmarkIcon, desc: 'Account & Cash' },
                { id: 'account', label: 'Bank Transfer', icon: LandmarkIcon, desc: 'Account credit' },
                { id: 'cash', label: 'Cash Only', icon: CurrencyRupeeIcon, desc: 'Cash payout' },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMode(opt.id)}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      paymentMode === opt.id
                        ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${paymentMode === opt.id ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className={`font-bold text-xs ${paymentMode === opt.id ? 'text-blue-900' : 'text-gray-900'}`}>
                        {opt.label}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Matches Count Banner */}
          {totalStaff > 0 && (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">Selected Criteria Matches:</span>
              <span className="font-bold text-gray-900 bg-white px-2.5 py-0.5 rounded-lg border border-gray-200">
                {matchCount} of {totalStaff} Staff Members
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/70">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting || (totalStaff > 0 && matchCount === 0)}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#1e40af] hover:bg-[#1c399b] rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            <DownloadIcon className="w-4 h-4 text-white" />
            <span>{isExporting ? 'Generating Excel…' : `Download Spreadsheet (${matchCount})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

