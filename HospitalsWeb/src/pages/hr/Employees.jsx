import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  Users, Clock, FileMinus, Banknote, 
  Briefcase, Calendar, X, Plus
} from 'lucide-react';
import './Employees.css'; 

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMins(mins) {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function AddEmployeeModal({ open, onClose, onSaved }) {
  const { request, loading } = useApi();
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [form, setForm] = useState({
    full_name: '', employee_code: '', phone: '', email: '',
    department_id: '', designation_id: '', shift_id: '',
    joining_date: new Date().toISOString().split('T')[0],
    salary_type: 'monthly', basic_salary: '',
  });
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    request('/hr/departments').then(r => setDepartments(r?.data || [])).catch(() => {});
    request('/hr/designations').then(r => setDesignations(r?.data || [])).catch(() => {});
    request('/hr/shifts').then(r => setShifts(r?.data || [])).catch(() => {});
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      await request('/hr/employees', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          department_id: Number(form.department_id) || undefined,
          designation_id: Number(form.designation_id) || undefined,
          shift_id: Number(form.shift_id) || undefined,
          basic_salary: Number(form.basic_salary) || undefined,
        })
      });
      onSaved(); onClose();
    } catch (e) { setErr(e.message); }
  };

  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 560 }}>
        <div className="modal-header">
          <h2 className="text-sm font-bold">Add New Employee</h2>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Full Name *</label>
                <input className="field" required value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <label className="field-label">Employee Code</label>
                <input className="field" value={form.employee_code} onChange={e => set('employee_code', e.target.value)} placeholder="EMP001" />
              </div>
              <div>
                <label className="field-label">Phone</label>
                <input className="field" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9XXXXXXXXX" />
              </div>
              <div>
                <label className="field-label">Email</label>
                <input className="field" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@hospital.com" />
              </div>
              <div>
                <label className="field-label">Department</label>
                <select className="field" value={form.department_id} onChange={e => set('department_id', e.target.value)}>
                  <option value="">Select...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Designation</label>
                <select className="field" value={form.designation_id} onChange={e => set('designation_id', e.target.value)}>
                  <option value="">Select...</option>
                  {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Shift</label>
                <select className="field" value={form.shift_id} onChange={e => set('shift_id', e.target.value)}>
                  <option value="">Select...</option>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Joining Date</label>
                <input className="field" type="date" value={form.joining_date} onChange={e => set('joining_date', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Salary Type</label>
                <select className="field" value={form.salary_type} onChange={e => set('salary_type', e.target.value)}>
                  <option value="monthly">Monthly Fixed</option>
                  <option value="daily">Daily Rate</option>
                  <option value="hourly">Hourly Rate</option>
                </select>
              </div>
              <div>
                <label className="field-label">Basic Salary (₹)</label>
                <input className="field" type="number" value={form.basic_salary} onChange={e => set('basic_salary', e.target.value)} placeholder="0" />
              </div>
            </div>
            {err && <p className="text-danger text-xs">{err}</p>}
          </div>
          <div className="modal-footer">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={loading}>{loading ? 'Saving…' : 'Add Employee'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Employees() {
  const { request, loading } = useApi();
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empDetail, setEmpDetail] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [payrollItems, setPayrollItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, on_leave: 0, attendance_rate: 0, payroll_total: 0 });

  const today = new Date().toISOString().split('T')[0];

  const loadEmployees = useCallback(async () => {
    try {
      const res = await request('/hr/employees?limit=200');
      const rows = res?.data?.rows || res?.data || [];
      setEmployees(rows);
      if (rows.length > 0 && !selectedEmp) {
        setSelectedEmp(rows[0]);
      }
      setStats(s => ({ ...s, total: rows.length }));
    } catch (_) {}
  }, []);

  const loadTodayAttendance = useCallback(async () => {
    try {
      const res = await request(`/attendance?date=${today}&limit=200`);
      const rows = res?.data?.rows || res?.data || [];
      setAttendance(rows);
      const present = rows.filter(r => r.status === 'present' || r.status === 'late').length;
      const rate = rows.length > 0 ? ((present / rows.length) * 100).toFixed(1) : 0;
      setStats(s => ({ ...s, attendance_rate: rate }));
    } catch (_) {}
  }, []);

  const loadLeaveRequests = useCallback(async () => {
    try {
      const res = await request('/leave/requests?status=pending&limit=20');
      setLeaveRequests(res?.data?.rows || res?.data || []);
      const onLeave = (res?.data?.rows || res?.data || []).length;
      setStats(s => ({ ...s, on_leave: onLeave }));
    } catch (_) {}
  }, []);

  const loadPayroll = useCallback(async () => {
    try {
      const runsRes = await request('/salary/payroll-runs?limit=1');
      const runs = runsRes?.data?.rows || runsRes?.data || [];
      if (runs.length > 0) {
        const run = runs[0];
        const itemsRes = await request(`/salary/payroll-runs/${run.id}/items?limit=200`);
        const items = itemsRes?.data?.rows || itemsRes?.data || [];
        setPayrollItems(items);
        const total = items.reduce((s, i) => s + Number(i.net_salary || 0), 0);
        setStats(s => ({ ...s, payroll_total: total }));
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    loadEmployees();
    loadTodayAttendance();
    loadLeaveRequests();
    loadPayroll();
  }, []);

  useEffect(() => {
    if (!selectedEmp) return;
    request(`/hr/employees/${selectedEmp.id}`).then(r => setEmpDetail(r?.data || null)).catch(() => {});
  }, [selectedEmp]);

  const handleLeaveReview = async (id, decision) => {
    try {
      await request(`/leave/requests/${id}/review`, { method: 'PATCH', body: JSON.stringify({ status: decision }) });
      loadLeaveRequests();
    } catch (_) {}
  };

  const fmtINR = (v) => {
    const n = Number(v || 0);
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    return `₹${n.toLocaleString('en-IN')}`;
  };

  const todayAttSlice = attendance.slice(0, 5);
  const pendingLeave = leaveRequests.filter(r => r.status === 'pending').slice(0, 3);
  const payrollSlice = payrollItems.slice(0, 4);
  const displayEmp = empDetail || selectedEmp;

  return (
    <div className="page-container">
      <AddEmployeeModal open={showModal} onClose={() => setShowModal(false)} onSaved={loadEmployees} />
      <PageHeader 
        breadcrumbs={[
          { label: 'HR & Payroll', path: '#' },
          { label: 'Overview' }
        ]}
        searchPlaceholder="Search employees..."
        actions={
          <Button variant="primary" onClick={() => setShowModal(true)}>
            <Plus size={16} className="mr-1" /> Add Employee
          </Button>
        }
      />

      <div className="page-content hr-overview-page">
        <div className="page-header-text mb-6">
          <h1 className="text-2xl font-bold mb-1">HR & Payroll Management</h1>
          <p className="text-[var(--text-md)] text-sm">Manage staff records, attendance, leave, fines, and monthly payroll from one place.</p>
        </div>

        <div className="stats-grid mb-6">
          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Total Employees</div>
              <div className="stat-icon-wrapper blue-bg"><Users size={18} className="text-primary" /></div>
            </div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-sub">{attendance.filter(r => r.status === 'present' || r.status === 'late').length} present today</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">On Leave Today</div>
              <div className="stat-icon-wrapper orange-bg"><FileMinus size={18} className="text-warning" /></div>
            </div>
            <div className="stat-value">{stats.on_leave}</div>
            <div className="stat-sub">{leaveRequests.filter(r => r.status === 'pending').length} pending requests</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Attendance Rate</div>
              <div className="stat-icon-wrapper green-bg"><Clock size={18} className="text-success" /></div>
            </div>
            <div className="stat-value">{stats.attendance_rate}%</div>
            <div className="stat-sub">Today's rate</div>
          </Card>

          <Card className="stat-card">
            <div className="stat-card-header">
              <div className="stat-label">Payroll This Month</div>
              <div className="stat-icon-wrapper blue-bg"><Banknote size={18} className="text-primary" /></div>
            </div>
            <div className="stat-value">{fmtINR(stats.payroll_total)}</div>
            <div className="stat-sub">Net payout</div>
          </Card>
        </div>

        <div className="hr-dashboard-grid">
          {/* Left: Employee List */}
          <div className="hr-left-column">
            <Card className="employee-list-card h-full flex flex-col">
              <div className="card-header-flex mb-4">
                <h3 className="font-bold">Employees</h3>
                <span className="badge bg-gray-100 text-gray-600">{stats.total} total</span>
              </div>
              <div className="employee-list flex-1">
                {loading && <p className="text-center text-[var(--text-md)] py-8">Loading…</p>}
                {employees.map(emp => (
                  <div
                    key={emp.id}
                    className={`emp-list-item cursor-pointer ${selectedEmp?.id === emp.id ? 'bg-primary/5 border border-primary/20 rounded-lg' : ''}`}
                    onClick={() => setSelectedEmp(emp)}
                  >
                    <div className="emp-avatar bg-gray-200">
                      <img
                        src={`https://i.pravatar.cc/150?u=emp_${emp.id}`}
                        alt="Avatar"
                        className="rounded-full w-full h-full object-cover"
                      />
                    </div>
                    <div className="emp-list-info flex-1">
                      <div className="font-semibold text-sm">{emp.full_name}</div>
                      <div className="text-xs text-[var(--text-md)]">{emp.department_name || '—'} • {emp.designation_name || '—'}</div>
                    </div>
                    <div className={`badge ${emp.status === 'active' || !emp.status ? 'badge-success-light' : 'badge-danger-light text-danger'}`}>
                      {emp.status === 'active' || !emp.status ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right: Details */}
          <div className="hr-right-column flex flex-col gap-6">
            {/* Employee Profile */}
            {displayEmp && (
              <Card>
                <div className="card-header-flex border-b border-gray-100 pb-4 mb-4">
                  <h3 className="font-bold">Employee Profile — {displayEmp.full_name} ({displayEmp.employee_code || `EMP${displayEmp.id}`})</h3>
                  <Button variant="outline" size="sm" className="text-primary border-primary">Edit profile</Button>
                </div>
                <div className="flex gap-8">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200">
                      <img src={`https://i.pravatar.cc/150?u=emp_${displayEmp.id}`} alt="Avatar" className="w-full h-full object-cover"/>
                    </div>
                    <span className={`badge ${displayEmp.status === 'active' || !displayEmp.status ? 'badge-success-light' : 'badge-danger-light text-danger'}`}>
                      {displayEmp.status === 'active' || !displayEmp.status ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-y-6">
                    <div>
                      <div className="text-xs text-[var(--text-md)] mb-1">Department</div>
                      <div className="font-semibold text-sm">{displayEmp.department_name || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-md)] mb-1">Designation</div>
                      <div className="font-semibold text-sm">{displayEmp.designation_name || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-md)] mb-1">Joining Date</div>
                      <div className="font-semibold text-sm">{fmtDate(displayEmp.joining_date)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-md)] mb-1">Phone</div>
                      <div className="font-semibold text-sm">{displayEmp.phone || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-md)] mb-1">Salary Basis</div>
                      <div className="font-semibold text-sm">{displayEmp.salary_type === 'monthly' ? 'Monthly Fixed' : displayEmp.salary_type || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-md)] mb-1">Basic Salary</div>
                      <div className="font-semibold text-sm">
                        {displayEmp.basic_salary ? `₹${Number(displayEmp.basic_salary).toLocaleString('en-IN')} / month` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-md)] mb-1">Email</div>
                      <div className="font-semibold text-sm">{displayEmp.email || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-md)] mb-1">Bank Account</div>
                      <div className="font-semibold text-sm">{displayEmp.bank_account ? `••••${displayEmp.bank_account.slice(-4)}` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-md)] mb-1">UAN (PF)</div>
                      <div className={`font-semibold text-sm ${displayEmp.uan ? '' : 'text-warning'}`}>
                        {displayEmp.uan || 'Pending enrolment'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex gap-3 border-t border-gray-100 pt-4">
                  <Button variant="primary" className="bg-primary hover:bg-primary/90 text-white"><Briefcase size={16} className="mr-2"/>Save changes</Button>
                  <Button variant="outline"><Banknote size={16} className="mr-2"/>View salary history</Button>
                  <Button variant="outline"><Calendar size={16} className="mr-2"/>View attendance</Button>
                </div>
              </Card>
            )}

            {/* Today's Attendance */}
            <Card>
              <div className="card-header-flex mb-4">
                <h3 className="font-bold">Today's Attendance — {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Sync biometric</Button>
                  <Button variant="primary" size="sm" className="bg-primary hover:bg-primary/90">Extend window</Button>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--text-md)] border-b pb-2">
                    <th className="pb-3 font-semibold">Employee</th>
                    <th className="pb-3 font-semibold">Shift</th>
                    <th className="pb-3 font-semibold">In</th>
                    <th className="pb-3 font-semibold">Out</th>
                    <th className="pb-3 font-semibold">Worked</th>
                    <th className="pb-3 font-semibold">Late</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAttSlice.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-[var(--text-md)]">No attendance data today</td></tr>
                  )}
                  {todayAttSlice.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-3 font-semibold">{r.employee_name || `EMP${r.employee_id}`}</td>
                      <td className="text-primary font-medium">{r.shift_name || '—'}</td>
                      <td>{r.first_punch_in ? r.first_punch_in.slice(0, 5) : '—'}</td>
                      <td>{r.last_punch_out ? r.last_punch_out.slice(0, 5) : '—'}</td>
                      <td>{fmtMins(r.worked_minutes)}</td>
                      <td className={r.late_minutes > 0 ? 'font-semibold text-warning' : 'text-[var(--text-md)]'}>
                        {r.late_minutes > 0 ? fmtMins(r.late_minutes) : '—'}
                      </td>
                      <td>
                        {r.status === 'present' && <span className="badge badge-success-light">Present</span>}
                        {r.status === 'late' && <span className="badge badge-warning-light text-warning">Late</span>}
                        {r.status === 'absent' && <span className="badge badge-danger-light text-danger">Absent</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="grid grid-cols-2 gap-6">
              {/* Leave Requests */}
              <Card>
                <div className="card-header-flex mb-4">
                  <h3 className="font-bold">Leave Requests</h3>
                  <span className="badge badge-warning-light border border-warning text-warning">{pendingLeave.length} pending</span>
                </div>
                <div className="flex flex-col gap-4">
                  {pendingLeave.length === 0 && <p className="text-center text-[var(--text-md)] py-4">No pending requests</p>}
                  {leaveRequests.slice(0, 3).map((r, i) => (
                    <div key={i} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex justify-between mb-3">
                        <div>
                          <div className="font-semibold text-sm">{r.employee_name || `Employee ${r.employee_id}`}</div>
                          <div className="text-xs text-[var(--text-md)] mt-1">
                            {r.leave_type_name || 'Leave'} • {new Date(r.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            {r.start_date !== r.end_date && ` – ${new Date(r.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${new Date(r.end_date).getFullYear()}`}
                          </div>
                        </div>
                        <span className={`badge h-fit ${r.status === 'pending' ? 'badge-warning-light border border-warning text-warning' : r.status === 'approved' ? 'badge-success-light border border-success' : 'badge-danger-light text-danger'}`}>
                          {r.status?.charAt(0).toUpperCase() + r.status?.slice(1)}
                        </span>
                      </div>
                      {r.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1 text-success border-success hover:bg-success/10" onClick={() => handleLeaveReview(r.id, 'approved')}>Approve</Button>
                          <Button variant="outline" className="flex-1 text-danger border-danger hover:bg-danger/10" onClick={() => handleLeaveReview(r.id, 'rejected')}>Reject</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Payroll Summary */}
              <Card>
                <div className="card-header-flex mb-4">
                  <h3 className="font-bold">Payroll — {new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</h3>
                  <Button variant="primary" size="sm" className="bg-primary">Run payroll</Button>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-md)] border-b pb-2">
                      <th className="pb-3 font-semibold">Employee</th>
                      <th className="pb-3 font-semibold text-center">Days</th>
                      <th className="pb-3 font-semibold text-right">Deductions</th>
                      <th className="pb-3 font-semibold text-right">Net Pay</th>
                      <th className="pb-3 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollSlice.length === 0 && (
                      <tr><td colSpan={5} className="py-6 text-center text-[var(--text-md)]">No payroll data. Run payroll first.</td></tr>
                    )}
                    {payrollSlice.map((it, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-3">
                          <div className="font-semibold">{it.employee_name || `EMP${it.employee_id}`}</div>
                          <div className="text-[10px] text-[var(--text-md)]">{it.department_name || '—'}</div>
                        </td>
                        <td className="text-center">{it.working_days || it.present_days || '—'}</td>
                        <td className="text-right text-danger">₹{Number(it.total_deductions || 0).toLocaleString('en-IN')}</td>
                        <td className="text-right font-bold">₹{Number(it.net_salary || 0).toLocaleString('en-IN')}</td>
                        <td className="text-right">
                          {it.status === 'locked' || it.status === 'paid'
                            ? <span className="badge badge-success-light">Approved</span>
                            : <span className="badge badge-warning-light text-warning">Pending</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {payrollItems.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <div className="text-sm text-[var(--text-md)] font-medium">Total net payout</div>
                    <div className="text-xl font-bold">₹{stats.payroll_total.toLocaleString('en-IN')}</div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
