import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../util/api';
import PageHeader from '../../components/PageHeader';
import { XIcon } from '../../components/Icons';

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-3 rounded-xl border shadow-sm ${cls}`}>{msg}</div>;
}

const displayDateTime = (v) => {
  if (!v) return 'Never';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function UsersAuthentication() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const u = await apiFetch('/users');
      setUsers(u);
    } catch (err) {
      fail(err, 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (u) => {
    try {
      await apiFetch(`/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !u.is_active }) });
      flash(`${u.username} ${u.is_active ? 'deactivated' : 'activated'}.`);
      await load();
    } catch (err) {
      fail(err, 'Failed to update user.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        category="Admin"
        title="Users & Authentication"
        subtitle="Give an employee a username and password so they can log in."
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-colors"
          >
            + Set Login for Employee
          </button>
        }
      />

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No logins created yet.</div>
        ) : (
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
              <tr>
                <th className="p-3.5">Username</th>
                <th className="p-3.5">Employee</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Last Login</th>
                <th className="p-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/80">
                  <td className="p-3.5 font-bold text-gray-900">{u.username}</td>
                  <td className="p-3.5">{u.employee_name || <span className="text-gray-400">—</span>}</td>
                  <td className="p-3.5">{u.department_name || <span className="text-gray-400">—</span>}</td>
                  <td className="p-3.5">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{u.designation_name || u.role_name || '—'}</span>
                    {!u.designation_name && u.role_name === 'Staff' && (
                      <div className="text-[10px] text-amber-600 font-semibold mt-0.5">No permissions — check the employee's designation</div>
                    )}
                  </td>
                  <td className="p-3.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3.5 text-gray-500">{displayDateTime(u.last_login_at)}</td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setResetTarget(u)} className="text-blue-600 font-semibold hover:underline cursor-pointer">Reset Password</button>
                      <button onClick={() => toggleActive(u)} className={`font-semibold hover:underline cursor-pointer ${u.is_active ? 'text-rose-500' : 'text-emerald-600'}`}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateLoginModal
          onClose={() => setShowCreate(false)}
          onSuccess={(msg) => { setShowCreate(false); flash(msg); load(); }}
          onError={(err) => fail(err, 'Failed to create login.')}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onSuccess={(msg) => { setResetTarget(null); flash(msg); }}
          onError={(err) => fail(err, 'Failed to reset password.')}
        />
      )}
    </div>
  );
}

function CreateLoginModal({ onClose, onSuccess, onError }) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedEmp) return; // don't keep searching once an employee is picked
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
    if (!username) {
      setUsername(emp.full_name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, ''));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmp) {
      onError({ message: 'Please search and select the employee to set a login for.' });
      return;
    }
    if (!username || !password) {
      onError({ message: 'Username and password are required.' });
      return;
    }
    try {
      setIsSubmitting(true);
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ employee_id: selectedEmp.id, username, password }),
      });
      onSuccess(`Login created for ${username}. Role and permissions can be assigned from the list below.`);
    } catch (err) {
      onError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-base font-bold text-gray-900">Set Login for Employee</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded hover:bg-gray-100">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5 relative">
            <label className="block text-xs font-semibold text-gray-700">Employee *</label>
            <input
              type="text"
              value={query}
              onChange={(e) => { setSelectedEmp(null); setQuery(e.target.value); }}
              placeholder="Search employee by name or code…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
            {candidates.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-gray-100">
                {candidates.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => selectEmployee(emp)}
                    className="w-full text-left px-3.5 py-2 text-xs hover:bg-blue-50 cursor-pointer"
                  >
                    <span className="font-bold text-gray-900">{emp.full_name}</span>{' '}
                    <span className="text-gray-400">({emp.employee_code}) — {emp.department_name || 'No Dept'} · {emp.designation_name || 'No Role'}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedEmp && (
              <p className="text-[11px] text-emerald-600 font-semibold">Selected: {selectedEmp.full_name} ({selectedEmp.employee_code})</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">Username *</label>
            <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">Password *</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold" />
          </div>

          <p className="text-[11px] text-gray-400">
            Role and phone carry over automatically from the employee's designation in Department &amp; Role — nothing to pick here.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-xs font-semibold bg-[#1e40af] hover:bg-[#1c399b] text-white rounded-lg cursor-pointer disabled:opacity-50">
              {isSubmitting ? 'Creating…' : 'Create Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onSuccess, onError }) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await apiFetch(`/users/${user.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
      onSuccess(`Password reset for ${user.username}.`);
    } catch (err) {
      onError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4 border border-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-base font-bold text-gray-900">Reset Password — {user.username}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded hover:bg-gray-100">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700">New Password *</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-xs font-semibold bg-[#1e40af] hover:bg-[#1c399b] text-white rounded-lg cursor-pointer disabled:opacity-50">
              {isSubmitting ? 'Saving…' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
