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

  // Debounce the search box so typing doesn't fire a request per keystroke.
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
      if (search) params.set('search', search);
      if (deptFilter) params.set('departmentId', deptFilter);
      if (statusFilter) params.set('status', statusFilter);

      const { data, meta: m } = await apiFetch(`/hr/employees?${params.toString()}`, { withMeta: true });
      setEmployees(Array.isArray(data) ? data : []);
      setMeta(m || { total: 0, page, limit: PAGE_SIZE, pages: 0 });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load employees.');
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, deptFilter, statusFilter]);

  const fetchDepartments = useCallback(async () => {
    try {
      const data = await apiFetch('/hr/departments');
      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load departments.');
    }
  }, []);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // Keep a selection alive as the list changes; default to the first row.
  useEffect(() => {
    if (!employees.length) { setSelectedId(null); setDetail(null); return; }
    if (!employees.some((e) => e.id === selectedId)) setSelectedId(employees[0].id);
  }, [employees, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      try {
        const emp = await apiFetch(`/hr/employees/${selectedId}`);
        if (!cancelled) { setDetail(emp); setIsEditing(false); }
      } catch (err) {
        if (!cancelled) setErrorMsg(err.message || 'Failed to load employee.');
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  const startEditing = () => {
    if (!detail) return;
    setForm({
      employee_code: detail.employee_code || '',
      full_name: detail.full_name || '',
      department_id: detail.department_id ?? '',
      designation_id: detail.designation_id ?? '',
      reporting_person_id: detail.reporting_person_id ?? '',
      gender: detail.gender || '',
      dob: isoDate(detail.date_of_birth),
      phone: detail.phone || '',
      address: detail.address || '',
      date_of_joining: isoDate(detail.date_of_joining),
      date_of_leaving: isoDate(detail.date_of_leaving),
      status: detail.status || 'active',
      basic_salary: detail.basic_salary ?? '',
      bank_account_no: detail.bank_account_no || '',
      bank_ifsc: detail.bank_ifsc || '',
      bank_name: detail.bank_name || '',
      uan_number: detail.uan_number || '',
      pf_enrolled: !!detail.pf_enrolled,
      esi_number: detail.esi_number || '',
      esi_enrolled: !!detail.esi_enrolled,
      qualification: detail.qualification || '',
      experience_description: detail.experience_description || '',
    });
    setIsEditing(true);
  };

  const setField = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!detail) return;
    try {
      setIsSaving(true);
      setErrorMsg('');
      const payload = { ...form };
      // Blank dates must be null, not '' — MySQL rejects '' for a DATE column.
      ['dob', 'date_of_joining', 'date_of_leaving'].forEach((k) => {
        if (!payload[k]) payload[k] = null;
      });
      if (payload.basic_salary === '') payload.basic_salary = 0;
      if (payload.reporting_person_id === '') payload.reporting_person_id = null;

      await apiFetch(`/hr/employees/${detail.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      const fresh = await apiFetch(`/hr/employees/${detail.id}`);
      setDetail(fresh);
      setIsEditing(false);
      flash(`${fresh.full_name} updated.`);
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
      // Surface on the form screen the user is still looking at.
      setErrorMsg(err.message || 'Failed to add employee.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeCount = employees.filter((e) => e.status === 'active').length;
  const totalPages = meta.pages || 1;

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
            {meta.total} employee{meta.total === 1 ? '' : 's'} on record.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name or code..."
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-xs w-60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors placeholder-gray-400"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={() => setViewMode('add')}
            disabled={departments.length === 0}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <span>+</span> Add Employee
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Department</span>
          <select
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          >
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</span>
          {[
            { value: '', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                statusFilter === opt.value ? 'bg-[#1e40af] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="sm:ml-auto text-[11px] text-gray-500 font-medium">
          Showing {employees.length} of {meta.total} · {activeCount} active on this page
        </div>
      </div>

      {/* Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* List */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Employees</h2>
            <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {meta.total} total
            </span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
          ) : employees.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">
              No employees match these filters.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
              {employees.map((emp) => {
                const isSelected = selectedId === emp.id;
                return (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedId(emp.id)}
                    className={`w-full p-3.5 text-left flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-gray-50/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 truncate">{emp.full_name}</div>
                        <div className="text-[11px] text-gray-400 truncate">
                          {emp.employee_code} · {emp.department_name || '—'} · {emp.designation_name || '—'}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                        emp.status === 'active'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                          : 'bg-rose-50 text-rose-600 border border-rose-200/60'
                      }`}
                    >
                      {emp.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          <div className="p-3 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-[11px] font-semibold text-gray-500">
              Page {meta.page || page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>

        {/* Detail */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
          {!detail ? (
            <div className="py-16 text-center text-xs text-gray-400">
              Select an employee to view their profile.
            </div>
          ) : isEditing ? (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <h2 className="text-base font-bold text-gray-900">
                  Editing — <span className="text-blue-600">{detail.full_name}</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Employee Code" value={form.employee_code} onChange={setField('employee_code')}
                  hint="Must match the biometric device"
                />
                <Input label="Full Name" value={form.full_name} onChange={setField('full_name')} />
                <Input
                  label="Status" value={form.status} onChange={setField('status')}
                  options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
                />

                <Input
                  label="Department" value={form.department_id} onChange={setField('department_id')}
                  options={[{ value: '', label: '—' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
                />
                <Input
                  label="Role" value={form.designation_id} onChange={setField('designation_id')}
                  options={[
                    { value: '', label: '—' },
                    ...((departments.find((d) => String(d.id) === String(form.department_id))?.roles) || [])
                      .map((r) => ({ value: r.id, label: r.roleName })),
                  ]}
                />
                <Input
                  label="Gender" value={form.gender} onChange={setField('gender')}
                  options={[
                    { value: '', label: '—' },
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                  ]}
                />

                <Input label="Date of Birth" type="date" value={form.dob} onChange={setField('dob')} />
                <Input label="Date of Joining" type="date" value={form.date_of_joining} onChange={setField('date_of_joining')} />
                <Input label="Date of Leaving" type="date" value={form.date_of_leaving} onChange={setField('date_of_leaving')} />

                <Input label="Phone" value={form.phone} onChange={setField('phone')} />
                <Input label="Monthly Salary (₹)" type="number" value={form.basic_salary} onChange={setField('basic_salary')} />
                <Input label="Qualification" value={form.qualification} onChange={setField('qualification')} />

                <Input label="Bank Account No" value={form.bank_account_no} onChange={setField('bank_account_no')} />
                <Input label="Bank IFSC" value={form.bank_ifsc} onChange={setField('bank_ifsc')} />
                <Input label="Bank Name" value={form.bank_name} onChange={setField('bank_name')} />

                <Input label="UAN (PF)" value={form.uan_number} onChange={setField('uan_number')} hint="Leave blank if enrolment is pending" />
                <Input label="ESI Number" value={form.esi_number} onChange={setField('esi_number')} hint="Leave blank if enrolment is pending" />
                <div className="space-y-2 pt-5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={!!form.pf_enrolled} onChange={(e) => setField('pf_enrolled')(e.target.checked)} />
                    PF enrolled
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={!!form.esi_enrolled} onChange={(e) => setField('esi_enrolled')(e.target.checked)} />
                    ESI enrolled
                  </label>
                </div>

                <div className="md:col-span-3">
                  <Input label="Address" value={form.address} onChange={setField('address')} />
                </div>

                <div className="md:col-span-3 space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Experience</label>
                  <textarea
                    rows="3"
                    value={form.experience_description ?? ''}
                    onChange={(e) => setField('experience_description')(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                <h2 className="text-base font-bold text-gray-900">
                  Employee Profile — <span className="text-blue-600">{detail.full_name}</span>
                </h2>
                <button
                  onClick={startEditing}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Edit Profile
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col items-center justify-center p-6 bg-gray-50/50 rounded-xl border border-gray-100 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mb-3 text-xl font-extrabold">
                    {(detail.full_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="text-[11px] font-bold text-gray-700">{detail.employee_code}</div>
                  <span className={`mt-2 text-xs font-semibold px-3 py-0.5 rounded-full ${
                    detail.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  }`}>
                    {detail.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="md:col-span-2 grid grid-cols-2 gap-y-4 gap-x-6">
                  <Field label="Department" value={detail.department_name} />
                  <Field label="Role" value={detail.designation_name} />
                  <Field label="Phone" value={detail.phone} />
                  <Field label="Joining Date" value={displayDate(detail.date_of_joining)} />
                  <Field label="Monthly Salary" value={money(detail.basic_salary)} />
                  <Field label="Qualification" value={detail.qualification} />
                  <Field label="Bank Account" value={detail.bank_account_no} />
                  <Field label="IFSC" value={detail.bank_ifsc} />
                  <Field label="UAN (PF)" value={detail.uan_number || 'Pending enrolment'} />
                  <Field label="ESI Number" value={detail.esi_number || 'Pending enrolment'} />
                  <Field label="Casual Leave / yr" value={detail.casual_leave_count ?? '—'} />
                  <Field label="Privilege Leave / yr" value={detail.privilege_leave_count ?? '—'} />
                </div>
              </div>

              {detail.experience_description && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Experience</div>
                  <p className="text-xs text-gray-700 leading-relaxed">{detail.experience_description}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
