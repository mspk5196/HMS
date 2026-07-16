import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  Clock, FileMinus, CalendarCheck, BarChart2,
  Calendar, ChevronDown, Download, Plus, X
} from 'lucide-react';
import './Leave.css';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function statusBadge(status) {
  switch ((status || '').toLowerCase()) {
    case 'pending':  return <span className="badge badge-warning-light text-warning border border-warning/20">Pending</span>;
    case 'approved': return <span className="badge badge-success-light text-success border border-success/20">Approved</span>;
    case 'rejected': return <span className="badge badge-danger-light text-danger border border-danger/20">Rejected</span>;
    default:         return <span className="badge">{status}</span>;
  }
}

function leaveTypeBadge(type) {
  const lower = (type || '').toLowerCase();
  if (lower.includes('sick'))    return <span className="badge bg-danger/10 text-danger border-none">{type}</span>;
  if (lower.includes('casual'))  return <span className="badge bg-warning/10 text-warning border-none">{type}</span>;
  if (lower.includes('annual'))  return <span className="badge bg-primary/10 text-primary border-none">{type}</span>;
  if (lower.includes('maternity')) return <span className="badge bg-purple-100 text-purple-600 border-none">{type}</span>;
  return <span className="badge bg-gray-100 text-gray-600 border-none">{type}</span>;
}

function daysDiff(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  return Math.ceil((e - s) / 86400000) + 1;
}

