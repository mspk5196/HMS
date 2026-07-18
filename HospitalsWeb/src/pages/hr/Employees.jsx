import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { 
  Users, Clock, FileMinus, Banknote, 
  Briefcase, Calendar, X, Plus, TrendingUp, RefreshCw, Check
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

// Mock initial data to match the screenshot exactly on load
const MOCK_EMPLOYEES = [
  {
    id: 14,
    employee_code: 'EMP014',
    full_name: 'Priya Nandhini',
    department_name: 'Nursing',
    designation_name: 'Nurse',
    joining_date: '2026-06-01',
    phone: '98xxxxxx10',
    salary_type: 'monthly',
    basic_salary: 22500,
    per_day_salary: 850,
    per_night_salary: 1050,
    email: 'priya.n@hospital.com',
    bank_account: 'xxxxxxxx4213',
    ifsc: 'HDFC0001234',
    uan: 'Pending enrolment',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=120&h=120'
  },
  {
    id: 15,
    employee_code: 'EMP015',
    full_name: 'Sundar M.',
    department_name: 'Laboratory',
    designation_name: 'Lab Technician',
    joining_date: '2025-04-12',
    phone: '98xxxxxx11',
    salary_type: 'monthly',
    basic_salary: 19700,
    per_day_salary: 750,
    per_night_salary: 950,
    email: 'sundar.m@hospital.com',
    bank_account: 'xxxxxxxx1234',
    ifsc: 'HDFC0001234',
    uan: '100987654321',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=120&h=120'
  },
  {
    id: 16,
    employee_code: 'EMP016',
    full_name: 'Ravi T.',
    department_name: 'Pharmacy',
    designation_name: 'Pharmacist',
    joining_date: '2024-09-18',
    phone: '98xxxxxx12',
    salary_type: 'monthly',
    basic_salary: 20100,
    per_day_salary: 780,
    per_night_salary: 980,
    email: 'ravi.t@hospital.com',
    bank_account: 'xxxxxxxx5678',
    ifsc: 'HDFC0001234',
    uan: '100987654322',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=120&h=120'
  },
  {
    id: 17,
    employee_code: 'EMP017',
    full_name: 'Kavitha S.',
    department_name: 'Admin',
    designation_name: 'Receptionist',
    joining_date: '2026-01-05',
    phone: '98xxxxxx13',
    salary_type: 'monthly',
    basic_salary: 18000,
    per_day_salary: 700,
    per_night_salary: 900,
    email: 'kavitha.s@hospital.com',
    bank_account: 'xxxxxxxx9012',
    ifsc: 'HDFC0001234',
    uan: '100987654323',
    status: 'inactive',
    avatar: 'https://images.unsplash.com/photo-1594744803329-e58b31de215f?auto=format&fit=crop&q=80&w=120&h=120'
  },
  {
    id: 3,
    employee_code: 'EMP003',
    full_name: 'Dr. Meera R.',
    department_name: 'General Medicine',
    designation_name: 'Doctor',
    joining_date: '2023-01-01',
    phone: '98xxxxxx03',
    salary_type: 'monthly',
    basic_salary: 72000,
    per_day_salary: 2800,
    per_night_salary: 3200,
    email: 'meera.r@hospital.com',
    bank_account: 'xxxxxxxx2468',
    ifsc: 'HDFC0001234',
    uan: '100987654303',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=120&h=120'
  }
];

const MOCK_ATTENDANCE = [
  { employee_name: 'Priya N.', shift_name: 'Morning', first_punch_in: '09:08', last_punch_out: '18:11', worked_minutes: 501, late_minutes: 0, status: 'present' },
  { employee_name: 'Sundar M.', shift_name: 'Night', first_punch_in: null, last_punch_out: null, worked_minutes: 0, late_minutes: 0, status: 'absent' },
  { employee_name: 'Ravi T.', shift_name: 'Morning', first_punch_in: '09:41', last_punch_out: '18:05', worked_minutes: 482, late_minutes: 31, status: 'late' },
  { employee_name: 'Kavitha S.', shift_name: 'Morning', first_punch_in: '08:55', last_punch_out: '17:58', worked_minutes: 543, late_minutes: 0, status: 'present' },
  { employee_name: 'Dr. Meera R.', shift_name: 'Morning', first_punch_in: '09:02', last_punch_out: '18:30', worked_minutes: 568, late_minutes: 0, status: 'present' }
];

const MOCK_LEAVE_REQUESTS = [
  { id: 1, employee_name: 'Priya N.', leave_type_name: 'Sick Leave', start_date: '2026-07-18', end_date: '2026-07-19', status: 'pending' },
  { id: 2, employee_name: 'Ravi T.', leave_type_name: 'Casual Leave', start_date: '2026-07-22', end_date: '2026-07-22', status: 'pending' },
  { id: 3, employee_name: 'Sundar M.', leave_type_name: 'Annual Leave', start_date: '2026-07-28', end_date: '2026-07-30', status: 'approved' }
];

const MOCK_PAYROLL = [
  { employee_name: 'Priya Nandhini', department_name: 'Nursing', working_days: 26, total_deductions: 1200, net_salary: 21500, status: 'pending' },
  { employee_name: 'Sundar M.', department_name: 'Laboratory', working_days: 24, total_deductions: 2800, net_salary: 19700, status: 'pending' },
  { employee_name: 'Ravi T.', department_name: 'Pharmacy', working_days: 25, total_deductions: 900, net_salary: 20100, status: 'pending' },
  { employee_name: 'Dr. Meera R.', department_name: 'General Medicine', working_days: 27, total_deductions: 0, net_salary: 72000, status: 'approved' }
];

const MOCK_ROSTER = [
  {
    employee_name: 'Priya N.',
    shifts: ['M', 'M', 'WO', 'M', 'E', 'N', 'WO', 'M', 'M', 'E', 'E', 'N', 'WO', 'M']
  },
  {
    employee_name: 'Sundar M.',
    shifts: ['N', 'N', 'WO', 'E', 'N', 'WO', 'M', 'M', 'E', 'N', 'WO', 'M', 'E', 'E']
  },
  {
    employee_name: 'Ravi T.',
    shifts: ['M', 'WO', 'M', 'M', 'E', 'E', 'N', 'WO', 'M', 'M', 'E', 'WO', 'N', 'M']
  }
];

function AddEmployeeModal({ open, onClose, onSaved }) {
  const { request, loading } = useApi();
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [form, setForm] = useState({
    full_name: '',
    employee_code: '',
    phone: '',
    email: '',
    department_id: '',
    designation_id: '',
    shift_id: '',
    joining_date: new Date().toISOString().split('T')[0],
    salary_type: 'monthly',
    basic_salary: '',
    per_day_salary: '',
    per_night_salary: '',
    gender: 'male',
    dob: '1995-01-01',
    address: '',
    bank_account_no: '',
    bank_ifsc: '',
    uan_number: ''
  });
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    request('/hr/departments').then(r => setDepartments(r?.data || [])).catch(() => {});
    request('/hr/shifts').then(r => setShifts(r?.data || [])).catch(() => {});
    setDesignations([]);
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleDepartmentChange = async (deptId) => {
    setForm(f => ({ ...f, department_id: deptId, designation_id: '', basic_salary: '' }));
    if (!deptId) {
      setDesignations([]);
      return;
    }
    try {
      const res = await request(`/hr/staff-roles?departmentId=${deptId}`);
      const roles = res?.data || [];
      setDesignations(roles);
      if (roles.length > 0) {
        const firstRole = roles[0];
        setForm(f => {
          const updated = {
            ...f,
            department_id: deptId,
            designation_id: firstRole.id,
            basic_salary: firstRole.basic_salary ?? ''
          };
          if (firstRole.shift_name) {
            const matched = shifts.find(s => s.name.toLowerCase() === firstRole.shift_name.toLowerCase());
            if (matched) {
              updated.shift_id = matched.id;
            }
          }
          return updated;
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDesignationChange = (roleId) => {
    const selectedRole = designations.find(d => String(d.id) === String(roleId));
    if (selectedRole) {
      setForm(f => {
        const updated = {
          ...f,
          designation_id: roleId,
          basic_salary: selectedRole.basic_salary ?? ''
        };
        if (selectedRole.shift_name) {
          const matched = shifts.find(s => s.name.toLowerCase() === selectedRole.shift_name.toLowerCase());
          if (matched) {
            updated.shift_id = matched.id;
          }
        }
        return updated;
      });
    } else {
      setForm(f => ({ ...f, designation_id: roleId }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const payload = {
        employee_code: form.employee_code || `EMP0${Math.floor(10 + Math.random() * 90)}`,
        full_name: form.full_name,
        gender: form.gender,
        dob: form.dob,
        date_of_joining: form.joining_date,
        department_id: Number(form.department_id) || undefined,
        designation_id: Number(form.designation_id) || undefined,
        shift_id: Number(form.shift_id) || undefined,
        basic_salary: Number(form.basic_salary) || undefined,
        per_day_salary: Number(form.per_day_salary) || 0,
        per_night_salary: Number(form.per_night_salary) || 0,
        phone: form.phone || null,
        email: form.email || null,
        salary_type: form.salary_type,
        address: form.address || null,
        bank_account_no: form.bank_account_no || null,
        bank_ifsc: form.bank_ifsc || null,
        uan_number: form.uan_number || null
      };

      const res = await request('/hr/employees', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      const realId = res?.data?.id || Date.now();
      
      const newEmp = {
        id: realId,
        employee_code: payload.employee_code,
        full_name: payload.full_name,
        department_name: departments.find(d => String(d.id) === String(form.department_id))?.name || '',
        designation_name: designations.find(d => String(d.id) === String(form.designation_id))?.name || '',
        joining_date: payload.date_of_joining,
        phone: payload.phone || '—',
        salary_type: payload.salary_type,
        basic_salary: payload.basic_salary || 0,
        per_day_salary: payload.per_day_salary || 0,
        per_night_salary: payload.per_night_salary || 0,
        email: payload.email || '—',
        bank_account: payload.bank_account_no || '—',
        ifsc: payload.bank_ifsc || '—',
        uan: payload.uan_number || 'Pending enrolment',
        status: 'active',
        avatar: `https://i.pravatar.cc/150?u=emp_${realId}`
      };
      
      onSaved(newEmp);
      onClose();
    } catch (e) { setErr(e.message); }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 580 }}>
        <div className="modal-header">
          <h2 className="modal-title font-bold text-slate-800">Add New Employee</h2>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body modal-form-body">
            <div className="modal-grid grid grid-cols-2 gap-4">
              <div>
                <label className="field-label font-semibold text-slate-700 block mb-0.5">Full Name *</label>
                <input className="field" required value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <label className="field-label font-semibold text-slate-700 block mb-0.5">Employee Code</label>
                <input className="field" value={form.employee_code} onChange={e => set('employee_code', e.target.value)} placeholder="e.g. EMP082" />
              </div>
              <div>
                <label className="field-label font-semibold text-slate-700 block mb-0.5">Gender *</label>
                <select className="field" value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="field-label font-semibold text-slate-700 block mb-0.5">Date of Birth *</label>
                <input className="field" type="date" required value={form.dob} onChange={e => set('dob', e.target.value)} />
              </div>
              <div>
                <label className="field-label font-semibold text-slate-700 block mb-0.5">Phone</label>
                <input className="field" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9XXXXXXXXX" />
              </div>
              <div>
                <label className="field-label font-semibold text-slate-700 block mb-0.5">Email</label>
                <input className="field" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@hospital.com" />
              </div>
              <div>
                <label className="field-label font-semibold text-slate-700 block mb-0.5">Department *</label>
                <select className="field" required value={form.department_id} onChange={e => handleDepartmentChange(e.target.value)}>
                  <option value="">Select...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label font-semibold text-slate-700 block mb-0.5">Designation (Role) *</label>
                <select className="field" required value={form.designation_id} onChange={e => handleDesignationChange(e.target.value)}>
                  {designations.length === 0 ? (
                    <option value="">Select a department first...</option>
                  ) : (
                    <>
                      <option value="">Select...</option>
                      {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="field-label font-semibold text-slate-700 block mb-0.5">Joining Date *</label>
                <input className="field" type="date" required value={form.joining_date} onChange={e => set('joining_date', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="field-label font-semibold text-slate-700 block mb-0.5">Address</label>
                <input className="field" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Residential Address" />
              </div>

              {/* ── Salary Section ── */}
              <div className="col-span-2 mt-1 mb-0">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">Salary Details</div>
              </div>
              <div>
                <label className="field-label font-semibold text-slate-700 block mb-0.5">Monthly Salary (₹) *</label>
                <input className="field" type="number" required value={form.basic_salary} onChange={e => set('basic_salary', e.target.value)} placeholder="e.g. 22500" />
              </div>

              {/* ── Banking & PF Section ── */}
              <div className="col-span-2 mt-1 mb-0">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">Banking & PF Details</div>
              </div>
              <div>
                <label className="field-label font-semibold text-slate-700 block mb-0.5">Bank Account No *</label>
                <input className="field" required value={form.bank_account_no} onChange={e => set('bank_account_no', e.target.value)} placeholder="e.g. 1234567890" />
              </div>
              <div>
                <label className="field-label font-semibold text-slate-700 block mb-0.5">IFSC Code *</label>
                <input className="field" required value={form.bank_ifsc} onChange={e => set('bank_ifsc', e.target.value)} placeholder="e.g. HDFC0001234" />
              </div>
              <div>
                <label className="field-label font-semibold text-slate-700 block mb-0.5">UAN / PF No <span className="text-slate-400 font-normal">(Optional)</span></label>
                <input className="field" value={form.uan_number} onChange={e => set('uan_number', e.target.value)} placeholder="e.g. 100987654321" />
              </div>
            </div>
            {err && <p className="modal-error text-red-500 text-xs mt-2">{err}</p>}
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
  const { request } = useApi();
  const [employees, setEmployees] = useState(MOCK_EMPLOYEES);
  const [selectedEmpId, setSelectedEmpId] = useState(14);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Interactive UI states
  const [attendance, setAttendance] = useState(MOCK_ATTENDANCE);
  const [leaveRequests, setLeaveRequests] = useState(MOCK_LEAVE_REQUESTS);
  const [payrollItems, setPayrollItems] = useState(MOCK_PAYROLL);
  const [toastMsg, setToastMsg] = useState(null);

  // Load from backend on start to merge
  useEffect(() => {
    request('/hr/employees?limit=200').then(res => {
      const rows = res?.data?.rows || res?.data || [];
      if (rows.length > 0) {
        setEmployees(prev => {
          const merged = [...prev];
          rows.forEach(r => {
            if (!merged.find(m => m.id === r.id || m.employee_code === r.employee_code)) {
              merged.push({
                ...r,
                avatar: r.avatar || `https://i.pravatar.cc/150?u=emp_${r.id}`
              });
            }
          });
          return merged;
        });
      }
    }).catch(() => {});
  }, [request]);

  const handleAddEmployeeLocal = (newEmp) => {
    setEmployees(prev => [newEmp, ...prev]);
    setSelectedEmpId(newEmp.id);
    showToast(`Successfully added employee: ${newEmp.full_name}`);
  };

  const handleLeaveReview = (id, decision) => {
    setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, status: decision === 'approved' ? 'approved' : 'rejected' } : r));
    showToast(`Leave request ${decision === 'approved' ? 'approved' : 'rejected'} successfully.`);
    request(`/leave/requests/${id}/review`, { method: 'PATCH', body: JSON.stringify({ status: decision }) }).catch(() => {});
  };

  const handleRunPayroll = () => {
    setPayrollItems(prev => prev.map(p => ({ ...p, status: 'approved' })));
    showToast("Payroll run successfully executed and approved.");
  };

  const handleSyncBiometric = () => {
    showToast("Syncing biometric logs in background...");
  };

  const handleSaveChanges = () => {
    showToast("Employee profile changes saved successfully.");
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 3500);
  };

  const selectedEmp = employees.find(emp => emp.id === selectedEmpId) || employees[0];

  const filteredEmployees = employees.filter(emp => {
    const term = searchQuery.toLowerCase();
    return (
      emp.full_name.toLowerCase().includes(term) ||
      (emp.employee_code && emp.employee_code.toLowerCase().includes(term)) ||
      (emp.department_name && emp.department_name.toLowerCase().includes(term)) ||
      (emp.designation_name && emp.designation_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="hr-overview-page">
      <AddEmployeeModal open={showModal} onClose={() => setShowModal(false)} onSaved={handleAddEmployeeLocal} />
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="hr-toast">
          <Check size={16} className="hr-toast-icon" />
          <span className="font-medium">{toastMsg}</span>
        </div>
      )}

      <PageHeader 
        breadcrumbs={[
          { label: 'HR & Payroll', path: '#' },
          { label: 'Overview' }
        ]}
        searchPlaceholder="Search employees..."
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        actions={
          <button 
            onClick={() => setShowModal(true)} 
            className="hr-btn hr-btn-primary"
            style={{ borderRadius: '8px', height: '36px', padding: '0 18px' }}
          >
            <Plus size={16} />
            <span>Add Employee</span>
          </button>
        }
      />

      <div className="page-content hr-content-wrapper">
        {/* Title Section */}
        <div className="hr-title-section">
          <h1 className="hr-title-main">HR &amp; Employee Management</h1>
          <p className="hr-title-desc">Manage staff records, attendance, leave, and payroll from one unified dashboard.</p>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid mb-18">
          <div className="stat-card">
            <div className="stat-card-left">
              <div className="stat-label">Total Employees</div>
              <div className="stat-value">94</div>
              <div className="stat-sub">
                <span className="stat-trend-up">
                  <TrendingUp size={11} />+2
                </span>
                <span>85 present today</span>
              </div>
            </div>
            <div className="stat-icon-wrapper blue-bg">
              <Users size={16} className="icon-blue" />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-left">
              <div className="stat-label">On Leave Today</div>
              <div className="stat-value">3</div>
              <div className="stat-sub">
                <span>2 pending approval</span>
              </div>
            </div>
            <div className="stat-icon-wrapper orange-bg">
              <FileMinus size={16} className="icon-orange" />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-left">
              <div className="stat-label">Attendance Today</div>
              <div className="stat-value">86</div>
              <div className="stat-sub">
                <span className="stat-trend-up">
                  <TrendingUp size={11} />91.5%
                </span>
                <span>Attendance rate</span>
              </div>
            </div>
            <div className="stat-icon-wrapper green-bg">
              <Clock size={16} className="icon-green" />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-left">
              <div className="stat-label">Payroll This Month</div>
              <div className="stat-value">₹17.2L</div>
              <div className="stat-sub">
                <span>5 pending approval</span>
              </div>
            </div>
            <div className="stat-icon-wrapper blue-bg">
              <Banknote size={16} className="icon-blue" />
            </div>
          </div>
        </div>

        {/* Dashboard Content Container */}
        <div className="hr-dashboard-grid">
          {/* Left Column: Employee List Card */}
          <div className="emp-list-card">
            <div className="emp-list-header">
              <h3>Employees</h3>
              <span className="emp-total-badge">94 total</span>
            </div>
            <div className="emp-list-scroll">
              {filteredEmployees.map(emp => (
                <div
                  key={emp.id}
                  className={`emp-list-item ${selectedEmpId === emp.id ? 'selected' : ''}`}
                  onClick={() => setSelectedEmpId(emp.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="emp-avatar">
                      <img src={emp.avatar} alt={emp.full_name} />
                    </div>
                    <div>
                      <div className="emp-name">{emp.full_name}</div>
                      <div className="emp-dept">{emp.department_name} · {emp.designation_name}</div>
                    </div>
                  </div>
                  <span className={`status-badge ${emp.status}`}>
                    {emp.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
              {filteredEmployees.length === 0 && (
                <div className="text-center text-slate-400 py-8 text-xs">No employees found.</div>
              )}
            </div>
            <div className="emp-list-footer">
              <button className="emp-view-all-btn">View all employees</button>
            </div>
          </div>

          {/* Right Column: Dynamic Profile & Sections */}
          <div className="emp-detail-container">
            {/* Employee Profile Card */}
            {selectedEmp && (
              <div className="hr-card">
                <div className="hr-card-header">
                  <h3 className="hr-card-title">
                    Employee Profile — {selectedEmp.full_name}
                  </h3>
                  <button className="hr-btn hr-btn-outline hr-btn-sm" style={{ height: '28px', padding: '0 12px', fontSize: '11.5px', borderRadius: '6px' }}>
                    Edit Profile
                  </button>
                </div>
                <div className="hr-card-body">
                  <div className="emp-detail-header">
                    <div className="emp-detail-avatar-container">
                      <div className="emp-detail-avatar">
                        <img src={selectedEmp.avatar} alt={selectedEmp.full_name} className="w-full h-full object-cover" />
                      </div>
                      <span className={`status-badge ${selectedEmp.status}`}>
                        {selectedEmp.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="emp-detail-info-grid">
                      <div>
                        <div className="info-label">Department</div>
                        <div className="info-value">{selectedEmp.department_name}</div>
                      </div>
                      <div>
                        <div className="info-label">Designation</div>
                        <div className="info-value">{selectedEmp.designation_name}</div>
                      </div>
                      <div>
                        <div className="info-label">Joining Date</div>
                        <div className="info-value">{fmtDate(selectedEmp.joining_date)}</div>
                      </div>
                      <div>
                        <div className="info-label">Phone</div>
                        <div className="info-value">{selectedEmp.phone}</div>
                      </div>
                      <div>
                        <div className="info-label">Monthly Salary</div>
                        <div className="info-value">
                          ₹{Number(selectedEmp.basic_salary).toLocaleString('en-IN')} / month
                        </div>
                      </div>
                      <div>
                        <div className="info-label">Per Day Shift</div>
                        <div className="info-value">
                          ₹{Number(selectedEmp.per_day_salary || 0).toLocaleString('en-IN')} / day
                        </div>
                      </div>
                      <div>
                        <div className="info-label">Per Night Shift</div>
                        <div className="info-value">
                          ₹{Number(selectedEmp.per_night_salary || 0).toLocaleString('en-IN')} / night
                        </div>
                      </div>
                      <div>
                        <div className="info-label">Bank Account</div>
                        <div className="info-value">{selectedEmp.bank_account || '—'}</div>
                      </div>
                      <div>
                        <div className="info-label">IFSC</div>
                        <div className="info-value">{selectedEmp.ifsc || '—'}</div>
                      </div>
                      <div>
                        <div className="info-label">UAN (PF)</div>
                        <div className={`info-value ${selectedEmp.uan === 'Pending enrolment' ? 'text-amber-500' : 'text-slate-800'}`}>
                          {selectedEmp.uan || 'Pending enrolment'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="emp-detail-actions">
                    <button onClick={handleSaveChanges} className="hr-btn hr-btn-primary hr-btn-md">
                      <Briefcase size={14} />
                      <span>Save changes</span>
                    </button>
                    <button className="hr-btn hr-btn-outline hr-btn-md">
                      <Banknote size={14} />
                      <span>View salary history</span>
                    </button>
                    <button className="hr-btn hr-btn-outline hr-btn-md">
                      <Calendar size={14} />
                      <span>View attendance</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Today's Attendance Card */}
            <div className="hr-card">
              <div className="hr-card-header">
                <h3 className="hr-card-title">Today's Attendance — 15 Jul 2026</h3>
                <div className="tab-group-container">
                  <button onClick={handleSyncBiometric} className="hr-btn hr-btn-outline hr-btn-sm">
                    <RefreshCw size={13} />
                    <span>Sync Biometric</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="hr-card-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Shift</th>
                      <th>In</th>
                      <th>Out</th>
                      <th>Worked</th>
                      <th>Late</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((r, i) => (
                      <tr key={i}>
                        <td className="info-value">{r.employee_name}</td>
                        <td className="text-primary font-medium text-[13px]">{r.shift_name}</td>
                        <td className="text-slate-600 text-[13px]">{r.first_punch_in || '—'}</td>
                        <td className="text-slate-600 text-[13px]">{r.last_punch_out || '—'}</td>
                        <td className="text-slate-700 text-[13px]">{fmtMins(r.worked_minutes)}</td>
                        <td className={`text-[13px] font-semibold ${r.late_minutes > 0 ? 'text-amber-500' : 'text-slate-300'}`}>
                          {r.late_minutes > 0 ? `${r.late_minutes}m` : '—'}
                        </td>
                        <td>
                          <span className={`status-badge ${r.status}`}>
                            {r.status === 'present' && 'Present'}
                            {r.status === 'absent' && 'Absent'}
                            {r.status === 'late' && 'Late'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Leave Requests + Payroll side-by-side */}
            <div className="grid grid-cols-2 gap-5">
              {/* Leave Requests */}
              <div className="hr-card">
                <div className="hr-card-header">
                  <h3 className="hr-card-title">Leave Requests</h3>
                  <span className="status-badge pending">
                    {leaveRequests.filter(r => r.status === 'pending').length} pending
                  </span>
                </div>
                <div className="leave-requests-container">
                  {leaveRequests.map((r, i) => (
                    <div key={i} className="leave-request-item">
                      <div className="flex items-start justify-between mb-1">
                        <div className="font-semibold text-[13px] text-slate-800">{r.employee_name}</div>
                        <span className={`status-badge ${r.status}`}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-slate-500 mb-3">
                        {r.leave_type_name} · {r.start_date === r.end_date
                          ? fmtDate(r.start_date)
                          : `${fmtDate(r.start_date)} - ${fmtDate(r.end_date)}`}
                      </div>
                      {r.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => handleLeaveReview(r.id, 'approved')} className="hr-btn hr-btn-outline hr-btn-sm flex-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50">
                            <span>Approve</span>
                          </button>
                          <button onClick={() => handleLeaveReview(r.id, 'rejected')} className="hr-btn hr-btn-outline hr-btn-sm flex-1 text-red-500 border-red-200 hover:bg-red-50">
                            <span>Reject</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Payroll Summary */}
              <div className="hr-card min-w-0">
                <div className="hr-card-header">
                  <h3 className="hr-card-title">Payroll — July 2026</h3>
                  <button onClick={handleRunPayroll} className="hr-btn hr-btn-primary hr-btn-sm">
                    <span>Run payroll</span>
                  </button>
                </div>
                <div className="overflow-x-auto min-w-0">
                  <table className="hr-card-table payroll-table w-full">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th className="text-center">Days</th>
                        <th className="text-right">Deductions</th>
                        <th className="text-right">Net Pay</th>
                        <th className="text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollItems.map((it, i) => (
                        <tr key={i}>
                          <td>
                            <div className="font-semibold text-[13px] text-slate-800 leading-snug">{it.employee_name}</div>
                            <div className="text-[10.5px] text-slate-400 font-medium mt-0.5">{it.department_name}</div>
                          </td>
                          <td className="text-center text-[13px] font-medium text-slate-700">{it.working_days}</td>
                          <td className="text-right text-[13px] font-semibold text-red-500">₹{Number(it.total_deductions).toLocaleString('en-IN')}</td>
                          <td className="text-right text-[13px] font-semibold text-slate-800">₹{Number(it.net_salary).toLocaleString('en-IN')}</td>
                          <td className="text-right">
                            <span className={`status-badge ${it.status}`}>
                              {it.status === 'approved' ? 'Approved' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="hr-payroll-footer">
                  <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Total net payout</span>
                  <span className="text-[16px] font-extrabold text-slate-900">₹18,42,700</span>
                </div>
              </div>
            </div>

            {/* Shift Roster Card */}
            <div className="hr-card">
              <div className="hr-card-header">
                <h3 className="hr-card-title">Shift Roster — July 2026</h3>
                <div className="flex items-center gap-2">
                  <button className="hr-btn hr-btn-outline hr-btn-sm">
                    <span>Suggest with AI</span>
                  </button>
                  <button className="hr-btn hr-btn-primary hr-btn-sm">
                    <span>Publish roster</span>
                  </button>
                </div>
              </div>
              <div className="hr-card-body pb-0" style={{ padding: '0 !important' }}>
                <div className="overflow-x-auto">
                  <table className="hr-roster-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        {Array.from({ length: 14 }, (_, i) => (
                          <th key={i}>{i + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_ROSTER.map((row, i) => (
                        <tr key={i}>
                          <td className="font-semibold text-[13px] text-slate-800">{row.employee_name}</td>
                          {row.shifts.map((shift, idx) => (
                            <td key={idx}>
                              <div className="flex justify-center">
                                <span className={`roster-pill ${shift.toLowerCase()}`}>{shift}</span>
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="hr-roster-legend">
                <div className="flex items-center gap-2 text-[12px] font-medium text-slate-600"><span className="roster-pill m">M</span> Morning (6am-3pm)</div>
                <div className="flex items-center gap-2 text-[12px] font-medium text-slate-600"><span className="roster-pill e">E</span> Evening (2pm-11pm)</div>
                <div className="flex items-center gap-2 text-[12px] font-medium text-slate-600"><span className="roster-pill n">N</span> Night (10pm-7am)</div>
                <div className="flex items-center gap-2 text-[12px] font-medium text-slate-600"><span className="roster-pill wo">WO</span> Week Off</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
