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
    <div className="page-container">
      <PageHeader 
        breadcrumbs={[
          { label: 'HR & Payroll', path: '#' },
          { label: 'Attendance' }
        ]}
        searchPlaceholder="Search employee..."
        actions={
          <div className="flex gap-3">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
            />
            <Button variant="outline" className="flex items-center gap-2">
              <Download size={16} /> Export
            </Button>
            <Button variant="primary" onClick={load} className="bg-primary flex items-center gap-2">
              <RefreshCw size={16} /> Sync Biometric
            </Button>
          </div>
        }
      />

      <div className="page-content attendance-page">
        <div className="page-header-text mb-6">
          <h1 className="text-2xl font-bold mb-1">Attendance — {displayDate}</h1>
          <p className="text-[var(--text-md)] text-sm">Live attendance log synced from biometric terminals across all departments.</p>
        </div>

        <div className="stats-grid mb-6">
          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Present Today</div>
              <div className="stat-icon-wrapper bg-success/10 text-success"><UserCheck size={18} /></div>
            </div>
            <div className="stat-value">{stats.present}</div>
            <div className="stat-sub">of {stats.total} scheduled</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Absent</div>
              <div className="stat-icon-wrapper bg-danger/10 text-danger"><UserMinus size={18} /></div>
            </div>
            <div className="stat-value">{stats.absent}</div>
            <div className="stat-sub">no-show or absent</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Late Arrivals</div>
              <div className="stat-icon-wrapper bg-warning/10 text-warning"><Clock size={18} /></div>
            </div>
            <div className="stat-value">{stats.late}</div>
            <div className="stat-sub">arrived after shift start</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Overtime Today</div>
              <div className="stat-icon-wrapper bg-primary/10 text-primary"><Timer size={18} /></div>
            </div>
            <div className="stat-value">{fmtMins(stats.ot_mins)}</div>
            <div className="stat-sub">across {records.filter(r => (r.overtime_minutes || 0) > 0).length} employees</div>
          </Card>
        </div>

        <div className="dashboard-grid">
          <div className="main-column">
            <Card className="h-full">
              <div className="card-header-flex mb-4">
                <h3 className="font-bold text-lg">Today's Attendance Log</h3>
                <div className="flex gap-2">
                  <select
                    value={deptFilter}
                    onChange={e => setDeptFilter(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-primary"
                  >
                    <option value="">All Depts</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select
                    value={shiftFilter}
                    onChange={e => setShiftFilter(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 focus:outline-none focus:border-primary"
                  >
                    <option value="">All Shifts</option>
                    {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-md)] border-b pb-2">
                      <th className="pb-3 font-semibold w-1/4">Employee</th>
                      <th className="pb-3 font-semibold">Dept</th>
                      <th className="pb-3 font-semibold">Shift</th>
                      <th className="pb-3 font-semibold">In</th>
                      <th className="pb-3 font-semibold">Out</th>
                      <th className="pb-3 font-semibold">Worked</th>
                      <th className="pb-3 font-semibold">Late</th>
                      <th className="pb-3 font-semibold">OT</th>
                      <th className="pb-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr><td colSpan={9} className="py-12 text-center text-[var(--text-md)]">Loading…</td></tr>
                    )}
                    {!loading && records.length === 0 && (
                      <tr><td colSpan={9} className="py-12 text-center text-[var(--text-md)]">No attendance records for this date.</td></tr>
                    )}
                    {records.map((r, i) => {
                      const isLate = r.status === 'late';
                      const hasOT = (r.overtime_minutes || 0) > 0;
                      return (
                        <tr key={r.id || i} className={`border-b border-gray-100 ${isLate ? 'bg-orange-50/30' : hasOT ? 'bg-green-50/30' : ''}`}>
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={`https://i.pravatar.cc/150?u=${r.employee_id}`}
                                className="w-8 h-8 rounded-full"
                                alt="avatar"
                              />
                              <div>
                                <div className="font-semibold text-gray-900">{r.employee_name || r.full_name || `EMP${r.employee_id}`}</div>
                                <div className="text-xs text-[var(--text-md)]">{r.employee_code || `EMP${String(r.employee_id).padStart(3,'0')}`}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-[var(--text-md)]">{r.department_name || r.department || '—'}</td>
                          <td className="text-primary font-medium">{r.shift_name || r.shift || '—'}</td>
                          <td className="font-semibold">{fmtTime(r.first_punch_in || r.check_in)}</td>
                          <td className="font-semibold text-gray-700">{fmtTime(r.last_punch_out || r.check_out)}</td>
                          <td className="font-medium text-gray-700">{fmtMins(r.worked_minutes)}</td>
                          <td className={`font-semibold ${(r.late_minutes || 0) > 0 ? 'text-warning' : 'text-[var(--text-md)]'}`}>
                            {(r.late_minutes || 0) > 0 ? fmtMins(r.late_minutes) : '—'}
                          </td>
                          <td className={`font-semibold ${(r.overtime_minutes || 0) > 0 ? 'text-success' : 'text-[var(--text-md)]'}`}>
                            {(r.overtime_minutes || 0) > 0 ? fmtMins(r.overtime_minutes) : '—'}
                          </td>
                          <td>{statusBadge(r.status)}</td>
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
              <div className="card-header-flex mb-4">
                <h3 className="font-bold">Late Arrivals</h3>
                <span className="badge badge-warning-light text-warning border border-warning/20">{stats.late} today</span>
              </div>
              <div className="flex flex-col gap-3">
                {records.filter(r => r.status === 'late').slice(0, 5).map((r, i) => (
                  <div key={i} className="border border-warning/20 rounded-lg p-3 flex gap-3 items-center">
                    <div className="w-8 h-8 rounded-full bg-warning/10 text-warning flex items-center justify-center shrink-0">
                      <Clock size={16} />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-gray-900">{r.employee_name || `EMP${r.employee_id}`}</div>
                      <div className="text-xs text-[var(--text-md)] mt-0.5">{r.department_name || '—'}</div>
                    </div>
                    <div className="text-warning font-semibold text-sm">{fmtMins(r.late_minutes)}</div>
                  </div>
                ))}
                {records.filter(r => r.status === 'late').length === 0 && (
                  <p className="text-sm text-[var(--text-md)] text-center py-4">No late arrivals</p>
                )}
              </div>
            </Card>

            {/* Absent Today */}
            <Card>
              <div className="card-header-flex mb-4">
                <h3 className="font-bold">Absent Today</h3>
                <span className="badge badge-danger-light text-danger border border-danger/20">{stats.absent} absent</span>
              </div>
              <div className="flex flex-col gap-3">
                {records.filter(r => r.status === 'absent').slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-gray-50 pb-3">
                    <img
                      src={`https://i.pravatar.cc/150?u=abs_${r.employee_id}`}
                      className="w-9 h-9 rounded-full"
                      alt="avatar"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-sm text-gray-900">{r.employee_name || `EMP${r.employee_id}`}</div>
                      <div className="text-xs text-[var(--text-md)]">{r.department_name || '—'} • {r.shift_name || '—'}</div>
                    </div>
                  </div>
                ))}
                {records.filter(r => r.status === 'absent').length === 0 && (
                  <p className="text-sm text-[var(--text-md)] text-center py-4">No absences today</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
