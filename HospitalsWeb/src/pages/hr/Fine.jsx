import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  AlertCircle, AlertOctagon, MinusCircle, Banknote,
  Calendar, ChevronDown, Download, Plus, User
} from 'lucide-react';
import './Fine.css';

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusBadge(status) {
  switch ((status || '').toLowerCase()) {
    case 'pending':   return <span className="badge badge-warning-light">Pending</span>;
    case 'approved':  return <span className="badge badge-success-light">Approved</span>;
    case 'deducted':  return <span className="badge badge-deducted">Deducted</span>;
    case 'waived':    return <span className="badge badge-danger-light">Waived</span>;
    case 'cancelled': return <span className="badge badge-cancelled">Cancelled</span>;
    default:          return <span className="badge">{status}</span>;
  }
}

export function Fine() {
  const { request, loading } = useApi();
  const [fines, setFines] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState({ pending: 0, total_month: 0, amount_pending: 0, deducted_ytd: 0 });
  const [form, setForm] = useState({
    employee_id: '', reason: '', amount: '', incident_date: '', remarks: ''
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [err, setErr] = useState('');

  const REASONS = ['Late Arrival', 'Unexcused Absence', 'Uniform Non-compliance', 'Phone Usage on Duty', 'Equipment Misuse', 'Other'];

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (statusFilter) params.set('status', statusFilter);
      const res = await request(`/salary/fines?${params}`);
      const rows = res?.data?.rows || res?.data || [];
      setFines(rows);

      const now = new Date();
      const monthRows = rows.filter(r => {
        const d = new Date(r.incident_date || r.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      setStats({
        pending: rows.filter(r => r.status === 'pending').length,
        total_month: monthRows.length,
        amount_pending: rows.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.amount || 0), 0),
        deducted_ytd: rows.filter(r => r.status === 'deducted').reduce((s, r) => s + Number(r.amount || 0), 0),
      });
    } catch (_) {}
  }, [statusFilter]);

  useEffect(() => {
    request('/hr/employees?limit=200').then(r => setEmployees(r?.data?.rows || r?.data || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    try {
      await request(`/salary/fines/${id}/approve`, { method: 'PATCH' });
      load();
    } catch (_) {}
  };

  const handleWaive = async (id) => {
    try {
      await request(`/salary/fines/${id}/waive`, { method: 'PATCH' });
      load();
    } catch (_) {}
  };

  const handleDeduct = async (id) => {
    try {
      await request(`/salary/fines/${id}/deduct`, { method: 'PATCH' });
      load();
    } catch (_) {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setSubmitLoading(true);
    try {
      await request('/salary/fines', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(form.employee_id),
          reason: form.reason,
          amount: Number(form.amount),
          incident_date: form.incident_date,
          remarks: form.remarks,
        })
      });
      setForm({ employee_id: '', reason: '', amount: '', incident_date: '', remarks: '' });
      load();
    } catch (e) { setErr(e.message); }
    finally { setSubmitLoading(false); }
  };

  // Group by reason for summary
  const byReason = fines.reduce((acc, f) => {
    const k = f.reason || 'Other';
    acc[k] = acc[k] || { count: 0, amount: 0 };
    acc[k].count++;
    acc[k].amount += Number(f.amount || 0);
    return acc;
  }, {});

  return (
    <div className="fine-page hr-overview-page">
      <PageHeader 
        breadcrumbs={[
          { label: 'HR & Payroll', path: '#' },
          { label: 'Fine & Penalties' }
        ]}
        searchPlaceholder="Search employee..."
        actions={
          <div className="fine-actions">
            <Button variant="outline" className="fine-action-btn fine-action-btn-outline">
              <Calendar size={16} /> {new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })} <ChevronDown size={14} />
            </Button>
            <Button variant="outline" className="fine-action-btn fine-action-btn-outline">
              <Download size={16} /> Export
            </Button>
            <Button variant="primary" className="fine-action-btn fine-action-btn-primary" onClick={() => document.getElementById('fine-form-section')?.scrollIntoView({ behavior: 'smooth' })}>
              <Plus size={16} /> Issue Fine
            </Button>
          </div>
        }
      />

      <div className="page-content fine-page">
        <div className="fine-heading-block">
          <h1 className="fine-title">Fine & Penalty Management</h1>
          <p className="fine-subtitle">Track, approve and deduct employee fines from payroll. Maintain a clean disciplinary record.</p>
        </div>

        <div className="stats-grid mb-6">
          <Card className="stat-card stat-pending">
            <div className="stat-card-left">
              <div className="stat-label">Pending Fines</div>
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-sub">Awaiting approval</div>
            </div>
            <div className="stat-icon-wrapper orange-bg">
              <AlertCircle size={16} className="icon-orange" />
            </div>
          </Card>

          <Card className="stat-card stat-month">
            <div className="stat-card-left">
              <div className="stat-label">Total Fines This Month</div>
              <div className="stat-value">{stats.total_month}</div>
              <div className="stat-sub">{new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</div>
            </div>
            <div className="stat-icon-wrapper orange-bg">
              <AlertOctagon size={16} className="icon-orange" />
            </div>
          </Card>

          <Card className="stat-card stat-pending-amt">
            <div className="stat-card-left">
              <div className="stat-label">Amount to Deduct</div>
              <div className="stat-value">₹{stats.amount_pending.toLocaleString('en-IN')}</div>
              <div className="stat-sub">From active payroll</div>
            </div>
            <div className="stat-icon-wrapper orange-bg">
              <MinusCircle size={16} className="icon-orange" />
            </div>
          </Card>

          <Card className="stat-card stat-deducted-ytd">
            <div className="stat-card-left">
              <div className="stat-label">Deducted YTD</div>
              <div className="stat-value">₹{stats.deducted_ytd.toLocaleString('en-IN')}</div>
              <div className="stat-sub">Across all months</div>
            </div>
            <div className="stat-icon-wrapper blue-bg">
              <Banknote size={16} className="icon-blue" />
            </div>
          </Card>
        </div>

        <div className="dashboard-grid">
          <div className="main-column">
            <Card className="h-full">
              <div className="card-header-flex">
                <h3 className="section-title" style={{ marginBottom: 0 }}>Fine Records</h3>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="fine-filter-select"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="deducted">Deducted</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="fine-table">
                  <thead>
                    <tr>
                      <th className="fine-th">Employee</th>
                      <th className="fine-th">Reason</th>
                      <th className="fine-th">Date</th>
                      <th className="fine-th">Amount</th>
                      <th className="fine-th">Deduct From</th>
                      <th className="fine-th">Status</th>
                      <th className="fine-th">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={7} className="fine-empty">Loading…</td></tr>}
                    {!loading && fines.length === 0 && <tr><td colSpan={7} className="fine-empty">No fine records found.</td></tr>}
                    {fines.map((f, i) => (
                      <tr key={f.id || i} className="fine-row">
                        <td>
                          <div className="fine-employee-cell">
                            <img src={`https://i.pravatar.cc/150?u=fine_${f.employee_id}`} className="fine-avatar" alt="avatar"/>
                            <div>
                              <div className="fine-name">{f.employee_name || `EMP${f.employee_id}`}</div>
                              <div className="fine-dept">{f.department_name || f.department || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td>{f.reason}</td>
                        <td className="fine-muted">{fmtDate(f.incident_date || f.created_at)}</td>
                        <td className="fine-name">₹{Number(f.amount).toLocaleString('en-IN')}</td>
                        <td className="fine-muted">{f.payroll_month ? new Date(f.payroll_month + '-01').toLocaleString('en-GB', { month: 'long' }) + ' Payroll' : 'Current Payroll'}</td>
                        <td>{statusBadge(f.status)}</td>
                        <td>
                          <div className="fine-action-btns">
                            {f.status === 'pending' && (
                              <>
                                <Button variant="outline" size="sm" className="fine-action-btn fine-action-btn-outline" onClick={() => handleApprove(f.id)}>Approve</Button>
                                <Button variant="outline" size="sm" className="fine-action-btn fine-action-btn-outline" onClick={() => handleWaive(f.id)}>Waive</Button>
                              </>
                            )}
                            {f.status === 'approved' && (
                              <Button variant="primary" size="sm" className="fine-action-btn fine-action-btn-primary" onClick={() => handleDeduct(f.id)}>Deduct</Button>
                            )}
                            {(f.status === 'deducted' || f.status === 'waived') && (
                              <Button variant="outline" size="sm" className="fine-action-btn fine-action-btn-outline">View</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="side-column">
            <Card id="fine-form-section">
              <div className="ui-card-content">
                <h3 className="section-title">Issue New Fine</h3>
                <form onSubmit={handleSubmit} className="fine-card-stack" style={{ marginTop: 16 }}>
                <div>
                  <label className="fine-muted">Employee</label>
                  <div className="relative">
                    <User size={16} className="fine-field-icon" />
                    <select
                      required
                      value={form.employee_id}
                      onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                      className="fine-select fine-field-input"
                    >
                      <option value="">Select employee...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.full_name} — {emp.department_name || ''}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="fine-field-chevron" />
                  </div>
                </div>

                <div>
                  <label className="fine-muted">Reason</label>
                  <div className="relative">
                    <select
                      required
                      value={form.reason}
                      onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                      className="fine-select fine-field-input"
                    >
                      <option value="">Select reason...</option>
                      {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown size={14} className="fine-field-chevron" />
                  </div>
                </div>

                <div>
                  <label className="fine-muted">Fine Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Enter amount..."
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="fine-input fine-field-input"
                  />
                </div>

                <div>
                  <label className="fine-muted">Date of Incident</label>
                  <div className="relative">
                    <Calendar size={16} className="fine-field-icon" />
                    <input
                      type="date"
                      required
                      value={form.incident_date}
                      onChange={e => setForm(f => ({ ...f, incident_date: e.target.value }))}
                      className="fine-input fine-field-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="fine-muted">Remarks (optional)</label>
                  <textarea
                    placeholder="Add notes..."
                    value={form.remarks}
                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    className="fine-textarea fine-field-input"
                  />
                </div>

                {err && <p className="modal-error">{err}</p>}

                <Button variant="primary" className="fine-action-btn fine-action-btn-primary" disabled={submitLoading}>
                  {submitLoading ? 'Submitting…' : 'Submit Fine'}
                </Button>
              </form>
              </div>
            </Card>

            {/* Fine by Reason */}
            <Card>
              <div className="ui-card-content">
                <h3 className="section-title" style={{ marginBottom: 20 }}>Fine by Reason ({new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })})</h3>
                <div className="fine-card-stack">
                {Object.entries(byReason).length === 0 && (
                  <p className="fine-empty">No fines recorded</p>
                )}
                {Object.entries(byReason).map(([reason, data], i, arr) => (
                  <div key={reason} className="fine-reason-row">
                    <div>
                      <div className="fine-name">{reason}</div>
                      <div className="fine-muted">{data.count} incidents</div>
                    </div>
                    <div className="fine-name" style={{ color: '#dc2626' }}>₹{data.amount.toLocaleString('en-IN')}</div>
                  </div>
                ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
