import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import { isoDate } from '../../util/mappers';
import AddMemberForm from './departmentrole/AddMemberForm';

const PAGE_SIZE = 25;

const displayDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const money = (value) =>
  value === null || value === undefined || value === '' || Number(value) === 0
    ? '—'
    : `₹${Number(value).toLocaleString('en-IN')}`;

/** Read-only key/value cell used across the profile panel. */
function Field({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="text-xs font-bold text-gray-800 mt-1 break-words">{value || '—'}</div>
    </div>
  );
}

/** Editable text/date/select input matching the app's form styling. */
function Input({ label, value, onChange, type = 'text', options, disabled, hint }) {
  const cls =
    'w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-900 bg-white ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors ' +
    'disabled:bg-gray-50 disabled:text-gray-400';
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</label>
      {options ? (
        <select className={cls} value={value ?? ''} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          className={cls}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

export default function HREmployees() {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'add'

  const [employees, setEmployees] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 0 });
  const [departments, setDepartments] = useState([]);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [rightTab, setRightTab] = useState('profile'); // 'profile' | 'modify-salary' | 'salary-logs' | 'remap-logs'

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({});

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchEmployees = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.append('search', search);
      if (deptFilter) params.append('departmentId', deptFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await apiFetch(`/hr/employees?${params.toString()}`, { withMeta: true });
      const rows = res.data || [];
      setEmployees(rows);
      setMeta(res.meta || { total: rows.length, page, limit: PAGE_SIZE, pages: 1 });

      if (rows.length && !selectedId) {
        setSelectedId(rows[0].id);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load employees.');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, deptFilter, statusFilter, selectedId]);

  useEffect(() => {
    (async () => {
      try {
        const d = await apiFetch('/hr/departments');
        setDepartments(Array.isArray(d) ? d : []);
      } catch {
        /* non-critical */
      }
    })();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Load employee detail panel when selectedId changes
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    (async () => {
      try {
        const data = await apiFetch(`/hr/employees/${selectedId}`);
        setDetail(data);
        setIsEditing(false);
      } catch {
        /* ignore */
      }
    })();
  }, [selectedId]);

  const startEditing = () => {
    if (!detail) return;
    setForm({
      employee_code: detail.employee_code || '',
      full_name: detail.full_name || '',
      phone: detail.phone || '',
      address: detail.address || '',
      date_of_birth: isoDate(detail.date_of_birth),
      date_of_joining: isoDate(detail.date_of_joining),
      gender: detail.gender || 'male',
      qualification: detail.qualification || '',
      experience_description: detail.experience_description || '',
      bank_account_no: detail.bank_account_no || '',
      bank_ifsc: detail.bank_ifsc || '',
      bank_name: detail.bank_name || '',
      uan_number: detail.uan_number || '',
      pf_enrolled: !!detail.pf_enrolled,
      esi_number: detail.esi_number || '',
      esi_enrolled: !!detail.esi_enrolled,
      status: detail.status || 'active',
      department_id: detail.department_id || '',
      designation_id: detail.designation_id || '',
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      setIsSaving(true);
      setErrorMsg('');
      await apiFetch(`/hr/employees/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      const fresh = await apiFetch(`/hr/employees/${selectedId}`);
      setDetail(fresh);
      setIsEditing(false);
      flash(`${fresh.full_name} updated successfully.`);
      await fetchEmployees();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save employee.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async (memberData, targetDept) => {
    if (!targetDept) { setErrorMsg('Select a department first.'); return; }
    try {
      setIsSaving(true);
      setErrorMsg('');

      const matchingRole = (targetDept.roles || []).find(
        (r) => (typeof r === 'object' ? r.roleName : r) === memberData.position
      );
      if (!matchingRole || typeof matchingRole !== 'object') {
        throw new Error(`The role "${memberData.position}" was not found in ${targetDept.name}.`);
      }

      const created = await apiFetch('/hr/employees', {
        method: 'POST',
        body: JSON.stringify({
          employee_code: memberData.employeeCode.trim(),
          full_name: memberData.name,
          date_of_joining: memberData.dateOfJoining,
          department_id: targetDept.id,
          designation_id: matchingRole.id,
          qualification: memberData.qualification,
          experience_description: memberData.experienceDescription,
          basic_salary: Number(matchingRole.basicSalary) || 0,
        }),
      });

      setViewMode('list');
      setPage(1);
      setSelectedId(created.id);
      flash(`${memberData.name} added to ${targetDept.name}.`);
      await fetchEmployees();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to add employee.');
    } finally {
      setIsSaving(false);
    }
  };

  if (viewMode === 'add') {
    return (
      <div className="space-y-4">
        {errorMsg && (
          <div className="bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl">
            {errorMsg}
          </div>
        )}
        <AddMemberForm
          departments={departments}
          initialDepartment={null}
          onBack={() => { setErrorMsg(''); setViewMode('list'); }}
          onSubmit={handleAddMember}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-4 py-3 rounded-xl shadow-sm">
          <svg className="w-4 h-4 flex-shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-3 bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl shadow-sm">
          <svg className="w-4 h-4 flex-shrink-0 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {errorMsg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">
            Staff &amp; Salary &nbsp;&gt;&nbsp; <span className="text-blue-600 font-semibold">HR &amp; Employees</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {meta.total} employee{meta.total === 1 ? '' : 's'} on record. Select an employee to view details or modify salary.
          </p>
        </div>

        <button
          onClick={() => setViewMode('add')}
          disabled={departments.length === 0}
          className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <span>+</span> Add Employee
        </button>
      </div>

      {/* Split View Layout: Left Employee List, Right Employee Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT PANE: Employee Selector List */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden flex flex-col min-h-[550px]">
          {/* Left Search & Filter Bar */}
          <div className="p-3 border-b border-gray-100 space-y-2 bg-gray-50/50">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search name or code..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
              <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex gap-2">
              <select
                value={deptFilter}
                onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
                className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-[11px] font-medium text-gray-700 bg-white"
              >
                <option value="">All Depts</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-2 py-1 border border-gray-200 rounded-lg text-[11px] font-medium text-gray-700 bg-white"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Employee List Items */}
          <div className="flex-1 divide-y divide-gray-100 overflow-y-auto max-h-[550px]">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-gray-400">Loading employees...</div>
            ) : employees.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">No employees found.</div>
            ) : (
              employees.map((emp) => {
                const isSelected = emp.id === selectedId;
                return (
                  <div
                    key={emp.id}
                    onClick={() => { setSelectedId(emp.id); setRightTab('profile'); }}
                    className={`p-3 text-xs cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50/80 border-l-4 border-blue-600 font-semibold text-gray-900'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-900">{emp.full_name}</span>
                        <span className="text-[10px] font-bold text-blue-600">({emp.employee_code})</span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {emp.department_name || 'No Dept'} · {emp.designation_name || 'No Role'}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      emp.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {emp.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {meta.pages > 1 && (
            <div className="p-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 bg-gray-50/50">
              <span>{page} / {meta.pages}</span>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40 cursor-pointer"
                >
                  Prev
                </button>
                <button
                  disabled={page >= meta.pages}
                  onClick={() => setPage((p) => Math.min(p + 1, meta.pages))}
                  className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANE: Selected Employee Workspace */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 space-y-5 min-h-[550px]">
          {!detail ? (
            <div className="text-center text-xs text-gray-400 py-20">
              👈 Select an employee from the left panel to view profile, modify salary, or inspect history logs.
            </div>
          ) : (
            <>
              {/* Selected Employee Header & Right Pane Tab Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900">{detail.full_name}</h2>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {detail.employee_code}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      detail.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {detail.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {detail.department_name || 'No Dept'} &nbsp;·&nbsp; {detail.designation_name || 'No Role'}
                  </p>
                </div>

                {/* Right Pane Tab Buttons */}
                <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-lg self-start sm:self-auto">
                  <button
                    onClick={() => setRightTab('profile')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      rightTab === 'profile' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    👤 Profile
                  </button>
                  <button
                    onClick={() => setRightTab('modify-salary')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      rightTab === 'modify-salary' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    💰 Modify Salary
                  </button>
                  <button
                    onClick={() => setRightTab('salary-logs')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      rightTab === 'salary-logs' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📜 Salary Logs
                  </button>
                  <button
                    onClick={() => setRightTab('remap-logs')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      rightTab === 'remap-logs' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🔄 Role Logs
                  </button>
                </div>
              </div>

              {/* Right Pane Active Tab Section */}
              {rightTab === 'profile' ? (
                isEditing ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900">Edit Profile — {detail.full_name}</h3>
                      <button onClick={() => setIsEditing(false)} className="text-xs font-semibold text-gray-500 cursor-pointer">Cancel</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[420px] overflow-y-auto pr-1">
                      <Input label="Employee Code" value={form.employee_code} onChange={(v) => setForm((f) => ({ ...f, employee_code: v }))} />
                      <Input label="Full Name" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
                      <Input label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
                      <Input label="Qualification" value={form.qualification} onChange={(v) => setForm((f) => ({ ...f, qualification: v }))} />
                      <Input label="Bank Account" value={form.bank_account_no} onChange={(v) => setForm((f) => ({ ...f, bank_account_no: v }))} />
                      <Input label="IFSC Code" value={form.bank_ifsc} onChange={(v) => setForm((f) => ({ ...f, bank_ifsc: v }))} />
                      <Input label="UAN (PF)" value={form.uan_number} onChange={(v) => setForm((f) => ({ ...f, uan_number: v }))} />
                      <Input label="ESI Number" value={form.esi_number} onChange={(v) => setForm((f) => ({ ...f, esi_number: v }))} />
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                      <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-xs text-gray-600 rounded-lg cursor-pointer">Cancel</button>
                      <button onClick={handleSaveEdit} disabled={isSaving} className="px-4 py-1.5 text-xs bg-blue-600 text-white font-semibold rounded-lg cursor-pointer">
                        {isSaving ? 'Saving...' : 'Save Profile Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={startEditing}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        ✏️ Edit Profile
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="flex flex-col items-center justify-center p-6 bg-gray-50/50 rounded-xl border border-gray-100 text-center">
                        <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mb-3 text-xl font-extrabold">
                          {(detail.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="text-xs font-bold text-gray-900">{detail.full_name}</div>
                        <div className="text-[11px] font-bold text-blue-600 mt-0.5">{detail.employee_code}</div>
                        <div className="text-[11px] text-gray-500 mt-2">Joining Date: {displayDate(detail.date_of_joining)}</div>
                      </div>

                      <div className="md:col-span-2 grid grid-cols-2 gap-y-4 gap-x-6">
                        <Field label="Department" value={detail.department_name} />
                        <Field label="Role / Position" value={detail.designation_name} />
                        <Field label="Phone" value={detail.phone} />
                        <Field label="Gender" value={detail.gender} />
                        <Field label="Monthly Basic Salary" value={money(detail.basic_salary)} />
                        <Field label="Salary Type" value={detail.salary_type || 'monthly'} />
                        <Field label="Per Day Rate" value={money(detail.per_day_salary)} />
                        <Field label="Per Night Rate" value={money(detail.per_night_salary)} />
                        <Field label="Qualification" value={detail.qualification} />
                        <Field label="Bank Account" value={detail.bank_account_no} />
                        <Field label="IFSC Code" value={detail.bank_ifsc} />
                        <Field label="UAN (PF)" value={detail.uan_number || 'Pending'} />
                        <Field label="ESI Number" value={detail.esi_number || 'Pending'} />
                      </div>
                    </div>

                    {detail.experience_description && (
                      <div className="pt-4 border-t border-gray-100">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Experience Summary</div>
                        <p className="text-xs text-gray-700 leading-relaxed">{detail.experience_description}</p>
                      </div>
                    )}
                  </div>
                )
              ) : rightTab === 'modify-salary' ? (
                <ModifySalarySection
                  employee={detail}
                  onSaved={async (msg) => {
                    flash(msg);
                    const fresh = await apiFetch(`/hr/employees/${detail.id}`);
                    setDetail(fresh);
                    setRightTab('salary-logs');
                  }}
                />
              ) : rightTab === 'salary-logs' ? (
                <EmployeeSalaryLogsSection employeeId={detail.id} />
              ) : (
                <EmployeeRemappingLogsSection employeeId={detail.id} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   RIGHT PANE TAB COMPONENTS
═══════════════════════════════════════════════════════════════════════ */

function ModifySalarySection({ employee, onSaved }) {
  const [salaryType, setSalaryType] = useState(employee.salary_type || 'monthly');
  const [basicSalary, setBasicSalary] = useState(employee.basic_salary ?? '0');
  const [perDaySalary, setPerDaySalary] = useState(employee.per_day_salary ?? '0');
  const [perNightSalary, setPerNightSalary] = useState(employee.per_night_salary ?? '0');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setSalaryType(employee.salary_type || 'monthly');
    setBasicSalary(employee.basic_salary ?? '0');
    setPerDaySalary(employee.per_day_salary ?? '0');
    setPerNightSalary(employee.per_night_salary ?? '0');
  }, [employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!effectiveFrom) { setErrorMsg('Please specify Effective From date.'); return; }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await apiFetch(`/hr/employees/${employee.id}/salary`, {
        method: 'PATCH',
        body: JSON.stringify({
          salary_type: salaryType,
          basic_salary: Number(basicSalary) || 0,
          per_day_salary: Number(perDaySalary) || 0,
          per_night_salary: Number(perNightSalary) || 0,
          effective_from: effectiveFrom,
          reason: reason.trim() || null,
        }),
      });
      onSaved(`Salary modified for ${employee.full_name} (${employee.employee_code}).`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update salary.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-xl text-xs flex justify-between items-center">
        <div>
          <div className="font-bold text-blue-900">Current Salary Parameters</div>
          <div className="text-blue-700 mt-0.5">
            Basic: ₹{Number(employee.basic_salary || 0).toLocaleString('en-IN')} / month ({employee.salary_type || 'monthly'})
          </div>
        </div>
        <span className="text-[11px] font-semibold text-blue-600 bg-white px-2.5 py-1 rounded-lg border border-blue-200">
          Per Day: ₹{Number(employee.per_day_salary || 0)} · Per Night: ₹{Number(employee.per_night_salary || 0)}
        </span>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-2.5 rounded-lg">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">Salary Calculation Type *</label>
            <select
              value={salaryType}
              onChange={(e) => setSalaryType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
              required
            >
              <option value="monthly">Monthly Fixed Salary</option>
              <option value="per_day">Per Day / Daily Wage</option>
              <option value="hourly">Hourly Rate</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">New Monthly Basic Salary (₹) *</label>
            <input
              type="number" min="0" step="100"
              value={basicSalary}
              onChange={(e) => setBasicSalary(e.target.value)}
              placeholder="e.g. 25000"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">Per Day Rate (₹)</label>
            <input
              type="number" min="0" step="10"
              value={perDaySalary}
              onChange={(e) => setPerDaySalary(e.target.value)}
              placeholder="e.g. 800"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">Per Night Shift Extra Rate (₹)</label>
            <input
              type="number" min="0" step="10"
              value={perNightSalary}
              onChange={(e) => setPerNightSalary(e.target.value)}
              placeholder="e.g. 200"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">Effective From Date *</label>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">Reason / Notes for Revision</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Annual Increment, Performance Bonus"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
            />
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-gray-100">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Updating Salary...' : 'Update Salary & Save Audit Log'}
          </button>
        </div>
      </form>
    </div>
  );
}

function EmployeeSalaryLogsSection({ employeeId }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!employeeId) return;
    (async () => {
      try {
        setIsLoading(true);
        const data = await apiFetch(`/hr/employees/salary-logs?employeeId=${employeeId}&limit=50`);
        setLogs(Array.isArray(data) ? data : []);
      } catch {
        setLogs([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [employeeId]);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Salary Revision Audit History</h3>
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3">Previous Salary</th>
              <th className="p-3">New Salary</th>
              <th className="p-3">Effective Date</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Changed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">Loading history...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">No salary change logs for this employee.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/80">
                  <td className="p-3 text-gray-600">
                    <div className="font-semibold">₹{Number(log.previous_basic_salary).toLocaleString('en-IN')}</div>
                    <div className="text-[10px] text-gray-400">{log.previous_salary_type || 'monthly'}</div>
                  </td>
                  <td className="p-3 font-bold text-emerald-700">
                    <div>₹{Number(log.new_basic_salary).toLocaleString('en-IN')}</div>
                    <div className="text-[10px] text-blue-600 font-normal">{log.new_salary_type}</div>
                  </td>
                  <td className="p-3 font-semibold text-gray-900">
                    {log.effective_from ? new Date(log.effective_from).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="p-3 text-gray-600">{log.reason || '—'}</td>
                  <td className="p-3 text-gray-600">{log.changed_by_name || 'System'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmployeeRemappingLogsSection({ employeeId }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!employeeId) return;
    (async () => {
      try {
        setIsLoading(true);
        const data = await apiFetch(`/hr/employees/remapping-logs?employeeId=${employeeId}&limit=50`);
        setLogs(Array.isArray(data) ? data : []);
      } catch {
        setLogs([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [employeeId]);

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Department &amp; Role Remapping History</h3>
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3">From Dept / Role</th>
              <th className="p-3">To Dept / Role</th>
              <th className="p-3">Effective From</th>
              <th className="p-3">End Date</th>
              <th className="p-3">Remapped By</th>
              <th className="p-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Loading history...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">No role remapping logs for this employee.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/80">
                  <td className="p-3 text-gray-600">
                    <div>{log.from_department_name || '—'}</div>
                    <div className="text-[10px] text-gray-400">{log.from_role_name || '—'}</div>
                  </td>
                  <td className="p-3 font-bold text-gray-900">
                    <div>{log.to_department_name}</div>
                    <div className="text-[10px] text-blue-700 font-semibold">{log.to_role_name}</div>
                  </td>
                  <td className="p-3 font-semibold text-emerald-700">
                    {log.from_date ? new Date(log.from_date).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="p-3 text-gray-500">
                    {log.to_date ? new Date(log.to_date).toLocaleDateString('en-IN') : <span className="text-emerald-600 font-bold">Active</span>}
                  </td>
                  <td className="p-3 text-gray-600">{log.remapped_by_name || 'System'}</td>
                  <td className="p-3 text-gray-500">{log.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
