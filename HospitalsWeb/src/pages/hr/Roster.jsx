import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  Users, Sun, Moon, Coffee, 
  Calendar, ChevronDown, Wand2, Send,
  Filter, Check, RefreshCw, AlertCircle
} from 'lucide-react';
import './Roster.css';

// Shift cycling values and styling
const SHIFT_TYPES = {
  '': { label: '—', class: 'shift-cell-empty', desc: 'Not Scheduled' },
  'day': { label: 'D', class: 'shift-cell-day', desc: 'Day Shift (9am-6pm)' },
  'night': { label: 'N', class: 'shift-cell-night', desc: 'Night Shift (10pm-7am)' },
  'wo': { label: 'WO', class: 'shift-cell-wo', desc: 'Week Off' }
};

export function Roster() {
  const { request } = useApi();
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [employees, setEmployees] = useState([]);
  const [gridData, setGridData] = useState({}); // { [empId]: { [day]: 'day'|'night'|'wo'|'' } }
  const [initialGridData, setInitialGridData] = useState({}); // to track changes
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Compute days in selected month
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Format month label
  const monthLabel = new Date(year, mon - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });

  // Generate list of Dates with weekday labels
  const daysList = days.map(d => new Date(year, mon - 1, d));

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch initial departments
  useEffect(() => {
    request('/hr/departments')
      .then(res => setDepartments(res?.data || []))
      .catch(() => showToast('Failed to load departments', 'error'));
  }, []);

  // Cascade fetch roles when department changes
  useEffect(() => {
    if (!selectedDept) {
      setRoles([]);
      setSelectedRole('');
      return;
    }
    request(`/hr/staff-roles?departmentId=${selectedDept}`)
      .then(res => {
        setRoles(res?.data || []);
        setSelectedRole('');
      })
      .catch(() => showToast('Failed to load staff roles', 'error'));
  }, [selectedDept]);

  // Load roster and employees grid
  const loadRoster = useCallback(async () => {
    if (!selectedDept || !selectedRole) return;
    setLoading(true);
    try {
      // 1. Fetch employees matching the filters
      const empRes = await request(`/hr/roster/employees?departmentId=${selectedDept}&staffRoleId=${selectedRole}`);
      const emps = empRes?.data || [];
      setEmployees(emps);

      // 2. Fetch existing roster entries for the month
      const params = new URLSearchParams({
        month: mon.toString(),
        year: year.toString(),
        departmentId: selectedDept,
        staffRoleId: selectedRole
      });
      const rosterRes = await request(`/hr/roster?${params}`);
      const rosterList = rosterRes?.data || [];

      // 3. Construct lookup map of existing roster: employee_id -> day -> shift_type
      const rosterMap = {};
      rosterList.forEach(r => {
        const empId = r.employee_id;
        const day = new Date(r.roster_date).getDate();
        let shiftType = '';
        if (r.is_week_off) {
          shiftType = 'wo';
        } else if (r.is_night_shift) {
          shiftType = 'night';
        } else if (r.shift_id) {
          shiftType = 'day';
        }
        if (!rosterMap[empId]) rosterMap[empId] = {};
        rosterMap[empId][day] = shiftType;
      });

      // 4. Initialize grid data for all employees & days
      const newGrid = {};
      emps.forEach(emp => {
        newGrid[emp.employee_id] = {};
        days.forEach(day => {
          newGrid[emp.employee_id][day] = rosterMap[emp.employee_id]?.[day] || '';
        });
      });

      setGridData(newGrid);
      setInitialGridData(JSON.parse(JSON.stringify(newGrid)));
    } catch (err) {
      showToast('Failed to load roster data', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedDept, selectedRole, month]);

  // Auto-fetch roster when filters change
  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Cycle shift type on click
  const handleCellClick = (empId, day) => {
    const current = gridData[empId]?.[day] || '';
    const cycle = ['', 'day', 'night', 'wo'];
    const nextIndex = (cycle.indexOf(current) + 1) % cycle.length;
    const next = cycle[nextIndex];

    setGridData(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [day]: next
      }
    }));
  };

  // Determine if there are unsaved edits
  const hasChanges = JSON.stringify(gridData) !== JSON.stringify(initialGridData);

  // Bulk save roster entries to DB
  const handleSaveAll = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const rows = [];
      Object.keys(gridData).forEach(empId => {
        const empIdNum = Number(empId);
        days.forEach(day => {
          const shiftType = gridData[empId][day];
          const dateStr = `${year}-${mon.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          
          // Only send if it differs from initial state, or if we want to write/overwrite it
          if (gridData[empId][day] !== initialGridData[empId]?.[day]) {
            rows.push({
              employee_id: empIdNum,
              shift_date: dateStr,
              shift_type: shiftType
            });
          }
        });
      });

      if (rows.length > 0) {
        await request('/hr/roster/bulk', {
          method: 'POST',
          body: JSON.stringify({ rows })
        });
        showToast(`Successfully updated ${rows.length} roster entries!`);
        // Sync initial state
        setInitialGridData(JSON.parse(JSON.stringify(gridData)));
      } else {
        showToast('No changes to save');
      }
    } catch (err) {
      showToast(err.message || 'Failed to save roster', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Statistics summaries from grid
  const stats = Object.values(gridData).reduce((acc, empGrid) => {
    Object.values(empGrid).forEach(shift => {
      if (shift === 'day') acc.day++;
      if (shift === 'night') acc.night++;
      if (shift === 'wo') acc.wo++;
    });
    return acc;
  }, { day: 0, night: 0, wo: 0 });

  return (
    <div className="roster-page hr-overview-page">
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
            <Button 
              variant="primary" 
              onClick={handleSaveAll}
              disabled={!hasChanges || saving}
              className={`roster-action-btn roster-action-btn-primary ${hasChanges ? 'roster-btn-glow' : ''}`}
            >
              {saving ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
              {saving ? 'Saving...' : 'Save Roster'}
            </Button>
          </div>
        }
      />

      <div className="page-content roster-page">
        <div className="roster-heading-block">
          <h1 className="roster-title">Shift & Roster Management</h1>
          <p className="roster-subtitle">Schedule shift rotations and week offs for your department staff.</p>
        </div>

        {/* Global Toast */}
        {toast && (
          <div className={`roster-global-toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            {toast.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
            <span>{toast.msg}</span>
          </div>
        )}

        {/* Dynamic Filters Card */}
        <Card className="mb-6 roster-filter-card">
          <div className="ui-card-content roster-filter-grid">
            <div className="filter-group">
              <label className="filter-label">1. Select Department</label>
              <div className="select-wrapper">
                <select
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  className="roster-filter-select"
                >
                  <option value="">Choose Department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <ChevronDown className="select-arrow" size={16} />
              </div>
            </div>

            <div className="filter-group">
              <label className="filter-label">2. Select Role/Designation</label>
              <div className="select-wrapper">
                <select
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  disabled={!selectedDept}
                  className="roster-filter-select"
                >
                  <option value="">Choose Designation...</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <ChevronDown className="select-arrow" size={16} />
              </div>
            </div>

            <div className="filter-legend-box">
              <span className="legend-title">Shift Guide (Click cells to cycle):</span>
              <div className="legend-items">
                {Object.entries(SHIFT_TYPES).map(([type, info]) => (
                  <div key={type} className="legend-item-pill">
                    <span className={`legend-dot ${info.class}`}>{info.label}</span>
                    <span className="legend-desc">{info.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Stats Section */}
        {employees.length > 0 && (
          <div className="stats-grid mb-6">
            <Card className="stat-card stat-total-staff">
              <div className="stat-card-left">
                <div className="stat-label">Total Staff Loaded</div>
                <div className="stat-value">{employees.length}</div>
                <div className="stat-sub">For {monthLabel}</div>
              </div>
              <div className="stat-icon-wrapper blue-bg">
                <Users size={16} className="icon-blue" />
              </div>
            </Card>

            <Card className="stat-card stat-morning-shifts">
              <div className="stat-card-left">
                <div className="stat-label">Day Shifts Scheduled</div>
                <div className="stat-value">{stats.day}</div>
                <div className="stat-sub">This month</div>
              </div>
              <div className="stat-icon-wrapper blue-bg">
                <Sun size={16} className="icon-blue" />
              </div>
            </Card>

            <Card className="stat-card stat-night-shifts">
              <div className="stat-card-left">
                <div className="stat-label">Night Shifts Scheduled</div>
                <div className="stat-value">{stats.night}</div>
                <div className="stat-sub">This month</div>
              </div>
              <div className="stat-icon-wrapper purple-bg">
                <Moon size={16} className="icon-purple" />
              </div>
            </Card>

            <Card className="stat-card stat-wo-assigned">
              <div className="stat-card-left">
                <div className="stat-label">Week Offs Assigned</div>
                <div className="stat-value">{stats.wo}</div>
                <div className="stat-sub">This month</div>
              </div>
              <div className="stat-icon-wrapper orange-bg">
                <Coffee size={16} className="icon-orange" />
              </div>
            </Card>
          </div>
        )}

        {/* Roster Main Work Grid */}
        <Card className="mb-6 overflow-hidden roster-grid-card">
          <div className="card-header-flex roster-grid-header">
            <div>
              <h3 className="section-title">Roster Scheduling Grid — {monthLabel}</h3>
              <p className="section-subtitle">Click on cells to set or change shifts. Make sure to click save when finished.</p>
            </div>
            {hasChanges && (
              <span className="unsaved-badge">Unsaved Changes Present</span>
            )}
          </div>

          {loading ? (
            <div className="roster-loading-wrapper">
              <RefreshCw className="animate-spin spinner-blue" size={32} />
              <p>Loading roster information...</p>
            </div>
          ) : !selectedDept || !selectedRole ? (
            <div className="roster-empty-state">
              <Calendar size={48} className="empty-icon" />
              <h4>Select Department and Role to Begin</h4>
              <p>Choose a department and then select a designation role above to load and edit the schedule grid.</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="roster-empty-state">
              <Users size={48} className="empty-icon" />
              <h4>No Employees Found</h4>
              <p>There are no active employees assigned to the selected Department and Designation.</p>
            </div>
          ) : (
            <div className="overflow-x-auto roster-scroll-container">
              <table className="roster-table">
                <thead>
                  <tr className="roster-th-row">
                    <th className="roster-th roster-th-sticky">Employee</th>
                    {daysList.map(d => {
                      const day = d.getDate();
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <th key={day} className={`roster-th-day ${isWeekend ? 'roster-th-weekend' : ''}`}>
                          <div className="roster-th-day-num">{day}</div>
                          <div className="roster-th-day-lbl">
                            {d.toLocaleString('en-US', { weekday: 'short' }).charAt(0)}
                          </div>
                        </th>
                      );
                    })}
                    <th className="roster-th-total color-primary">D</th>
                    <th className="roster-th-total color-gray">N</th>
                    <th className="roster-th-total color-danger">WO</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const empGrid = gridData[emp.employee_id] || {};
                    const counts = { day: 0, night: 0, wo: 0 };
                    days.forEach(d => {
                      const shift = empGrid[d] || '';
                      if (counts[shift] !== undefined) counts[shift]++;
                    });

                    return (
                      <tr key={emp.employee_id} className="roster-td-row">
                        <td className="roster-td roster-td-sticky">
                          <div className="roster-employee-cell">
                            <img
                              src={`https://api.dicebear.com/7.x/initials/svg?seed=${emp.full_name}&backgroundColor=24428b,0369a1,4f46e5`}
                              className="roster-avatar"
                              alt="avatar"
                            />
                            <div className="roster-info-block">
                              <div className="roster-name">{emp.full_name}</div>
                              <div className="roster-muted">{emp.employee_code}</div>
                            </div>
                          </div>
                        </td>
                        {daysList.map(d => {
                          const day = d.getDate();
                          const shiftType = empGrid[day] || '';
                          const info = SHIFT_TYPES[shiftType];
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          return (
                            <td 
                              key={day} 
                              className={`roster-td-day ${isWeekend ? 'roster-td-weekend' : ''}`}
                              onClick={() => handleCellClick(emp.employee_id, day)}
                            >
                              <div className={`shift-cell-pill ${info.class}`}>
                                {info.label}
                              </div>
                            </td>
                          );
                        })}
                        <td className="roster-td-total color-primary">{counts.day}</td>
                        <td className="roster-td-total color-gray">{counts.night}</td>
                        <td className="roster-td-total color-danger">{counts.wo}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
