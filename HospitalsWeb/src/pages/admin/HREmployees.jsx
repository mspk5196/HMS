import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import { isoDate } from '../../util/mappers';
import PageHeader from '../../components/PageHeader';
import AddMemberForm from './departmentrole/AddMemberForm';
import BulkEmployeeImportModal, { downloadEmployeeExcelTemplate } from './BulkEmployeeImportModal';
import ConfigureShiftTimingModal from './shiftroster/ConfigureShiftTimingModal';
import {
  GearIcon,
  DownloadIcon,
  UploadIcon,
  PlusIcon,
  UserIcon,
  ClockIcon,
  CurrencyRupeeIcon,
  ClipboardListIcon,
  SyncIcon,
  SunIcon,
  MoonIcon,
  CalendarIcon,
  LockIcon,
  EditIcon,
  DocumentTextIcon,
  LandmarkIcon,
  ReceiptIcon,
} from '../../components/Icons';

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
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [shiftConfigs, setShiftConfigs] = useState({
    day: { start: '09:00', end: '17:00' },
    night: { start: '20:00', end: '08:00' },
  });
  const [showShiftTimingModal, setShowShiftTimingModal] = useState(false);

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

      if (rows.length) {
        setSelectedId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0].id));
      } else {
        setSelectedId(null);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load employees.');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, deptFilter, statusFilter]);

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

  const fetchShiftConfigs = useCallback(async () => {
    try {
      const data = await apiFetch('/hr/shifts');
      if (Array.isArray(data)) {
        const d = data.find((s) => !s.is_night_shift);
        const n = data.find((s) => s.is_night_shift);
        setShiftConfigs({
          day: {
            start: d?.start_time ? String(d.start_time).slice(0, 5) : '09:00',
            end: d?.end_time ? String(d.end_time).slice(0, 5) : '17:00',
          },
          night: {
            start: n?.start_time ? String(n.start_time).slice(0, 5) : '20:00',
            end: n?.end_time ? String(n.end_time).slice(0, 5) : '08:00',
          },
        });
      }
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    fetchShiftConfigs();
  }, [fetchShiftConfigs]);

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
      payment_mode: detail.payment_mode || 'account',
      uan_number: detail.uan_number || '',
      pf_enrolled: !!detail.pf_enrolled,
      esi_number: detail.esi_number || '',
      esi_enrolled: !!detail.esi_enrolled,
      status: detail.status || 'active',
      department_id: detail.department_id || '',
      designation_id: detail.designation_id || '',
      // Documents & shift fields (v9)
      aadhar_number: detail.aadhar_number || '',
      pan_number: detail.pan_number || '',
      shift_category: detail.shift_category || 'day',
      custom_shift_start: detail.shift_category === 'day'
        ? shiftConfigs.day.start
        : (detail.shift_category === 'night'
          ? shiftConfigs.night.start
          : (detail.custom_shift_start ? String(detail.custom_shift_start).slice(0, 5) : '09:00')),
      custom_shift_end: detail.shift_category === 'day'
        ? shiftConfigs.day.end
        : (detail.shift_category === 'night'
          ? shiftConfigs.night.end
          : (detail.custom_shift_end ? String(detail.custom_shift_end).slice(0, 5) : '17:00')),
      custom_buffer_minutes: detail.custom_buffer_minutes ?? 10,
      aadhar_doc: null,
      pan_doc: null,
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      setIsSaving(true);
      setErrorMsg('');

      const dataToSend = { ...form };
      if (dataToSend.shift_category === 'day') {
        dataToSend.custom_shift_start = shiftConfigs.day.start;
        dataToSend.custom_shift_end = shiftConfigs.day.end;
        dataToSend.custom_buffer_minutes = null;
      } else if (dataToSend.shift_category === 'night') {
        dataToSend.custom_shift_start = shiftConfigs.night.start;
        dataToSend.custom_shift_end = shiftConfigs.night.end;
        dataToSend.custom_buffer_minutes = null;
      } else if (dataToSend.shift_category === 'day_and_night') {
        dataToSend.custom_shift_start = null;
        dataToSend.custom_shift_end = null;
        dataToSend.custom_buffer_minutes = null;
      } else if (dataToSend.shift_category === 'general') {
        dataToSend.custom_buffer_minutes = dataToSend.custom_buffer_minutes !== '' && dataToSend.custom_buffer_minutes !== undefined
          ? Number(dataToSend.custom_buffer_minutes) : 10;
      }

      const fd = new FormData();
      Object.entries(dataToSend).forEach(([k, v]) => {
        if (k === 'aadhar_doc') {
          if (v instanceof File) fd.append('aadhar_doc', v);
        } else if (k === 'pan_doc') {
          if (v instanceof File) fd.append('pan_doc', v);
        } else if (v !== undefined && v !== null) {
          fd.append(k, v);
        } else if (v === null) {
          fd.append(k, '');
        }
      });

      await apiFetch(`/hr/employees/${selectedId}`, {
        method: 'PATCH',
        body: fd,
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

      const fd = new FormData();
      fd.append('employee_code', memberData.employeeCode.trim());
      fd.append('full_name', memberData.name);
      fd.append('date_of_joining', memberData.dateOfJoining);
      fd.append('department_id', targetDept.id);
      fd.append('designation_id', matchingRole.id);
      fd.append('qualification', memberData.qualification || '');
      fd.append('experience_description', memberData.experienceDescription || '');
      fd.append('salary_type', 'monthly');
      fd.append('basic_salary', Number(memberData.basicSalary) || Number(matchingRole.basicSalary) || 0);
      fd.append('per_day_salary', Number(memberData.perDaySalary) || 0);
      fd.append('per_night_salary', Number(memberData.perNightSalary) || 0);

      if (memberData.bankAccountNo) fd.append('bank_account_no', memberData.bankAccountNo);
      if (memberData.bankIfsc) fd.append('bank_ifsc', memberData.bankIfsc);
      if (memberData.bankName) fd.append('bank_name', memberData.bankName);
      fd.append('payment_mode', memberData.payment_mode || memberData.paymentMode || 'account');

      if (memberData.aadharNumber) fd.append('aadhar_number', memberData.aadharNumber);
      if (memberData.panNumber) fd.append('pan_number', memberData.panNumber);
      if (memberData.aadharDoc instanceof File) fd.append('aadhar_doc', memberData.aadharDoc);
      if (memberData.panDoc instanceof File) fd.append('pan_doc', memberData.panDoc);

      if (memberData.shiftCategory) fd.append('shift_category', memberData.shiftCategory);
      if (memberData.shiftCategory === 'day') {
        fd.append('custom_shift_start', shiftConfigs.day.start);
        fd.append('custom_shift_end', shiftConfigs.day.end);
      } else if (memberData.shiftCategory === 'night') {
        fd.append('custom_shift_start', shiftConfigs.night.start);
        fd.append('custom_shift_end', shiftConfigs.night.end);
      } else if (memberData.shiftCategory === 'general') {
        if (memberData.customShiftStart) fd.append('custom_shift_start', memberData.customShiftStart);
        if (memberData.customShiftEnd) fd.append('custom_shift_end', memberData.customShiftEnd);
        if (memberData.customBufferMinutes !== undefined && memberData.customBufferMinutes !== null) {
          fd.append('custom_buffer_minutes', memberData.customBufferMinutes);
        }
      }

      const created = await apiFetch('/hr/employees', {
        method: 'POST',
        body: fd,
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

      <PageHeader
        category="Staff & Salary"
        title="HR & Employees"
        subtitle={`${meta.total} employee${meta.total === 1 ? '' : 's'} on record. Select an employee to view details or modify salary.`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowShiftTimingModal(true)}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-semibold px-3 py-2 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Configure hospital-wide Day and Night shift timings"
            >
              <GearIcon className="w-4 h-4 text-gray-500" />
              <span>Shift Timings</span>
            </button>

            <button
              type="button"
              onClick={() => downloadEmployeeExcelTemplate(departments)}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 text-xs font-semibold px-3 py-2 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download blank Excel spreadsheet template"
            >
              <DownloadIcon className="w-4 h-4 text-gray-500" />
              <span>Excel Template</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <UploadIcon className="w-4 h-4 text-white" />
              <span>Bulk Upload Staff</span>
            </button>

            <button
              onClick={() => setViewMode('add')}
              disabled={departments.length === 0}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <PlusIcon className="w-4 h-4 text-white" />
              <span>Add Employee</span>
            </button>
          </>
        }
      />

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
                placeholder="Search name, code, phone, role, dept..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
              <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
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
                      <div className="flex items-center gap-1.5 mt-1">
                        {Boolean(emp.pf_enrolled) && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200" title="Enrolled in Employee Provident Fund (12%)">
                            EPF
                          </span>
                        )}
                        {Boolean(emp.esi_enrolled) && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200" title="Enrolled in Employee State Insurance (0.75% / 3.25%)">
                            ESI
                          </span>
                        )}
                        {(emp.payment_mode || 'account') === 'cash' ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200" title="Cash Disbursement">
                            Cash
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200" title="Bank Account Transfer">
                            Bank
                          </span>
                        )}
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
            <div className="flex flex-col items-center justify-center text-center text-xs text-gray-400 py-20 gap-2">
              <UserIcon className="w-8 h-8 text-gray-300" />
              <span>Select an employee from the left panel to view profile, modify salary, or inspect history logs.</span>
            </div>
          ) : (
            <>
              {/* Selected Employee Identity & Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-lg font-extrabold shadow-xs shrink-0">
                    {(detail.full_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-gray-900 tracking-tight">{detail.full_name}</h2>
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-mono">
                        #{detail.employee_code}
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        detail.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {detail.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        (detail.payment_mode || 'account') === 'cash'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {(detail.payment_mode || 'account') === 'cash' ? (
                          <CurrencyRupeeIcon className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <LandmarkIcon className="w-3.5 h-3.5 text-blue-600" />
                        )}
                        {(detail.payment_mode || 'account') === 'cash' ? 'Cash Payment' : 'Bank Transfer'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-700">{detail.department_name || 'No Dept'}</span>
                      <span className="text-gray-300">•</span>
                      <span>{detail.designation_name || 'No Role'}</span>
                      {detail.date_of_joining && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-gray-400">Joined {displayDate(detail.date_of_joining)}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {rightTab === 'profile' && !isEditing && (
                    <button
                      onClick={startEditing}
                      className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <EditIcon className="w-3.5 h-3.5" />
                      <span>Edit Profile</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Dedicated Full-Width Tab Strip */}
              <div className="bg-gray-100/70 p-1 rounded-xl border border-gray-200/80">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
                  {[
                    { id: 'profile', label: 'Profile', icon: UserIcon },
                    { id: 'monthly-payouts', label: 'Monthly Payouts', icon: ReceiptIcon },
                    { id: 'shift-overrides', label: 'Shift Overrides', icon: ClockIcon },
                    { id: 'modify-salary', label: 'Modify Salary', icon: CurrencyRupeeIcon },
                    { id: 'salary-logs', label: 'Salary Logs', icon: ClipboardListIcon },
                    { id: 'remap-logs', label: 'Role Logs', icon: SyncIcon },
                    { id: 'audit-logs', label: 'Audit Logs', icon: ClipboardListIcon },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = rightTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setRightTab(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                          isActive
                            ? 'bg-[#1e40af] text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[440px] overflow-y-auto pr-1">
                      <Input label="Employee Code" value={form.employee_code} onChange={(v) => setForm((f) => ({ ...f, employee_code: v }))} />
                      <Input label="Full Name" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
                      <Input label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
                      <Input label="Qualification" value={form.qualification} onChange={(v) => setForm((f) => ({ ...f, qualification: v }))} />

                      {/* Payment Mode */}
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Salary Payment Mode</label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold ${
                            (form.payment_mode || 'account') === 'account' ? 'border-blue-600 bg-blue-50/50 text-blue-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}>
                            <input
                              type="radio"
                              name="edit_payment_mode"
                              value="account"
                              checked={(form.payment_mode || 'account') === 'account'}
                              onChange={() => setForm((f) => ({ ...f, payment_mode: 'account' }))}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <LandmarkIcon className="w-4 h-4 text-blue-600" />
                            <span>Bank Transfer</span>
                          </label>
                          <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold ${
                            form.payment_mode === 'cash' ? 'border-amber-600 bg-amber-50/50 text-amber-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}>
                            <input
                              type="radio"
                              name="edit_payment_mode"
                              value="cash"
                              checked={form.payment_mode === 'cash'}
                              onChange={() => setForm((f) => ({ ...f, payment_mode: 'cash' }))}
                              className="text-amber-600 focus:ring-amber-500"
                            />
                            <CurrencyRupeeIcon className="w-4 h-4 text-amber-600" />
                            <span>Cash Payment</span>
                          </label>
                        </div>
                      </div>

                      <Input label="Bank Account No" value={form.bank_account_no} onChange={(v) => setForm((f) => ({ ...f, bank_account_no: v }))} />
                      <Input label="IFSC Code" value={form.bank_ifsc} onChange={(v) => setForm((f) => ({ ...f, bank_ifsc: v }))} />
                      <Input label="Bank Branch Name" value={form.bank_name} onChange={(v) => setForm((f) => ({ ...f, bank_name: v }))} />

                      {/* Shift Category & Timing Section */}
                      <div className="sm:col-span-2 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                            Shift Category &amp; Working Hours
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowShiftTimingModal(true)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:text-blue-800 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            <GearIcon className="w-3.5 h-3.5 text-blue-600" />
                            <span>Configure Shift Timings</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1 sm:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Shift Category</label>
                            <select
                              value={form.shift_category || 'day'}
                              onChange={(e) => {
                                const cat = e.target.value;
                                setForm((f) => ({
                                  ...f,
                                  shift_category: cat,
                                  custom_shift_start: cat === 'day' ? shiftConfigs.day.start : (cat === 'night' ? shiftConfigs.night.start : (f.custom_shift_start || '09:00')),
                                  custom_shift_end: cat === 'day' ? shiftConfigs.day.end : (cat === 'night' ? shiftConfigs.night.end : (f.custom_shift_end || '17:00')),
                                }));
                              }}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white"
                            >
                              <option value="day">Day Shift (Fixed Time: {shiftConfigs.day.start} – {shiftConfigs.day.end})</option>
                              <option value="night">Night Shift (Fixed Time: {shiftConfigs.night.start} – {shiftConfigs.night.end})</option>
                              <option value="day_and_night">Day &amp; Night Shift (Scheduled via Weekly Duty Roster)</option>
                              <option value="general">General Shift (Individual Custom Timing)</option>
                            </select>
                          </div>

                          {/* Fixed Day Shift: Non-editable */}
                          {form.shift_category === 'day' && (
                            <div className="sm:col-span-2 p-3 bg-amber-50/70 rounded-lg border border-amber-200 flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <SunIcon className="w-4 h-4 text-amber-600 shrink-0" />
                                  <span className="text-xs font-bold text-amber-900">Fixed Day Shift Timing:</span>
                                  <span className="text-xs font-extrabold text-amber-900">{shiftConfigs.day.start} – {shiftConfigs.day.end}</span>
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-amber-200/80 text-amber-800 rounded">Fixed (Non-editable)</span>
                                </div>
                                <p className="text-[11px] text-amber-700 mt-0.5">
                                  Day shift hours are fixed for this employee. Use "Configure Shift Timings" above to modify global hours.
                                </p>
                              </div>
                              <LockIcon className="w-5 h-5 text-amber-500 shrink-0" />
                            </div>
                          )}

                          {/* Fixed Night Shift: Non-editable */}
                          {form.shift_category === 'night' && (
                            <div className="sm:col-span-2 p-3 bg-purple-50/70 rounded-lg border border-purple-200 flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <MoonIcon className="w-4 h-4 text-purple-600 shrink-0" />
                                  <span className="text-xs font-bold text-purple-900">Fixed Night Shift Timing:</span>
                                  <span className="text-xs font-extrabold text-purple-900">{shiftConfigs.night.start} – {shiftConfigs.night.end}</span>
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-purple-200/80 text-purple-800 rounded">Fixed (Non-editable)</span>
                                </div>
                                <p className="text-[11px] text-purple-700 mt-0.5">
                                  Night shift hours are fixed for this employee. Use "Configure Shift Timings" above to modify global hours.
                                </p>
                              </div>
                              <LockIcon className="w-5 h-5 text-purple-500 shrink-0" />
                            </div>
                          )}

                          {/* Day & Night Shift: Managed via Duty Roster (No shift timing asked) */}
                          {form.shift_category === 'day_and_night' && (
                            <div className="sm:col-span-2 p-3 bg-blue-50/70 rounded-lg border border-blue-200 flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
                                  <span className="text-xs font-bold text-blue-900">Weekly Duty Roster Scheduled</span>
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-blue-200/80 text-blue-800 rounded">Roster Assigned</span>
                                </div>
                                <p className="text-[11px] text-blue-700 mt-0.5">
                                  Day &amp; Night staff working hours and shift duties are scheduled each week on the <strong>Weekly Duty Roster</strong>.
                                </p>
                              </div>
                              <CalendarIcon className="w-5 h-5 text-blue-500 shrink-0" />
                            </div>
                          )}

                          {/* General Shift: Editable Individual Custom Timing */}
                          {form.shift_category === 'general' && (
                            <>
                              <Input
                                type="time"
                                label="Shift Start Time"
                                value={form.custom_shift_start}
                                onChange={(v) => setForm((f) => ({ ...f, custom_shift_start: v }))}
                              />
                              <Input
                                type="time"
                                label="Shift End Time"
                                value={form.custom_shift_end}
                                onChange={(v) => setForm((f) => ({ ...f, custom_shift_end: v }))}
                              />
                              <div className="sm:col-span-2">
                                <Input
                                  type="number"
                                  label="Buffer Mins (Grace Period)"
                                  value={form.custom_buffer_minutes ?? 10}
                                  onChange={(v) => setForm((f) => ({ ...f, custom_buffer_minutes: v }))}
                                  min="0"
                                  max="60"
                                  hint="Allowed arrival grace period in minutes before lateness applies"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Identity & Verification Documents */}
                      <div className="sm:col-span-2 bg-gray-50/80 p-3.5 rounded-xl border border-gray-200 space-y-3">
                        <div className="text-[11px] font-bold text-gray-800 uppercase tracking-wider">
                          Identity Documents (Aadhar &amp; PAN)
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Input
                              label="Aadhar Number"
                              value={form.aadhar_number}
                              onChange={(v) => setForm((f) => ({ ...f, aadhar_number: v }))}
                              hint="12-digit Aadhar Card Number"
                            />
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase">Upload Aadhar (PDF/Image)</label>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => setForm((f) => ({ ...f, aadhar_doc: e.target.files?.[0] || null }))}
                                className="w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-blue-700"
                              />
                              {detail.aadhar_doc_path && !form.aadhar_doc && (
                                <p className="text-[10px] text-emerald-600">Current file uploaded on record</p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Input
                              label="PAN Number"
                              value={form.pan_number}
                              onChange={(v) => setForm((f) => ({ ...f, pan_number: v.toUpperCase() }))}
                              hint="10-character PAN (e.g. ABCDE1234F)"
                            />
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase">Upload PAN (PDF/Image)</label>
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => setForm((f) => ({ ...f, pan_doc: e.target.files?.[0] || null }))}
                                className="w-full text-xs text-gray-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-blue-700"
                              />
                              {detail.pan_doc_path && !form.pan_doc && (
                                <p className="text-[10px] text-emerald-600">Current file uploaded on record</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Statutory EPF & ESI Configuration Card */}
                      <div className="sm:col-span-2 bg-gray-50/80 p-3.5 rounded-xl border border-gray-200/80 space-y-3 mt-1">
                        <div className="text-[11px] font-bold text-gray-800 uppercase tracking-wider">
                          EPF &amp; ESI Statutory Compliance
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2 p-3 bg-white rounded-lg border border-gray-100 shadow-xs">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(form.pf_enrolled)}
                                onChange={(e) => setForm((f) => ({ ...f, pf_enrolled: e.target.checked }))}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                              />
                              <span>Enable EPF Deduction (12%)</span>
                            </label>
                            <Input
                              label="UAN (Universal Account Number)"
                              value={form.uan_number}
                              onChange={(v) => setForm((f) => ({ ...f, uan_number: v }))}
                              disabled={!form.pf_enrolled}
                              hint="12-digit UAN"
                            />
                          </div>

                          <div className="space-y-2 p-3 bg-white rounded-lg border border-gray-100 shadow-xs">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(form.esi_enrolled)}
                                onChange={(e) => setForm((f) => ({ ...f, esi_enrolled: e.target.checked }))}
                                className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                              />
                              <span>Enable ESI Deduction (0.75% / 3.25%)</span>
                            </label>
                            <Input
                              label="ESI IP Number"
                              value={form.esi_number}
                              onChange={(v) => setForm((f) => ({ ...f, esi_number: v }))}
                              disabled={!form.esi_enrolled}
                              hint="10 or 17-digit Insurance Number"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                      <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-xs text-gray-600 rounded-lg cursor-pointer">Cancel</button>
                      <button onClick={handleSaveEdit} disabled={isSaving} className="px-4 py-1.5 text-xs bg-blue-600 text-white font-semibold rounded-lg cursor-pointer">
                        {isSaving ? 'Saving...' : 'Save Profile Changes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Section 1: Employment & Compensation Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Personal & Work Info */}
                      <div className="p-4 rounded-xl border border-gray-200/80 bg-white shadow-2xs space-y-3">
                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2">
                          Employment &amp; Contact Details
                        </div>
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                          <Field label="Department" value={detail.department_name} />
                          <Field label="Role / Position" value={detail.designation_name} />
                          <Field label="Phone" value={detail.phone} />
                          <Field label="Gender" value={detail.gender} />
                          <Field label="Qualification" value={detail.qualification} />
                          <Field label="Joining Date" value={displayDate(detail.date_of_joining)} />
                        </div>
                      </div>

                      {/* Salary & Payment Mode */}
                      <div className="p-4 rounded-xl border border-gray-200/80 bg-white shadow-2xs space-y-3">
                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center justify-between">
                          <span>Salary &amp; Disbursement</span>
                          <span className="text-[10px] text-gray-400 font-normal">Monthly Base</span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                          {detail.shift_category === 'day_and_night' ? (
                            <>
                              <Field label="Per Day Shift Rate" value={money(detail.per_day_salary)} />
                              <Field label="Per Night Shift Rate" value={money(detail.per_night_salary)} />
                              <Field label="Monthly Base (30 days)" value={money(detail.basic_salary)} />
                            </>
                          ) : (
                            <>
                              <Field label="Monthly Salary" value={money(detail.basic_salary)} />
                              <Field label="Per Day Rate (÷ 30)" value={money(detail.per_day_salary || Math.round(((Number(detail.basic_salary) || 0) / 30) * 100) / 100)} />
                            </>
                          )}
                          <Field
                            label="Salary Payment Mode"
                            value={
                              (detail.payment_mode || 'account') === 'cash' ? (
                                <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  <CurrencyRupeeIcon className="w-3.5 h-3.5 text-amber-600" /> Cash Payment
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  <LandmarkIcon className="w-3.5 h-3.5 text-blue-600" /> Bank Transfer
                                </span>
                              )
                            }
                          />
                          <Field
                            label="Bank Account"
                            value={detail.bank_account_no || ((detail.payment_mode || 'account') === 'cash' ? 'Cash Payment (No Bank A/c)' : '—')}
                          />
                          <Field label="IFSC Code" value={detail.bank_ifsc} />
                          <Field label="Branch Name" value={detail.bank_name} />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Shift Schedule & Working Hours */}
                    <div className="p-4 rounded-xl border border-gray-200/80 bg-white shadow-2xs space-y-3">
                      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-2">
                        Shift Schedule &amp; Working Hours
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Field
                          label="Shift Category"
                          value={
                            detail.shift_category === 'day' ? 'Day Shift (Fixed)' :
                            detail.shift_category === 'night' ? 'Night Shift (Fixed)' :
                            detail.shift_category === 'day_and_night' ? 'Day & Night Shift (Roster)' :
                            detail.shift_category === 'general' ? 'General Shift (Custom)' : '—'
                          }
                        />
                        <Field
                          label="Working Hours"
                          value={
                            detail.shift_category === 'day'
                              ? `${shiftConfigs.day.start} – ${shiftConfigs.day.end} (Fixed Day Shift)`
                              : (detail.shift_category === 'night'
                                ? `${shiftConfigs.night.start} – ${shiftConfigs.night.end} (Fixed Night Shift)`
                                : (detail.shift_category === 'day_and_night'
                                  ? 'Scheduled via Weekly Duty Roster'
                                  : (detail.custom_shift_start && detail.custom_shift_end
                                    ? `${String(detail.custom_shift_start).slice(0, 5)} – ${String(detail.custom_shift_end).slice(0, 5)}`
                                    : '—')))
                          }
                        />
                        <Field
                          label="Grace Buffer"
                          value={`${detail.custom_buffer_minutes ?? 10} minutes`}
                        />
                      </div>
                    </div>

                    {/* Identity Documents Cards (Aadhar & PAN) */}
                    <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-3.5 rounded-xl border border-gray-200/80 bg-gray-50/50 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Aadhar Card</span>
                          {detail.aadhar_doc_path ? (
                            <a
                              href={detail.aadhar_doc_path}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 flex items-center gap-1 cursor-pointer"
                            >
                              <DocumentTextIcon className="w-3.5 h-3.5 text-blue-600" />
                              <span>View Document</span>
                            </a>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200">
                              No Doc Uploaded
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs font-bold text-gray-800">
                          Number: <span className="text-gray-600 font-medium">{detail.aadhar_number || '—'}</span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-gray-200/80 bg-gray-50/50 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PAN Card</span>
                          {detail.pan_doc_path ? (
                            <a
                              href={detail.pan_doc_path}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 flex items-center gap-1 cursor-pointer"
                            >
                              <DocumentTextIcon className="w-3.5 h-3.5 text-blue-600" />
                              <span>View Document</span>
                            </a>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200">
                              No Doc Uploaded
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs font-bold text-gray-800">
                          Number: <span className="text-gray-600 font-medium uppercase">{detail.pan_number || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Statutory Compliance Summary Cards */}
                    <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-3.5 rounded-xl border border-gray-200/80 bg-gray-50/50 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Employee Provident Fund (EPF)</span>
                          {detail.pf_enrolled ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Enrolled (12%)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                              Not Applicable / Excluded
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs font-bold text-gray-800">
                          UAN: <span className="text-gray-600 font-medium">{detail.uan_number || '—'}</span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-gray-200/80 bg-gray-50/50 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Employee State Insurance (ESI)</span>
                          {detail.esi_enrolled ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                              Enrolled (0.75% / 3.25%)
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                              Out of Cover / Excluded
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-xs font-bold text-gray-800">
                          ESI IP: <span className="text-gray-600 font-medium">{detail.esi_number || '—'}</span>
                        </div>
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
              ) : rightTab === 'shift-overrides' ? (
                <ShiftOverridesSection
                  employeeId={detail.id}
                  employeeName={detail.full_name}
                  onSuccess={flash}
                  onError={(err) => setErrorMsg(err?.message || 'Shift override error')}
                />
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
              ) : rightTab === 'monthly-payouts' ? (
                <EmployeePayoutLogsSection employeeId={detail.id} />
              ) : rightTab === 'audit-logs' ? (
                <EmployeeAuditLogsSection employeeId={detail.id} />
              ) : (
                <EmployeeRemappingLogsSection employeeId={detail.id} />
              )}
            </>
          )}
        </div>
      </div>

      <BulkEmployeeImportModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        departments={departments}
        onSuccess={(msg) => {
          flash(msg);
          fetchEmployees();
        }}
      />

      <ConfigureShiftTimingModal
        isOpen={showShiftTimingModal}
        onClose={() => setShowShiftTimingModal(false)}
        onSuccess={() => {
          fetchShiftConfigs();
          fetchEmployees();
          if (selectedId) {
            apiFetch(`/hr/employees/${selectedId}`).then((fresh) => setDetail(fresh)).catch(() => {});
          }
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   RIGHT PANE TAB COMPONENTS
═══════════════════════════════════════════════════════════════════════ */

function ModifySalarySection({ employee, onSaved }) {
  const isDayNight = employee.shift_category === 'day_and_night';

  const [basicSalary, setBasicSalary] = useState(employee.basic_salary ?? '0');
  const [perDaySalary, setPerDaySalary] = useState(employee.per_day_salary ?? '0');
  const [perNightSalary, setPerNightSalary] = useState(employee.per_night_salary ?? '0');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setBasicSalary(employee.basic_salary ?? '0');
    setPerDaySalary(employee.per_day_salary ?? '0');
    setPerNightSalary(employee.per_night_salary ?? '0');
  }, [employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!effectiveFrom) { setErrorMsg('Please specify Effective From date.'); return; }

    const finalBasicSalary = isDayNight
      ? Math.round((Number(perDaySalary) || 0) * 30 * 100) / 100
      : (Number(basicSalary) || 0);
    const finalPerDaySalary = isDayNight
      ? (Number(perDaySalary) || 0)
      : Math.round(((Number(basicSalary) || 0) / 30) * 100) / 100;
    const finalPerNightSalary = isDayNight
      ? (Number(perNightSalary) || 0)
      : 0;

    if (isDayNight) {
      if (finalPerDaySalary <= 0) { setErrorMsg('Per Day Shift Salary must be greater than 0.'); return; }
      if (finalPerNightSalary <= 0) { setErrorMsg('Per Night Shift Salary must be greater than 0.'); return; }
    } else {
      if (finalBasicSalary <= 0) { setErrorMsg('Monthly Basic Salary must be greater than 0.'); return; }
    }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await apiFetch(`/hr/employees/${employee.id}/salary`, {
        method: 'PATCH',
        body: JSON.stringify({
          salary_type: 'monthly',
          basic_salary: finalBasicSalary,
          per_day_salary: finalPerDaySalary,
          per_night_salary: finalPerNightSalary,
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
      <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-xl text-xs flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <div>
          <div className="font-bold text-blue-900">Current Salary Parameters (Monthly Basis)</div>
          <div className="text-blue-700 mt-0.5">
            Basic: ₹{Number(employee.basic_salary || 0).toLocaleString('en-IN')} / month
          </div>
        </div>
        <span className="text-[11px] font-semibold text-blue-600 bg-white px-2.5 py-1 rounded-lg border border-blue-200 self-start sm:self-auto">
          {isDayNight
            ? `Per Day: ₹${Number(employee.per_day_salary || 0)} · Per Night: ₹${Number(employee.per_night_salary || 0)}`
            : `Per Day (÷ 30): ₹${Number(employee.per_day_salary || Math.round(((Number(employee.basic_salary) || 0) / 30) * 100) / 100)}`}
        </span>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-2.5 rounded-lg">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isDayNight ? (
            <>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">Per Day Shift Salary (₹) *</label>
                <input
                  type="number" min="0" step="10"
                  value={perDaySalary}
                  onChange={(e) => setPerDaySalary(e.target.value)}
                  placeholder="e.g. 700"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">Per Night Shift Salary (₹) *</label>
                <input
                  type="number" min="0" step="10"
                  value={perNightSalary}
                  onChange={(e) => setPerNightSalary(e.target.value)}
                  placeholder="e.g. 900"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
                  required
                />
              </div>

              <div className="sm:col-span-2 p-3 bg-blue-50/60 rounded-xl border border-blue-200/80 flex items-center justify-between text-xs">
                <span className="text-blue-800 font-medium">
                  Auto-calculated Monthly Base (30 days × Per Day Rate):
                </span>
                <span className="font-bold text-blue-900 text-sm">
                  ₹{((Number(perDaySalary) || 0) * 30).toLocaleString('en-IN')}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">New Monthly Salary (₹) *</label>
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
                <label className="block text-xs font-semibold text-gray-700">Auto-calculated Per Day Salary (÷ 30)</label>
                <div className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-lg text-xs font-bold text-gray-800 bg-gray-50 flex items-center justify-between">
                  <span>₹{basicSalary && Number(basicSalary) > 0 ? (Number(basicSalary) / 30).toFixed(2) : '0.00'}</span>
                  <span className="text-[10px] font-normal text-gray-400">(÷ 30 days)</span>
                </div>
              </div>
            </>
          )}

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
              placeholder="e.g. Annual Increment, Promotion"
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
                    {Number(log.previous_per_day_salary) > 0 && (
                      <div className="text-[10px] text-gray-400">₹{Number(log.previous_per_day_salary)}/day</div>
                    )}
                  </td>
                  <td className="p-3 font-bold text-emerald-700">
                    <div>₹{Number(log.new_basic_salary).toLocaleString('en-IN')}</div>
                    {Number(log.new_per_day_salary) > 0 && (
                      <div className="text-[10px] text-blue-600 font-normal">₹{Number(log.new_per_day_salary)}/day</div>
                    )}
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

function ShiftOverridesSection({ employeeId, employeeName, onSuccess, onError }) {
  const [overrides, setOverrides] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    override_date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    end_time: '17:00',
    note: '',
  });

  const loadOverrides = useCallback(async () => {
    if (!employeeId) return;
    try {
      setIsLoading(true);
      const data = await apiFetch(`/hr/employees/${employeeId}/shift-overrides`);
      setOverrides(Array.isArray(data) ? data : []);
    } catch (err) {
      onError(err);
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, onError]);

  useEffect(() => {
    loadOverrides();
  }, [loadOverrides]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.override_date || !form.start_time || !form.end_time) {
      onError(new Error('Date, start time, and end time are required.'));
      return;
    }
    try {
      setIsSaving(true);
      await apiFetch(`/hr/employees/${employeeId}/shift-overrides`, {
        method: 'POST',
        body: JSON.stringify({
          override_date: form.override_date,
          start_time: form.start_time.length === 5 ? `${form.start_time}:00` : form.start_time,
          end_time: form.end_time.length === 5 ? `${form.end_time}:00` : form.end_time,
          note: form.note || null,
        }),
      });
      onSuccess(`Shift override saved for ${form.override_date}.`);
      setForm((prev) => ({ ...prev, note: '' }));
      await loadOverrides();
    } catch (err) {
      onError(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (date) => {
    const formatted = typeof date === 'string' ? date.slice(0, 10) : date;
    if (!window.confirm(`Remove shift override for ${formatted}?`)) return;
    try {
      setIsSaving(true);
      await apiFetch(`/hr/employees/${employeeId}/shift-overrides/${formatted}`, {
        method: 'DELETE',
      });
      onSuccess(`Shift override for ${formatted} removed.`);
      await loadOverrides();
    } catch (err) {
      onError(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 text-xs text-blue-800 space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <ClockIcon className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Single-Day Shift Overrides</span>
        </div>
        <p className="text-[11px] text-blue-700 leading-relaxed">
          Use shift overrides to change working hours for <strong>{employeeName}</strong> on specific calendar dates (for Day, Night, or General shift staff).
          Overrides take precedence over standard shifts when calculating biometric attendance and late punch-ins.
        </p>
      </div>

      {/* Add Override Form */}
      <form onSubmit={handleSubmit} className="p-4 bg-gray-50/60 border border-gray-200 rounded-xl space-y-3">
        <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Set Shift Override for a Date</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Override Date *</label>
            <input
              type="date"
              required
              value={form.override_date}
              onChange={(e) => setForm((f) => ({ ...f, override_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Start Time *</label>
            <input
              type="time"
              required
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">End Time *</label>
            <input
              type="time"
              required
              value={form.end_time}
              onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Note / Reason</label>
            <input
              type="text"
              placeholder="e.g. Special duty coverage"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium bg-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, start_time: '09:00', end_time: '17:00' }))}
              className="px-2 py-1 text-[10px] font-semibold bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded cursor-pointer"
            >
              Preset: Day (09:00–17:00)
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, start_time: '20:00', end_time: '08:00' }))}
              className="px-2 py-1 text-[10px] font-semibold bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded cursor-pointer"
            >
              Preset: Night (20:00–08:00)
            </button>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save Shift Override'}
          </button>
        </div>
      </form>

      {/* List of Existing Overrides */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3">Override Date</th>
              <th className="p-3">Work Hours Range</th>
              <th className="p-3">Note / Reason</th>
              <th className="p-3">Created On</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">Loading overrides...</td></tr>
            ) : overrides.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">No shift overrides configured for this employee.</td></tr>
            ) : (
              overrides.map((ov) => {
                const dateStr = String(ov.override_date).slice(0, 10);
                return (
                  <tr key={ov.id || dateStr} className="hover:bg-gray-50/80">
                    <td className="p-3 font-bold text-gray-900">
                      {new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-3 font-semibold text-blue-700">
                      <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {String(ov.start_time).slice(0, 5)} – {String(ov.end_time).slice(0, 5)}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600">{ov.note || '—'}</td>
                    <td className="p-3 text-gray-400 text-[11px]">
                      {ov.created_at ? new Date(ov.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(dateStr)}
                        disabled={isSaving}
                        className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmployeePayoutLogsSection({ employeeId }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  useEffect(() => {
    if (!employeeId) return;
    (async () => {
      try {
        setIsLoading(true);
        const res = await apiFetch(`/hr/employees/${employeeId}/payout-logs?limit=50`);
        setLogs(Array.isArray(res) ? res : (res?.data || []));
      } catch {
        setLogs([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [employeeId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Monthly Salary Payout History</h3>
          <p className="text-[11px] text-gray-400">Record of monthly salary payments, amounts, and payment method used</p>
        </div>
        <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
          {logs.length} Month{logs.length === 1 ? '' : 's'} Logged
        </span>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3">Period / Month</th>
              <th className="p-3">Payment Method</th>
              <th className="p-3">Net Payout</th>
              <th className="p-3">Earned Gross</th>
              <th className="p-3">Deductions</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Loading payout records...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">No monthly payroll records for this employee yet.</td></tr>
            ) : (
              logs.map((log) => {
                const monthLabel = `${MONTH_NAMES[(log.period_month || 1) - 1]} ${log.period_year}`;
                const isCash = (log.payment_mode || 'account').toLowerCase() === 'cash';
                const ttlDed = Number(log.pf_employee_amount || 0) + Number(log.esi_employee_amount || 0) + Number(log.fines_amount || 0);

                return (
                  <tr key={log.id} className="hover:bg-gray-50/80">
                    <td className="p-3">
                      <div className="font-bold text-gray-900">{monthLabel}</div>
                      <div className="text-[10px] text-gray-400">Run #{log.payroll_run_id}</div>
                    </td>
                    <td className="p-3">
                      {isCash ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <CurrencyRupeeIcon className="w-3.5 h-3.5 text-amber-600" />
                          <span>Cash Payment</span>
                        </div>
                      ) : (
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            <LandmarkIcon className="w-3.5 h-3.5 text-blue-600" />
                            <span>Bank Transfer</span>
                          </div>
                          {log.bank_account_no && (
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              A/c: {log.bank_account_no} {log.bank_name ? `(${log.bank_name})` : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-bold text-emerald-700 text-sm">
                      ₹{Number(log.net_pay || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 font-medium text-gray-800">
                      ₹{Number(log.gross_pay || 0).toLocaleString('en-IN')}
                      {Number(log.lop_amount || 0) > 0 && (
                        <div className="text-[10px] text-rose-500">LOP: -₹{Number(log.lop_amount).toLocaleString('en-IN')}</div>
                      )}
                    </td>
                    <td className="p-3 text-gray-600">
                      ₹{ttlDed.toLocaleString('en-IN')}
                      <div className="text-[10px] text-gray-400">
                        PF: ₹{Number(log.pf_employee_amount || 0)} | ESI: ₹{Number(log.esi_employee_amount || 0)}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                        log.run_status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                        log.run_status === 'locked' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {log.run_status || 'draft'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmployeeAuditLogsSection({ employeeId }) {
  const [logs, setLogs] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!employeeId) return;
    (async () => {
      try {
        setIsLoading(true);
        const query = filterType !== 'all' ? `&changeType=${filterType}` : '';
        const res = await apiFetch(`/hr/employees/${employeeId}/audit-logs?limit=100${query}`);
        setLogs(Array.isArray(res) ? res : (res?.data || []));
      } catch {
        setLogs([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [employeeId, filterType]);

  const getBadge = (type) => {
    switch (type) {
      case 'payment_mode':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Payment Mode</span>;
      case 'bank_details':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">Bank Details</span>;
      case 'status_change':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">Status Change</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">Profile Update</span>;
    }
  };

  const formatFieldName = (name) => {
    const map = {
      payment_mode: 'Payment Mode',
      bank_account_no: 'Bank Account No',
      bank_name: 'Bank Branch Name',
      bank_ifsc: 'Bank IFSC',
      full_name: 'Full Name',
      phone: 'Phone Number',
      address: 'Address',
      status: 'Employment Status',
      shift_category: 'Shift Category',
      custom_shift_start: 'Shift Start Time',
      custom_shift_end: 'Shift End Time',
      custom_buffer_minutes: 'Grace Buffer Mins',
      uan_number: 'PF UAN Number',
      esi_number: 'ESI Number',
      pf_enrolled: 'PF Enrolled',
      esi_enrolled: 'ESI Enrolled',
      qualification: 'Qualification',
      experience_description: 'Experience',
    };
    return map[name] || name;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Employee Profile &amp; Payment Audit Logs</h3>
          <p className="text-[11px] text-gray-400">Complete audit trail of profile modifications, payment modes, and banking changes</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-[11px] self-start sm:self-auto font-semibold">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterType === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilterType('payment_mode')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterType === 'payment_mode' ? 'bg-white text-amber-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Payment Mode
          </button>
          <button
            type="button"
            onClick={() => setFilterType('bank_details')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterType === 'bank_details' ? 'bg-white text-blue-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Bank
          </button>
          <button
            type="button"
            onClick={() => setFilterType('profile_update')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterType === 'profile_update' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Profile
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs text-gray-700">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3">Date &amp; Time</th>
              <th className="p-3">Category</th>
              <th className="p-3">Field Modified</th>
              <th className="p-3">Previous Value</th>
              <th className="p-3">New Value</th>
              <th className="p-3">Changed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">Loading audit history...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">No activity logged for this filter.</td></tr>
            ) : (
              logs.map((log) => {
                const dateStr = log.created_at
                  ? new Date(log.created_at).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', hour12: true
                    })
                  : '—';

                return (
                  <tr key={log.id} className="hover:bg-gray-50/80">
                    <td className="p-3 font-semibold text-gray-900 whitespace-nowrap">
                      {dateStr}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {getBadge(log.change_type)}
                    </td>
                    <td className="p-3 font-semibold text-gray-800">
                      {formatFieldName(log.field_name)}
                    </td>
                    <td className="p-3 text-rose-700 font-medium">
                      <span className="bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {log.old_value || <span className="italic text-gray-400">Empty</span>}
                      </span>
                    </td>
                    <td className="p-3 text-emerald-700 font-bold">
                      <span className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {log.new_value || <span className="italic text-gray-400">Empty</span>}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600 whitespace-nowrap">
                      {log.changed_by_name || 'System Admin'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

