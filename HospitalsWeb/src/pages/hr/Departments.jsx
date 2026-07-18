import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  FolderOpen, Plus, Search, Edit2, Trash2, CheckCircle, XCircle, X,
  AlertTriangle, Shield, Clock, Banknote, ArrowRight, ArrowLeft, Sun, Moon, Fingerprint, Users
} from 'lucide-react';
import './Departments.css';

// Helper to format TIME (HH:MM:SS or HH:MM) into a cleaner AM/PM format
function formatTime12(timeStr) {
  if (!timeStr) return '—';
  const parts = timeStr.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] || '00';
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

const DEFAULT_ROLE_FORM = {
  name: '',
  basic_salary: '',
  hra: '',
  da: '',
  lop_deduction: '',
  casual_leave_count: '',
  privilege_leave_count: '',
  weekly_off_count: '',
  shift_name: '',
  shift_start_time: '08:30',
  shift_end_time: '16:00',
  biometric_in_start: '08:30',
  biometric_in_end: '09:00',
  biometric_out_start: '16:00',
  biometric_out_end: '16:15',
  is_night_shift: false,
  night_shift_name: '',
  night_shift_start_time: '22:00',
  night_shift_end_time: '07:00',
  night_biometric_in_start: '21:45',
  night_biometric_in_end: '22:15',
  night_biometric_out_start: '06:45',
  night_biometric_out_end: '07:15',
  grace_period_minutes: 15
};

/* ═══════════════════════════════════════════════════════════
   ROLE CARD COMPONENT
   ═══════════════════════════════════════════════════════════ */
