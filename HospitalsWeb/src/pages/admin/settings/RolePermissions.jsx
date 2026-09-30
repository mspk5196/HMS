import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../../util/api';
import {
  BoltIcon,
  CheckIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  XIcon,
  LockIcon,
  UsersIcon,
  AlertTriangleIcon,
} from '../../../components/Icons';

function Banner({ msg, tone }) {
  if (!msg) return null;
  const cls = tone === 'error'
    ? 'bg-rose-50 border-red-200 text-rose-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`text-xs font-medium px-4 py-2.5 rounded-lg border ${cls}`}>{msg}</div>;
}

const STANDARD_ORDER = ['view', 'create', 'edit', 'delete'];
const STANDARD_LABELS = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete' };

export default function RolePermissions() {
  const [roles, setRoles] = useState([]);
  const [orderedRoles, setOrderedRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [activeRoleId, setActiveRoleId] = useState(null);
  const [matrix, setMatrix] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editRoleTarget, setEditRoleTarget] = useState(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);

  // Priority Manager
  const [prioritySearch, setPrioritySearch] = useState('');
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3500); };
  const fail = (err, fallback) => { setErrorMsg(err?.message || fallback); setTimeout(() => setErrorMsg(''), 5000); };

  const loadBase = useCallback(async (preferredRoleId = null) => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const [r, c] = await Promise.all([apiFetch('/rbac/roles'), apiFetch('/rbac/catalog')]);
      setRoles(r);
      setOrderedRoles(r);
      setCatalog(c);

      setActiveRoleId((prev) => {
        if (preferredRoleId && r.some((role) => role.id === preferredRoleId)) {
          return preferredRoleId;
        }
        if (prev && r.some((role) => role.id === prev)) {
          return prev;
        }
        return r.length ? r[0].id : null;
      });
    } catch (err) {
      fail(err, 'Failed to load roles/catalog.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadBase(); }, [loadBase]);

  const loadMatrix = useCallback(async (roleId) => {
    if (!roleId) { setMatrix({}); return; }
    try {
      setIsLoading(true);
      const m = await apiFetch(`/rbac/roles/${roleId}/matrix`);
      setMatrix(m);
    } catch (err) {
      fail(err, 'Failed to load permission matrix.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeRoleId) loadMatrix(activeRoleId);
  }, [activeRoleId, loadMatrix]);

  const activeRole = useMemo(() => {
    return roles.find((r) => r.id === activeRoleId) || roles[0] || null;
  }, [roles, activeRoleId]);

  /* ─── Priority Hierarchy Actions ─── */
  const moveRole = (idx, dir) => {
    setOrderedRoles((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const jumpRole = (fromIdx, toRank) => {
    const targetRank = Math.max(1, Math.min(orderedRoles.length, parseInt(toRank, 10) || 1));
    const targetIdx = targetRank - 1;
    if (fromIdx === targetIdx) return;
    setOrderedRoles((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(targetIdx, 0, removed);
      return next;
    });
  };

  const moveToTop = (idx) => {
    if (idx === 0) return;
    setOrderedRoles((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.unshift(item);
      return next;
    });
  };

  const moveToBottom = (idx) => {
    if (idx === orderedRoles.length - 1) return;
    setOrderedRoles((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.push(item);
      return next;
    });
  };

  const handleDragStart = (e, idx) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;
    setOrderedRoles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggedIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    setDraggedIdx(null);
  };

  const savePriority = async () => {
    try {
      setIsSaving(true);
      await apiFetch('/rbac/roles/priority', {
        method: 'PATCH',
        body: JSON.stringify({ orderedIds: orderedRoles.map((r) => r.id) }),
      });
      flash('Role priority order updated successfully.');
      await loadBase(activeRoleId);
      setIsPriorityOpen(false);
    } catch (err) {
      fail(err, 'Failed to save priority order.');
    } finally {
      setIsSaving(false);
    }
  };

  /* ─── Permission Matrix Toggles ─── */
  const toggleGrant = (code) => {
    setMatrix((prev) => {
      const curr = prev[code] || {};
      const nextGranted = !curr.granted;
      return {
        ...prev,
        [code]: {
          granted: nextGranted,
          skip_approval: nextGranted ? !!curr.skip_approval : false,
        },
      };
    });
  };

  const toggleSkip = (code) => {
    setMatrix((prev) => {
      const curr = prev[code] || {};
      return {
        ...prev,
        [code]: {
          granted: true,
          skip_approval: !curr.skip_approval,
        },
      };
    });
  };

  const allCodes = catalog.flatMap((m) => m.actions.map((a) => a.code));
  const allSkipChecked = allCodes.length > 0 && allCodes.every((c) => matrix[c]?.granted && matrix[c]?.skip_approval);

  const selectAllSkipApproval = () => {
    setMatrix((prev) => {
      const next = { ...prev };
      const targetState = !allSkipChecked;
      for (const code of allCodes) {
        next[code] = { granted: true, skip_approval: targetState };
      }
      return next;
    });
  };

  const saveMatrix = async () => {
    if (!activeRoleId) return;
    try {
      setIsSaving(true);
      const entries = catalog.flatMap((m) => m.actions.map((a) => ({
        code: a.code,
        granted: !!matrix[a.code]?.granted,
        skip_approval: !!matrix[a.code]?.skip_approval,
      })));
      await apiFetch(`/rbac/roles/${activeRoleId}/matrix`, {
        method: 'PUT',
        body: JSON.stringify({ entries }),
      });
      flash(`Permissions saved for "${activeRole?.name}".`);
    } catch (err) {
      fail(err, 'Failed to save permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Add Role Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Role Permissions Matrix</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure fine-grained software capabilities and approval skip privileges for each RBAC security role.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm cursor-pointer transition-all"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add New RBAC Role</span>
        </button>
      </div>

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      {/* Priority Order (Collapsible with Drag-Drop & Direct Jump) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div
          onClick={() => setIsPriorityOpen(!isPriorityOpen)}
          className="p-4 bg-gray-50/80 hover:bg-gray-100/80 transition-colors flex items-center justify-between cursor-pointer border-b border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center font-bold text-xs">
              ↕
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">Role Priority Hierarchy</h3>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                  {orderedRoles.length} Roles
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Higher rank (#1 = highest) determines authority in approvals and permission cascades. Drag rows, type rank directly, or use quick jump buttons.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600">
              {isPriorityOpen ? 'Collapse' : 'Configure Order'}
            </span>
            <span className="text-gray-400 text-xs">{isPriorityOpen ? '▲' : '▼'}</span>
          </div>
        </div>

        {isPriorityOpen && (
          <div className="p-4 space-y-3 bg-gray-50/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <input
                  type="text"
                  value={prioritySearch}
                  onChange={(e) => setPrioritySearch(e.target.value)}
                  placeholder="Search role in priority list…"
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
                {prioritySearch && (
                  <button
                    onClick={() => setPrioritySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-500">
                Showing {orderedRoles.filter((r) => r.name.toLowerCase().includes(prioritySearch.toLowerCase())).length} of {orderedRoles.length} roles
              </span>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {orderedRoles
                .map((r, actualIdx) => ({ r, actualIdx }))
                .filter(({ r }) => !prioritySearch || r.name.toLowerCase().includes(prioritySearch.toLowerCase()))
                .map(({ r, actualIdx }) => {
                  const currentRank = actualIdx + 1;
                  const isTop = actualIdx === 0;
                  return (
                    <div
                      key={r.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, actualIdx)}
                      onDragOver={(e) => handleDragOver(e, actualIdx)}
                      onDrop={(e) => handleDrop(e, actualIdx)}
                      className={`flex items-center justify-between px-3 py-2 bg-white rounded-lg border transition-all ${
                        isTop ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="cursor-grab text-gray-400 hover:text-gray-600 text-sm select-none" title="Drag to reorder">
                          ⠿
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max={orderedRoles.length}
                            value={currentRank}
                            onChange={(e) => jumpRole(actualIdx, e.target.value)}
                            className="w-10 text-center font-bold text-xs py-0.5 border border-gray-300 rounded bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            title="Type rank number directly to jump"
                          />
                          {isTop && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                              Highest #1
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-gray-800">{r.name}</span>
                        {r.user_count !== undefined && (
                          <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded">
                            {r.user_count} users
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveToTop(actualIdx)}
                          disabled={actualIdx === 0}
                          className="px-1.5 py-1 text-[10px] font-bold text-gray-600 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded border border-gray-200 disabled:opacity-25 cursor-pointer"
                          title="Jump to Top (#1 rank)"
                        >
                          Top
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRole(actualIdx, -1)}
                          disabled={actualIdx === 0}
                          className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-600 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded border border-gray-200 disabled:opacity-25 cursor-pointer"
                          title="Move up 1 position"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRole(actualIdx, 1)}
                          disabled={actualIdx === orderedRoles.length - 1}
                          className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-600 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded border border-gray-200 disabled:opacity-25 cursor-pointer"
                          title="Move down 1 position"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => moveToBottom(actualIdx)}
                          disabled={actualIdx === orderedRoles.length - 1}
                          className="px-1.5 py-1 text-[10px] font-bold text-gray-600 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded border border-gray-200 disabled:opacity-25 cursor-pointer"
                          title="Jump to Bottom (Last rank)"
                        >
                          Bottom
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200/80 text-[11px] text-gray-500">
              <span>💡 Tip: Drag ⠿ to reorder, or type rank number directly into any box.</span>
              <button
                onClick={savePriority}
                disabled={isSaving}
                className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save Priority Order'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Role Selection Strip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
            Select Active RBAC Role ({roles.length})
          </label>
          <span className="text-[11px] text-gray-500">Click a role to view &amp; edit its permissions</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => {
            const isActive = r.id === activeRoleId;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveRoleId(r.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  isActive
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm ring-2 ring-blue-500/10'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span>{r.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  #{r.priority || '—'}
                </span>
                {r.user_count > 0 && (
                  <span className="text-[10px] text-gray-400 font-normal">
                    ({r.user_count})
                  </span>
                )}
                {!!r.can_access_settings && (
                  <LockIcon className="w-3 h-3 text-amber-500" title="Has Settings Access" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Role Control Banner */}
      {activeRole && (
        <div className="bg-gradient-to-r from-blue-50/80 via-white to-gray-50 border border-blue-200/70 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Editing Permissions For:</span>
              <h3 className="text-sm font-extrabold text-gray-900">{activeRole.name}</h3>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                Rank #{activeRole.priority}
              </span>
              <span className="text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                <UsersIcon className="w-3 h-3 text-gray-500" />
                <span>{activeRole.user_count || 0} Assigned User(s)</span>
              </span>
              {!!activeRole.can_access_settings && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <LockIcon className="w-3 h-3 text-amber-600" />
                  <span>Settings Access</span>
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600">
              {activeRole.description || 'No description configured for this role.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCopyModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg cursor-pointer shadow-2xs"
            >
              <span>📋</span>
              <span>Copy From Another Role</span>
            </button>
            {activeRole.id !== 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setEditRoleTarget(activeRole)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg cursor-pointer shadow-2xs"
                >
                  <EditIcon className="w-3.5 h-3.5 text-gray-500" />
                  <span>Edit Role</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteRoleTarget(activeRole)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg cursor-pointer"
                >
                  <TrashIcon className="w-3.5 h-3.5 text-rose-500" />
                  <span>Delete Role</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Legend & Skip All Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-blue-600 rounded-sm inline-block" />
            <span className="font-semibold text-gray-700">Granted:</span> Role can execute this action
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-amber-400 rounded-sm inline-block" />
            <BoltIcon className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-semibold text-gray-700">Skip Approval:</span> Direct execution without workflow sign-off
          </span>
        </div>

        <button
          onClick={selectAllSkipApproval}
          className="text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-100/70 hover:bg-amber-100 px-2.5 py-1 rounded border border-amber-300 flex items-center gap-1.5 cursor-pointer"
        >
          <BoltIcon className="w-3.5 h-3.5 text-amber-600" />
          <span>{allSkipChecked ? 'Uncheck All Approval Skips' : 'Grant All Approval Skips'}</span>
        </button>
      </div>

      {/* Permission Matrix Catalog */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-gray-400 font-medium">Loading permission matrix…</div>
      ) : (
        <div className="space-y-5">
          {Object.entries(
            catalog.reduce((groups, m) => {
              (groups[m.group] = groups[m.group] || []).push(m);
              return groups;
            }, {})
          ).map(([group, modules]) => (
            <div key={group} className="border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              <div className="bg-gray-50/90 px-4 py-2 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                {group}
              </div>
              <div className="divide-y divide-gray-100 bg-white">
                {modules.map((m) => {
                  const standard = STANDARD_ORDER
                    .map((code) => m.actions.find((a) => a.action_code === code))
                    .filter(Boolean);
                  const specials = m.actions.filter((a) => a.is_special);
                  return (
                    <div key={m.id} className="p-3.5 flex flex-wrap items-start gap-x-6 gap-y-3 hover:bg-gray-50/40 transition-colors">
                      <span className="text-xs font-bold text-gray-900 w-36 shrink-0 pt-0.5">{m.name}</span>

                      {standard.length > 0 && (
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                          {standard.map((a) => {
                            const granted = !!matrix[a.code]?.granted;
                            return (
                              <div key={a.code} className="flex flex-col items-start gap-1 w-24">
                                <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={granted}
                                    onChange={() => toggleGrant(a.code)}
                                    className="w-3.5 h-3.5 rounded text-blue-600"
                                  />
                                  {STANDARD_LABELS[a.action_code]}
                                </label>
                                {granted && (
                                  <label className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 cursor-pointer whitespace-nowrap bg-amber-50 px-1 py-0.2 rounded border border-amber-200/60">
                                    <input
                                      type="checkbox"
                                      checked={!!matrix[a.code]?.skip_approval}
                                      onChange={() => toggleSkip(a.code)}
                                      className="w-3 h-3 accent-amber-500 rounded"
                                    />
                                    <BoltIcon className="w-3 h-3 text-amber-500 shrink-0" />
                                    <span>Skip</span>
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {specials.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {specials.map((a) => {
                            const granted = !!matrix[a.code]?.granted;
                            return (
                              <div key={a.code} className="flex flex-col items-start gap-1">
                                <label
                                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border cursor-pointer flex items-center gap-1.5 whitespace-nowrap transition-all ${
                                    granted ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={granted}
                                    onChange={() => toggleGrant(a.code)}
                                    className="w-3 h-3 rounded text-blue-600"
                                  />
                                  {a.action_name}
                                </label>
                                {granted && (
                                  <label className="text-[9px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer flex items-center gap-1 whitespace-nowrap bg-amber-50 border-amber-200 text-amber-700">
                                    <input
                                      type="checkbox"
                                      checked={!!matrix[a.code]?.skip_approval}
                                      onChange={() => toggleSkip(a.code)}
                                      className="w-2.5 h-2.5 accent-amber-500 rounded"
                                    />
                                    <BoltIcon className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                    <span>Skip</span>
                                  </label>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating or Fixed Save Button */}
      <div className="sticky bottom-4 bg-white/95 backdrop-blur-xs border border-gray-200 rounded-xl p-3.5 shadow-lg flex items-center justify-between">
        <div className="text-xs text-gray-600">
          Ready to apply changes to <span className="font-bold text-gray-900">{activeRole?.name}</span>?
        </div>
        <button
          onClick={saveMatrix}
          disabled={isSaving || !activeRoleId}
          className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-6 py-2 rounded-lg shadow-sm cursor-pointer disabled:opacity-50 transition-all"
        >
          {isSaving ? 'Saving Permissions…' : `Save Permissions for ${activeRole?.name || 'Role'}`}
        </button>
      </div>

      {/* ─── ADD ROLE MODAL ─── */}
      {showAddModal && (
        <RoleFormModal
          mode="create"
          defaultPriority={roles.length + 1}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newId, msg) => {
            setShowAddModal(false);
            flash(msg);
            loadBase(newId);
          }}
          onError={(err) => fail(err, 'Failed to create role.')}
        />
      )}

      {/* ─── EDIT ROLE MODAL ─── */}
      {editRoleTarget && (
        <RoleFormModal
          mode="edit"
          initialRole={editRoleTarget}
          onClose={() => setEditRoleTarget(null)}
          onSuccess={(id, msg) => {
            setEditRoleTarget(null);
            flash(msg);
            loadBase(id);
          }}
          onError={(err) => fail(err, 'Failed to update role.')}
        />
      )}

      {/* ─── DELETE ROLE MODAL ─── */}
      {deleteRoleTarget && (
        <DeleteRoleModal
          role={deleteRoleTarget}
          onClose={() => setDeleteRoleTarget(null)}
          onSuccess={(msg) => {
            setDeleteRoleTarget(null);
            flash(msg);
            loadBase();
          }}
          onError={(err) => fail(err, 'Failed to delete role.')}
        />
      )}

      {/* ─── COPY PERMISSIONS MODAL ─── */}
      {showCopyModal && (
        <CopyPermissionsModal
          targetRole={activeRole}
          availableRoles={roles.filter((r) => r.id !== activeRoleId)}
          onClose={() => setShowCopyModal(false)}
          onCopy={(sourceMatrix, sourceRoleName) => {
            setMatrix(sourceMatrix);
            setShowCopyModal(false);
            flash(`Permissions copied from "${sourceRoleName}". Click 'Save Permissions' to persist.`);
          }}
          onError={(err) => fail(err, 'Failed to copy permissions.')}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ROLE FORM MODAL (Create & Edit)
═══════════════════════════════════════════════════════════════════════ */

function RoleFormModal({ mode, initialRole, defaultPriority, onClose, onSuccess, onError }) {
  const [name, setName] = useState(initialRole?.name || '');
  const [description, setDescription] = useState(initialRole?.description || '');
  const [priority, setPriority] = useState(initialRole?.priority || defaultPriority || 10);
  const [canAccessSettings, setCanAccessSettings] = useState(!!initialRole?.can_access_settings);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdministrator = initialRole?.id === 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      onError({ message: 'Role name is required.' });
      return;
    }

    try {
      setIsSubmitting(true);
      if (mode === 'create') {
        const res = await apiFetch('/rbac/roles', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            priority: Number(priority) || 10,
            can_access_settings: canAccessSettings,
          }),
        });
        onSuccess(res?.id, `RBAC Role "${name.trim()}" created successfully.`);
      } else {
        await apiFetch(`/rbac/roles/${initialRole.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: isAdministrator ? undefined : name.trim(),
            description: description.trim() || null,
            priority: Number(priority) || 10,
            can_access_settings: canAccessSettings,
          }),
        });
        onSuccess(initialRole.id, `Role "${name.trim()}" updated successfully.`);
      }
    } catch (err) {
      onError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              {mode === 'create' ? <PlusIcon className="w-4 h-4" /> : <EditIcon className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                {mode === 'create' ? 'Create New RBAC Role' : `Edit Role: ${initialRole.name}`}
              </h3>
              <p className="text-[11px] text-gray-500">Security &amp; authorization access profile</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded hover:bg-gray-100">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700">Role Name *</label>
            <input
              type="text"
              required
              disabled={isAdministrator}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Visiting Specialist, Audit Officer"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-gray-100"
            />
            {isAdministrator && (
              <p className="text-[10px] text-amber-600">The Administrator role name is immutable.</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of role responsibilities…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-700">Priority Rank *</label>
              <input
                type="number"
                min="1"
                required
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
              <p className="text-[10px] text-gray-400">#1 is highest authority</p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-gray-700">Settings Access</label>
              <label className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={canAccessSettings}
                  onChange={(e) => setCanAccessSettings(e.target.checked)}
                  disabled={isAdministrator}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span className="text-[11px] font-semibold text-gray-700">Can Access Settings</span>
              </label>
            </div>
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
              {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create Role' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DELETE ROLE MODAL
═══════════════════════════════════════════════════════════════════════ */

function DeleteRoleModal({ role, onClose, onSuccess, onError }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const hasUsers = (role.user_count || 0) > 0;

  const handleDelete = async () => {
    if (hasUsers) return;
    try {
      setIsDeleting(true);
      await apiFetch(`/rbac/roles/${role.id}`, { method: 'DELETE' });
      onSuccess(`Role "${role.name}" was successfully deleted.`);
    } catch (err) {
      onError(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangleIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Delete RBAC Role</h3>
            <p className="text-xs text-gray-500">Confirm role removal</p>
          </div>
        </div>

        {hasUsers ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5">
              <span>⚠️ Cannot Delete Active Role</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Role <span className="font-bold text-gray-900">"{role.name}"</span> currently has{' '}
              <span className="font-bold text-amber-900">{role.user_count} assigned user account(s)</span>.
            </p>
            <p className="text-[11px] text-amber-700">
              Please go to <span className="font-semibold underline">Users &amp; Authentication</span> and reassign those staff members to another role before deleting this role.
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-xs text-gray-600">
            <p>
              Are you sure you want to permanently delete role <span className="font-bold text-gray-900">"{role.name}"</span>?
            </p>
            <p className="text-[11px] text-gray-500">
              All custom permissions configured for this role will be removed. This action cannot be undone.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
          >
            {hasUsers ? 'Close' : 'Cancel'}
          </button>
          {!hasUsers && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {isDeleting ? 'Deleting…' : 'Yes, Delete Role'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   COPY PERMISSIONS MODAL
═══════════════════════════════════════════════════════════════════════ */

function CopyPermissionsModal({ targetRole, availableRoles, onClose, onCopy, onError }) {
  const [sourceRoleId, setSourceRoleId] = useState(availableRoles[0]?.id || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleCopy = async () => {
    if (!sourceRoleId) return;
    try {
      setIsLoading(true);
      const sourceMatrix = await apiFetch(`/rbac/roles/${sourceRoleId}/matrix`);
      const sourceRole = availableRoles.find((r) => r.id === Number(sourceRoleId));
      onCopy(sourceMatrix, sourceRole?.name || 'source role');
    } catch (err) {
      onError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-100">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              📋
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Copy Permissions Template</h3>
              <p className="text-[11px] text-gray-500">Duplicate permissions into "{targetRole.name}"</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded hover:bg-gray-100">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700">Source Template Role *</label>
            <select
              value={sourceRoleId}
              onChange={(e) => setSourceRoleId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              {availableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (Rank #{r.priority})
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg text-xs text-blue-900 space-y-1">
            <div className="font-bold">What happens when you copy:</div>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              All action grants and skip approval flags from the selected source role will be copied onto your active form for{' '}
              <span className="font-bold text-gray-900">"{targetRole.name}"</span>. You can inspect the table and click "Save Permissions" to persist.
            </p>
          </div>
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
            type="button"
            onClick={handleCopy}
            disabled={isLoading || !sourceRoleId}
            className="px-4 py-2 text-xs font-semibold bg-[#1e40af] hover:bg-[#1c399b] text-white rounded-lg cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {isLoading ? 'Copying…' : 'Copy Matrix'}
          </button>
        </div>
      </div>
    </div>
  );
}