function NewRequestModal({ open, onClose, onSaved }) {
  const { request, loading } = useApi();
  const [employees, setEmployees] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [form, setForm] = useState({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', reason: '' });
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    request('/hr/employees?limit=200').then(r => setEmployees(r?.data?.rows || r?.data || [])).catch(() => {});
    request('/leave/types').then(r => setLeaveTypes(r?.data || [])).catch(() => {});
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      await request('/leave/requests', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: Number(form.employee_id),
          leave_type_id: Number(form.leave_type_id),
          start_date: form.start_date,
          end_date: form.end_date,
          reason: form.reason,
        })
      });
      onSaved(); onClose();
    } catch (e) { setErr(e.message); }
  };

  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 480 }}>
        <div className="modal-header">
          <h2 className="text-sm font-bold">Add Leave Request</h2>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div>
              <label className="field-label">Employee *</label>
              <select className="field" required value={form.employee_id} onChange={e => set('employee_id', e.target.value)}>
                <option value="">Select employee...</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Leave Type *</label>
              <select className="field" required value={form.leave_type_id} onChange={e => set('leave_type_id', e.target.value)}>
                <option value="">Select type...</option>
                {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Start Date *</label>
                <input className="field" type="date" required value={form.start_date} onChange={e => set('start_date', e.target.value)} />
              </div>
              <div>
                <label className="field-label">End Date *</label>
                <input className="field" type="date" required value={form.end_date} onChange={e => set('end_date', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label">Reason</label>
              <textarea className="field h-20 resize-none" placeholder="Reason for leave..." value={form.reason} onChange={e => set('reason', e.target.value)} />
            </div>
            {err && <p className="text-danger text-xs">{err}</p>}
          </div>
          <div className="modal-footer">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={loading}>{loading ? 'Submitting…' : 'Submit Request'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Leave() {
  const { request, loading } = useApi();
  const [requests, setRequests] = useState([]);
  const [onLeaveToday, setOnLeaveToday] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leavePolicy, setLeavePolicy] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({ pending: 0, on_leave: 0, approved_month: 0, total_days: 0 });

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (statusFilter) params.set('status', statusFilter);
      const res = await request(`/leave/requests?${params}`);
      const rows = res?.data?.rows || res?.data || [];
      setRequests(rows);

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const monthRows = rows.filter(r => {
        const d = new Date(r.created_at || r.start_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const onLeave = rows.filter(r => r.status === 'approved' && r.start_date <= today && r.end_date >= today);
      setOnLeaveToday(onLeave);
      setStats({
        pending: rows.filter(r => r.status === 'pending').length,
        on_leave: onLeave.length,
        approved_month: monthRows.filter(r => r.status === 'approved').length,
        total_days: monthRows.filter(r => r.status === 'approved').reduce((s, r) => s + daysDiff(r.start_date, r.end_date), 0),
      });
    } catch (_) {}
  }, [statusFilter]);

  useEffect(() => {
    request('/leave/types').then(r => {
      const types = r?.data || [];
      setLeaveTypes(types);
      setLeavePolicy(types);
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReview = async (id, decision) => {
    try {
      await request(`/leave/requests/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status: decision })
      });
      load();
    } catch (_) {}
  };

  const filtered = typeFilter
    ? requests.filter(r => String(r.leave_type_id) === typeFilter || (r.leave_type_name || '').includes(typeFilter))
    : requests;

  // Leave type breakdown for current month
  const leaveBreakdown = leaveTypes.map(lt => ({
    name: lt.name,
    days: requests.filter(r => r.leave_type_id === lt.id && r.status === 'approved')
      .reduce((s, r) => s + daysDiff(r.start_date, r.end_date), 0),
    max_days: lt.max_days_per_year || lt.annual_limit || 15,
  }));

  return (
    <div className="page-container">
      <NewRequestModal open={showModal} onClose={() => setShowModal(false)} onSaved={load} />
      <PageHeader 
        breadcrumbs={[
          { label: 'HR & Payroll', path: '#' },
          { label: 'Leave Management' }
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
            <Button variant="primary" className="bg-primary flex items-center gap-2" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Add Leave Request
            </Button>
          </div>
        }
      />

      <div className="page-content leave-page">
        <div className="page-header-text mb-6">
          <h1 className="text-2xl font-bold mb-1">Leave Management</h1>
          <p className="text-[var(--text-md)] text-sm">Review and manage employee leave applications. Track leave balances and history.</p>
        </div>

        <div className="stats-grid mb-6">
          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Pending Requests</div>
              <div className="stat-icon-wrapper bg-warning/10 text-warning"><Clock size={18} /></div>
            </div>
            <div className="stat-value">{stats.pending}</div>
            <div className="stat-sub">Awaiting approval</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">On Leave Today</div>
              <div className="stat-icon-wrapper bg-danger/10 text-danger"><FileMinus size={18} /></div>
            </div>
            <div className="stat-value">{stats.on_leave}</div>
            <div className="stat-sub">Approved & active</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Approved This Month</div>
              <div className="stat-icon-wrapper bg-success/10 text-success"><CalendarCheck size={18} /></div>
            </div>
            <div className="stat-value">{stats.approved_month}</div>
            <div className="stat-sub">{new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Total Leave Days Used</div>
              <div className="stat-icon-wrapper bg-primary/10 text-primary"><BarChart2 size={18} /></div>
            </div>
            <div className="stat-value">{stats.total_days}</div>
            <div className="stat-sub">Across all staff this month</div>
          </Card>
        </div>

        <div className="dashboard-grid">
          <div className="main-column">
            <Card className="h-full">
              <div className="card-header-flex mb-6">
                <h3 className="font-bold text-lg">Leave Requests</h3>
                <div className="flex gap-2">
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-primary"
                  >
                    <option value="">All Types</option>
                    {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-primary"
                  >
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="leave-requests-list flex flex-col gap-4">
                {loading && <p className="text-center text-[var(--text-md)] py-8">Loading…</p>}
                {!loading && filtered.length === 0 && (
                  <p className="text-center text-[var(--text-md)] py-8">No leave requests found.</p>
                )}
                {filtered.map((req, i) => {
                  const days = daysDiff(req.start_date, req.end_date);
                  const isRejected = req.status === 'rejected';
                  return (
                    <div key={req.id || i} className={`leave-request-item border border-gray-100 rounded-xl p-4 ${isRejected ? 'opacity-70' : ''}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={`https://i.pravatar.cc/150?u=leave_${req.employee_id}`}
                            className="w-10 h-10 rounded-full bg-gray-200"
                            alt="avatar"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">{req.employee_name || `Employee ${req.employee_id}`}</span>
                              <span className="text-xs text-[var(--text-md)]">{req.employee_code || ''} {req.department_name ? `• ${req.department_name}` : ''}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs">
                              {leaveTypeBadge(req.leave_type_name || 'Leave')}
                              <span className="flex items-center gap-1 text-[var(--text-md)]">
                                <Calendar size={12}/> {fmtDate(req.start_date)} — {fmtDate(req.end_date)}
                              </span>
                              <span className="font-medium text-gray-700">{days} {days === 1 ? 'day' : 'days'}</span>
                              <span className="text-[var(--text-md)]">Applied: {fmtDate(req.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                          {statusBadge(req.status)}
                          {req.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="text-success border-success hover:bg-success/10 h-8 px-3" onClick={() => handleReview(req.id, 'approved')}>Approve</Button>
                              <Button variant="outline" size="sm" className="text-danger border-danger hover:bg-danger/10 h-8 px-3" onClick={() => handleReview(req.id, 'rejected')}>Reject</Button>
                            </div>
                          )}
                        </div>
                      </div>
                      {req.reason && (
                        <div className="text-xs text-[var(--text-md)] border-t border-gray-100 pt-3">
                          <span className="font-medium">Reason: </span>{req.reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <div className="side-column flex flex-col gap-6">
            {/* Leave Types Breakdown */}
            <Card>
              <h3 className="font-bold mb-5">Leave Types — {new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</h3>
              <div className="flex flex-col gap-5 text-sm">
                {leaveBreakdown.length === 0 && <p className="text-[var(--text-md)] text-center py-4">No leave types configured</p>}
                {leaveBreakdown.map(lt => (
                  <div key={lt.name}>
                    <div className="flex justify-between font-semibold mb-2">
                      <span className="text-gray-900">{lt.name}</span>
                      <span className="text-gray-900">{lt.days} <span className="font-normal text-[var(--text-md)]">days</span></span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${Math.min(100, (lt.days / (lt.max_days || 30)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* On Leave Today */}
            <Card>
              <div className="card-header-flex mb-5">
                <h3 className="font-bold">On Leave Today</h3>
                <span className="badge badge-danger-light border border-danger text-danger">{onLeaveToday.length} absent</span>
              </div>
              <div className="flex flex-col gap-4">
                {onLeaveToday.length === 0 && <p className="text-sm text-[var(--text-md)] text-center py-4">No one on leave today</p>}
                {onLeaveToday.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <img src={`https://i.pravatar.cc/150?u=today_${r.employee_id}`} className="w-10 h-10 rounded-full bg-gray-200" alt="avatar"/>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-gray-900">{r.employee_name || `Employee ${r.employee_id}`}</div>
                      <div className="text-xs text-[var(--text-md)] mt-0.5">{r.leave_type_name || 'Leave'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xs text-gray-900">Returns</div>
                      <div className="text-xs text-[var(--text-md)]">{fmtDate(r.end_date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Leave Policy */}
            <Card>
              <h3 className="font-bold mb-5">Leave Policy Summary</h3>
              <div className="flex flex-col gap-4 text-sm text-[var(--text-md)] font-medium">
                {leavePolicy.length === 0 && <p className="text-center py-4">No policies configured</p>}
                {leavePolicy.map((lt, i) => (
                  <div key={lt.id} className={`flex justify-between ${i < leavePolicy.length - 1 ? 'border-b border-gray-50 pb-2' : 'pb-2'}`}>
                    <span>{lt.name}</span>
                    <span className="text-primary font-semibold">
                      {lt.max_days_per_year || lt.annual_limit || '—'} days/yr
                    </span>
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
