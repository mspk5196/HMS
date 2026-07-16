import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  Users, Sun, Moon, Coffee, 
  Calendar, ChevronDown, Wand2, Send,
  Filter
} from 'lucide-react';
import './Roster.css';

const SHIFT_ABBR = { 'M': 'M', 'E': 'E', 'N': 'N', 'WO': 'WO' };

function renderShift(shift) {
  switch (shift) {
    case 'M': return <span className="shift-cell text-primary bg-primary/10">M</span>;
    case 'E': return <span className="shift-cell text-warning bg-warning/10">E</span>;
    case 'N': return <span className="shift-cell text-gray-500 bg-gray-100">N</span>;
    case 'WO': return <span className="shift-cell text-danger font-medium">WO</span>;
    default: return <span className="shift-cell"></span>;
  }
}

function getShiftCode(shiftName) {
  if (!shiftName) return '';
  const n = shiftName.toLowerCase();
  if (n.includes('morn') || n.includes('day')) return 'M';
  if (n.includes('even') || n.includes('after')) return 'E';
  if (n.includes('night')) return 'N';
  if (n.includes('off') || n.includes('week')) return 'WO';
  return n.charAt(0).toUpperCase();
}

function shiftBadge(shiftName) {
  const code = getShiftCode(shiftName);
  switch (code) {
    case 'M': return <span className="badge bg-primary/10 text-primary border-none">{shiftName || 'Morning'}</span>;
    case 'E': return <span className="badge bg-warning/10 text-warning border-none">{shiftName || 'Evening'}</span>;
    case 'N': return <span className="badge bg-gray-100 text-gray-500 border-none">{shiftName || 'Night'}</span>;
    case 'WO': return <span className="badge bg-danger/10 text-danger border-none">Week Off</span>;
    default:  return <span className="badge bg-gray-100 text-gray-600 border-none">{shiftName}</span>;
  }
}

