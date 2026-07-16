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
    <div className="page-container payroll-page">
      <PageHeader 
        breadcrumbs={[
          { label: 'HR & Payroll', path: '#' },
          { label: 'Payroll' }
        ]}
        searchPlaceholder="Search employee..."
        actions={
          <div className="payroll-actions">
            <select
              value={activeRun?.id || ''}
              onChange={e => {
                const r = runs.find(r => String(r.id) === e.target.value);
                setActiveRun(r || null);
                if (r) loadItems(r.id);
              }}
              className="payroll-filter-select"
            >
              {runs.map(r => <option key={r.id} value={r.id}>{r.month || r.id} ({r.status})</option>)}
              {runs.length === 0 && <option value="">{monthLabel}</option>}
            </select>
            <Button variant="outline" className="payroll-action-btn payroll-action-btn-outline">
              <Download size={16} /> Export Payslips
            </Button>
            <Button
              variant="primary"
              className="payroll-action-btn payroll-action-btn-primary"
              onClick={handleRunPayroll}
              disabled={runLoading}
            >
              <Play size={16} fill="currentColor" /> {runLoading ? 'Running…' : 'Run Payroll'}
            </Button>
          </div>
        }
      />

      <div className="page-content payroll-page">
        <div className="payroll-heading-block">
          <h1 className="payroll-title">Payroll — {activeRun?.month || monthLabel}</h1>
          <p className="payroll-subtitle">Review salary calculations, approve payments, and disburse monthly payroll for all staff.</p>
        </div>

        <div className="stats-grid mb-6">
          <Card className="stat-card stat-gross">
            <div className="stat-card-left">
              <div className="stat-label">Total Gross Payout</div>
              <div className="stat-value">{fmtINR(stats.gross)}</div>
              <div className="stat-sub">{items.length} employees</div>
            </div>
            <div className="stat-icon-wrapper blue-bg">
              <Banknote size={16} className="text-[#3b82f6]" />
            </div>
          </Card>

          <Card className="stat-card stat-deductions">
            <div className="stat-card-left">
              <div className="stat-label">Total Deductions</div>
              <div className="stat-value">{fmtINR(stats.deductions)}</div>
              <div className="stat-sub">PF, ESI & fines</div>
            </div>
            <div className="stat-icon-wrapper orange-bg">
              <MinusCircle size={16} className="text-[#f97316]" />
            </div>
          </Card>

          <Card className="stat-card stat-net">
            <div className="stat-card-left">
              <div className="stat-label">Net Payout</div>
              <div className="stat-value">{fmtINR(stats.net)}</div>
              <div className="stat-sub">
                <span className="text-emerald-600 font-bold flex items-center gap-0.5">Calculated <span className="text-slate-500 font-normal">this period</span></span>
              </div>
            </div>
            <div className="stat-icon-wrapper blue-bg">
              <Wallet size={16} className="text-[#3b82f6]" />
            </div>
          </Card>

          <Card className="stat-card stat-pending">
            <div className="stat-card-left">
              <div className="stat-label">Pending Approvals</div>
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-sub">Requires calculation check</div>
            </div>
            <div className="stat-icon-wrapper orange-bg">
              <Clock size={16} className="text-[#f97316]" />
            </div>
          </Card>
        </div>

        <div className="dashboard-grid">
          <div className="main-column">
            <Card className="h-full">
              <div className="card-header-flex">
                <h3 className="section-title">Payroll Register</h3>
                <div className="payroll-filter-row">
                  <select
                    value={deptFilter}
                    onChange={e => setDeptFilter(e.target.value)}
                    className="payroll-filter-select"
                  >
                    <option value="">All Depts</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th className="payroll-th">Employee</th>
                      <th className="payroll-th">Days</th>
                      <th className="payroll-th">Gross</th>
                      <th className="payroll-th">Fines</th>
                      <th className="payroll-th">PF/ESI</th>
                      <th className="payroll-th">Net Pay</th>
                      <th className="payroll-th">Mode</th>
                      <th className="payroll-th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={8} className="payroll-empty">Loading…</td></tr>}
                    {!loading && !activeRun && (
                      <tr>
                        <td colSpan={8} className="payroll-empty">
                          No payroll run found for this period. Click <strong>Run Payroll</strong> to generate.
                        </td>
                      </tr>
                    )}
                    {!loading && activeRun && items.length === 0 && (
                      <tr><td colSpan={8} className="payroll-empty">Payroll not yet calculated. Click <strong>Run Payroll</strong>.</td></tr>
                    )}
                    {items.map((it, i) => (
                      <tr key={it.id || i} className="payroll-row">
                        <td>
                          <div className="payroll-employee-cell">
                            <img src={`https://i.pravatar.cc/150?u=pay_${it.employee_id}`} className="payroll-avatar" alt="avatar"/>
                            <div>
                              <div className="payroll-name">{it.employee_name || `EMP${it.employee_id}`}</div>
                              <div className="payroll-muted">{it.department_name || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td>{it.working_days || it.present_days || '—'}</td>
                        <td className="payroll-name">{fmtINRFull(it.gross_salary || it.basic_salary)}</td>
                        <td style={{ color: '#dc2626' }}>{fmtINRFull(it.fine_deductions || it.fines || 0)}</td>
                        <td className="payroll-muted">{fmtINRFull(it.pf_deduction || it.pf || 0)}</td>
                        <td className="payroll-name">{fmtINRFull(it.net_salary)}</td>
                        <td className="payroll-muted">{it.payment_mode || 'Bank Transfer'}</td>
                        <td>{statusBadge(it.status || activeRun?.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {items.length > 0 && (
                <div className="payroll-summary">
                  <div className="payroll-muted">Gross Total: <span className="payroll-name">{fmtINRFull(stats.gross)}</span></div>
                  <div className="payroll-muted">Total Deductions: <span style={{ color: '#dc2626' }}>{fmtINRFull(stats.deductions)}</span></div>
                  <div className="payroll-muted" style={{ marginLeft: 'auto' }}>Net Total: <span style={{ color: '#16a34a', fontWeight: 700 }}>{fmtINRFull(stats.net)}</span></div>
                </div>
              )}
            </Card>
          </div>

          <div className="side-column flex flex-col gap-6">
            {/* Payroll Status */}
            <Card>
              <h3 className="section-title" style={{ marginBottom: 20 }}>Payroll Status</h3>
              <div className="payroll-panel-stack">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="payroll-name">Approved & Ready</span>
                    <span className="payroll-name">{payrollStatusCounts.locked}</span>
                  </div>
                  <div className="payroll-progress-bar">
                    <div className="payroll-progress-fill-green" style={{ width: items.length ? `${(payrollStatusCounts.locked / items.length) * 100}%` : '0%' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="payroll-name">Calculated</span>
                    <span className="payroll-name">{payrollStatusCounts.calculated}</span>
                  </div>
                  <div className="payroll-progress-bar">
                    <div className="payroll-progress-fill-blue" style={{ width: items.length ? `${(payrollStatusCounts.calculated / items.length) * 100}%` : '0%' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span className="payroll-name">Pending Approval</span>
                    <span className="payroll-name">{payrollStatusCounts.pending}</span>
                  </div>
                  <div className="payroll-progress-bar">
                    <div className="payroll-progress-fill-orange" style={{ width: items.length ? `${(payrollStatusCounts.pending / items.length) * 100}%` : '0%' }} />
                  </div>
                </div>

                {activeRun && activeRun.status !== 'locked' && activeRun.status !== 'paid' && (
                  <Button variant="primary" className="payroll-action-btn payroll-action-btn-primary" onClick={handleLock}>
                    Approve & Lock Payroll
                  </Button>
                )}
                {activeRun && (activeRun.status === 'locked' || activeRun.status === 'paid') && (
                  <div className="text-center" style={{ color: '#16a34a', fontSize: 14, fontWeight: 700, padding: '8px 0' }}>✓ Payroll Locked</div>
                )}
              </div>
            </Card>

            {/* Payout by Department */}
            <Card>
              <h3 className="section-title" style={{ marginBottom: 20 }}>Payout by Department</h3>
              <div className="payroll-panel-stack">
                {Object.entries(deptBreakdown).length === 0 && (
                  <p className="payroll-empty">No data available</p>
                )}
                {Object.entries(deptBreakdown).map(([dept, data], i, arr) => (
                  <div key={dept} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: i < arr.length - 1 ? 16 : 0, borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <div>
                      <div className="payroll-name">{dept}</div>
                      <div className="payroll-muted">{data.count} employees</div>
                    </div>
                    <div className="payroll-name">{fmtINR(data.net)}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Payslip Actions */}
            <Card>
              <h3 className="section-title" style={{ marginBottom: 16 }}>Payslip Actions</h3>
              <div className="payroll-action-list">
                <Button variant="outline" className="payroll-action-btn payroll-action-btn-outline" style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <Mail size={15} style={{ color: '#24428b', flexShrink: 0 }} /> Email Payslips to All
                </Button>
                <Button variant="outline" className="payroll-action-btn payroll-action-btn-outline" style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <FileText size={15} style={{ color: '#24428b', flexShrink: 0 }} /> Generate PDF Report
                </Button>
                <Button variant="outline" className="payroll-action-btn payroll-action-btn-outline" style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <Landmark size={15} style={{ color: '#24428b', flexShrink: 0 }} /> Submit to Bank
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
