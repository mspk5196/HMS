import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
      className={`relative w-9 h-5 rounded-full shrink-0 transition-colors cursor-pointer ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'}`}
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
        <h2 className="text-sm font-bold text-gray-900 dark:text-slate-100">Approval Workflows</h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
          Enable approval for an action, then assign who must approve it — by role (anyone in that role) or a specific user. Add a second level for two-step approval.
        </p>
      </div>

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      {isLoading ? (
        <div className="p-8 text-center text-xs text-gray-400 dark:text-slate-500">Loading…</div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byModule).map(([moduleName, rows]) => (
            <div key={moduleName} className="border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
              <div className="bg-gray-50 dark:bg-slate-800/80 px-3 py-1.5 text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider border-b border-gray-100 dark:border-slate-800">{moduleName}</div>
              <div className="divide-y divide-gray-100 dark:divide-slate-800/60">
                {rows.map((w) => {
                  const isEnabled = Boolean(w.enabled);
                  const isLevel2 = Boolean(w.level2_enabled);
                  return (
                    <div key={w.permission_code} className={`p-3.5 transition-colors ${isEnabled ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''}`}>
                      <div className="flex items-center gap-3">
                        <Toggle checked={isEnabled} onChange={(v) => setEnabled(w, v)} />
                        <span className="text-xs font-bold text-gray-900 dark:text-slate-100 flex-1">{w.permission_description}</span>
                        {isEnabled ? (
                          <button
                            onClick={() => save(w)}
                            disabled={savingCode === w.permission_code}
                            className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-[11px] font-semibold px-3.5 py-1.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
                          >
                            {savingCode === w.permission_code ? 'Saving…' : 'Save'}
                          </button>
                        ) : null}
                      </div>

                      {isEnabled ? (
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

                          {!isLevel2 ? (
                            <button
                              onClick={() => patch(w.permission_code, { level2_enabled: true })}
                              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer border border-dashed border-blue-300 dark:border-blue-700/60 rounded-lg px-2.5 py-1"
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
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select option…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matching options',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const target = (o.searchTerms || `${o.label} ${o.sublabel || ''} ${o.badge || ''}`).toLowerCase();
      return target.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 border rounded-lg text-[11px] font-semibold transition-all cursor-pointer min-w-[210px] max-w-[320px] text-left ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100'
            : selectedOption
            ? 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 hover:border-gray-400'
            : 'border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-800/50 text-gray-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:border-gray-400'
        }`}
      >
        <span className="truncate flex-1">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedOption && (
            <span
              role="button"
              tabIndex={0}
              title="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="text-gray-400 hover:text-rose-500 p-0.5 rounded cursor-pointer transition-colors text-[10px]"
            >
              ✕
            </span>
          )}
          <span className="text-gray-400 text-[9px]">▼</span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-80 max-w-[90vw] bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 z-50 overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/50">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-gray-50 dark:divide-slate-800/40">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-slate-500">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold'
                        : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{opt.label}</span>
                        {opt.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 font-bold shrink-0">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.sublabel && (
                        <p className="text-[11px] text-gray-400 dark:text-slate-500 truncate mt-0.5 font-normal">
                          {opt.sublabel}
                        </p>
                      )}
                    </div>
                    {isSelected && <span className="text-blue-600 dark:text-blue-400 text-xs font-bold shrink-0">✓</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ApproverPicker({ label, type, roleId, userId, roles, users, onChange, prefix }) {
  const roleOptions = useMemo(() => {
    return (roles || []).map((r) => ({
      value: r.id,
      label: r.name,
      sublabel: r.description || (r.staff_role_id ? 'Staff RBAC Role' : 'System Governance Role'),
      badge: r.department_name || (r.can_access_settings ? 'Settings' : 'Governance'),
      searchTerms: `${r.name} ${r.description || ''} ${r.department_name || ''}`.toLowerCase(),
    }));
  }, [roles]);

  const userOptions = useMemo(() => {
    return (users || []).map((u) => {
      const displayName = u.employee_name || u.username;
      const details = [
        u.employee_code,
        u.username !== displayName ? `@${u.username}` : null,
        u.department_name,
      ].filter(Boolean).join(' • ');

      return {
        value: u.id,
        label: displayName,
        sublabel: details || u.email || 'User',
        badge: u.role_name || 'Staff',
        searchTerms: `${displayName} ${u.username || ''} ${u.employee_code || ''} ${u.email || ''} ${u.role_name || ''} ${u.department_name || ''}`.toLowerCase(),
      };
    });
  }, [users]);

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <span className="text-[11px] font-semibold text-gray-600 dark:text-slate-300 min-w-[140px]">{label}</span>
      <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 text-[11px] font-semibold shadow-2xs">
        <button
          type="button"
          onClick={() => onChange({ [`${prefix}_type`]: 'role' })}
          className={`px-2.5 py-1.5 cursor-pointer transition-colors ${type === 'role' ? 'bg-[#1e40af] text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50'}`}
        >
          By role
        </button>
        <button
          type="button"
          onClick={() => onChange({ [`${prefix}_type`]: 'user' })}
          className={`px-2.5 py-1.5 cursor-pointer border-l border-gray-200 dark:border-slate-700 transition-colors ${type === 'user' ? 'bg-[#1e40af] text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50'}`}
        >
          Specific user
        </button>
      </div>

      {type === 'role' ? (
        <SearchableSelect
          value={roleId}
          onChange={(val) => onChange({ [`${prefix}_role_id`]: val })}
          options={roleOptions}
          placeholder="Search & select RBAC role…"
          searchPlaceholder="Type role name or department…"
          emptyMessage="No matching RBAC roles"
        />
      ) : (
        <SearchableSelect
          value={userId}
          onChange={(val) => onChange({ [`${prefix}_user_id`]: val })}
          options={userOptions}
          placeholder="Search & select employee / user…"
          searchPlaceholder="Type employee name, code, or user…"
          emptyMessage="No matching employees or users"
        />
      )}
    </div>
  );
}

