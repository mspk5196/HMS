import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  Banknote, MinusCircle, Wallet, Clock, 
  Calendar, ChevronDown, Download, Play,
  Mail, FileText, Landmark
} from 'lucide-react';
import './Payroll.css';

function fmtINR(val) {
  const n = Number(val || 0);
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function fmtINRFull(val) {
  return `₹${Number(val || 0).toLocaleString('en-IN')}`;
}

function statusBadge(status) {
  switch ((status || '').toLowerCase()) {
    case 'draft':     return <span className="badge badge-warning-light border border-warning/20 text-warning">Draft</span>;
    case 'calculated': return <span className="badge bg-primary/10 text-primary border border-primary/20">Calculated</span>;
    case 'locked':    return <span className="badge badge-success-light border border-success/20">Approved</span>;
    case 'paid':      return <span className="badge bg-green-100 text-green-700 border border-green-200">Paid</span>;
    default:          return <span className="badge">{status}</span>;
  }
}

export function Payroll() {
  const { request, loading } = useApi();
  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [items, setItems] = useState([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [departments, setDepartments] = useState([]);
  const [runLoading, setRunLoading] = useState(false);
  const [stats, setStats] = useState({ gross: 0, deductions: 0, net: 0, pending: 0 });

  // Current month YYYY-MM
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthLabel = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  const loadRuns = useCallback(async () => {
    try {
      const res = await request(`/salary/payroll-runs?limit=10`);
      const allRuns = res?.data?.rows || res?.data || [];
      setRuns(allRuns);
      // Find current month run
      const cur = allRuns.find(r => r.month === currentMonth) || allRuns[0];
      setActiveRun(cur || null);
      return cur;
    } catch (_) { return null; }
  }, []);

  const loadItems = useCallback(async (runId) => {
    if (!runId) return;
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (deptFilter) params.set('department_id', deptFilter);
      const res = await request(`/salary/payroll-runs/${runId}/items?${params}`);
      const rows = res?.data?.rows || res?.data || [];
      setItems(rows);
      const gross = rows.reduce((s, r) => s + Number(r.gross_salary || r.basic_salary || 0), 0);
      const deductions = rows.reduce((s, r) => s + Number(r.total_deductions || 0), 0);
      const net = rows.reduce((s, r) => s + Number(r.net_salary || 0), 0);
      const pending = rows.filter(r => r.status === 'draft' || !r.status).length;
      setStats({ gross, deductions, net, pending });
    } catch (_) {}
  }, [deptFilter]);

  useEffect(() => {
    request('/hr/departments').then(r => setDepartments(r?.data || [])).catch(() => {});
    loadRuns().then(run => { if (run) loadItems(run.id); });
  }, []);

  useEffect(() => {
    if (activeRun) loadItems(activeRun.id);
  }, [deptFilter, activeRun]);

  const handleRunPayroll = async () => {
    setRunLoading(true);
    try {
      let run = activeRun;
      if (!run) {
        const res = await request('/salary/payroll-runs', {
          method: 'POST',
          body: JSON.stringify({ month: currentMonth })
        });
        run = res?.data;
      }
      if (run?.id) {
        await request(`/salary/payroll-runs/${run.id}/calculate`, { method: 'POST' });
        const freshRun = await loadRuns();
        if (freshRun) loadItems(freshRun.id);
      }
    } catch (_) {}
    setRunLoading(false);
  };

  const handleLock = async () => {
    if (!activeRun?.id) return;
    try {
      await request(`/salary/payroll-runs/${activeRun.id}/lock`, { method: 'POST' });
      loadRuns().then(r => r && loadItems(r.id));
    } catch (_) {}
  };

  // Group items by department for sidebar
  const deptBreakdown = items.reduce((acc, it) => {
    const d = it.department_name || it.department || 'Other';
    acc[d] = acc[d] || { count: 0, net: 0 };
    acc[d].count++;
    acc[d].net += Number(it.net_salary || 0);
    return acc;
  }, {});

  const payrollStatusCounts = {
    locked: items.filter(i => i.status === 'locked' || i.status === 'paid').length,
    pending: items.filter(i => i.status === 'draft' || !i.status).length,
    calculated: items.filter(i => i.status === 'calculated').length,
  };

  return (
    <div className="page-container">
      <PageHeader 
        breadcrumbs={[
          { label: 'HR & Payroll', path: '#' },
          { label: 'Payroll' }
        ]}
        searchPlaceholder="Search employee..."
        actions={
          <div className="flex gap-3">
            <select
              value={activeRun?.id || ''}
              onChange={e => {
                const r = runs.find(r => String(r.id) === e.target.value);
                setActiveRun(r || null);
                if (r) loadItems(r.id);
              }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
            >
              {runs.map(r => <option key={r.id} value={r.id}>{r.month || r.id} ({r.status})</option>)}
              {runs.length === 0 && <option value="">{monthLabel}</option>}
            </select>
            <Button variant="outline" className="flex items-center gap-2">
              <Download size={16} /> Export Payslips
            </Button>
            <Button
              variant="primary"
              className="bg-[#1e3a8a] text-white hover:bg-[#1e3a8a]/90 flex items-center gap-2"
              onClick={handleRunPayroll}
              disabled={runLoading}
            >
              <Play size={16} fill="currentColor" /> {runLoading ? 'Running…' : 'Run Payroll'}
            </Button>
          </div>
        }
      />

      <div className="page-content payroll-page">
        <div className="page-header-text mb-6">
          <h1 className="text-2xl font-bold mb-1">Payroll — {activeRun?.month || monthLabel}</h1>
          <p className="text-[var(--text-md)] text-sm">Review salary calculations, approve payments, and disburse monthly payroll for all staff.</p>
        </div>

        <div className="stats-grid mb-6">
          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Total Gross Payout</div>
              <div className="stat-icon-wrapper bg-primary/10 text-primary"><Banknote size={18} /></div>
            </div>
            <div className="stat-value">{fmtINR(stats.gross)}</div>
            <div className="stat-sub">{items.length} employees</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Total Deductions</div>
              <div className="stat-icon-wrapper bg-danger/10 text-danger"><MinusCircle size={18} /></div>
            </div>
            <div className="stat-value">{fmtINR(stats.deductions)}</div>
            <div className="stat-sub">PF, ESI & fines</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Net Payout</div>
              <div className="stat-icon-wrapper bg-success/10 text-success"><Wallet size={18} /></div>
            </div>
            <div className="stat-value">{fmtINR(stats.net)}</div>
            <div className="stat-sub">After all deductions</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Pending Approvals</div>
              <div className="stat-icon-wrapper bg-warning/10 text-warning"><Clock size={18} /></div>
            </div>
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-sub">Requires sign-off</div>
          </Card>
        </div>

        <div className="dashboard-grid">
          <div className="main-column">
            <Card className="h-full">
              <div className="card-header-flex mb-4">
                <h3 className="font-bold text-lg">Payroll Register</h3>
                <div className="flex gap-2">
                  <select
                    value={deptFilter}
                    onChange={e => setDeptFilter(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-primary"
                  >
                    <option value="">All Depts</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-md)] border-b pb-2">
                      <th className="pb-3 font-semibold">Employee</th>
                      <th className="pb-3 font-semibold">Days</th>
                      <th className="pb-3 font-semibold">Gross</th>
                      <th className="pb-3 font-semibold">Fines</th>
                      <th className="pb-3 font-semibold">PF/ESI</th>
                      <th className="pb-3 font-semibold">Net Pay</th>
                      <th className="pb-3 font-semibold">Mode</th>
                      <th className="pb-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={8} className="py-12 text-center text-[var(--text-md)]">Loading…</td></tr>}
                    {!loading && !activeRun && (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[var(--text-md)]">
                          No payroll run found for this period. Click <strong>Run Payroll</strong> to generate.
                        </td>
                      </tr>
                    )}
                    {!loading && activeRun && items.length === 0 && (
                      <tr><td colSpan={8} className="py-12 text-center text-[var(--text-md)]">Payroll not yet calculated. Click <strong>Run Payroll</strong>.</td></tr>
                    )}
                    {items.map((it, i) => (
                      <tr key={it.id || i} className="border-b border-gray-100">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <img src={`https://i.pravatar.cc/150?u=pay_${it.employee_id}`} className="w-8 h-8 rounded-full" alt="avatar"/>
                            <div>
                              <div className="font-semibold text-gray-900">{it.employee_name || `EMP${it.employee_id}`}</div>
                              <div className="text-xs text-[var(--text-md)]">{it.department_name || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="font-medium">{it.working_days || it.present_days || '—'}</td>
                        <td className="font-semibold">{fmtINRFull(it.gross_salary || it.basic_salary)}</td>
                        <td className="text-danger">{fmtINRFull(it.fine_deductions || it.fines || 0)}</td>
                        <td className="text-[var(--text-md)]">{fmtINRFull(it.pf_deduction || it.pf || 0)}</td>
                        <td className="font-bold text-gray-900">{fmtINRFull(it.net_salary)}</td>
                        <td className="text-[var(--text-md)]">{it.payment_mode || 'Bank Transfer'}</td>
                        <td>{statusBadge(it.status || activeRun?.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {items.length > 0 && (
                <div className="mt-6 pt-4 border-t flex items-center gap-8 text-sm">
                  <div className="text-[var(--text-md)]">Gross Total: <span className="font-bold text-gray-900 ml-1">{fmtINRFull(stats.gross)}</span></div>
                  <div className="text-[var(--text-md)]">Total Deductions: <span className="font-bold text-danger ml-1">{fmtINRFull(stats.deductions)}</span></div>
                  <div className="text-[var(--text-md)] flex-1 text-right">Net Total: <span className="font-bold text-success text-base ml-1">{fmtINRFull(stats.net)}</span></div>
                </div>
              )}
            </Card>
          </div>

          <div className="side-column flex flex-col gap-6">
            {/* Payroll Status */}
            <Card>
              <h3 className="font-bold mb-5">Payroll Status</h3>
              <div className="flex flex-col gap-4 text-sm font-medium">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-900">Approved & Ready</span>
                    <span className="font-bold text-gray-900">{payrollStatusCounts.locked}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full w-full overflow-hidden">
                    <div className="bg-success h-full" style={{ width: items.length ? `${(payrollStatusCounts.locked / items.length) * 100}%` : '0%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-900">Calculated</span>
                    <span className="font-bold text-gray-900">{payrollStatusCounts.calculated}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full w-full overflow-hidden">
                    <div className="bg-primary h-full" style={{ width: items.length ? `${(payrollStatusCounts.calculated / items.length) * 100}%` : '0%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-900">Pending Approval</span>
                    <span className="font-bold text-gray-900">{payrollStatusCounts.pending}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full w-full overflow-hidden">
                    <div className="bg-warning h-full" style={{ width: items.length ? `${(payrollStatusCounts.pending / items.length) * 100}%` : '0%' }} />
                  </div>
                </div>

                {activeRun && activeRun.status !== 'locked' && activeRun.status !== 'paid' && (
                  <Button variant="primary" className="bg-[#1e3a8a] text-white hover:bg-[#1e3a8a]/90 w-full py-2 mt-2" onClick={handleLock}>
                    Approve & Lock Payroll
                  </Button>
                )}
                {activeRun && (activeRun.status === 'locked' || activeRun.status === 'paid') && (
                  <div className="text-center text-success text-sm font-semibold py-2">✓ Payroll Locked</div>
                )}
              </div>
            </Card>

            {/* Payout by Department */}
            <Card>
              <h3 className="font-bold mb-5">Payout by Department</h3>
              <div className="flex flex-col gap-4 text-sm">
                {Object.entries(deptBreakdown).length === 0 && (
                  <p className="text-[var(--text-md)] text-center py-4">No data available</p>
                )}
                {Object.entries(deptBreakdown).map(([dept, data], i, arr) => (
                  <div key={dept} className={`flex justify-between items-center ${i < arr.length - 1 ? 'border-b border-gray-50 pb-3' : 'pb-1'}`}>
                    <div>
                      <div className="font-semibold text-gray-900">{dept}</div>
                      <div className="text-xs text-[var(--text-md)]">{data.count} employees</div>
                    </div>
                    <div className="font-bold text-gray-900">{fmtINR(data.net)}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Payslip Actions */}
            <Card>
              <h3 className="font-bold mb-4">Payslip Actions</h3>
              <div className="flex flex-col gap-3">
                <Button variant="outline" className="w-full flex items-center justify-start gap-3 h-10 border-gray-200 text-gray-700 hover:bg-gray-50">
                  <Mail size={16} className="text-primary" /> Email Payslips to All
                </Button>
                <Button variant="outline" className="w-full flex items-center justify-start gap-3 h-10 border-gray-200 text-gray-700 hover:bg-gray-50">
                  <FileText size={16} className="text-primary" /> Generate PDF Report
                </Button>
                <Button variant="outline" className="w-full flex items-center justify-start gap-3 h-10 border-gray-200 text-gray-700 hover:bg-gray-50">
                  <Landmark size={16} className="text-primary" /> Submit to Bank
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
