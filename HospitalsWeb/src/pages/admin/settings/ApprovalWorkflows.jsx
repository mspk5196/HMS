import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-2.5 rounded-lg border ${cls}`}>{msg}</div>;
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full shrink-0 transition-colors cursor-pointer ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`}
      />
    </button>
  );
}

const payloadOf = (w) => ({
  enabled: !!w.enabled,
  level1_type: w.level1_type,
  level1_role_id: w.level1_role_id,
  level1_user_id: w.level1_user_id,
  level2_enabled: !!w.level2_enabled,
  level2_type: w.level2_type,
  level2_role_id: w.level2_role_id,
  level2_user_id: w.level2_user_id,
});

export default function ApprovalWorkflows() {
  const [workflows, setWorkflows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingCode, setSavingCode] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const [wf, r, u] = await Promise.all([
        apiFetch('/rbac/approval-workflows'),
        apiFetch('/rbac/roles'),
        apiFetch('/users'),
      ]);
      setWorkflows(wf);
      setRoles(r);
      setUsers(u);
    } catch (err) {
      fail(err, 'Failed to load approval workflows.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = (code, changes) => {
    setWorkflows((prev) => prev.map((w) => (w.permission_code === code ? { ...w, ...changes } : w)));
  };

  const save = async (w) => {
    try {
      setSavingCode(w.permission_code);
      await apiFetch(`/rbac/approval-workflows/${w.permission_code}`, {
        method: 'PUT',
        body: JSON.stringify(payloadOf(w)),
      });
      flash(`Saved: ${w.permission_description}`);
    } catch (err) {
      fail(err, 'Failed to save.');
    } finally {
      setSavingCode(null);
    }
  };

  // Turning the toggle off needs no further configuration, so it saves
  // immediately instead of leaving a "Save" button dangling under an
  // otherwise-empty disabled row.
  const setEnabled = async (w, enabled) => {
    patch(w.permission_code, { enabled });
    if (!enabled) await save({ ...w, enabled: false });
  };

  const byModule = workflows.reduce((groups, w) => {
    (groups[w.module_name] = groups[w.module_name] || []).push(w);
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Approval Workflows</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Enable approval for an action, then assign who must approve it — by role (anyone in that role) or a specific user. Add a second level for two-step approval.
        </p>
      </div>

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      {isLoading ? (
        <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byModule).map(([moduleName, rows]) => (
            <div key={moduleName} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">{moduleName}</div>
              <div className="divide-y divide-gray-100">
                {rows.map((w) => (
                  <div key={w.permission_code} className={`p-3.5 ${w.enabled ? 'bg-blue-50/30' : ''}`}>
                    <div className="flex items-center gap-3">
                      <Toggle checked={!!w.enabled} onChange={(v) => setEnabled(w, v)} />
                      <span className="text-xs font-bold text-gray-900 flex-1">{w.permission_description}</span>
                      {w.enabled && (
                        <button
                          onClick={() => save(w)}
                          disabled={savingCode === w.permission_code}
                          className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-[11px] font-semibold px-3.5 py-1.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          {savingCode === w.permission_code ? 'Saving…' : 'Save'}
                        </button>
                      )}
                    </div>

                    {w.enabled && (
                      <div className="pl-12 pt-2.5 space-y-2">
                        <ApproverPicker
                          label="Level 1 — Approved by"
                          type={w.level1_type}
                          roleId={w.level1_role_id}
                          userId={w.level1_user_id}
                          roles={roles}
                          users={users}
                          onChange={(changes) => patch(w.permission_code, changes)}
                          prefix="level1"
                        />

                        {!w.level2_enabled ? (
                          <button
                            onClick={() => patch(w.permission_code, { level2_enabled: true })}
                            className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer border border-dashed border-blue-300 rounded-lg px-2.5 py-1"
                          >
                            + Add second approval level
                          </button>
                        ) : (
                          <div className="space-y-1">
                            <ApproverPicker
                              label="Level 2 — Approved by"
                              type={w.level2_type}
                              roleId={w.level2_role_id}
                              userId={w.level2_user_id}
                              roles={roles}
                              users={users}
                              onChange={(changes) => patch(w.permission_code, changes)}
                              prefix="level2"
                            />
                            <button
                              onClick={() => patch(w.permission_code, { level2_enabled: false, level2_role_id: null, level2_user_id: null })}
                              className="text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                            >
                              Remove second level
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApproverPicker({ label, type, roleId, userId, roles, users, onChange, prefix }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-semibold text-gray-600">{label}</span>
      <div className="flex rounded-lg overflow-hidden border border-gray-200 text-[11px] font-semibold">
        <button
          onClick={() => onChange({ [`${prefix}_type`]: 'role' })}
          className={`px-2.5 py-1 cursor-pointer ${type === 'role' ? 'bg-[#1e40af] text-white' : 'bg-white text-gray-600'}`}
        >
          By role
        </button>
        <button
          onClick={() => onChange({ [`${prefix}_type`]: 'user' })}
          className={`px-2.5 py-1 cursor-pointer border-l border-gray-200 ${type === 'user' ? 'bg-[#1e40af] text-white' : 'bg-white text-gray-600'}`}
        >
          Specific user
        </button>
      </div>
      {type === 'role' ? (
        <select
          value={roleId ?? ''}
          onChange={(e) => onChange({ [`${prefix}_role_id`]: e.target.value ? Number(e.target.value) : null })}
          className="px-2.5 py-1 border border-gray-200 rounded-lg text-[11px] font-semibold"
        >
          <option value="">Select role…</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      ) : (
        <select
          value={userId ?? ''}
          onChange={(e) => onChange({ [`${prefix}_user_id`]: e.target.value ? Number(e.target.value) : null })}
          className="px-2.5 py-1 border border-gray-200 rounded-lg text-[11px] font-semibold"
        >
          <option value="">Select user…</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.username} {u.employee_name ? `(${u.employee_name})` : ''}</option>)}
        </select>
      )}
    </div>
  );
}
