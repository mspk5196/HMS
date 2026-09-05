import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import { mapEmployeeToMember } from '../../../util/mappers';
import PageHeader from '../../../components/PageHeader';
import AddDepartmentForm from './AddDepartmentForm';
import DepartmentMembersView from './DepartmentMembersView';
import {
  ClipboardListIcon,
  SyncIcon,
  EditIcon,
  TrashIcon,
  XIcon,
  PlusIcon,
} from '../../../components/Icons';

export default function DepartmentRole() {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'add-dept' | 'members-list' | 'remap-logs'
  const [selectedDept, setSelectedDept] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Remap Modal State
  const [showRemapModal, setShowRemapModal] = useState(false);

  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await apiFetch('/hr/departments');
      if (data && Array.isArray(data)) {
        setDepartments(data.map(d => ({
          ...d,
          roles: Array.isArray(d.roles)
            ? [...d.roles].sort((a, b) => Number(b.basicSalary || 0) - Number(a.basicSalary || 0))
            : d.roles,
          members: d.members || undefined
        })));
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load departments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Submit Handler for Add/Edit Department
  const handleDepartmentSubmit = async ({ deptName, roles }) => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      if (editingDept) {
        await apiFetch(`/hr/departments/${editingDept.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: deptName,
            roles: roles.map(r => ({ id: r.id, roleName: r.roleName, basicSalary: Number(r.basicSalary), weeklyOffCount: Number(r.weeklyOffCount || 4), isDoctor: !!r.isDoctor }))
          })
        });
        flash(`Department "${deptName}" updated successfully.`);
      } else {
        await apiFetch('/hr/departments', {
          method: 'POST',
          body: JSON.stringify({
            name: deptName,
            roles: roles.map(r => ({ roleName: r.roleName, basicSalary: Number(r.basicSalary), weeklyOffCount: Number(r.weeklyOffCount || 4), isDoctor: !!r.isDoctor }))
          })
        });
        flash(`Department "${deptName}" added successfully with ${roles.length} role(s).`);
      }

      await fetchDepartments();
      setEditingDept(null);
      setViewMode('list');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save department.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDepartment = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the department "${name}"?`)) {
      return;
    }
    try {
      setIsLoading(true);
      setErrorMsg('');
      await apiFetch(`/hr/departments/${id}`, { method: 'DELETE' });
      flash(`Department "${name}" deleted successfully.`);
      await fetchDepartments();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete department.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (dept) => {
    setEditingDept(dept);
    setViewMode('add-dept');
  };

  const handleOpenMembers = async (dept) => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const empData = await apiFetch(`/hr/employees?departmentId=${dept.id}&limit=200`);
      const members = (empData || []).map(mapEmployeeToMember);
      
      const updatedDept = {
        ...dept,
        members,
        staffCount: members.length
      };
      
      setDepartments(prev => prev.map(d => d.id === dept.id ? updatedDept : d));
      setSelectedDept(updatedDept);
      setViewMode('members-list');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load department members.');
    } finally {
      setIsLoading(false);
    }
  };

  // Render Views
  if (viewMode === 'add-dept') {
    return (
      <AddDepartmentForm
        onBack={() => { setEditingDept(null); setViewMode('list'); }}
        onSubmit={handleDepartmentSubmit}
        initialData={editingDept}
      />
    );
  }

  if (viewMode === 'members-list' && selectedDept) {
    const currentDept = departments.find(d => (d.id && d.id === selectedDept.id) || d.name === selectedDept.name) || selectedDept;
    return (
      <DepartmentMembersView
        department={currentDept}
        members={currentDept.members || []}
        onBack={() => setViewMode('list')}
      />
    );
  }

  if (viewMode === 'remap-logs') {
    return (
      <RemappingHistoryView
        onBack={() => setViewMode('list')}
      />
    );
  }

  // Main Department Cards List
  return (
    <div className="space-y-6">
      {/* Toast notifications */}
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
        title="Department & Role"
        subtitle="Manage hospital departments, staff roles, and employee department remappings."
        actions={
          <>
            <button
              onClick={() => setViewMode('remap-logs')}
              className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <ClipboardListIcon className="w-3.5 h-3.5 text-gray-600" />
              <span>Remapping Logs</span>
            </button>

            <button
              onClick={() => setShowRemapModal(true)}
              disabled={isLoading || departments.length === 0}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <SyncIcon className="w-3.5 h-3.5 text-white" />
              <span>Remap Employee</span>
            </button>

            <button
              onClick={() => { setEditingDept(null); setViewMode('add-dept'); }}
              disabled={isLoading}
              className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <PlusIcon className="w-3.5 h-3.5 text-white" />
              <span>Add Department</span>
            </button>
          </>
        }
      />

      {/* Department Cards Grid */}
      {departments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-12 text-center text-xs text-gray-500">
          No departments configured yet. Click "+ Add Department" to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => {
            const rolesCount = Array.isArray(dept.roles) ? dept.roles.length : (dept.rolesCount || 0);
            return (
              <div key={dept.id || dept.name} className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">{dept.name}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {dept.staffCount ?? 0} Staff Member{dept.staffCount === 1 ? '' : 's'} · {rolesCount} Role{rolesCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditClick(dept)}
                        title="Edit Department"
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                        title="Delete Department"
                        className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Roles Preview */}
                  {Array.isArray(dept.roles) && dept.roles.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-gray-100">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Roles &amp; Salaries</div>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {dept.roles.map((r, i) => (
                          <div key={r.id || i} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-gray-50 text-gray-700">
                            <span className="font-semibold text-gray-900 truncate max-w-[170px] flex items-center gap-1">
                              {typeof r === 'object' ? r.roleName : r}
                              {typeof r === 'object' && r.isDoctor && (
                                <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">Doctor</span>
                              )}
                            </span>
                            <span className="font-bold text-blue-700 text-[11px] whitespace-nowrap">
                              {typeof r === 'object' && r.basicSalary !== undefined ? `₹${Number(r.basicSalary).toLocaleString('en-IN')}` : ''}
                              {typeof r === 'object' && r.weeklyOffCount !== undefined ? ` · ${r.weeklyOffCount} W/O` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => handleOpenMembers(dept)}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                  >
                    View Members ({dept.staffCount ?? 0}) →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Remap Employee Modal */}
      {showRemapModal && (
        <RemapEmployeeModal
          departments={departments}
          onClose={() => setShowRemapModal(false)}
          onSuccess={(msg) => {
            setShowRemapModal(false);
            flash(msg);
            fetchDepartments();
          }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   REMAP EMPLOYEE MODAL
═══════════════════════════════════════════════════════════════════════ */
function RemapEmployeeModal({ departments, onClose, onSuccess }) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);

  const [toDeptId, setToDeptId] = useState('');
  const [roles, setRoles] = useState([]);
  const [toRoleId, setToRoleId] = useState('');
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Search employee by Name or Code
  useEffect(() => {
    const q = query.trim();
    if (!q) { setCandidates([]); return; }
    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const data = await apiFetch(`/hr/employees?search=${encodeURIComponent(q)}&limit=10`);
        setCandidates(Array.isArray(data) ? data : []);
      } catch {
        setCandidates([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Load staff roles when target department changes
  useEffect(() => {
    if (!toDeptId) { setRoles([]); setToRoleId(''); return; }
    (async () => {
      try {
        const data = await apiFetch(`/hr/staff-roles?departmentId=${toDeptId}`);
        setRoles(Array.isArray(data) ? data : []);
      } catch {
        setRoles([]);
      }
    })();
  }, [toDeptId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmp) { setErrorMsg('Please search and select an employee to remap.'); return; }
    if (!toDeptId || !toRoleId) { setErrorMsg('Please select target Department and Staff Role.'); return; }
    if (!fromDate) { setErrorMsg('Please specify Effective Joining Date.'); return; }

    try {
      setIsSubmitting(true);
      setErrorMsg('');
      await apiFetch('/hr/employees/remap', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: selectedEmp.id,
          to_department_id: Number(toDeptId),
          to_role_id: Number(toRoleId),
          from_date: fromDate,
          notes: notes.trim() || null,
        }),
      });
      onSuccess(`Employee ${selectedEmp.full_name} (${selectedEmp.employee_code}) successfully remapped.`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to remap employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">Remap Employee Department &amp; Role</h3>
            <p className="text-xs text-gray-500">Reassign employee to another department with historical logging</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded-md hover:bg-gray-100 transition-colors">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-2.5 rounded-lg">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Search */}
          <div className="space-y-1.5 relative">
            <label className="block text-xs font-semibold text-gray-700">Search Employee (Name or Employee Code) *</label>
            <input
              type="text"
              value={selectedEmp ? `${selectedEmp.full_name} (${selectedEmp.employee_code})` : query}
              onChange={(e) => {
                setSelectedEmp(null);
                setQuery(e.target.value);
              }}
              placeholder="Type Employee Code (e.g. EMP-001) or Name..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              required
            />
            {selectedEmp && (
              <button
                type="button"
                onClick={() => { setSelectedEmp(null); setQuery(''); }}
                className="absolute right-2.5 top-8 text-xs font-bold text-rose-500 hover:underline cursor-pointer"
              >
                Change
              </button>
            )}

            {!selectedEmp && candidates.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-100">
                {candidates.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setSelectedEmp(emp);
                      setCandidates([]);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-gray-900">{emp.full_name}</span>{' '}
                      <span className="text-blue-600 font-semibold">({emp.employee_code})</span>
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {emp.department_name || 'No Dept'} · {emp.designation_name || 'No Role'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedEmp && (
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs space-y-1">
              <div><span className="font-bold text-blue-900">Current Dept:</span> {selectedEmp.department_name || '—'}</div>
              <div><span className="font-bold text-blue-900">Current Role:</span> {selectedEmp.designation_name || '—'}</div>
            </div>
          )}

          {/* Target Department */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">New Department *</label>
            <select
              value={toDeptId}
              onChange={(e) => setToDeptId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
              required
            >
              <option value="">Select Target Department...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Target Role */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">New Staff Role *</label>
            <select
              value={toRoleId}
              onChange={(e) => setToRoleId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
              disabled={!toDeptId}
              required
            >
              <option value="">Select Target Staff Role...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (Basic: ₹{Number(r.basic_salary).toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          {/* Effective Joining Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">Effective Joining Date in New Role *</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold"
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">Remapping Notes / Reason</label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional transfer reason or internal reference..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedEmp}
              className="px-4 py-2 text-xs font-semibold bg-[#1e40af] hover:bg-[#1c399b] text-white rounded-lg cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Remapping...' : 'Remap & Save Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   REMAPPING HISTORY VIEW
═══════════════════════════════════════════════════════════════════════ */
function RemappingHistoryView({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const data = await apiFetch(`/hr/employees/remapping-logs?search=${encodeURIComponent(search)}&limit=100`);
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load remapping logs.');
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-4">
      <PageHeader
        category="Staff & Salary"
        parent="Department & Role"
        title="Remapping Logs"
        subtitle="Audit log of all department transfers and role reassignments"
        onBack={onBack}
        backLabel="Back to Departments"
      />

      {errorMsg && (
        <div className="bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl">
          {errorMsg}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex items-center justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter logs by employee code or name..."
          className="w-72 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
        />
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left text-xs text-gray-700 min-w-[700px]">
          <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
            <tr>
              <th className="p-3.5">Employee</th>
              <th className="p-3.5">Previous Assignment</th>
              <th className="p-3.5">New Assignment</th>
              <th className="p-3.5">Effective From</th>
              <th className="p-3.5">End Date</th>
              <th className="p-3.5">Remapped By</th>
              <th className="p-3.5">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">Loading remapping history...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">No remapping logs recorded yet.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/80">
                  <td className="p-3.5">
                    <div className="font-bold text-gray-900">{log.employee_name}</div>
                    <div className="text-[11px] text-blue-600 font-semibold">{log.employee_code}</div>
                  </td>
                  <td className="p-3.5 text-gray-600">
                    <div>{log.from_department_name || '—'}</div>
                    <div className="text-[11px] text-gray-400">{log.from_role_name || '—'}</div>
                  </td>
                  <td className="p-3.5">
                    <div className="font-bold text-gray-900">{log.to_department_name}</div>
                    <div className="text-[11px] text-blue-700 font-semibold">{log.to_role_name}</div>
                  </td>
                  <td className="p-3.5 font-semibold text-emerald-700">
                    {log.from_date ? new Date(log.from_date).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="p-3.5 text-gray-500">
                    {log.to_date ? new Date(log.to_date).toLocaleDateString('en-IN') : <span className="text-emerald-600 font-bold">Active</span>}
                  </td>
                  <td className="p-3.5 text-gray-600">{log.remapped_by_name || 'System'}</td>
                  <td className="p-3.5 text-gray-500 max-w-xs truncate">{log.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
