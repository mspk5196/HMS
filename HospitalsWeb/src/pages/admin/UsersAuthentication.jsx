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

function EyeIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeSlashIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300'
    : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-300';
  return (
    <div className={`text-xs font-semibold px-4 py-3 rounded-xl border shadow-2xs flex items-center justify-between ${cls}`}>
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
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'audit-history'

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

  // Filters for Accounts Table
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Login History State
  const [loginHistory, setLoginHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyMethod, setHistoryMethod] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
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

  const loadHistory = useCallback(async () => {
    try {
      setIsHistoryLoading(true);
      const params = new URLSearchParams();
      if (historySearch.trim()) params.append('search', historySearch.trim());
      if (historyMethod) params.append('method', historyMethod);
      if (historyStatus) params.append('status', historyStatus);
      params.append('limit', '100');

      const data = await apiFetch(`/users/login-history?${params.toString()}`);
      setLoginHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      fail(err, 'Failed to retrieve login audit history.');
    } finally {
      setIsHistoryLoading(false);
    }
  }, [historySearch, historyMethod, historyStatus]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeTab === 'audit-history') {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

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

  const toggleAuthMethod = async (user, method) => {
    try {
      const currentGoogle = user.google_login_enabled !== 0;
      const currentPassword = user.password_login_enabled !== 0;

      let nextGoogle = currentGoogle;
      let nextPassword = currentPassword;

      if (method === 'google') {
        nextGoogle = !currentGoogle;
      } else if (method === 'password') {
        nextPassword = !currentPassword;
      }

      if (!nextGoogle && !nextPassword) {
        fail({ message: 'At least one authentication method (Password or Google) must remain enabled.' });
        return;
      }

      await apiFetch(`/users/${user.id}/auth-methods`, {
        method: 'PATCH',
        body: JSON.stringify({
          google_login_enabled: nextGoogle,
          password_login_enabled: nextPassword,
        }),
      });

      flash(`Updated login methods for ${user.username}.`);
      await load();
    } catch (err) {
      fail(err, 'Failed to update authentication methods.');
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
    <div className="space-y-5 antialiased font-sans">
      <PageHeader
        category="Administration & Security"
        title="Users & Roles"
        subtitle="Manage hospital staff credentials, Google SSO toggles, first-time password policies, and inspect login audit history."
        count={users.length}
        countLabel="Total Accounts"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab(activeTab === 'users' ? 'audit-history' : 'users')}
              className={`text-xs font-semibold px-3.5 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2 shadow-2xs ${
                activeTab === 'audit-history'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <SyncIcon className="w-3.5 h-3.5 text-emerald-600" />
              <span>{activeTab === 'audit-history' ? 'View User Accounts' : 'Login Audit Trail'}</span>
            </button>

            <button
              onClick={() => setShowCreate(true)}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-2"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>+ Set Login for Employee</span>
            </button>
          </div>
        }
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#0f172a] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
            <UsersIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Accounts</div>
            <div className="text-lg font-heading font-black text-slate-900 dark:text-white">{users.length}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0f172a] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm">
            <CheckIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Active Logins</div>
            <div className="text-lg font-heading font-black text-emerald-600 dark:text-emerald-400">{activeCount}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0f172a] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center font-bold text-sm">
            <LockIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Inactive</div>
            <div className="text-lg font-heading font-black text-slate-600 dark:text-slate-400">{inactiveCount}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0f172a] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
            <BoltIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Without Login</div>
            <div className="text-lg font-heading font-black text-amber-600 dark:text-amber-400">{unlinkedCount} staff</div>
          </div>
        </div>
      </div>

      {/* ── Sub-navigation Tab Bar ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'users'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <UsersIcon className="w-4 h-4" />
          <span>User Accounts &amp; Access</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit-history')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'audit-history'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <SyncIcon className="w-4 h-4" />
          <span>Login Audit History</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
            Live Audit Trail
          </span>
        </button>
      </div>

      {/* ── VIEW 1: USER ACCOUNTS TABLE ── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white dark:bg-[#0f172a] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="all">All ({users.length})</option>
                  <option value="active">Active ({activeCount})</option>
                  <option value="inactive">Inactive ({inactiveCount})</option>
                </select>
              </div>

              {/* Department Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Dept</span>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 max-w-[150px]"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Role Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Role</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 max-w-[160px]"
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
              <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search username, name, or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Accounts Table */}
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Registered Staff Logins
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Standard format <code className="bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded text-emerald-700 dark:text-emerald-400 font-mono text-[10px]">&lt;name&gt;-&lt;id&gt;</code>. Staff must set a new password on their first login.
                </p>
              </div>
              <div className="text-[11px] font-semibold text-slate-400">
                Showing {filteredUsers.length} of {users.length} accounts
              </div>
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent mb-2"></div>
                <div>Loading accounts…</div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No user accounts found matching your filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold border-b border-slate-200 dark:border-slate-800 tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Username</th>
                      <th className="px-3 py-3">Employee</th>
                      <th className="px-3 py-3">Department</th>
                      <th className="px-3 py-3">Assigned Role</th>
                      <th className="px-3 py-3">Login Methods (Click to toggle)</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-3 py-3">Last Login</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredUsers.map((u) => {
                      const passwordActive = u.password_login_enabled !== 0;
                      const googleActive = u.google_login_enabled !== 0;

                      return (
                        <tr key={u.id} className="hover:bg-emerald-50/20 dark:hover:bg-slate-800/40 transition-colors">
                          {/* Username */}
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            <div className="flex items-center gap-1.5 font-mono text-xs text-emerald-700 dark:text-emerald-400">
                              <span>{u.username}</span>
                            </div>
                            {u.must_change_password ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 mt-1">
                                🔒 1st-Time PW Required
                              </span>
                            ) : null}
                          </td>

                          {/* Employee */}
                          <td className="px-3 py-3">
                            {u.employee_name ? (
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">{u.employee_name}</div>
                                <div className="text-[10px] text-slate-400">
                                  Code: {u.employee_code || u.employee_id} {u.designation_name ? `· ${u.designation_name}` : ''}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Hospital System Admin</span>
                            )}
                          </td>

                          {/* Department */}
                          <td className="px-3 py-3 text-slate-600 dark:text-slate-400 font-medium">
                            {u.department_name || '—'}
                          </td>

                          {/* Role */}
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg font-semibold text-[11px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {u.role_name || 'Staff'}
                            </span>
                          </td>

                          {/* Login Methods Toggles */}
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Password Toggle Button */}
                              <button
                                type="button"
                                onClick={() => toggleAuthMethod(u, 'password')}
                                title="Click to toggle Password login for this employee"
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                  passwordActive
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 opacity-60'
                                }`}
                              >
                                <span>🔑 Password</span>
                                <span className={`text-[9px] px-1 rounded ${passwordActive ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-200 text-slate-600'}`}>
                                  {passwordActive ? 'ON' : 'OFF'}
                                </span>
                              </button>

                              {/* Google Toggle Button */}
                              <button
                                type="button"
                                onClick={() => toggleAuthMethod(u, 'google')}
                                title="Click to toggle Google SSO login for this employee"
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                  googleActive
                                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800 hover:bg-teal-100'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 opacity-60'
                                }`}
                              >
                                <span>🌐 Google</span>
                                <span className={`text-[9px] px-1 rounded ${googleActive ? 'bg-teal-200/80 text-teal-900' : 'bg-slate-200 text-slate-600'}`}>
                                  {googleActive ? 'ON' : 'OFF'}
                                </span>
                              </button>
                            </div>
                            {u.google_email && (
                              <div className="text-[10px] text-teal-600 dark:text-teal-400 truncate max-w-[170px] mt-0.5">
                                Linked: {u.google_email}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={() => toggleActive(u)}
                              title="Click to toggle active status"
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                                u.is_active
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {u.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>

                          {/* Last Login */}
                          <td className="px-3 py-3 text-slate-500 dark:text-slate-400 text-[11px]">
                            {displayDateTime(u.last_login_at)}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditTarget(u)}
                                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <EditIcon className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => setResetTarget(u)}
                                className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <LockIcon className="w-3.5 h-3.5 text-slate-500" />
                                <span>Password</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VIEW 2: LOGIN AUDIT HISTORY ── */}
      {activeTab === 'audit-history' && (
        <div className="space-y-4 animate-fade-in">
          {/* Audit Filter & Refresh Bar */}
          <div className="bg-white dark:bg-[#0f172a] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Method filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Method</span>
                <select
                  value={historyMethod}
                  onChange={(e) => setHistoryMethod(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">All Methods</option>
                  <option value="PASSWORD">Password</option>
                  <option value="GOOGLE">Google SSO</option>
                </select>
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Outcome</span>
                <select
                  value={historyStatus}
                  onChange={(e) => setHistoryStatus(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">All Outcomes</option>
                  <option value="SUCCESS">Success Only</option>
                  <option value="FAILED">Failed Attempts</option>
                </select>
              </div>

              {/* Live Search */}
              <div className="relative min-w-[220px]">
                <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff name or username..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>
            </div>

            <button
              onClick={loadHistory}
              disabled={isHistoryLoading}
              className="px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <SyncIcon className={`w-3.5 h-3.5 ${isHistoryLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Audit Log</span>
            </button>
          </div>

          {/* Audit History Log Table */}
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Employee Authentication History
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Complete audit trail of all staff login attempts, IP addresses, authentication methods, and security outcomes.
                </p>
              </div>
              <div className="text-[11px] font-semibold text-slate-400">
                {loginHistory.length} Recorded Attempts
              </div>
            </div>

            {isHistoryLoading ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent mb-2"></div>
                <div>Fetching authentication history…</div>
              </div>
            ) : loginHistory.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No login history records found. (Login attempts are recorded live as staff sign into the portal)
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold border-b border-slate-200 dark:border-slate-800 tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Employee / Account</th>
                      <th className="px-3 py-3">Auth Method</th>
                      <th className="px-3 py-3 text-center">Status</th>
                      <th className="px-4 py-3">IP Address</th>
                      <th className="px-4 py-3">Client / Browser Details</th>
                      <th className="px-4 py-3">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {loginHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-emerald-50/20 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Timestamp */}
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {displayDateTime(item.created_at)}
                        </td>

                        {/* Employee / Username */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {item.employee_name || item.username}
                          </div>
                          <div className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                            {item.username}
                          </div>
                        </td>

                        {/* Auth Method */}
                        <td className="px-3 py-3">
                          {item.login_method === 'GOOGLE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                              <span>🌐 Google SSO</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <span>🔑 Password</span>
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3 text-center">
                          {item.status === 'SUCCESS' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              ✓ SUCCESS
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              ✕ FAILED
                            </span>
                          )}
                        </td>

                        {/* IP Address */}
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          {item.ip_address || '—'}
                        </td>

                        {/* User Agent */}
                        <td className="px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={item.user_agent}>
                          {item.user_agent ? (
                            item.user_agent.length > 35 ? item.user_agent.slice(0, 35) + '…' : item.user_agent
                          ) : '—'}
                        </td>

                        {/* Audit Details / Failure reason */}
                        <td className="px-4 py-3 text-[11px]">
                          {item.failure_reason ? (
                            <span className="text-rose-600 dark:text-rose-400 font-medium">{item.failure_reason}</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">Authenticated successfully</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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

  const directLink = rolesList.find((r) => r.staff_role_id && r.staff_role_id === emp.designation_id);
  if (directLink) return directLink.id;

  if (emp.is_doctor || des.includes('doctor') || des.includes('consultant') || des.includes('surgeon')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('doctor') || r.name.toLowerCase().includes('consultant'));
    if (match) return match.id;
  }
  if (des.includes('nurse') || dept.includes('nurs')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('nurse'));
    if (match) return match.id;
  }
  if (des.includes('pharmac') || dept.includes('pharmac')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('pharmac'));
    if (match) return match.id;
  }
  if (des.includes('lab') || dept.includes('lab')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('lab'));
    if (match) return match.id;
  }
  if (des.includes('scan') || des.includes('radiograph') || dept.includes('radiolog')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('scan') || r.name.toLowerCase().includes('radiograph'));
    if (match) return match.id;
  }
  if (des.includes('admin') || des.includes('reception') || des.includes('billing') || des.includes('cashier')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('admin') || r.name.toLowerCase().includes('reception'));
    if (match) return match.id;
  }
  if (des.includes('security')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('security'));
    if (match) return match.id;
  }
  if (des.includes('house') || des.includes('clean')) {
    const match = rolesList.find((r) => r.name.toLowerCase().includes('house'));
    if (match) return match.id;
  }

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
      onSuccess(`Login created successfully for ${cleanUser}. Employee will be prompted to set their private password upon first login.`);
    } catch (err) {
      onError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <UserIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Set Login for Employee</h3>
              <p className="text-[11px] text-slate-500">Creates hospital access credentials</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Picker */}
          <div className="space-y-1.5 relative">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Select Employee *</label>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setSelectedEmp(null);
                setQuery(e.target.value);
              }}
              placeholder="Search employee by name or code…"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
            {candidates.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                {candidates.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => selectEmployee(emp)}
                    className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-emerald-50 dark:hover:bg-slate-700 cursor-pointer flex flex-col"
                  >
                    <span className="font-bold text-slate-900 dark:text-white">{emp.full_name}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Code: {emp.employee_code} · {emp.department_name || 'No Dept'} · {emp.designation_name || 'Staff'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedEmp && (
              <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl p-2.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <div>
                  <div className="font-bold">{selectedEmp.full_name}</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    Code: {selectedEmp.employee_code} · {selectedEmp.department_name || 'General'}
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">Selected</span>
              </div>
            )}
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Username * <span className="text-[10px] text-slate-400 font-normal">(format: name-id, lowercase only)</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={handleUsernameChange}
              placeholder="e.g. divyas-2"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          {/* Initial Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Initial Temporary Password *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2 pr-16 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer p-0.5"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* RBAC Security Role */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">RBAC Security Role *</label>
              {selectedEmp && (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                  Suggested for {selectedEmp.designation_name || 'Staff'}
                </span>
              )}
            </div>
            <select
              required
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            >
              <option value="" disabled>-- Select RBAC Security Role --</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.id === 1 ? '(Superuser)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* First-Time Password Policy Banner */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <span>🔒 First-Time Password Reset Required</span>
            </div>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
              When the employee signs in with this password for the first time, the portal will immediately prompt them to set their own new permanent password before gaining access.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedEmp || !roleId}
              className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl cursor-pointer disabled:opacity-50 shadow-xs"
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
  const [roleId, setRoleId] = useState(user.role_id || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [isActive, setIsActive] = useState(user.is_active);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUser = sanitizeUsername(username);
    if (!cleanUser || cleanUser.length < 3) {
      onError({ message: 'Username must be at least 3 characters.' });
      return;
    }
    try {
      setIsSubmitting(true);
      await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          username: cleanUser,
          role_id: Number(roleId),
          email: email.trim() || null,
          phone: phone.trim() || null,
          is_active: isActive,
        }),
      });
      onSuccess(`Account updated for ${cleanUser}.`);
    } catch (err) {
      onError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <EditIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Edit User Account</h3>
              <p className="text-[11px] text-slate-500 font-mono">{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Username */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Username *</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          {/* Role */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Assigned RBAC Role *</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={user.id === 1}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {user.id === 1 && (
              <p className="text-[10px] text-amber-600 font-medium">The primary Administrator role cannot be changed.</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employee@nehahospital.com"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Account Active</div>
              <div className="text-[10px] text-slate-500">Deactivated users cannot log into the portal</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl cursor-pointer disabled:opacity-50 shadow-xs"
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
      onSuccess(`Temporary password set for ${user.username}. The employee will be required to set their own password upon first login.`);
    } catch (err) {
      onError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-[#0f172a] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <LockIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reset Staff Password</h3>
              <p className="text-[11px] text-slate-500 font-mono">{user.username}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">New Temporary Password *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2 pr-16 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer p-0.5"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <span>🔒 First-Time Password Reset Policy</span>
            </div>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
              Upon signing in with this password for the first time, this employee will be required to set their own permanent password before entering the application.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl cursor-pointer disabled:opacity-50 shadow-xs"
            >
              {isSubmitting ? 'Saving…' : 'Save Temporary Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
