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
    <div className="page-container leave-page">
      <NewRequestModal open={showModal} onClose={() => setShowModal(false)} onSaved={load} />
      <PageHeader 
        breadcrumbs={[
          { label: 'HR & Payroll', path: '#' },
          { label: 'Leave Management' }
        ]}
        searchPlaceholder="Search employee..."
        actions={
          <div className="leave-actions">
            <Button variant="outline" className="leave-action-btn leave-action-btn-outline">
              <Calendar size={16} /> {new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })} <ChevronDown size={14} />
            </Button>
            <Button variant="outline" className="leave-action-btn leave-action-btn-outline">
              <Download size={16} /> Export
            </Button>
            <Button variant="primary" className="leave-action-btn leave-action-btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Add Leave Request
            </Button>
          </div>
        }
      />

      <div className="page-content leave-page">
        <div className="leave-heading-block">
          <h1 className="leave-title">Leave Management</h1>
          <p className="leave-subtitle">Review and manage employee leave applications. Track leave balances and history.</p>
        </div>

        <div className="stats-grid mb-6">
          <Card className="stat-card stat-pending">
            <div className="stat-card-left">
              <div className="stat-label">Pending Requests</div>
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-sub">Awaiting approval</div>
            </div>
            <div className="stat-icon-wrapper orange-bg">
              <Clock size={16} className="text-[#f97316]" />
            </div>
          </Card>

          <Card className="stat-card stat-on-leave">
            <div className="stat-card-left">
              <div className="stat-label">On Leave Today</div>
              <div className="stat-value">{stats.on_leave}</div>
              <div className="stat-sub">Approved & active</div>
            </div>
            <div className="stat-icon-wrapper orange-bg">
              <FileMinus size={16} className="text-[#f97316]" />
            </div>
          </Card>

          <Card className="stat-card stat-approved">
            <div className="stat-card-left">
              <div className="stat-label">Approved This Month</div>
              <div className="stat-value">{stats.approved_month}</div>
              <div className="stat-sub">
                <span className="text-emerald-600 font-bold flex items-center gap-0.5">Approved <span className="text-slate-500 font-normal">in {new Date().toLocaleString('en-GB', { month: 'short' })}</span></span>
              </div>
            </div>
            <div className="stat-icon-wrapper blue-bg">
              <CalendarCheck size={16} className="text-[#3b82f6]" />
            </div>
          </Card>

          <Card className="stat-card stat-total-days">
            <div className="stat-card-left">
              <div className="stat-label">Total Leave Days Used</div>
              <div className="stat-value">{stats.total_days}</div>
              <div className="stat-sub">Across all staff this month</div>
            </div>
            <div className="stat-icon-wrapper blue-bg">
              <BarChart2 size={16} className="text-[#3b82f6]" />
            </div>
          </Card>
        </div>

        <div className="dashboard-grid">
          <div className="main-column">
            <Card className="h-full">
              <div className="card-header-flex">
                <h3 className="section-title">Leave Requests</h3>
                <div className="leave-filter-row">
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="leave-filter-select"
                  >
                    <option value="">All Types</option>
                    {leaveTypes.map(lt => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="leave-filter-select"
                  >
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div className="leave-list">
                {loading && <p className="leave-empty">Loading…</p>}
                {!loading && filtered.length === 0 && (
                  <p className="leave-empty">No leave requests found.</p>
                )}
                {filtered.map((req, i) => {
                  const days = daysDiff(req.start_date, req.end_date);
                  const isRejected = req.status === 'rejected';
                  const statusClass = `leave-request-item status-${(req.status || 'pending').toLowerCase()}`;
                  return (
                    <div key={req.id || i} className={statusClass} style={{ opacity: isRejected ? 0.7 : 1 }}>
                      <div className="leave-request-top">
                        <div className="leave-request-meta">
                          <img
                            src={`https://i.pravatar.cc/150?u=leave_${req.employee_id}`}
                            className="leave-avatar"
                            alt="avatar"
                          />
                          <div>
                            <div className="leave-name">{req.employee_name || `Employee ${req.employee_id}`}</div>
                            <div className="leave-muted">{req.employee_code || ''} {req.department_name ? `• ${req.department_name}` : ''}</div>
                            <div className="leave-subtext">
                              {leaveTypeBadge(req.leave_type_name || 'Leave')}
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Calendar size={12}/> {fmtDate(req.start_date)} — {fmtDate(req.end_date)}
                              </span>
                              <span>{days} {days === 1 ? 'day' : 'days'}</span>
                              <span>Applied: {fmtDate(req.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="leave-request-actions">
                          {statusBadge(req.status)}
                          {req.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <Button variant="outline" size="sm" className="leave-action-btn leave-action-btn-outline" onClick={() => handleReview(req.id, 'approved')}>Approve</Button>
                              <Button variant="outline" size="sm" className="leave-action-btn leave-action-btn-outline" onClick={() => handleReview(req.id, 'rejected')}>Reject</Button>
                            </div>
                          )}
                        </div>
                      </div>
                      {req.reason && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eef2f7', fontSize: 12, color: '#64748b' }}>
                          <span style={{ fontWeight: 600, color: '#374151' }}>Reason: </span>{req.reason}
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
              <h3 className="section-title" style={{ marginBottom: 20 }}>Leave Types — {new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</h3>
              <div className="leave-panel-stack">
                {leaveBreakdown.length === 0 && <p className="leave-empty">No leave types configured</p>}
                {leaveBreakdown.map(lt => (
                  <div key={lt.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span className="leave-name">{lt.name}</span>
                      <span className="leave-name">{lt.days} <span className="leave-muted" style={{ fontWeight: 400 }}>days</span></span>
                    </div>
                    <div className="leave-bar-track">
                      <div
                        className="leave-bar-fill"
                        style={{ width: `${Math.min(100, (lt.days / (lt.max_days || 30)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* On Leave Today */}
            <Card>
              <div className="card-header-flex">
                <h3 className="section-title">On Leave Today</h3>
                <span className="badge-soft-danger">{onLeaveToday.length} absent</span>
              </div>
              <div className="leave-panel-stack">
                {onLeaveToday.length === 0 && <p className="leave-empty">No one on leave today</p>}
                {onLeaveToday.slice(0, 5).map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={`https://i.pravatar.cc/150?u=today_${r.employee_id}`} className="leave-avatar" alt="avatar" style={{ flexShrink: 0 }}/>
                    <div style={{ flex: 1 }}>
                      <div className="leave-name">{r.employee_name || `Employee ${r.employee_id}`}</div>
                      <div className="leave-muted">{r.leave_type_name || 'Leave'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Returns</div>
                      <div className="leave-name" style={{ fontSize: 12 }}>{fmtDate(r.end_date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Leave Policy */}
            <Card>
              <h3 className="section-title">Leave Policy Summary</h3>
              <div className="leave-panel-stack">
                {leavePolicy.length === 0 && <p className="leave-empty">No policies configured</p>}
                {leavePolicy.map((lt, i) => (
                  <div key={lt.id} className={`flex justify-between ${i < leavePolicy.length - 1 ? 'border-b border-gray-50 pb-2' : 'pb-2'}`}>
                    <span className="leave-name">{lt.name}</span>
                    <span className="leave-name" style={{ color: '#24428b' }}>
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
