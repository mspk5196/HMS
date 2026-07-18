import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { 
  UserCheck, UserMinus, Clock, Timer, 
  Download, RefreshCw, Pencil, X, CheckCircle, AlertCircle,
  Fingerprint, Shield
} from 'lucide-react';
import './Attendance.css';

/* ─── Helpers ──────────────────────────────────────────── */
function fmtMins(mins) {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtTime(t) {
  if (!t) return '—';
  // Handle full datetime strings like "2024-01-18T09:05:00.000Z"
  if (t.includes('T') || t.includes(' ')) {
    const d = new Date(t);
    if (!isNaN(d)) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  return t.slice(0, 5);
}

function timeToMins(t) {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

function statusBadge(status, lateMinutes = 0) {
  if (lateMinutes > 0 && status === 'present') {
    return <span className="badge badge-warning-light">Late</span>;
  }
  switch ((status || '').toLowerCase()) {
    case 'present':      return <span className="badge badge-success-light">Present</span>;
    case 'absent':       return <span className="badge badge-danger-light">Absent</span>;
    case 'on_leave':     return <span className="badge badge-half-day">On Leave</span>;
    case 'lop':          return <span className="badge badge-danger-light">LOP</span>;
    case 'week_off':     return <span className="badge badge-no-record">Week Off</span>;
    case 'holiday':      return <span className="badge badge-success-light">Holiday</span>;
    case '':             return <span className="badge badge-no-record">No Entry</span>;
    default:             return <span className="badge">{status}</span>;
  }
}

/* ─── Manual Entry Modal ────────────────────────────────── */
function ManualEntryModal({ record, date, shiftStart, onClose, onSaved }) {
  const { request } = useApi();
  const [form, setForm] = useState({
    check_in: record?.first_punch_in ? fmtTime(record.first_punch_in) : '',
    check_out: record?.last_punch_out ? fmtTime(record.last_punch_out) : '',
    ot_hours: '0',
    ot_mins: '0',
  });
  const [buffer, setBuffer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load buffer for this employee
  useEffect(() => {
    if (!record?.employee_id) return;
    const m = new Date(date).getMonth() + 1;
    const y = new Date(date).getFullYear();
    request(`/attendance/buffer/employee/${record.employee_id}?month=${m}&year=${y}`)
      .then(r => setBuffer(r?.data || null))
      .catch(() => {});
  }, [record?.employee_id, date]);

  // Compute preview values
  const inMins   = timeToMins(form.check_in);
  const outMins  = timeToMins(form.check_out);
  const shiftMins = timeToMins(shiftStart || '09:00');

  const workedMins = form.check_out ? Math.max(0, outMins - inMins) : 0;
  const rawLate    = form.check_in  ? Math.max(0, inMins - shiftMins) : 0;
  const bufferLeft = buffer ? Number(buffer.buffer_remaining_minutes ?? 0) : 0;
  const absorbed   = Math.min(rawLate, bufferLeft);
  const effectiveLate = Math.max(0, rawLate - absorbed);
  const otMins     = Number(form.ot_hours) * 60 + Number(form.ot_mins);

  const handleSave = async () => {
    if (!form.check_in) { showToast('Check-in time is required', 'error'); return; }
    setSaving(true);
    try {
      await request('/attendance/manual-punch', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: record.employee_id,
          date,
          check_in: form.check_in,
          check_out: form.check_out || null,
          overtime_minutes: otMins,
        })
      });
      showToast(`Attendance saved for ${record.employee_name || record.full_name}`);
      setTimeout(() => { onSaved(); onClose(); }, 1200);
    } catch (err) {
      showToast(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const bufferPct = buffer
    ? Math.round((Number(buffer.buffer_used_minutes) / Number(buffer.buffer_allocated_minutes)) * 100)
    : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon"><Fingerprint size={18} /></div>
            <div>
              <div className="modal-title">Manual Biometric Entry</div>
              <div className="modal-subtitle">
                {record?.employee_name || record?.full_name} — {new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Toast inside modal */}
        {toast && (
          <div className={`modal-toast ${toast.type === 'error' ? 'modal-toast-error' : 'modal-toast-success'}`}>
            {toast.type === 'error' ? <AlertCircle size={13} /> : <CheckCircle size={13} />}
            <span>{toast.msg}</span>
          </div>
        )}

        <div className="modal-body">
          {/* Time Inputs */}
          <div className="modal-time-grid">
            <div className="modal-field">
              <label className="modal-label">Check-In Time *</label>
              <input
                type="time"
                className="modal-input"
                value={form.check_in}
                onChange={e => setForm({ ...form, check_in: e.target.value })}
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Check-Out Time</label>
              <input
                type="time"
                className="modal-input"
                value={form.check_out}
                onChange={e => setForm({ ...form, check_out: e.target.value })}
              />
            </div>
          </div>

          {/* OT Entry */}
          <div className="modal-field" style={{ marginTop: '12px' }}>
            <label className="modal-label">Overtime (OT)</label>
            <div className="ot-input-group">
              <div className="ot-unit">
                <input
                  type="number"
                  min="0"
                  max="12"
                  className="modal-input ot-num-input"
                  value={form.ot_hours}
                  onChange={e => setForm({ ...form, ot_hours: e.target.value })}
                />
                <span className="ot-unit-label">hrs</span>
              </div>
              <div className="ot-unit">
                <input
                  type="number"
                  min="0"
                  max="59"
                  className="modal-input ot-num-input"
                  value={form.ot_mins}
                  onChange={e => setForm({ ...form, ot_mins: e.target.value })}
                />
                <span className="ot-unit-label">min</span>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          {form.check_in && (
            <div className="attendance-preview">
              <div className="preview-title"><Shield size={12} /> Computed Preview</div>
              <div className="preview-grid">
                <div className="preview-item">
                  <span className="preview-label">Shift Start</span>
                  <span className="preview-val">{shiftStart || '09:00'}</span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">Worked</span>
                  <span className="preview-val">{fmtMins(workedMins)}</span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">Effective Late</span>
                  <span className={`preview-val ${effectiveLate > 0 ? 'preview-late' : 'preview-ok'}`}>{effectiveLate > 0 ? `${effectiveLate}m` : '✓ None'}</span>
                </div>
                <div className="preview-item">
                  <span className="preview-label">OT</span>
                  <span className="preview-val preview-ot">{otMins > 0 ? fmtMins(otMins) : '—'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Grace Buffer Bar */}
          {buffer && (
            <div className="buffer-section">
              <div className="buffer-header">
                <span className="buffer-label">Monthly Late Buffer — {buffer.role_name || 'Role'}</span>
                <span className="buffer-remaining">{buffer.buffer_remaining_minutes}m left</span>
              </div>
              <div className="buffer-bar-track">
                <div
                  className={`buffer-bar-fill ${bufferPct >= 100 ? 'buffer-exhausted' : bufferPct >= 75 ? 'buffer-warning' : 'buffer-ok'}`}
                  style={{ width: `${Math.min(bufferPct, 100)}%` }}
                />
              </div>
              <div className="buffer-legend">
                <span>{buffer.buffer_used_minutes}m used</span>
                <span>{buffer.buffer_allocated_minutes}m total (from role)</span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────── */
export function Attendance() {
  const { request, loading } = useApi();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState([]);       // merged rows shown in table
  const [allEmployees, setAllEmployees] = useState([]); // base employee list
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, ot_mins: 0, total: 0 });
  const [deptFilter, setDeptFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [departments, setDepartments] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [modalRecord, setModalRecord] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    try {
      // 1. Fetch all active employees (with optional dept filter)
      const empParams = new URLSearchParams({ limit: 500, status: 'active' });
      if (deptFilter) empParams.set('departmentId', deptFilter);
      const empRes = await request(`/hr/employees?${empParams}`);
      const employees = empRes?.data?.rows || empRes?.data || [];

      // 2. Fetch existing attendance records for this date
      const attParams = new URLSearchParams({ date, limit: 500 });
      if (deptFilter) attParams.set('department_id', deptFilter);
      if (shiftFilter) attParams.set('shift_id', shiftFilter);
      let attRows = [];
      try {
        const attRes = await request(`/attendance?${attParams}`);
        attRows = attRes?.data?.rows || attRes?.data || [];
      } catch (_) {}

      // 3. Build a lookup: employee_id → attendance record
      const attMap = {};
      for (const row of attRows) attMap[row.employee_id] = row;

      // 4. Merge: every employee gets shown, with their attendance data if it exists
      const merged = employees
        .filter(emp => !shiftFilter || emp.shift_id == shiftFilter)
        .map(emp => ({
          // Base employee fields
          employee_id:   emp.id,
          employee_name: emp.full_name,
          employee_code: emp.employee_code,
          department_name: emp.department_name,
          designation_name: emp.designation_name,
          shift_id:      null,
          shift_name:    null,
          // Overlay with real attendance if it exists
          ...(attMap[emp.id] || { status: null, first_punch_in: null, last_punch_out: null,
                                    worked_minutes: 0, late_minutes: 0, overtime_minutes: 0 }),
          // Keep employee_id from emp (attMap may override correctly)
          employee_id: emp.id,
        }));

      setAllEmployees(employees);
      setRecords(merged);

      // 5. Recompute stats
      const present  = merged.filter(r => r.status === 'present').length;
      const late     = merged.filter(r => (r.late_minutes || 0) > 0).length;
      const absent   = merged.filter(r => r.status === 'absent').length;
      const ot_mins  = merged.reduce((s, r) => s + (Number(r.overtime_minutes) || 0), 0);
      setStats({ present, absent, late, ot_mins, total: merged.length });
    } catch (e) { console.error('Attendance load error', e); }
  }, [date, deptFilter, shiftFilter, request]);

  useEffect(() => {
    request('/hr/departments').then(r => setDepartments(r?.data || [])).catch(() => {});
    request('/hr/shifts').then(r => setShifts(r?.data || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // Find shift start time for the selected row
  const getShiftStart = (rec) => {
    const shift = shifts.find(s => s.id === rec.shift_id);
    return shift?.start_time?.slice(0, 5) || null;
  };

  return (
    <div className="attendance-page hr-overview-page">
      {/* Global Toast */}
      {toast && (
        <div className={`att-toast ${toast.type === 'error' ? 'att-toast-error' : 'att-toast-success'}`}>
          {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle size={15} />}
          <span>{toast.msg}</span>
        </div>
      )}

      <PageHeader 
        breadcrumbs={[
          { label: 'HR & Payroll', path: '#' },
          { label: 'Attendance' }
        ]}
        searchPlaceholder="Search employee..."
        actions={
          <div className="attendance-actions">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="attendance-date-input"
            />
            <button className="hr-btn hr-btn-outline" style={{ borderRadius: '8px', height: '36px', padding: '0 18px' }}>
              <Download size={16} /> <span>Export</span>
            </button>
            <button onClick={load} className="hr-btn hr-btn-primary" style={{ borderRadius: '8px', height: '36px', padding: '0 18px' }}>
              <RefreshCw size={16} /> <span>Refresh</span>
            </button>
          </div>
        }
      />

      <div className="page-content attendance-page">
        <div className="hr-title-section">
          <h1 className="hr-title-main">Attendance — {displayDate}</h1>
          <p className="hr-title-desc">Manual biometric entry per employee. Late minutes are deducted from the monthly buffer pool assigned to their role.</p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid mb-6">
          <Card className="stat-card stat-present">
            <div className="stat-card-left">
              <div className="stat-label">Present Today</div>
              <div className="stat-value">{stats.present}</div>
              <div className="stat-sub stat-sub-inline"><span>of {stats.total} scheduled</span></div>
            </div>
            <div className="stat-icon-wrapper blue-bg"><UserCheck size={16} /></div>
          </Card>

          <Card className="stat-card stat-absent">
            <div className="stat-card-left">
              <div className="stat-label">Absent</div>
              <div className="stat-value">{stats.absent}</div>
              <div className="stat-sub">Unplanned or on leave</div>
            </div>
            <div className="stat-icon-wrapper orange-bg"><UserMinus size={16} /></div>
          </Card>

          <Card className="stat-card stat-late">
            <div className="stat-card-left">
              <div className="stat-label">Late Arrivals</div>
              <div className="stat-value">{stats.late}</div>
              <div className="stat-sub">After buffer deduction</div>
            </div>
            <div className="stat-icon-wrapper orange-bg"><Clock size={16} /></div>
          </Card>

          <Card className="stat-card stat-ot">
            <div className="stat-card-left">
              <div className="stat-label">Total OT Today</div>
              <div className="stat-value">{fmtMins(stats.ot_mins)}</div>
              <div className="stat-sub">Manually entered</div>
            </div>
            <div className="stat-icon-wrapper blue-bg"><Timer size={16} /></div>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="dashboard-grid">
          <div className="main-column">
            <Card className="h-full">
              <div className="card-header-flex">
                <h3 className="section-title">Attendance Log</h3>
                <div className="filter-row">
                  <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="filter-select">
                    <option value="">All Depts</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select value={shiftFilter} onChange={e => setShiftFilter(e.target.value)} className="filter-select">
                    <option value="">All Shifts</option>
                    {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="attendance-table">
                  <thead>
                    <tr>
                      <th className="attendance-th attendance-th-wide">Employee</th>
                      <th className="attendance-th">Dept</th>
                      <th className="attendance-th">Shift</th>
                      <th className="attendance-th">In</th>
                      <th className="attendance-th">Out</th>
                      <th className="attendance-th">Worked</th>
                      <th className="attendance-th">Late</th>
                      <th className="attendance-th">OT</th>
                      <th className="attendance-th">Status</th>
                      <th className="attendance-th">Entry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={10} className="attendance-empty">Loading…</td></tr>
                    )}
                    {!loading && records.length === 0 && (
                      <tr>
                        <td colSpan={10} className="attendance-empty">
                          No employees found. Make sure employees are added in the HR module.
                        </td>
                      </tr>
                    )}
                    {records.map((r, i) => {
                      const isLate = (r.late_minutes || 0) > 0;
                      const hasOT  = (r.overtime_minutes || 0) > 0;
                      const noEntry = !r.status;
                      return (
                        <tr key={r.employee_id || i} className={
                          isLate   ? 'attendance-row attendance-row-late'
                          : hasOT  ? 'attendance-row attendance-row-overtime'
                          : noEntry ? 'attendance-row attendance-row-noentry'
                          : 'attendance-row'
                        }>
                          <td className="attendance-td">
                            <div className="attendance-employee-cell">
                              <div className="attendance-logo">
                                <Shield size={20} />
                              </div>
                              <div>
                                <div className="attendance-employee-name">{r.employee_name || r.full_name || `EMP${r.employee_id}`}</div>
                                <div className="attendance-employee-code">{r.employee_code || `EMP${String(r.employee_id).padStart(3,'0')}`}</div>
                              </div>
                            </div>
                          </td>
                          <td className="attendance-td attendance-muted">{r.department_name || '—'}</td>
                          <td className="attendance-td attendance-shift">{r.shift_name || '—'}</td>
                          <td className="attendance-td attendance-strong">{fmtTime(r.first_punch_in || r.check_in)}</td>
                          <td className="attendance-td attendance-strong">{fmtTime(r.last_punch_out || r.check_out)}</td>
                          <td className="attendance-td attendance-normal">{fmtMins(r.worked_minutes)}</td>
                          <td className={`attendance-td ${(r.late_minutes || 0) > 0 ? 'attendance-late' : 'attendance-muted'}`}>
                            {(r.late_minutes || 0) > 0 ? fmtMins(r.late_minutes) : '—'}
                          </td>
                          <td className={`attendance-td ${(r.overtime_minutes || 0) > 0 ? 'attendance-overtime' : 'attendance-muted'}`}>
                            {(r.overtime_minutes || 0) > 0 ? fmtMins(r.overtime_minutes) : '—'}
                          </td>
                          <td className="attendance-td">{statusBadge(r.status, r.late_minutes)}</td>
                          <td className="attendance-td">
                            <button
                              className="edit-punch-btn"
                              title="Enter biometric times manually"
                              onClick={() => setModalRecord(r)}
                            >
                              <Pencil size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="side-column">
            {/* Late Arrivals */}
            <Card>
              <div className="card-header-flex">
                <h3 className="section-title">Late Arrivals</h3>
                <span className="badge badge-soft-warning">{stats.late} today</span>
              </div>
              <div className="late-list">
                {records.filter(r => r.status === 'late' || r.status === 'late_present').slice(0, 5).map((r, i) => (
                  <div key={i} className="late-item">
                    <div className="late-icon"><Clock size={16} /></div>
                    <div className="late-meta">
                      <div className="late-name">{r.employee_name || r.full_name || `EMP${r.employee_id}`}</div>
                      <div className="late-dept">{r.department_name || '—'}</div>
                    </div>
                    <div className="late-duration">{fmtMins(r.late_minutes)}</div>
                  </div>
                ))}
                {records.filter(r => r.status === 'late' || r.status === 'late_present').length === 0 && (
                  <p className="empty-note">No late arrivals</p>
                )}
              </div>
            </Card>

            {/* Absent Today */}
            <Card>
              <div className="card-header-flex">
                <h3 className="section-title">Absent Today</h3>
                <span className="badge badge-soft-danger">{stats.absent} absent</span>
              </div>
              <div className="absent-list">
                {records.filter(r => r.status === 'absent').slice(0, 5).map((r, i) => (
                  <div key={i} className="absent-item">
                    <div className="attendance-logo attendance-logo-md"><Shield size={20} /></div>
                    <div className="absent-meta">
                      <div className="absent-name">{r.employee_name || r.full_name || `EMP${r.employee_id}`}</div>
                      <div className="absent-sub">{r.department_name || '—'} • {r.shift_name || '—'}</div>
                    </div>
                  </div>
                ))}
                {records.filter(r => r.status === 'absent').length === 0 && (
                  <p className="empty-note">No absences today</p>
                )}
              </div>
            </Card>

            {/* How it works */}
            <Card>
              <div className="card-header-flex">
                <h3 className="section-title">Buffer Logic</h3>
              </div>
              <div style={{ padding: '14px 20px 20px', fontSize: '12px', color: '#64748b', lineHeight: '1.7' }}>
                <p style={{ margin: '0 0 10px' }}>
                  When an employee is late, their <strong>late minutes</strong> are absorbed from their role's <strong>monthly buffer pool</strong>.
                </p>
                <p style={{ margin: '0 0 10px' }}>
                  If the buffer is exhausted, remaining late minutes count as <strong>effective late</strong> and are deducted from salary.
                </p>
                <p style={{ margin: 0, color: '#94a3b8' }}>
                  Buffer allocation is set per role in <em>Staff Roles</em> → Monthly Buffer Minutes.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {modalRecord && (
        <ManualEntryModal
          record={modalRecord}
          date={date}
          shiftStart={getShiftStart(modalRecord)}
          onClose={() => setModalRecord(null)}
          onSaved={() => {
            load();
            showToast(`Attendance updated for ${modalRecord.employee_name || modalRecord.full_name}`);
          }}
        />
      )}
    </div>
  );
}
