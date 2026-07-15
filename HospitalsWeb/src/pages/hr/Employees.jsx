import { useState, useEffect } from 'react';
import { useApi } from '../../hooks/useApi';
import { Card } from '../../components/ui/Card';
import './Employees.css';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, TableLoading } from '../../components/ui/Table';
import { Button } from '../../components/ui/Button';
import { Search, UserCheck, X, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

function EmployeeModal({ open, onClose, onSaved }) {
  const { request, loading } = useApi();
  const [form, setForm] = useState({
    full_name: '', employee_code: '', department: '', designation_id: '',
    mobile: '', email: '', date_of_joining: new Date().toISOString().split('T')[0],
    gender: 'male', is_active: true
  });
  const [designations, setDesignations] = useState([]);
  const [err, setErr] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) {
      request('/hr/designations').then(r => setDesignations(r?.data || [])).catch(() => {});
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr('');
    if (!form.full_name || !form.employee_code) return setErr('Name and employee code are required.');
    try {
      await request('/hr/employees', { method: 'POST', body: JSON.stringify(form) });
      onSaved(); onClose();
      setForm({ full_name: '', employee_code: '', department: '', designation_id: '', mobile: '', email: '', date_of_joining: new Date().toISOString().split('T')[0], gender: 'male', is_active: true });
    } catch (e) { setErr(e.message); }
  };

  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ width: 540 }}>
        <div className="modal-header">
          <h2>Add New Employee</h2>
          <button className="modal-close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid-cols-2 gap-3" style={{ display: 'grid', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label required">Full Name</label>
                <input className="form-control" required value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. John Doe" />
              </div>
              <div className="form-group">
                <label className="form-label required">Employee Code</label>
                <input className="form-control" required value={form.employee_code} onChange={e => set('employee_code', e.target.value)} placeholder="e.g. EMP001" />
              </div>
            </div>
            <div className="grid-cols-2 gap-3" style={{ display: 'grid', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-control" value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date of Joining</label>
                <input className="form-control" type="date" value={form.date_of_joining} onChange={e => set('date_of_joining', e.target.value)} />
              </div>
            </div>
            <div className="grid-cols-2 gap-3" style={{ display: 'grid', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Mobile</label>
                <input className="form-control" type="tel" value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="e.g. 9999999999" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="e.g. john@example.com" />
              </div>
            </div>
            <div className="grid-cols-2 gap-3" style={{ display: 'grid', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input className="form-control" placeholder="e.g. Cardiology" value={form.department} onChange={e => set('department', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Designation</label>
                <select className="form-control" value={form.designation_id} onChange={e => set('designation_id', e.target.value)}>
                  <option value="">— Select —</option>
                  {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            {err && <div className="alert alert-danger"><span className="alert-content">{err}</span></div>}
          </div>
          <div className="modal-footer">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={loading}>Add Employee</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Employees() {
  const { request } = useApi();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('active');

  const load = async (q = '', tab = 'active') => {
    setLoading(true);
    try {
      const isActive = tab === 'active' ? 1 : 0;
      const res = await request(`/hr/employees?search=${encodeURIComponent(q)}&is_active=${isActive}&limit=100`);
      if (res?.success) {
        setEmployees(res.data?.rows || res.data || []);
        setTotal(res.data?.total || 0);
      }
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(() => load(search, activeTab), 300);
    return () => clearTimeout(t);
  }, [search, activeTab]);

  return (
    <div className="employees-container">
      <div className="employees-header">
        <div>
          <h1 className="employees-title">Employee Master</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-md)', margin: '4px 0 0 0' }}>{total} employees — {activeTab === 'active' ? 'Active' : 'Inactive'}</p>
        </div>
        <div className="employees-actions">
          <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
            <button style={{ padding: '6px 12px', background: activeTab === 'active' ? 'var(--primary)' : 'transparent', color: activeTab === 'active' ? 'white' : 'var(--text-md)', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s' }} onClick={() => setActiveTab('active')}>Active</button>
            <button style={{ padding: '6px 12px', background: activeTab === 'inactive' ? 'var(--primary)' : 'transparent', color: activeTab === 'inactive' ? 'white' : 'var(--text-md)', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s' }} onClick={() => setActiveTab('inactive')}>Inactive</button>
          </div>
          <Button icon={UserCheck} onClick={() => setShowModal(true)}>Add Employee</Button>
        </div>
      </div>

      <div className="search-box" style={{ width: '100%', maxWidth: '300px' }}>
        <span className="search-box-icon"><Search size={14} /></span>
        <input
          className="form-control"
          placeholder="Search by name or employee code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="employees-table-card">
        <div className="employees-table-wrapper">
          <table className="employees-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Mobile</th>
                <th>Joined</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--mute)' }}>Loading...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--mute)' }}>No employees found.</td></tr>
              ) : (
                employees.map(e => (
                  <tr key={e.id}>
                    <td><span className="employee-cell-code">{e.employee_code}</span></td>
                    <td>
                      <div className="employee-cell-name">{e.full_name}</div>
                      {e.email && <div style={{ fontSize: '11px', color: 'var(--text-md)' }}>{e.email}</div>}
                    </td>
                    <td style={{ color: 'var(--text-md)' }}>{e.department_name || e.department || '—'}</td>
                    <td style={{ color: 'var(--text-md)' }}>{e.designation_name || e.designation || '—'}</td>
                    <td>{e.mobile || '—'}</td>
                    <td style={{ color: 'var(--text-md)' }}>
                      {e.date_of_joining ? format(new Date(e.date_of_joining), 'dd MMM yyyy') : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`employee-status ${e.is_active ? 'active' : 'inactive'}`}>
                        {e.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmployeeModal open={showModal} onClose={() => setShowModal(false)} onSaved={() => load(search, activeTab)} />
    </div>
  );
}
