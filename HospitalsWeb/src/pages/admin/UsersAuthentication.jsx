import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../util/api';
import PageHeader from '../../components/PageHeader';
import {
  XIcon,
  SearchIcon,
  UsersIcon,
  UserIcon,
  LockIcon,
  EditIcon,
  CheckIcon,
  SyncIcon,
  BoltIcon,
} from '../../components/Icons';

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-rose-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return (
    <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm flex items-center justify-between ${cls}`}>
      <span>{msg}</span>
    </div>
  );
}

const displayDateTime = (v) => {
  if (!v) return 'Never logged in';
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

/** Sanitizes username into <name>-<id> format: lowercase letters, numbers, and hyphens only */
export const sanitizeUsername = (raw) => {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
};

/** Generates default username for an employee */
export const generateDefaultUsername = (fullName, employeeCodeOrId) => {
  const cleanName = String(fullName || '')
    .toLowerCase()
    .replace(/^dr\.\s*/i, '')
    .replace(/^dr\s*/i, '')
    .replace(/[^a-z0-9]/g, '');
  const cleanId = String(employeeCodeOrId || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `${cleanName}-${cleanId}`;
};

export default function UsersAuthentication() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [unlinkedCount, setUnlinkedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };
  const fail = (err, fallback) => {
    setErrorMsg(err?.message || fallback);
    setTimeout(() => setErrorMsg(''), 6000);
  };

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const [u, r, unlinked] = await Promise.all([
        apiFetch('/users'),
        apiFetch('/rbac/roles').catch(() => []),
        apiFetch('/users/employees-without-login').catch(() => []),
      ]);
      setUsers(Array.isArray(u) ? u : []);
      setRoles(Array.isArray(r) ? r : []);
      setUnlinkedCount(Array.isArray(unlinked) ? unlinked.length : 0);
    } catch (err) {
      fail(err, 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (u) => {
    try {
      await apiFetch(`/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      flash(`User ${u.username} ${u.is_active ? 'deactivated' : 'activated'}.`);
      await load();
    } catch (err) {
      fail(err, 'Failed to update user status.');
    }
  };

  // Distinct departments for filter
  const departments = useMemo(() => {
    const set = new Set();
    users.forEach((u) => {
      if (u.department_name) set.add(u.department_name);
    });
    return Array.from(set).sort();
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === 'active' && !u.is_active) return false;
      if (statusFilter === 'inactive' && u.is_active) return false;
      if (roleFilter && String(u.role_id) !== String(roleFilter)) return false;
      if (deptFilter && u.department_name !== deptFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const usernameMatch = (u.username || '').toLowerCase().includes(q);
        const nameMatch = (u.employee_name || '').toLowerCase().includes(q);
        const codeMatch = (u.employee_code || '').toLowerCase().includes(q);
        const roleMatch = (u.role_name || '').toLowerCase().includes(q);
        const deptMatch = (u.department_name || '').toLowerCase().includes(q);
        const desMatch = (u.designation_name || '').toLowerCase().includes(q);
        if (!usernameMatch && !nameMatch && !codeMatch && !roleMatch && !deptMatch && !desMatch) {
          return false;
        }
      }
      return true;
    });
  }, [users, searchQuery, statusFilter, roleFilter, deptFilter]);

  const activeCount = users.filter((u) => u.is_active).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        category="Admin"
        title="Users & Authentication"
        subtitle="Manage hospital staff logins, change usernames, assign roles, and reset passwords."
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm cursor-pointer transition-colors flex items-center gap-2"
          >
            <UserIcon className="w-4 h-4" />
            <span>+ Set Login for Employee</span>
          </button>
        }
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
            <UsersIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Total Logins</div>
            <div className="text-lg font-bold text-gray-900">{users.length}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
            <CheckIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Active Accounts</div>
            <div className="text-lg font-bold text-emerald-600">{activeCount}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-sm">
            <LockIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Inactive</div>
            <div className="text-lg font-bold text-gray-600">{inactiveCount}</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-sm flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
            <BoltIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Without Login</div>
            <div className="text-lg font-bold text-amber-600">{unlinkedCount} staff</div>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All ({users.length})</option>
              <option value="active">Active ({activeCount})</option>
              <option value="inactive">Inactive ({inactiveCount})</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Dept</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[150px]"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Role</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[160px]"
            >
              <option value="">All Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Search */}
        <div className="relative min-w-[240px] flex-1 sm:flex-initial">
          <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, username, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Hospital User Accounts</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Standardized format <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-600 font-mono text-[10px]">&lt;name&gt;-&lt;id&gt;</code> without spaces or special characters.
            </p>
          </div>
          <div className="text-[11px] font-semibold text-gray-400">
            Showing {filteredUsers.length} of {users.length} accounts
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-gray-400">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mb-2"></div>
            <div>Loading accounts…</div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-500">
            No user accounts found matching your search and filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50/80 text-[10px] text-gray-500 uppercase font-bold border-b border-gray-200 tracking-wider">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-3 py-3">Employee</th>
                  <th className="px-3 py-3">Department</th>
                  <th className="px-3 py-3">Assigned Role</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3">Last Login</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                    {/* Username */}
                    <td className="px-4 py-2.5 font-bold text-gray-900">
                      <div className="flex items-center gap-1.5 font-mono text-xs text-blue-700">
                        <span>{u.username}</span>
                      </div>
                    </td>

                    {/* Employee */}
                    <td className="px-3 py-2.5">
                      {u.employee_name ? (
                        <div>
                          <div className="font-bold text-gray-900">{u.employee_name}</div>
                          <div className="text-[10px] text-gray-400">
                            Code: {u.employee_code || u.employee_id} {u.designation_name ? `· ${u.designation_name}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">System Admin</span>
                      )}
                    </td>

                    {/* Department */}
                    <td className="px-3 py-2.5 text-gray-600 font-medium">
                      {u.department_name || '—'}
                    </td>

                    {/* Role */}
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] bg-blue-50 text-blue-700 border border-blue-200/80">
                        {u.role_name || 'Staff'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => toggleActive(u)}
                        title="Click to toggle status"
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                          u.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>

                    {/* Last Login */}
                    <td className="px-3 py-2.5 text-gray-500 text-[11px]">
                      {displayDateTime(u.last_login_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditTarget(u)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200/80 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <EditIcon className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setResetTarget(u)}
                          className="px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <LockIcon className="w-3.5 h-3.5 text-gray-500" />
                          <span>Password</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Login Modal */}
      {showCreate && (
        <CreateLoginModal
          roles={roles}
          onClose={() => setShowCreate(false)}
          onSuccess={(msg) => {
            setShowCreate(false);
            flash(msg);
            load();
          }}
          onError={(err) => fail(err, 'Failed to create login.')}
        />
      )}

      {/* Edit User Modal */}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          roles={roles}
          onClose={() => setEditTarget(null)}
          onSuccess={(msg) => {
            setEditTarget(null);
            flash(msg);
            load();
          }}
          onError={(err) => fail(err, 'Failed to update user.')}
        />
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onSuccess={(msg) => {
            setResetTarget(null);
            flash(msg);
          }}
          onError={(err) => fail(err, 'Failed to reset password.')}
        />
      )}
    </div>
  );
}

/** Smartly suggests an RBAC role based on employee designation / department */
export const guessRole = (emp, rolesList) => {
  if (!emp || !rolesList?.length) return '';
  const des = String(emp.designation_name || '').toLowerCase();
  const dept = String(emp.department_name || '').toLowerCase();

  // 1. Direct match with staff_role_id if any role is linked
  const directLink = rolesList.find((r) => r.staff_role_id && r.staff_role_id === emp.designation_id);
  if (directLink) return directLink.id;

  // 2. Doctor / Clinician
  if (emp.is_doctor || des.includes('doctor') || des.includes('consultant') || des.includes('surgeon')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('doctor') || r.name.toLowerCase().includes('consultant'));
    if (match) return match.id;
  }
  // 3. Nurse
  if (des.includes('nurse') || dept.includes('nurs')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('nurse'));
    if (match) return match.id;
  }
  // 4. Pharmacist
  if (des.includes('pharmac') || dept.includes('pharmac')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('pharmac'));
    if (match) return match.id;
  }
  // 5. Lab Technician
  if (des.includes('lab') || dept.includes('lab')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('lab'));
    if (match) return match.id;
  }
  // 6. Scan / Radiographer
  if (des.includes('scan') || des.includes('radiograph') || dept.includes('radiolog')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('scan') || r.name.toLowerCase().includes('radiograph'));
    if (match) return match.id;
  }
  // 7. Admin / Receptionist / Billing
  if (des.includes('admin') || des.includes('reception') || des.includes('billing') || des.includes('cashier')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('admin') || r.name.toLowerCase().includes('reception'));
    if (match) return match.id;
  }
  // 8. Security
  if (des.includes('security')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('security'));
    if (match) return match.id;
  }
  // 9. Housekeeping
  if (des.includes('house') || des.includes('clean')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('house'));
    if (match) return match.id;
  }

  // Fallback to first non-admin role or first available
  const fallback = rolesList.find((r) => r.id !== 1);
  return fallback?.id || rolesList[0]?.id || '';
};

/* ═══════════════════════════════════════════════════════════════════════
   CREATE LOGIN MODAL
═══════════════════════════════════════════════════════════════════════ */

function CreateLoginModal({ roles = [], onClose, onSuccess, onError }) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedEmp) return;
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch(`/users/employees-without-login?search=${encodeURIComponent(query)}`);
        setCandidates(Array.isArray(data) ? data : []);
      } catch {
        setCandidates([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selectedEmp]);

  const selectEmployee = (emp) => {
    setSelectedEmp(emp);
    setCandidates([]);
    setQuery(emp.full_name);
    const autoUser = generateDefaultUsername(emp.full_name, emp.employee_code || emp.id);
    setUsername(autoUser);
    const suggestedRole = guessRole(emp, roles);
    setRoleId(suggestedRole);
  };

  const handleUsernameChange = (e) => {
    setUsername(sanitizeUsername(e.target.value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmp) {
      onError({ message: 'Please search and select the employee to set a login for.' });
      return;
    }
    const cleanUser = sanitizeUsername(username);
    if (!cleanUser || cleanUser.length < 3) {
      onError({ message: 'Username must be at least 3 characters and contain only lowercase letters, numbers, or hyphens.' });
      return;
    }
    if (!password || password.length < 6) {
      onError({ message: 'Password must be at least 6 characters.' });
      return;
    }
    if (!roleId) {
      onError({ message: 'Please select an RBAC Security Role for this user.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          employee_id: selectedEmp.id,
          username: cleanUser,
          password,
          role_id: Number(roleId),
        }),
      });
      onSuccess(`Login created successfully for ${cleanUser}.`);
    } catch (err) {
      onError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Set Login for Employee</h3>
              <p className="text-[11px] text-gray-500">Creates hospital access credentials</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded hover:bg-gray-100">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Picker */}
          <div className="space-y-1.5 relative">
            <label className="block text-xs font-semibold text-gray-700">Select Employee *</label>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setSelectedEmp(null);
                setQuery(e.target.value);
              }}
              placeholder="Search employee by name or code…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
            {candidates.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-100">
                {candidates.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => selectEmployee(emp)}
                    className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-blue-50 cursor-pointer flex flex-col"
                  >
                    <span className="font-bold text-gray-900">{emp.full_name}</span>
                    <span className="text-[11px] text-gray-500">
                      Code: {emp.employee_code} · {emp.department_name || 'No Dept'} · {emp.designation_name || 'Staff'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedEmp && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-800 flex items-center justify-between">
                <div>
                  <div className="font-bold">{selectedEmp.full_name}</div>
                  <div className="text-[11px] text-emerald-600">
                    Code: {selectedEmp.employee_code} · {selectedEmp.department_name || 'General'}
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">Selected</span>
              </div>
            )}
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">
              Username * <span className="text-[10px] text-gray-400 font-normal">(format: name-id, lowercase only)</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={handleUsernameChange}
              placeholder="e.g. divyas-2"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">Initial Password *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2 pr-16 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-blue-600 hover:text-blue-800 px-1.5 py-0.5 cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* RBAC Security Role */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700">RBAC Security Role *</label>
              {selectedEmp && (
                <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                  Suggested for {selectedEmp.designation_name || 'Staff'}
                </span>
              )}
            </div>
            <select
              required
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              <option value="" disabled>-- Select RBAC Security Role --</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.id === 1 ? '(Superuser)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg text-[11px] text-blue-800 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <BoltIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Decoupled Role Security</span>
            </div>
            <p className="text-blue-700/90 text-[10px]">
              This sets the user's software authorization profile. Their clinical title and department remain managed under Department &amp; Role.
            </p>
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
              disabled={isSubmitting || !selectedEmp || !roleId}
              className="px-4 py-2 text-xs font-semibold bg-[#1e40af] hover:bg-[#1c399b] text-white rounded-lg cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? 'Creating…' : 'Create Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   EDIT USER MODAL (Username, Role, Phone, Email)
═══════════════════════════════════════════════════════════════════════ */

function EditUserModal({ user, roles = [], onClose, onSuccess, onError }) {
  const [username, setUsername] = useState(user.username || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [roleId, setRoleId] = useState(user.role_id || '');
  const [isActive, setIsActive] = useState(!!user.is_active);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUsernameChange = (e) => {
    setUsername(sanitizeUsername(e.target.value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUser = sanitizeUsername(username);
    if (!cleanUser || cleanUser.length < 3) {
      onError({ message: 'Username must be at least 3 characters with only lowercase letters, numbers, and hyphens.' });
      return;
    }
    if (!roleId) {
      onError({ message: 'Please select an RBAC Role.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          username: cleanUser,
          email: email || null,
          phone: phone || null,
          role_id: user.username === 'admin' ? undefined : Number(roleId),
          is_active: isActive,
        }),
      });
      onSuccess(`User ${cleanUser} updated successfully.`);
    } catch (err) {
      onError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <EditIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Edit User Account</h3>
              <p className="text-[11px] text-gray-500">{user.employee_name || user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded hover:bg-gray-100">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Username */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700">
              Username * <span className="text-[10px] text-gray-400 font-normal">(format: name-id, lowercase only)</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={handleUsernameChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Role Selector */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700">RBAC Security Role *</label>
              {user.designation_name && (
                <span className="text-[10px] text-gray-400 font-normal">
                  Designation: {user.designation_name}
                </span>
              )}
            </div>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={user.username === 'admin'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-gray-100"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.id === 1 ? '(Superuser)' : ''}
                </option>
              ))}
            </select>
            {user.username === 'admin' && (
              <p className="text-[10px] text-amber-600 font-medium">The primary Administrator role cannot be changed.</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@nehahospital.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div>
              <div className="text-xs font-bold text-gray-900">Account Active</div>
              <div className="text-[10px] text-gray-500">Deactivated users cannot log into the portal</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
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
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold bg-[#1e40af] hover:bg-[#1c399b] text-white rounded-lg cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   RESET PASSWORD MODAL
═══════════════════════════════════════════════════════════════════════ */

function ResetPasswordModal({ user, onClose, onSuccess, onError }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      onError({ message: 'Password must be at least 6 characters long.' });
      return;
    }
    try {
      setIsSubmitting(true);
      await apiFetch(`/users/${user.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      onSuccess(`Password has been updated for ${user.username}.`);
    } catch (err) {
      onError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <LockIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Reset Password</h3>
              <p className="text-[11px] text-gray-500 font-mono">{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded hover:bg-gray-100">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">New Password *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2 pr-16 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-blue-600 hover:text-blue-800 px-1.5 py-0.5 cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400">
              The user can immediately log in using their username <span className="font-mono font-bold text-gray-700">{user.username}</span> and this password.
            </p>
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
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold bg-[#1e40af] hover:bg-[#1c399b] text-white rounded-lg cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? 'Saving…' : 'Save Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
