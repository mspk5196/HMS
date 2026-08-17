import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-2.5 rounded-lg border ${cls}`}>{msg}</div>;
}

export default function SettingsAccess() {
  const [roles, setRoles] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000); };

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const rows = await apiFetch('/rbac/settings-access');
      setRoles(rows);
      setSelected(new Set(rows.filter((r) => r.can_access_settings).map((r) => r.id)));
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to load settings access.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    try {
      setIsSaving(true);
      const adminIds = roles.filter((r) => r.name === 'Administrator').map((r) => r.id);
      const roleIds = Array.from(new Set([...selected, ...adminIds]));
      await apiFetch('/rbac/settings-access', {
        method: 'PUT',
        body: JSON.stringify({ roleIds }),
      });
      flash('Settings access saved.');
      await load();
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Settings Page Access</h2>
        <p className="text-xs text-gray-500 mt-0.5">Choose which roles (in addition to Administrator) can open the Settings page. Administrators always have full access regardless of this list.</p>
      </div>

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5 text-[11px] text-blue-800">
        Roles granted here can view all Settings tabs and make changes. Settings does <strong>not</strong> appear in the Role Permissions matrix — access is managed exclusively here.
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-2">
          {roles.map((r) => {
            const isAdmin = r.name === 'Administrator';
            const checked = isAdmin || selected.has(r.id);
            return (
              <label
                key={r.id}
                className={`flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 ${isAdmin ? 'bg-gray-50' : 'hover:bg-gray-50 cursor-pointer'}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isAdmin}
                    onChange={() => toggle(r.id)}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="text-sm font-bold text-gray-900">{r.name}</div>
                    {r.description && <div className="text-[11px] text-gray-400">{r.description}</div>}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${checked ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {checked ? 'Has access' : 'No access'}
                </span>
              </label>
            );
          })}

          <div className="pt-2">
            <button
              onClick={save}
              disabled={isSaving}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-6 py-2.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save Settings Access'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
