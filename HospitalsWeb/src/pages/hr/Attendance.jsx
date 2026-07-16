import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  UserCheck, UserMinus, Clock, Timer, 
  Download, RefreshCw, Calendar as CalendarIcon, ChevronDown
} from 'lucide-react';
import './Attendance.css';

function fmtMins(mins) {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtTime(t) {
  if (!t) return '—';
  return t.slice(0, 5);
}

function statusBadge(status) {
  switch ((status || '').toLowerCase()) {
    case 'present': return <span className="badge badge-success-light border border-success/20">Present</span>;
    case 'absent':  return <span className="badge badge-danger-light border border-danger/20 text-danger">Absent</span>;
    case 'late':    return <span className="badge badge-warning-light border border-warning/20 text-warning">Late</span>;
    case 'half_day': return <span className="badge bg-orange-50 border border-orange-200 text-orange-600">Half Day</span>;
    default:        return <span className="badge">{status}</span>;
  }
}

export function Attendance() {
  const { request, loading } = useApi();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, ot_mins: 0, total: 0 });
  const [deptFilter, setDeptFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [departments, setDepartments] = useState([]);
  const [shifts, setShifts] = useState([]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ date, limit: 200 });
      if (deptFilter) params.set('department_id', deptFilter);
      if (shiftFilter) params.set('shift_id', shiftFilter);
      const res = await request(`/attendance?${params}`);
      const rows = res?.data?.rows || res?.data || [];
      setRecords(rows);

      // compute stats from rows
      const present = rows.filter(r => r.status === 'present').length;
      const late    = rows.filter(r => r.status === 'late').length;
      const absent  = rows.filter(r => r.status === 'absent').length;
      const ot_mins = rows.reduce((sum, r) => sum + (Number(r.overtime_minutes) || 0), 0);
      setStats({ present: present + late, absent, late, ot_mins, total: rows.length });
    } catch (_) {}
  }, [date, deptFilter, shiftFilter]);

  useEffect(() => {
    request('/hr/departments').then(r => setDepartments(r?.data || [])).catch(() => {});
    request('/hr/shifts').then(r => setShifts(r?.data || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayDate = new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="attendance-page hr-overview-page">
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
              <RefreshCw size={16} /> <span>Sync Biometric</span>
            </button>
          </div>
        }
      />

      <div className="page-content attendance-page">
        <div className="hr-title-section">
          <h1 className="hr-title-main">Attendance — {displayDate}</h1>
          <p className="hr-title-desc">Live attendance log synced from biometric terminals across all departments.</p>
        </div>

        <div className="stats-grid mb-6">
          <Card className="stat-card stat-present">
            <div className="stat-card-left">
              <div className="stat-label">Present Today</div>
              <div className="stat-value">{stats.present}</div>
              <div className="stat-sub stat-sub-inline"><span>of {stats.total} scheduled</span></div>
            </div>
            <div className="stat-icon-wrapper blue-bg">
              <UserCheck size={16} />
            </div>
          </Card>

          <Card className="stat-card stat-absent">
            <div className="stat-card-left">
              <div className="stat-label">Absent</div>
              <div className="stat-value">{stats.absent}</div>
              <div className="stat-sub">Unplanned or on leave</div>
            </div>
            <div className="stat-icon-wrapper orange-bg">
              <UserMinus size={16} />
            </div>
          </Card>

          <Card className="stat-card stat-late">
            <div className="stat-card-left">
              <div className="stat-label">Late Arrivals</div>
              <div className="stat-value">{stats.late}</div>
              <div className="stat-sub">Requires delay check</div>
            </div>
            <div className="stat-icon-wrapper orange-bg">
              <Clock size={16} />
            </div>
          </Card>

          <Card className="stat-card stat-ot">
            <div className="stat-card-left">
              <div className="stat-label">Overtime Today</div>
              <div className="stat-value">{fmtMins(stats.ot_mins)}</div>
              <div className="stat-sub">Total OT minutes</div>
            </div>
            <div className="stat-icon-wrapper blue-bg">
              <Timer size={16} />
            </div>
          </Card>
        </div>

        <div className="dashboard-grid">
          <div className="main-column">
            <Card className="h-full">
              <div className="card-header-flex">
                <h3 className="section-title">Today's Attendance Log</h3>
                <div className="filter-row">
                  <select
                    value={deptFilter}
                    onChange={e => setDeptFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All Depts</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select
                    value={shiftFilter}
                    onChange={e => setShiftFilter(e.target.value)}
                    className="filter-select"
                  >
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
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={9} className="attendance-empty">Loading…</td></tr>
                    )}
                    {!loading && records.length === 0 && (
                      <tr><td colSpan={9} className="attendance-empty">No attendance records for this date.</td></tr>
                    )}
                    {records.map((r, i) => {
                      const isLate = r.status === 'late';
                      const hasOT = (r.overtime_minutes || 0) > 0;
                      return (
                        <tr key={r.id || i} className={isLate ? 'attendance-row attendance-row-late' : hasOT ? 'attendance-row attendance-row-overtime' : 'attendance-row'}>
                          <td className="attendance-td">
                            <div className="attendance-employee-cell">
                              <img
                                src={`https://i.pravatar.cc/150?u=${r.employee_id}`}
                                className="attendance-avatar"
                                alt="avatar"
                              />
                              <div>
                                <div className="attendance-employee-name">{r.employee_name || r.full_name || `EMP${r.employee_id}`}</div>
                                <div className="attendance-employee-code">{r.employee_code || `EMP${String(r.employee_id).padStart(3,'0')}`}</div>
                              </div>
                            </div>
                          </td>
                          <td className="attendance-td attendance-muted">{r.department_name || r.department || '—'}</td>
                          <td className="attendance-td attendance-shift">{r.shift_name || r.shift || '—'}</td>
                          <td className="attendance-td attendance-strong">{fmtTime(r.first_punch_in || r.check_in)}</td>
                          <td className="attendance-td attendance-strong">{fmtTime(r.last_punch_out || r.check_out)}</td>
                          <td className="attendance-td attendance-normal">{fmtMins(r.worked_minutes)}</td>
                          <td className={`attendance-td ${(r.late_minutes || 0) > 0 ? 'attendance-late' : 'attendance-muted'}`}>
                            {(r.late_minutes || 0) > 0 ? fmtMins(r.late_minutes) : '—'}
                          </td>
                          <td className={`attendance-td ${(r.overtime_minutes || 0) > 0 ? 'attendance-overtime' : 'attendance-muted'}`}>
                            {(r.overtime_minutes || 0) > 0 ? fmtMins(r.overtime_minutes) : '—'}
                          </td>
                          <td className="attendance-td">{statusBadge(r.status)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="side-column flex flex-col gap-6">
            {/* Late Arrivals */}
            <Card>
              <div className="card-header-flex">
                <h3 className="section-title">Late Arrivals</h3>
                <span className="badge badge-soft-warning">3 today</span>
              </div>
              <div className="late-list">
                {records.filter(r => r.status === 'late').slice(0, 3).map((r, i) => (
                  <div key={i} className="late-item">
                    <div className="late-icon">
                      <Clock size={16} />
                    </div>
                    <div className="late-meta">
                      <div className="late-name">{r.employee_name || `EMP${r.employee_id}`}</div>
                      <div className="late-dept">{r.department_name || '—'}</div>
                    </div>
                    <div className="late-duration">{fmtMins(r.late_minutes)}</div>
                  </div>
                ))}
                {records.filter(r => r.status === 'late').length === 0 && (
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
                    <img
                      src={`https://i.pravatar.cc/150?u=abs_${r.employee_id}`}
                      className="attendance-avatar attendance-avatar-md"
                      alt="avatar"
                    />
                    <div className="absent-meta">
                      <div className="absent-name">{r.employee_name || `EMP${r.employee_id}`}</div>
                      <div className="absent-sub">{r.department_name || '—'} • {r.shift_name || '—'}</div>
                    </div>
                  </div>
                ))}
                {records.filter(r => r.status === 'absent').length === 0 && (
                  <p className="empty-note">No absences today</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
