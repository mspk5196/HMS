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
    case 'pending':   return <span className="badge badge-warning-light border border-warning/20 text-warning">Pending</span>;
    case 'approved':  return <span className="badge badge-success-light border border-success/20">Approved</span>;
    case 'deducted':  return <span className="badge bg-transparent border border-success text-success">Deducted</span>;
    case 'waived':    return <span className="badge badge-danger-light border border-danger/20 text-danger">Waived</span>;
    case 'cancelled': return <span className="badge bg-gray-100 text-gray-500 border border-gray-200">Cancelled</span>;
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
    <div className="page-container">
      <PageHeader 
        breadcrumbs={[
          { label: 'HR & Payroll', path: '#' },
          { label: 'Fine & Penalties' }
        ]}
        searchPlaceholder="Search employee..."
        actions={
          <div className="flex gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Calendar size={16} /> {new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })} <ChevronDown size={14} />
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Download size={16} /> Export
            </Button>
            <Button variant="primary" className="bg-primary flex items-center gap-2" onClick={() => document.getElementById('fine-form-section')?.scrollIntoView({ behavior: 'smooth' })}>
              <Plus size={16} /> Issue Fine
            </Button>
          </div>
        }
      />

      <div className="page-content fine-page">
        <div className="page-header-text mb-6">
          <h1 className="text-2xl font-bold mb-1">Fine & Penalty Management</h1>
          <p className="text-[var(--text-md)] text-sm">Track, approve and deduct employee fines from payroll. Maintain a clean disciplinary record.</p>
        </div>

        <div className="stats-grid mb-6">
          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Pending Fines</div>
              <div className="stat-icon-wrapper bg-warning/10 text-warning"><AlertCircle size={18} /></div>
            </div>
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-sub">Awaiting approval</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Total Fines This Month</div>
              <div className="stat-icon-wrapper bg-danger/10 text-danger"><AlertOctagon size={18} /></div>
            </div>
            <div className="stat-value">{stats.total_month}</div>
            <div className="stat-sub">{new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Amount to Deduct</div>
              <div className="stat-icon-wrapper bg-danger/10 text-danger"><MinusCircle size={18} /></div>
            </div>
            <div className="stat-value">₹{stats.amount_pending.toLocaleString('en-IN')}</div>
            <div className="stat-sub">From current payroll</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Deducted YTD</div>
              <div className="stat-icon-wrapper bg-primary/10 text-primary"><Banknote size={18} /></div>
            </div>
            <div className="stat-value">₹{stats.deducted_ytd.toLocaleString('en-IN')}</div>
            <div className="stat-sub">Across all months</div>
          </Card>
        </div>

        <div className="dashboard-grid">
          <div className="main-column">
            <Card className="h-full">
              <div className="card-header-flex mb-4">
                <h3 className="font-bold text-lg">Fine Records</h3>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-primary"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="deducted">Deducted</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-md)] border-b pb-2">
                      <th className="pb-3 font-semibold">Employee</th>
                      <th className="pb-3 font-semibold">Reason</th>
                      <th className="pb-3 font-semibold">Date</th>
                      <th className="pb-3 font-semibold">Amount</th>
                      <th className="pb-3 font-semibold">Deduct From</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={7} className="py-12 text-center text-[var(--text-md)]">Loading…</td></tr>}
                    {!loading && fines.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-[var(--text-md)]">No fine records found.</td></tr>}
                    {fines.map((f, i) => (
                      <tr key={f.id || i} className="border-b border-gray-100">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <img src={`https://i.pravatar.cc/150?u=fine_${f.employee_id}`} className="w-8 h-8 rounded-full" alt="avatar"/>
                            <div>
                              <div className="font-semibold text-gray-900">{f.employee_name || `EMP${f.employee_id}`}</div>
                              <div className="text-xs text-[var(--text-md)]">{f.department_name || f.department || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="font-medium text-gray-800">{f.reason}</td>
                        <td className="text-[var(--text-md)]">{fmtDate(f.incident_date || f.created_at)}</td>
                        <td className="font-bold text-danger">₹{Number(f.amount).toLocaleString('en-IN')}</td>
                        <td className="text-[var(--text-md)]">{f.payroll_month ? new Date(f.payroll_month + '-01').toLocaleString('en-GB', { month: 'long' }) + ' Payroll' : 'Current Payroll'}</td>
                        <td>{statusBadge(f.status)}</td>
                        <td>
                          <div className="flex gap-2">
                            {f.status === 'pending' && (
                              <>
                                <Button variant="outline" size="sm" className="text-success border-success hover:bg-success/10 h-8 px-3" onClick={() => handleApprove(f.id)}>Approve</Button>
                                <Button variant="outline" size="sm" className="text-gray-600 border-gray-300 hover:bg-gray-50 h-8 px-3" onClick={() => handleWaive(f.id)}>Waive</Button>
                              </>
                            )}
                            {f.status === 'approved' && (
                              <Button variant="primary" size="sm" className="bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 h-8 px-4 text-white" onClick={() => handleDeduct(f.id)}>Deduct</Button>
                            )}
                            {(f.status === 'deducted' || f.status === 'waived') && (
                              <Button variant="outline" size="sm" className="text-gray-600 border-gray-300 hover:bg-gray-50 h-8 px-4">View</Button>
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

          <div className="side-column flex flex-col gap-6">
            <Card id="fine-form-section">
              <h3 className="font-bold mb-5">Issue New Fine</h3>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm text-[var(--text-md)]">
                <div>
                  <label className="block mb-1.5 font-medium">Employee</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select
                      required
                      value={form.employee_id}
                      onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                      className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select employee...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.full_name} — {emp.department_name || ''}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 font-medium">Reason</label>
                  <div className="relative">
                    <select
                      required
                      value={form.reason}
                      onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                      className="w-full px-3 pr-8 py-2 border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select reason...</option>
                      {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 font-medium">Fine Amount (₹)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Enter amount..."
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block mb-1.5 font-medium">Date of Incident</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      required
                      value={form.incident_date}
                      onChange={e => setForm(f => ({ ...f, incident_date: e.target.value }))}
                      className="w-full pl-9 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 font-medium">Remarks (optional)</label>
                  <textarea
                    placeholder="Add notes..."
                    value={form.remarks}
                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg h-20 resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                {err && <p className="text-danger text-xs">{err}</p>}

                <Button variant="primary" className="bg-[#1e3a8a] w-full text-white hover:bg-[#1e3a8a]/90 mt-2 py-2" disabled={submitLoading}>
                  {submitLoading ? 'Submitting…' : 'Submit Fine'}
                </Button>
              </form>
            </Card>

            {/* Fine by Reason */}
            <Card>
              <h3 className="font-bold mb-5">Fine by Reason ({new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })})</h3>
              <div className="flex flex-col gap-4 text-sm">
                {Object.entries(byReason).length === 0 && (
                  <p className="text-[var(--text-md)] text-center py-4">No fines recorded</p>
                )}
                {Object.entries(byReason).map(([reason, data], i, arr) => (
                  <div key={reason} className={`flex justify-between items-center ${i < arr.length - 1 ? 'border-b border-gray-50 pb-3' : 'pb-1'}`}>
                    <div>
                      <div className="font-semibold text-gray-900">{reason}</div>
                      <div className="text-xs text-[var(--text-md)]">{data.count} incidents</div>
                    </div>
                    <div className="font-bold text-danger">₹{data.amount.toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