function RoleCard({ role, onEdit, onDelete }) {
  const isRoleActive = role.is_active === 1 || role.is_active === true;
  const isNight = role.is_night_shift === 1 || role.is_night_shift === true;

  return (
    <div className={`role-card ${isNight ? 'night-role' : ''} ${!isRoleActive ? 'inactive-role' : ''}`}>
      <div className="role-card-accent" />
      <div className="role-card-body">
        {/* Header */}
        <div className="role-card-header">
          <div>
            <div className="role-card-title">{role.name}</div>
            <div className="role-card-badges" style={{ marginTop: 4 }}>
              <span className={`badge ${isRoleActive ? 'badge-success' : 'badge-danger'}`}>
                {isRoleActive ? 'Active' : 'Inactive'}
              </span>
              {isNight && (
                <span className="night-shift-badge">
                  <Moon size={9} /> Night
                </span>
              )}
            </div>
          </div>
          <div className="role-card-actions">
            <button className="edit-btn" onClick={() => onEdit(role)} title="Edit">
              <Edit2 size={13} />
            </button>
            <button className="del-btn" onClick={() => onDelete(role.id)} title="Delete">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="role-info-grid">
          <div className="role-info-block">
            <div className="role-info-label">Monthly Salary</div>
            <div className="role-info-value">₹{(parseFloat(role.basic_salary) || 0).toLocaleString('en-IN')}</div>
            <div className="role-info-sub">
              HRA: ₹{parseFloat(role.hra) || 0} · DA: ₹{parseFloat(role.da) || 0}
            </div>
          </div>
          <div className="role-info-block">
            <div className="role-info-label">LOP / Day</div>
            <div className="role-info-value" style={{ color: '#e11d48' }}>
              ₹{(parseFloat(role.lop_deduction) || 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="role-info-block">
            <div className="role-info-label">Casual Leave</div>
            <div className="role-info-value">{role.casual_leave_count} /month</div>
          </div>
          <div className="role-info-block">
            <div className="role-info-label">Privilege Leave</div>
            <div className="role-info-value">{role.privilege_leave_count || 0} /month</div>
          </div>
          <div className="role-info-block col-span-2">
            <div className="role-info-label">Weekly Offs</div>
            <div className="role-info-value">{role.weekly_off_count} day(s)</div>
          </div>
        </div>

        {/* Shift Strip */}
        {role.shift_name && (
          <div className="role-shift-strip">
            <div className={`shift-icon-box ${isNight ? 'night' : 'day'}`}>
              {isNight ? <Moon size={16} /> : <Sun size={16} />}
            </div>
            <div className="shift-details-text">
              <div className="shift-name-row">{role.shift_name}</div>
              <div className="shift-time-row">
                {formatTime12(role.shift_start_time)} — {formatTime12(role.shift_end_time)}
                <span style={{ marginLeft: 6, fontSize: 10, color: '#94a3b8' }}>
                  Grace: {role.grace_period_minutes || 0}min
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Biometric Strip */}
        {role.shift_name && (
          <div className="biometric-strip">
            <span className="bio-badge in">
              <Fingerprint size={10} />
              IN {formatTime12(role.biometric_in_start)}–{formatTime12(role.biometric_in_end)}
            </span>
            <span className="bio-badge out">
              <Fingerprint size={10} />
              OUT {formatTime12(role.biometric_out_start)}–{formatTime12(role.biometric_out_end)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ROLE FORM (USED IN BOTH WIZARD AND STANDALONE MODAL)
   ═══════════════════════════════════════════════════════════ */
function RoleFormFields({ form, setForm, compact = false }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      {/* 1. Basic Details */}
      <div className="form-section">
        <div className="form-section-header">
          <div className="form-section-icon blue"><Shield size={14} /></div>
          <div>
            <div className="form-section-title">Role Details</div>
            <div className="form-section-subtitle">Name and status of this staff role</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-0.5">Role Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Head Nurse"
              className="field w-full py-1.5 text-xs"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>
          {!compact && (
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="role_form_active"
                checked={form.is_active !== false}
                onChange={(e) => set('is_active', e.target.checked)}
              />
              <label htmlFor="role_form_active" className="text-[11px] text-slate-600 font-medium cursor-pointer">Active</label>
            </div>
          )}
        </div>
      </div>

      {/* 2. Salary & Leaves */}
      <div className="form-section">
        <div className="form-section-header">
          <div className="form-section-icon green"><Banknote size={14} /></div>
          <div>
            <div className="form-section-title">Salary & Leave Rules</div>
            <div className="form-section-subtitle">Monthly salary structure and leave allowances</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-0.5">Monthly Salary (₹) *</label>
            <input type="number" placeholder="e.g. 35000" className="field w-full py-1 text-xs"
              value={form.basic_salary} onChange={(e) => set('basic_salary', e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-0.5">HRA (₹)</label>
            <input type="number" placeholder="e.g. 5000" className="field w-full py-1 text-xs"
              value={form.hra} onChange={(e) => set('hra', e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-0.5">DA (₹)</label>
            <input type="number" placeholder="e.g. 3000" className="field w-full py-1 text-xs"
              value={form.da} onChange={(e) => set('da', e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-0.5">LOP Deduction / Day (₹) *</label>
            <input type="number" placeholder="e.g. 600" className="field w-full py-1 text-xs"
              value={form.lop_deduction} onChange={(e) => set('lop_deduction', e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-0.5">Casual Leave (Monthly) *</label>
            <input type="number" placeholder="e.g. 1" className="field w-full py-1 text-xs"
              value={form.casual_leave_count} onChange={(e) => set('casual_leave_count', e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-0.5">Privilege Leave (Monthly) *</label>
            <input type="number" placeholder="e.g. 1" className="field w-full py-1 text-xs"
              value={form.privilege_leave_count} onChange={(e) => set('privilege_leave_count', e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-0.5">Weekly Offs *</label>
            <input type="number" placeholder="e.g. 1" className="field w-full py-1 text-xs"
              value={form.weekly_off_count} onChange={(e) => set('weekly_off_count', e.target.value)} />
          </div>
        </div>
      </div>

      {/* 3. Day Shift Timing */}
      <div className="form-section">
        <div className="form-section-header">
          <div className="form-section-icon amber"><Sun size={14} /></div>
          <div>
            <div className="form-section-title">Day Shift & Biometric Timing</div>
            <div className="form-section-subtitle">Working hours and biometric scanner windows</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[11px] font-bold text-slate-600 block mb-0.5">Shift Name *</label>
            <input type="text" placeholder="e.g. Day Shift" className="field w-full py-1 text-xs"
              value={form.shift_name} onChange={(e) => set('shift_name', e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-0.5">Start Time *</label>
            <input type="time" className="field w-full py-1 text-xs"
              value={form.shift_start_time} onChange={(e) => set('shift_start_time', e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-0.5">End Time *</label>
            <input type="time" className="field w-full py-1 text-xs"
              value={form.shift_end_time} onChange={(e) => set('shift_end_time', e.target.value)} />
          </div>

          <div className="col-span-2 text-[10px] font-bold text-emerald-800 uppercase pt-1">Biometric IN Window</div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">IN Start *</label>
            <input type="time" className="field w-full py-1 border-emerald-100 bg-emerald-50/10 text-xs"
              value={form.biometric_in_start} onChange={(e) => set('biometric_in_start', e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">IN End *</label>
            <input type="time" className="field w-full py-1 border-emerald-100 bg-emerald-50/10 text-xs"
              value={form.biometric_in_end} onChange={(e) => set('biometric_in_end', e.target.value)} />
          </div>

          <div className="col-span-2 text-[10px] font-bold text-indigo-800 uppercase pt-1">Biometric OUT Window</div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">OUT Start *</label>
            <input type="time" className="field w-full py-1 border-indigo-100 bg-indigo-50/10 text-xs"
              value={form.biometric_out_start} onChange={(e) => set('biometric_out_start', e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-0.5">OUT End *</label>
            <input type="time" className="field w-full py-1 border-indigo-100 bg-indigo-50/10 text-xs"
              value={form.biometric_out_end} onChange={(e) => set('biometric_out_end', e.target.value)} />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-0.5">Grace Period (Mins) *</label>
            <input type="number" className="field w-full py-1 text-xs"
              value={form.grace_period_minutes} onChange={(e) => set('grace_period_minutes', e.target.value)} />
          </div>
        </div>
      </div>

      {/* 4. Night Shift Toggle + Timing */}
      <div className={form.is_night_shift ? 'night-shift-section' : 'form-section'}>
        <div className="form-section-header">
          <div className="form-section-icon purple"><Moon size={14} /></div>
          <div style={{ flex: 1 }}>
            <div className="form-section-title">Night Shift Timing</div>
            <div className="form-section-subtitle">Enable and configure night shift hours</div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_night_shift}
              onChange={(e) => set('is_night_shift', e.target.checked)}
            />
            <span className="text-[11px] font-bold text-purple-700">Enable Night Shift</span>
          </label>
        </div>

        {form.is_night_shift && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-purple-700 block mb-0.5">Night Shift Name *</label>
              <input type="text" placeholder="e.g. Night Shift" className="field w-full py-1 text-xs"
                value={form.night_shift_name} onChange={(e) => set('night_shift_name', e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-purple-700 block mb-0.5">Night Start Time *</label>
              <input type="time" className="field w-full py-1 text-xs border-purple-200 bg-purple-50/20"
                value={form.night_shift_start_time} onChange={(e) => set('night_shift_start_time', e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-purple-700 block mb-0.5">Night End Time *</label>
              <input type="time" className="field w-full py-1 text-xs border-purple-200 bg-purple-50/20"
                value={form.night_shift_end_time} onChange={(e) => set('night_shift_end_time', e.target.value)} />
            </div>

            <div className="col-span-2 text-[10px] font-bold text-purple-800 uppercase pt-1">Night Biometric IN Window</div>
            <div>
              <label className="text-[10px] text-purple-500 block mb-0.5">IN Start *</label>
              <input type="time" className="field w-full py-1 border-purple-200 bg-purple-50/20 text-xs"
                value={form.night_biometric_in_start} onChange={(e) => set('night_biometric_in_start', e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-purple-500 block mb-0.5">IN End *</label>
              <input type="time" className="field w-full py-1 border-purple-200 bg-purple-50/20 text-xs"
                value={form.night_biometric_in_end} onChange={(e) => set('night_biometric_in_end', e.target.value)} />
            </div>

            <div className="col-span-2 text-[10px] font-bold text-purple-800 uppercase pt-1">Night Biometric OUT Window</div>
            <div>
              <label className="text-[10px] text-purple-500 block mb-0.5">OUT Start *</label>
              <input type="time" className="field w-full py-1 border-purple-200 bg-purple-50/20 text-xs"
                value={form.night_biometric_out_start} onChange={(e) => set('night_biometric_out_start', e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-purple-500 block mb-0.5">OUT End *</label>
              <input type="time" className="field w-full py-1 border-purple-200 bg-purple-50/20 text-xs"
                value={form.night_biometric_out_end} onChange={(e) => set('night_biometric_out_end', e.target.value)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Departments() {
  const { request, loading } = useApi();
  const [departments, setDepartments] = useState([]);
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  
  // Right Pane state
  const [deptRoles, setDeptRoles] = useState([]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Wizard Modals
  const [deptWizardOpen, setDeptWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardDeptForm, setWizardDeptForm] = useState({ name: '', is_active: true });
  const [wizardRolesList, setWizardRolesList] = useState([]);
  const [wizardRoleForm, setWizardRoleForm] = useState({ ...DEFAULT_ROLE_FORM });

  // Edit Department Modal
  const [editDeptOpen, setEditDeptOpen] = useState(false);
  const [editDeptForm, setEditDeptForm] = useState({ id: null, name: '', is_active: true });

  // Role Add/Edit Modal (Standalone inside selected department)
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ ...DEFAULT_ROLE_FORM, is_active: true });

  // Deletions
  const [deleteConfirm, setDeleteConfirm] = useState({ id: null, type: null });

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── LOADERS ──────────────────────────────────────────
  const loadDepartments = useCallback(async () => {
    try {
      const res = await request('/hr/departments');
      const list = res?.data || [];
      setDepartments(list);
      if (list.length > 0 && !selectedDeptId) {
        setSelectedDeptId(list[0].id);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load departments', 'error');
    }
  }, [request, selectedDeptId]);

  const loadDeptRoles = useCallback(async () => {
    if (!selectedDeptId) return;
    try {
      const res = await request(`/hr/staff-roles?departmentId=${selectedDeptId}`);
      setDeptRoles(res?.data || []);
    } catch (err) {
      showToast(err.message || 'Failed to load staff roles', 'error');
    }
  }, [request, selectedDeptId]);

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (selectedDeptId) {
      loadDeptRoles();
    } else {
      setDeptRoles([]);
    }
  }, [selectedDeptId, loadDeptRoles]);

  // ── WIZARD ACTIONS ───────────────────────────────────
  const handleOpenWizard = () => {
    setWizardDeptForm({ name: '', is_active: true });
    setWizardRolesList([]);
    setWizardRoleForm({ ...DEFAULT_ROLE_FORM });
    setWizardStep(1);
    setDeptWizardOpen(true);
  };

  const handleAddRoleToWizardList = () => {
    if (!wizardRoleForm.name.trim()) {
      showToast('Role name is required', 'error');
      return;
    }
    if (wizardRoleForm.basic_salary === '' || wizardRoleForm.lop_deduction === '' || wizardRoleForm.casual_leave_count === '' || wizardRoleForm.privilege_leave_count === '' || wizardRoleForm.weekly_off_count === '') {
      showToast('Salary, LOP, Casual Leave, Privilege Leave, and Weekly Offs are required', 'error');
      return;
    }
    if (!wizardRoleForm.shift_name.trim()) {
      showToast('Shift name is required', 'error');
      return;
    }

    setWizardRolesList([...wizardRolesList, { ...wizardRoleForm, id: Date.now() }]);
    setWizardRoleForm({ ...DEFAULT_ROLE_FORM });
    showToast('Role & shift configuration added to list');
  };

  const handleRemoveRoleFromWizardList = (id) => {
    setWizardRolesList(wizardRolesList.filter(r => r.id !== id));
  };

  const handleSaveOnlyDepartment = async () => {
    if (!wizardDeptForm.name.trim()) {
      showToast('Department name is required', 'error');
      return;
    }
    try {
      const deptRes = await request('/hr/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: wizardDeptForm.name.trim(),
          is_active: wizardDeptForm.is_active
        })
      });
      const deptId = deptRes?.data?.id;
      showToast('Department created successfully');
      setDeptWizardOpen(false);
      if (deptId) {
        setSelectedDeptId(deptId);
      }
      loadDepartments();
    } catch (err) {
      showToast(err.message || 'Failed to save department', 'error');
    }
  };

  const buildRolePayload = (role, deptId) => {
    const fmtTime = (t) => t && t.length === 5 ? `${t}:00` : t;
    return {
      department_id: Number(deptId),
      name: role.name.trim(),
      is_active: role.is_active !== false,
      basic_salary: parseFloat(role.basic_salary) || 0,
      hra: parseFloat(role.hra) || 0,
      da: parseFloat(role.da) || 0,
      lop_deduction: parseFloat(role.lop_deduction) || 0,
      casual_leave_count: parseInt(role.casual_leave_count) || 0,
      privilege_leave_count: parseInt(role.privilege_leave_count) || 0,
      weekly_off_count: parseInt(role.weekly_off_count) || 0,
      shift_name: role.shift_name.trim(),
      shift_start_time: fmtTime(role.shift_start_time),
      shift_end_time: fmtTime(role.shift_end_time),
      biometric_in_start: fmtTime(role.biometric_in_start),
      biometric_in_end: fmtTime(role.biometric_in_end),
      biometric_out_start: fmtTime(role.biometric_out_start),
      biometric_out_end: fmtTime(role.biometric_out_end),
      is_night_shift: role.is_night_shift,
      grace_period_minutes: parseInt(role.grace_period_minutes) || 0
    };
  };

  const handleFinishWizard = async () => {
    if (!wizardDeptForm.name.trim()) {
      showToast('Department name is required', 'error');
      return;
    }

    try {
      const deptRes = await request('/hr/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: wizardDeptForm.name.trim(),
          is_active: wizardDeptForm.is_active
        })
      });
      const deptId = deptRes?.data?.id;

      if (deptId && wizardRolesList.length > 0) {
        for (const role of wizardRolesList) {
          await request('/hr/staff-roles', {
            method: 'POST',
            body: JSON.stringify(buildRolePayload(role, deptId))
          });
        }
      }

      showToast('Department and roles saved successfully');
      setDeptWizardOpen(false);
      if (deptId) {
        setSelectedDeptId(deptId);
      }
      loadDepartments();
    } catch (err) {
      showToast(err.message || 'Failed to save department & roles', 'error');
    }
  };

  // ── DEPT ACTIONS ─────────────────────────────────────
  const handleOpenEditDept = (dept) => {
    setEditDeptForm({
      id: dept.id,
      name: dept.name,
      is_active: dept.is_active === 1 || dept.is_active === true
    });
    setEditDeptOpen(true);
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    if (!editDeptForm.name.trim()) return;
    try {
      await request(`/hr/departments/${editDeptForm.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editDeptForm.name.trim(),
          is_active: editDeptForm.is_active
        })
      });
      showToast('Department details updated');
      setEditDeptOpen(false);
      loadDepartments();
    } catch (err) {
      showToast(err.message || 'Failed to update department', 'error');
    }
  };

  // ── ROLE ACTIONS ─────────────────────────────────────
  const handleOpenAddRole = () => {
    setEditingRole(null);
    setRoleForm({ ...DEFAULT_ROLE_FORM, is_active: true });
    setRoleModalOpen(true);
  };

  const handleOpenEditRole = (role) => {
    const cleanTime = (t) => t ? t.substring(0, 5) : '';
    setEditingRole(role);
    setRoleForm({
      name: role.name,
      is_active: role.is_active === 1 || role.is_active === true,
      basic_salary: role.basic_salary ?? '',
      hra: role.hra ?? '',
      da: role.da ?? '',
      lop_deduction: role.lop_deduction ?? '',
      casual_leave_count: role.casual_leave_count ?? '',
      privilege_leave_count: role.privilege_leave_count ?? '',
      weekly_off_count: role.weekly_off_count ?? '',
      shift_name: role.shift_name ?? '',
      shift_start_time: cleanTime(role.shift_start_time) || '08:30',
      shift_end_time: cleanTime(role.shift_end_time) || '16:00',
      biometric_in_start: cleanTime(role.biometric_in_start) || '08:30',
      biometric_in_end: cleanTime(role.biometric_in_end) || '09:00',
      biometric_out_start: cleanTime(role.biometric_out_start) || '16:00',
      biometric_out_end: cleanTime(role.biometric_out_end) || '16:15',
      is_night_shift: role.is_night_shift === 1 || role.is_night_shift === true,
      night_shift_name: role.night_shift_name ?? '',
      night_shift_start_time: cleanTime(role.night_shift_start_time) || '22:00',
      night_shift_end_time: cleanTime(role.night_shift_end_time) || '07:00',
      night_biometric_in_start: cleanTime(role.night_biometric_in_start) || '21:45',
      night_biometric_in_end: cleanTime(role.night_biometric_in_end) || '22:15',
      night_biometric_out_start: cleanTime(role.night_biometric_out_start) || '06:45',
      night_biometric_out_end: cleanTime(role.night_biometric_out_end) || '07:15',
      grace_period_minutes: role.grace_period_minutes ?? 15
    });
    setRoleModalOpen(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) return;
    if (roleForm.basic_salary === '' || roleForm.lop_deduction === '' || roleForm.casual_leave_count === '' || roleForm.privilege_leave_count === '' || roleForm.weekly_off_count === '') {
      showToast('Salary, LOP, Casual Leave, Privilege Leave, and Weekly Offs are required', 'error');
      return;
    }
    if (!roleForm.shift_name.trim()) {
      showToast('Shift name is required', 'error');
      return;
    }

    try {
      const payload = buildRolePayload(roleForm, selectedDeptId);
      // Remove department_id for updates (it doesn't change)
      if (editingRole) {
        delete payload.department_id;
        payload.is_active = roleForm.is_active;
        await request(`/hr/staff-roles/${editingRole.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        showToast('Role configuration saved');
      } else {
        await request('/hr/staff-roles', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast('New role added successfully');
      }
      setRoleModalOpen(false);
      loadDeptRoles();
    } catch (err) {
      showToast(err.message || 'Operation failed', 'error');
    }
  };

  // ── DELETIONS EXECUTION ──────────────────────────────
  const handleDeleteConfirm = async () => {
    const { id, type } = deleteConfirm;
    if (!id || !type) return;

    try {
      if (type === 'dept') {
        await request(`/hr/departments/${id}`, { method: 'DELETE' });
        showToast('Department deleted successfully');
        if (selectedDeptId === id) {
          setSelectedDeptId(null);
        }
        loadDepartments();
      } else if (type === 'role') {
        await request(`/hr/staff-roles/${id}`, { method: 'DELETE' });
        showToast('Role deleted successfully');
        loadDeptRoles();
      }
      setDeleteConfirm({ id: null, type: null });
    } catch (err) {
      showToast(err.message || 'Failed to delete record', 'error');
      setDeleteConfirm({ id: null, type: null });
    }
  };

  // ── FILTER DEPARTMENTS ───────────────────────────────
  const filteredDepartments = departments.filter((dept) => {
    const matchesSearch = dept.name.toLowerCase().includes(searchTerm.toLowerCase());

    const isActive = dept.is_active === 1 || dept.is_active === true;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && isActive) ||
      (statusFilter === 'inactive' && !isActive);

    return matchesSearch && matchesStatus;
  });

  const selectedDept = departments.find(d => d.id === selectedDeptId);

  return (
    <div className="dept-roles-master-page p-6 space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className={`toast-alert ${toast.type === 'error' ? 'error-toast' : 'success-toast'}`}>
          {toast.type === 'error' ? <XCircle size={16} /> : <CheckCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        breadcrumbs={[
          { label: 'Staff Management', path: '#' },
          { label: 'Departments & Roles' }
        ]}
        title="Department & Role Management"
        actions={
          <Button variant="primary" onClick={handleOpenWizard} className="flex items-center gap-2">
            <Plus size={16} /> Add Department
          </Button>
        }
      />

      {/* Two Column Layout: Master-Detail */}
      <div className="dept-roles-layout-grid">
        {/* Left Column: Department List */}
        <div className="dept-list-panel flex flex-col h-[calc(100vh-190px)] min-h-[500px]">
          <Card className="p-4 flex flex-col h-full shadow-sm">
            <div className="mb-4">
              <h3 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider text-[var(--mute)]">Departments</h3>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--mute)]" />
                <input
                  type="text"
                  placeholder="Search departments..."
                  className="field pl-9 pr-4 py-1.5 w-full text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between mt-3 text-[11px] text-[var(--mute)]">
                <span>Status:</span>
                <div className="flex gap-2">
                  <button className={`px-2 py-0.5 rounded ${statusFilter === 'all' ? 'bg-slate-200 text-slate-800 font-semibold' : ''}`} onClick={() => setStatusFilter('all')}>All</button>
                  <button className={`px-2 py-0.5 rounded ${statusFilter === 'active' ? 'bg-emerald-100 text-emerald-800 font-semibold' : ''}`} onClick={() => setStatusFilter('active')}>Active</button>
                  <button className={`px-2 py-0.5 rounded ${statusFilter === 'inactive' ? 'bg-rose-100 text-rose-800 font-semibold' : ''}`} onClick={() => setStatusFilter('inactive')}>Inactive</button>
                </div>
              </div>
            </div>

            {/* List Scroll */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredDepartments.map((dept) => {
                const isActive = dept.is_active === 1 || dept.is_active === true;
                return (
                  <div
                    key={dept.id}
                    className={`dept-list-item cursor-pointer p-3 rounded-lg border transition-all ${
                      selectedDeptId === dept.id
                        ? 'border-blue-500 bg-blue-50/30 shadow-sm font-semibold'
                        : 'border-slate-100 hover:bg-slate-50/50'
                    }`}
                    onClick={() => setSelectedDeptId(dept.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="text-[13px] text-slate-800">{dept.name}</div>
                      <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredDepartments.length === 0 && (
                <div className="text-center text-slate-400 py-10 text-xs">No departments found.</div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Detailed Department Configurations */}
        <div className="dept-detail-panel h-[calc(100vh-190px)] min-h-[500px] flex flex-col">
          {selectedDept ? (
            <Card className="p-6 flex flex-col h-full overflow-hidden shadow-sm">
              {/* Dept Header */}
              <div className="flex justify-between items-center border-b pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-800">{selectedDept.name}</h2>
                    <span className={`badge ${selectedDept.is_active === 1 || selectedDept.is_active === true ? 'badge-success' : 'badge-danger'}`}>
                      {selectedDept.is_active === 1 || selectedDept.is_active === true ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <Users size={11} /> {deptRoles.length} role(s) configured
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEditDept(selectedDept)} className="text-xs py-1">
                    <Edit2 size={12} className="mr-1" /> Rename
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleteConfirm({ id: selectedDept.id, type: 'dept' })} className="text-xs py-1 text-rose-600 hover:bg-rose-50 border-rose-200">
                    <Trash2 size={12} className="mr-1" /> Delete
                  </Button>
                </div>
              </div>

              {/* Roles Panel */}
              <div className="flex-grow flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield size={14} className="text-slate-500" /> Staff Roles & Configurations
                  </h3>
                  <Button variant="primary" size="sm" onClick={handleOpenAddRole} className="text-xs py-1 flex items-center gap-1">
                    <Plus size={12} /> Add Role
                  </Button>
                </div>

                <div className="flex-1 overflow-auto">
                  {deptRoles.length === 0 ? (
                    <div className="dept-empty-state">
                      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                        <Shield size={24} />
                      </div>
                      <h4 className="text-sm font-bold text-slate-600 mb-1">No Roles Configured</h4>
                      <p className="text-xs text-slate-400 max-w-[280px]">
                        Add staff roles with salary structure, shift timings, and biometric rules for this department.
                      </p>
                      <Button variant="outline" size="sm" onClick={handleOpenAddRole} className="mt-4 text-xs">
                        <Plus size={12} className="mr-1" /> Add First Role
                      </Button>
                    </div>
                  ) : (
                    <div className="role-cards-grid">
                      {deptRoles.map((role) => (
                        <RoleCard
                          key={role.id}
                          role={role}
                          onEdit={handleOpenEditRole}
                          onDelete={(id) => setDeleteConfirm({ id, type: 'role' })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="flex-1 flex flex-col items-center justify-center text-center p-8 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-4 border border-dashed">
                <FolderOpen size={28} />
              </div>
              <h3 className="text-sm font-bold text-slate-700">No Department Selected</h3>
              <p className="text-xs text-slate-400 mt-2 max-w-[320px]">
                Choose a department from the left list to configure its roles, salaries, and shift timing settings.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* ── WIZARD MODAL (CREATE DEPT + ROLES) ──────────────── */}
      {deptWizardOpen && (
        <div className="modal-overlay">
          <div className="modal-box w-full max-w-2xl">
            <div className="modal-header">
              <h3 className="modal-title font-bold text-slate-800 flex items-center gap-1.5">
                <FolderOpen className="text-blue-500" size={18} />
                Create Department Wizard
              </h3>
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider ml-2">
                Step {wizardStep} of 2
              </span>
              <button className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 ml-auto" onClick={() => setDeptWizardOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {wizardStep === 1 ? (
              <div className="modal-body space-y-4 py-4">
                <div className="bg-blue-50/50 p-3 rounded-lg text-xs text-slate-600">
                  Step 1: Set up the department name. You can save it immediately or go to Step 2 to configure roles and shift timing guidelines.
                </div>
                <div>
                  <label className="field-label font-bold text-slate-700 mb-1 block">Department Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cardiology"
                    className="field w-full"
                    value={wizardDeptForm.name}
                    onChange={(e) => setWizardDeptForm({ ...wizardDeptForm, name: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="wiz_active"
                    checked={wizardDeptForm.is_active}
                    onChange={(e) => setWizardDeptForm({ ...wizardDeptForm, is_active: e.target.checked })}
                  />
                  <label htmlFor="wiz_active" className="text-xs text-slate-700 font-medium cursor-pointer">Mark department as Active</label>
                </div>

                <div className="modal-footer flex justify-between gap-3 pt-4 border-t mt-4">
                  <Button variant="outline" type="button" onClick={() => setDeptWizardOpen(false)}>Cancel</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" type="button" onClick={handleSaveOnlyDepartment} disabled={loading}>
                      Save Department
                    </Button>
                    <Button
                      variant="primary"
                      type="button"
                      onClick={() => {
                        if (!wizardDeptForm.name.trim()) {
                          showToast('Department name is required', 'error');
                          return;
                        }
                        setWizardStep(2);
                      }}
                      className="flex items-center gap-1"
                    >
                      Next: Add Roles <ArrowRight size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="modal-body space-y-4 py-4 max-h-[75vh] overflow-y-auto">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-600 flex justify-between items-center">
                  <span>Step 2: Add staff roles, salaries, and biometric shift timing rules for <strong>{wizardDeptForm.name}</strong>.</span>
                  <span className="font-bold text-slate-800">{wizardRolesList.length} role(s) configured</span>
                </div>

                {/* Reusable Role Form */}
                <RoleFormFields form={wizardRoleForm} setForm={setWizardRoleForm} compact={true} />

                <div className="flex justify-end pt-2">
                  <Button variant="outline" type="button" onClick={handleAddRoleToWizardList} className="text-xs py-1 px-4">
                    + Add Role Configuration to List
                  </Button>
                </div>

                {/* List of configured roles */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold text-slate-700 uppercase">Roles to be created:</h4>
                  {wizardRolesList.length === 0 ? (
                    <div className="text-center py-4 border border-dashed rounded text-xs text-slate-400 bg-slate-50/20">
                      No roles added yet. Enter details above to configure and add roles.
                    </div>
                  ) : (
                    <div className="border rounded divide-y max-h-40 overflow-y-auto">
                      {wizardRolesList.map((r, idx) => (
                        <div key={r.id} className="p-2 flex justify-between items-center text-xs bg-white">
                          <div>
                            <span className="font-bold text-slate-700">{idx + 1}. {r.name}</span>
                            <span className="text-slate-400 ml-2">
                              (₹{r.basic_salary} · {r.shift_name}{r.is_night_shift ? ' · 🌙 Night' : ''})
                            </span>
                          </div>
                          <button className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded" onClick={() => handleRemoveRoleFromWizardList(r.id)}>
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="modal-footer flex justify-between gap-3 pt-4 border-t mt-4">
                  <Button variant="outline" type="button" onClick={() => setWizardStep(1)} className="flex items-center gap-1">
                    <ArrowLeft size={14} /> Back
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" type="button" onClick={() => setDeptWizardOpen(false)}>Cancel</Button>
                    <Button variant="primary" type="button" onClick={handleFinishWizard} disabled={loading}>
                      {loading ? 'Saving...' : 'Save & Finish'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EDIT DEPARTMENT MODAL ───────────────────────── */}
      {editDeptOpen && (
        <div className="modal-overlay">
          <div className="modal-box w-full max-w-md">
            <div className="modal-header">
              <h3 className="modal-title font-bold text-slate-800">Rename Department</h3>
              <button className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400" onClick={() => setEditDeptOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveDept}>
              <div className="modal-body space-y-4 py-4">
                <div>
                  <label className="field-label font-semibold text-slate-700 mb-1 block">Department Name *</label>
                  <input
                    type="text"
                    required
                    className="field w-full"
                    value={editDeptForm.name}
                    onChange={(e) => setEditDeptForm({ ...editDeptForm, name: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_dept_active"
                    checked={editDeptForm.is_active}
                    onChange={(e) => setEditDeptForm({ ...editDeptForm, is_active: e.target.checked })}
                  />
                  <label htmlFor="edit_dept_active" className="text-xs text-slate-700 font-medium cursor-pointer">Mark as Active</label>
                </div>
              </div>
              <div className="modal-footer flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" type="button" onClick={() => setEditDeptOpen(false)}>Cancel</Button>
                <Button variant="primary" type="submit">Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ROLE ADD/EDIT MODAL (STANDALONE) ─────────────── */}
      {roleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-box w-full max-w-xl max-h-[85vh] overflow-y-auto">
            <div className="modal-header">
              <h3 className="modal-title font-bold text-slate-800 flex items-center gap-1.5">
                <Shield className="text-blue-500" size={18} />
                {editingRole ? `Configure Role: ${editingRole.name}` : 'Add Staff Role'}
              </h3>
              <button className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 ml-auto" onClick={() => setRoleModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveRole}>
              <div className="modal-body py-4">
                <RoleFormFields form={roleForm} setForm={setRoleForm} />
              </div>
              <div className="modal-footer flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" type="button" onClick={() => setRoleModalOpen(false)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Role'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ────────────────────── */}
      {deleteConfirm.id && (
        <div className="modal-overlay">
          <div className="modal-box w-full max-w-sm text-center p-6">
            <div className="flex justify-center mb-4 text-rose-500 bg-rose-50 w-12 h-12 rounded-full items-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-2">
              Delete {deleteConfirm.type === 'dept' ? 'Department' : 'Staff Role'}?
            </h4>
            <p className="text-[13px] text-slate-500 mb-6">
              Are you sure you want to delete this {deleteConfirm.type === 'dept' ? 'department' : 'role'}? This action is permanent and cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" onClick={() => setDeleteConfirm({ id: null, type: null })}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteConfirm} disabled={loading}>
                {loading ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