export function Roster() {
  const { request, loading } = useApi();
  const [roster, setRoster] = useState([]); // array of { employee, days: [{date, shift_code}] }
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  // Compute days in selected month
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const firstDow = new Date(year, mon - 1, 1).getDay(); // 0=Sun
  const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ month });
      if (deptFilter) params.set('department_id', deptFilter);
      const res = await request(`/hr/roster?${params}`);
      const data = res?.data || [];
      // Data shape: array of { employee_id, employee_name, department_name, roster: [{date, shift_code, shift_name}] }
      setRoster(Array.isArray(data) ? data : []);
    } catch (_) {}
  }, [month, deptFilter]);

  useEffect(() => {
    request('/hr/departments').then(r => setDepartments(r?.data || [])).catch(() => {});
    request('/hr/shifts').then(r => setShifts(r?.data || [])).catch(() => {});
    request('/hr/employees?limit=200').then(r => setEmployees(r?.data?.rows || r?.data || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // Stats derived from roster
  const shiftCounts = roster.reduce((acc, emp) => {
    (emp.roster || []).forEach(d => {
      const code = d.shift_code || getShiftCode(d.shift_name);
      if (code === 'M') acc.morning = (acc.morning || 0) + 1;
      else if (code === 'E') acc.evening = (acc.evening || 0) + 1;
      else if (code === 'N') acc.night = (acc.night || 0) + 1;
      else if (code === 'WO') acc.wo = (acc.wo || 0) + 1;
    });
    return acc;
  }, {});

  const monthLabel = new Date(year, mon - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  // Build a lookup for employee roster: empId -> { day -> shift_code }
  const rosterMap = {};
  roster.forEach(emp => {
    rosterMap[emp.employee_id] = {};
    (emp.roster || []).forEach(d => {
      const day = new Date(d.date).getDate();
      rosterMap[emp.employee_id][day] = d.shift_code || getShiftCode(d.shift_name) || '';
    });
  });

  // Employees with roster data
  const rosterEmployees = roster.length > 0 ? roster : employees.map(emp => ({
    employee_id: emp.id,
    employee_name: emp.full_name,
    employee_code: emp.employee_code,
    department_name: emp.department_name || '',
    roster: [],
  }));

  return (
    <div className="page-container roster-page">
      <PageHeader 
        breadcrumbs={[
          { label: 'HR & Payroll', path: '#' },
          { label: 'Shift & Roster' }
        ]}
        actions={
          <div className="roster-actions">
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="roster-month-input"
            />
            <Button variant="outline" className="roster-action-btn roster-action-btn-outline">
              <Wand2 size={16} /> AI Suggest
            </Button>
            <Button variant="primary" className="roster-action-btn roster-action-btn-primary">
              <Send size={16} /> Publish Roster
            </Button>
          </div>
        }
      />

      <div className="page-content roster-page">
        <div className="roster-heading-block">
          <h1 className="roster-title">Shift & Roster Management</h1>
          <p className="roster-subtitle">Plan and manage monthly shift rotations for all departments.</p>
        </div>

        <div className="stats-grid mb-6">
          <Card className="stat-card stat-total-staff">
            <div className="stat-card-left">
              <div className="stat-label">Total Staff Scheduled</div>
              <div className="stat-value">{rosterEmployees.length}</div>
              <div className="stat-sub">For {monthLabel}</div>
            </div>
            <div className="stat-icon-wrapper blue-bg">
              <Users size={16} className="text-[#3b82f6]" />
            </div>
          </Card>

          <Card className="stat-card stat-morning-shifts">
            <div className="stat-card-left">
              <div className="stat-label">Morning Shifts</div>
              <div className="stat-value">{shiftCounts.morning || 0}</div>
              <div className="stat-sub">Across all depts</div>
            </div>
            <div className="stat-icon-wrapper blue-bg">
              <Sun size={16} className="text-[#3b82f6]" />
            </div>
          </Card>

          <Card className="stat-card stat-night-shifts">
            <div className="stat-card-left">
              <div className="stat-label">Night Shifts</div>
              <div className="stat-value">{shiftCounts.night || 0}</div>
              <div className="stat-sub">Across all depts</div>
            </div>
            <div className="stat-icon-wrapper blue-bg">
              <Moon size={16} className="text-[#3b82f6]" />
            </div>
          </Card>

          <Card className="stat-card stat-wo-assigned">
            <div className="stat-card-left">
              <div className="stat-label">Week Offs Assigned</div>
              <div className="stat-value">{shiftCounts.wo || 0}</div>
              <div className="stat-sub">For selected period</div>
            </div>
            <div className="stat-icon-wrapper orange-bg">
              <Coffee size={16} className="text-[#f97316]" />
            </div>
          </Card>
        </div>

        {/* Legend & Filter */}
        <Card className="mb-6">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div className="roster-legend-items">
              <span className="section-title" style={{ fontSize: 13, marginBottom: 0 }}>Legend</span>
              {shifts.length > 0 ? shifts.map(s => (
                <div key={s.id} className="roster-legend-item">
                  <span className="shift-pill-m" style={{ background: 'var(--color-m-bg, #dbeafe)', color: 'var(--color-m-text, #2563eb)' }}>{getShiftCode(s.name)}</span>
                  {s.name} {s.start_time && s.end_time ? `(${s.start_time}–${s.end_time})` : ''}
                </div>
              )) : (
                <>
                  <div className="roster-legend-item"><span className="shift-pill-m">M</span> Morning (9am–6pm)</div>
                  <div className="roster-legend-item"><span className="shift-pill-e">E</span> Evening (2pm–10pm)</div>
                  <div className="roster-legend-item"><span className="shift-pill-n">N</span> Night (10pm–7am)</div>
                  <div className="roster-legend-item"><span className="shift-pill-wo">WO</span> Week Off</div>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={15} style={{ color: '#9ca3af' }} />
              <span className="roster-muted">Department:</span>
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="roster-filter-select"
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        </Card>

        {/* Monthly Roster Table */}
        <Card className="mb-6 overflow-hidden">
          <h3 className="section-title">Monthly Roster — {monthLabel}</h3>
          {loading && <p className="text-center text-[var(--text-md)] py-8">Loading roster…</p>}
          {!loading && rosterEmployees.length === 0 && (
            <p className="roster-empty">No roster data for this period. Please publish roster first.</p>
          )}
          {!loading && rosterEmployees.length > 0 && (
            <div className="overflow-x-auto roster-scroll-container">
              <table className="roster-table">
                <thead>
                  <tr className="border-b">
                    <th className="text-left font-semibold py-2 px-3 sticky left-0 bg-white z-10 w-48 min-w-[192px]">Employee</th>
                    {days.map((day, idx) => {
                      const dow = (firstDow + idx) % 7;
                      return (
                        <th key={day} className="text-center font-normal px-1 pb-2 w-7 min-w-[28px]">
                          <div className="font-semibold text-gray-900">{day}</div>
                          <div className="roster-muted">{DOW_LABELS[dow]}</div>
                        </th>
                      );
                    })}
                    <th className="text-center font-semibold px-2 w-8 text-primary">M</th>
                    <th className="text-center font-semibold px-2 w-8 text-warning">E</th>
                    <th className="text-center font-semibold px-2 w-8 text-gray-500">N</th>
                    <th className="text-center font-semibold px-2 w-8 text-danger">WO</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterEmployees.map((emp, ri) => {
                    const empRoster = rosterMap[emp.employee_id] || {};
                    const counts = { M: 0, E: 0, N: 0, WO: 0 };
                    days.forEach(d => {
                      const code = empRoster[d] || '';
                      if (counts[code] !== undefined) counts[code]++;
                    });
                    return (
                      <tr key={emp.employee_id || ri} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-2 px-3 sticky left-0 bg-white z-10 border-r border-gray-50">
                          <div className="roster-employee-cell">
                            <img
                              src={`https://i.pravatar.cc/150?u=roster_${emp.employee_id}`}
                              className="roster-avatar"
                              alt="avatar"
                            />
                            <div>
                              <div className="roster-name">{emp.employee_name || `EMP${emp.employee_id}`}</div>
                              <div className="roster-muted">{emp.department_name || '—'}</div>
                            </div>
                          </div>
                        </td>
                        {days.map(d => (
                          <td key={d} className="text-center px-0.5">
                            {renderShift(empRoster[d] || '')}
                          </td>
                        ))}
                        <td className="text-center font-semibold text-primary">{counts.M}</td>
                        <td className="text-center font-semibold text-warning">{counts.E}</td>
                        <td className="text-center font-semibold text-gray-500">{counts.N}</td>
                        <td className="text-center font-semibold text-danger">{counts.WO}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Shifts Config Table */}
        <Card>
          <div className="card-header-flex mb-4">
            <h3 className="font-bold text-lg">Configured Shifts</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-md)] border-b pb-2">
                  <th className="pb-3 font-semibold">Shift Name</th>
                  <th className="pb-3 font-semibold">Code</th>
                  <th className="pb-3 font-semibold">Start Time</th>
                  <th className="pb-3 font-semibold">End Time</th>
                  <th className="pb-3 font-semibold">Grace Period</th>
                  <th className="pb-3 font-semibold">Type</th>
                </tr>
              </thead>
              <tbody>
                {shifts.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-[var(--text-md)]">No shifts configured.</td></tr>
                )}
                {shifts.map((s, i) => (
                  <tr key={s.id || i} className="border-b border-gray-100">
                    <td className="py-3 font-semibold text-gray-900">{s.name}</td>
                    <td>{shiftBadge(s.name)}</td>
                    <td className="font-medium">{s.start_time || '—'}</td>
                    <td className="font-medium">{s.end_time || '—'}</td>
                    <td className="text-[var(--text-md)]">{s.grace_minutes ? `${s.grace_minutes} min` : '—'}</td>
                    <td className="text-[var(--text-md)]">{s.shift_type || s.type || 'Regular'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
