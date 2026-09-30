import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../util/api';
import { BoltIcon, CheckIcon } from '../../../components/Icons';

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
  const [selectedIds, setSelectedIds] = useState([]); // ordered array — first is the "baseline" role
  const [matrix, setMatrix] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3500); };
  const fail = (err, fallback) => setErrorMsg(err?.message || fallback);

  const loadBase = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const [r, c] = await Promise.all([apiFetch('/rbac/roles'), apiFetch('/rbac/catalog')]);
      setRoles(r);
      setOrderedRoles(r);
      setCatalog(c);
      setSelectedIds((prev) => (prev.length ? prev : (r.length ? [r[0].id] : [])));
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

  // The matrix shown/edited is always the baseline (first selected) role's
  // current state — Save then applies those edits to every selected role.
  useEffect(() => { loadMatrix(selectedIds[0]); }, [selectedIds[0], loadMatrix]); // eslint-disable-line react-hooks/exhaustive-deps

  const [prioritySearch, setPrioritySearch] = useState('');
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);

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
      const [dragged] = next.splice(draggedIdx, 1);
      next.splice(targetIdx, 0, dragged);
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
      flash('Priority order saved successfully.');
      await loadBase();
    } catch (err) {
      fail(err, 'Failed to save priority order.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRoleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectDepartmentGroup = (ids) => {
    setSelectedIds((prev) => {
      const allIn = ids.every((id) => prev.includes(id));
      if (allIn) return prev.filter((id) => !ids.includes(id));
      return Array.from(new Set([...prev, ...ids]));
    });
  };

  const toggleGrant = (code) => {
    setMatrix((prev) => {
      const cur = prev[code] || { granted: false, skip_approval: false };
      const granted = !cur.granted;
      return { ...prev, [code]: { granted, skip_approval: granted ? cur.skip_approval : false } };
    });
  };

  const toggleSkip = (code) => {
    setMatrix((prev) => {
      const cur = prev[code];
      if (!cur?.granted) return prev;
      return { ...prev, [code]: { ...cur, skip_approval: !cur.skip_approval } };
    });
  };

  const selectAllSkipApproval = () => {
    setMatrix((prev) => {
      const allCodes = catalog.flatMap((m) => m.actions.map((a) => a.code));
      const allSkipped = allCodes.every((c) => prev[c]?.granted && prev[c]?.skip_approval);
      const next = {};
      for (const code of allCodes) {
        next[code] = { granted: true, skip_approval: !allSkipped };
      }
      return next;
    });
  };

  const saveMatrix = async () => {
    if (!selectedIds.length) return;
    try {
      setIsSaving(true);
      const entries = catalog.flatMap((m) => m.actions.map((a) => ({
        code: a.code,
        granted: !!matrix[a.code]?.granted,
        skip_approval: !!matrix[a.code]?.skip_approval,
      })));
      await apiFetch('/rbac/roles/matrix/bulk', {
        method: 'PUT',
        body: JSON.stringify({ roleIds: selectedIds, entries }),
      });
      flash(selectedIds.length > 1 ? `Permissions saved for ${selectedIds.length} roles.` : 'Permissions saved.');
    } catch (err) {
      fail(err, 'Failed to save permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  const allCodes = catalog.flatMap((m) => m.actions.map((a) => a.code));
  const allSkipChecked = allCodes.length > 0 && allCodes.every((c) => matrix[c]?.granted && matrix[c]?.skip_approval);

  const grouped = roles.reduce((groups, r) => {
    const key = r.department_name || 'General';
    (groups[key] = groups[key] || []).push(r);
    return groups;
  }, {});
  const selectedNames = roles.filter((r) => selectedIds.includes(r.id)).map((r) => r.name);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Role Permissions</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Roles are the job roles configured under Department &amp; Role. Set what each can do and which skip approval workflows — all in one table.
        </p>
      </div>

      <Banner msg={successMsg} tone="success" />
      <Banner msg={errorMsg} tone="error" />

      {/* Priority Order (Collapsible & Searchable with Drag-Drop & Direct Jump) */}
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
            {/* Search and Quick Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <input
                  type="text"
                  value={prioritySearch}
                  onChange={(e) => setPrioritySearch(e.target.value)}
                  placeholder="Search role or department in priority list…"
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

              <div className="flex items-center gap-2">
                <button
                  onClick={savePriority}
                  disabled={isSaving}
                  className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-4 py-1.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSaving ? 'Saving…' : 'Save Priority Order'}
                </button>
              </div>
            </div>

            {/* Reorderable List */}
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {orderedRoles
                .map((r, actualIdx) => ({ r, actualIdx }))
                .filter(({ r }) => {
                  if (!prioritySearch.trim()) return true;
                  const q = prioritySearch.toLowerCase().trim();
                  return (
                    (r.name || '').toLowerCase().includes(q) ||
                    (r.department_name || '').toLowerCase().includes(q) ||
                    (r.description || '').toLowerCase().includes(q)
                  );
                })
                .map(({ r, actualIdx }) => {
                  const isDragging = draggedIdx === actualIdx;
                  return (
                    <div
                      key={r.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, actualIdx)}
                      onDragOver={(e) => handleDragOver(e, actualIdx)}
                      onDrop={(e) => handleDrop(e, actualIdx)}
                      className={`flex items-center justify-between bg-white border rounded-lg px-3 py-2 transition-all duration-150 ${
                        isDragging
                          ? 'border-blue-500 bg-blue-50/50 shadow-md opacity-60'
                          : 'border-gray-200 hover:border-blue-300 hover:shadow-xs'
                      }`}
                    >
                      {/* Left: Drag Handle, Direct Rank Jump Input, Name, Department */}
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span
                          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700 text-sm select-none p-1"
                          title="Drag to reorder"
                        >
                          ⠿
                        </span>

                        {/* Numeric Rank Input */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-gray-400">#</span>
                          <input
                            type="number"
                            min={1}
                            max={orderedRoles.length}
                            defaultValue={actualIdx + 1}
                            key={`rank-${r.id}-${actualIdx}`}
                            onBlur={(e) => jumpRole(actualIdx, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                jumpRole(actualIdx, e.currentTarget.value);
                                e.currentTarget.blur();
                              }
                            }}
                            className="w-11 px-1.5 py-0.5 text-center text-xs font-bold text-blue-700 bg-blue-50/80 border border-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            title="Type rank number and press Enter to jump position"
                          />
                        </div>

                        <span className="text-xs font-bold text-gray-900 truncate">{r.name}</span>

                        {r.department_name && (
                          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 shrink-0">
                            {r.department_name}
                          </span>
                        )}

                        {r.description && (
                          <span className="text-[11px] text-gray-400 truncate hidden md:inline">
                            {r.description}
                          </span>
                        )}
                      </div>

                      {/* Right: Quick Navigation Jump Buttons */}
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {/* Jump to Top */}
                        <button
                          type="button"
                          onClick={() => moveToTop(actualIdx)}
                          disabled={actualIdx === 0}
                          className="px-1.5 py-1 text-[10px] font-bold text-gray-600 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded border border-gray-200 disabled:opacity-25 cursor-pointer"
                          title="Jump to Top (#1)"
                        >
                          ⏫ Top
                        </button>

                        {/* Move Up */}
                        <button
                          type="button"
                          onClick={() => moveRole(actualIdx, -1)}
                          disabled={actualIdx === 0}
                          className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-600 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded border border-gray-200 disabled:opacity-25 cursor-pointer"
                          title="Move up 1 position"
                        >
                          ▲
                        </button>

                        {/* Move Down */}
                        <button
                          type="button"
                          onClick={() => moveRole(actualIdx, 1)}
                          disabled={actualIdx === orderedRoles.length - 1}
                          className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-600 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded border border-gray-200 disabled:opacity-25 cursor-pointer"
                          title="Move down 1 position"
                        >
                          ▼
                        </button>

                        {/* Jump to Bottom */}
                        <button
                          type="button"
                          onClick={() => moveToBottom(actualIdx)}
                          disabled={actualIdx === orderedRoles.length - 1}
                          className="px-1.5 py-1 text-[10px] font-bold text-gray-600 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded border border-gray-200 disabled:opacity-25 cursor-pointer"
                          title="Jump to Bottom (Last rank)"
                        >
                          ⏬ Bottom
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200/80 text-[11px] text-gray-500">
              <span>💡 Tip: Grab ⠿ to drag &amp; drop, or type rank number directly into any box.</span>
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

      {/* Configure Role(s) — multi-select grouped by department */}
      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Configure Role(s)</h3>
          <p className="text-[11px] text-gray-500">
            Select one or more roles. The form below edits the first selected role's permissions — Save applies that exact set to every role checked here.
          </p>
        </div>
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
          {Object.entries(grouped).map(([dept, deptRoles]) => {
            const ids = deptRoles.map((r) => r.id);
            const allIn = ids.every((id) => selectedIds.includes(id));
            return (
              <div key={dept} className="p-2.5">
                <div className="flex items-center justify-between px-1.5 pb-1.5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{dept}</span>
                  <button
                    onClick={() => selectDepartmentGroup(ids)}
                    className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    {allIn ? 'Unselect all' : 'Select all'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {deptRoles.map((r) => {
                    const isSelected = selectedIds.includes(r.id);
                    const isBaseline = selectedIds[0] === r.id;
                    return (
                      <label
                        key={r.id}
                        className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border cursor-pointer flex items-center gap-1.5 ${
                          isSelected ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600'
                        }`}
                        title={isBaseline ? 'Baseline role — its current permissions are shown below' : undefined}
                      >
                        <input type="checkbox" checked={isSelected} onChange={() => toggleRoleSelected(r.id)} className="w-3.5 h-3.5" />
                        {r.name}
                        {isBaseline && <span className="text-[9px] text-blue-500">(baseline)</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {selectedIds.length > 0 && (
          <div className="text-[11px] text-gray-500">
            Editing based on <span className="font-semibold text-gray-700">{selectedNames[0]}</span>
            {selectedIds.length > 1 && <> — will also apply to <span className="font-semibold text-gray-700">{selectedNames.slice(1).join(', ')}</span></>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-600 rounded-sm inline-block" /> Permission — role can perform this action</span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-amber-400 rounded-sm inline-block" />
          <BoltIcon className="w-3.5 h-3.5 text-amber-500" />
          <span>Skip Approval — bypasses approval workflow for this action</span>
        </span>
      </div>

      {selectedIds.length > 0 && (
        <button
          onClick={selectAllSkipApproval}
          className="w-full text-left bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800 cursor-pointer hover:bg-amber-100 transition-colors"
        >
          <span className="font-bold flex items-center gap-2">
            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${allSkipChecked ? 'bg-amber-500 border-amber-500 text-white' : 'border-amber-400 bg-white'}`}>
              {allSkipChecked && <CheckIcon className="w-3 h-3 text-white" />}
            </span>
            <BoltIcon className="w-3.5 h-3.5 text-amber-500" />
            <span>Select All — Skip Approval for every action</span>
          </span>
          <div className="text-[11px] mt-0.5">When fully checked, the selected role(s) bypass all approval workflows globally regardless of what is configured.</div>
        </button>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-xs text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-5">
          {Object.entries(
            catalog.reduce((groups, m) => {
              (groups[m.group] = groups[m.group] || []).push(m);
              return groups;
            }, {})
          ).map(([group, modules]) => (
            <div key={group} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">{group}</div>
              <div className="divide-y divide-gray-100">
                {modules.map((m) => {
                  const standard = STANDARD_ORDER
                    .map((code) => m.actions.find((a) => a.action_code === code))
                    .filter(Boolean);
                  const specials = m.actions.filter((a) => a.is_special);
                  return (
                    <div key={m.id} className="p-3 flex flex-wrap items-start gap-x-6 gap-y-3">
                      <span className="text-xs font-bold text-gray-900 w-32 shrink-0 pt-1">{m.name}</span>

                      {standard.length > 0 && (
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                          {standard.map((a) => {
                            const granted = !!matrix[a.code]?.granted;
                            return (
                              <div key={a.code} className="flex flex-col items-start gap-1 w-24">
                                <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
                                  <input type="checkbox" checked={granted} onChange={() => toggleGrant(a.code)} className="w-3.5 h-3.5" />
                                  {STANDARD_LABELS[a.action_code]}
                                </label>
                                {granted && (
                                  <label className="flex items-center gap-1 text-[10px] text-amber-700 cursor-pointer whitespace-nowrap">
                                    <input type="checkbox" checked={!!matrix[a.code]?.skip_approval} onChange={() => toggleSkip(a.code)} className="w-3 h-3 accent-amber-500" />
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
                                  className={`text-[10px] font-semibold px-2 py-1 rounded-full border cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                                    granted ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'
                                  }`}
                                >
                                  <input type="checkbox" checked={granted} onChange={() => toggleGrant(a.code)} className="w-3 h-3" />
                                  {a.action_name}
                                </label>
                                {granted && (
                                  <label className="text-[9px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer flex items-center gap-1 whitespace-nowrap bg-amber-50 border-amber-200 text-amber-700">
                                    <input type="checkbox" checked={!!matrix[a.code]?.skip_approval} onChange={() => toggleSkip(a.code)} className="w-2.5 h-2.5 accent-amber-500" />
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

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <button
          onClick={saveMatrix}
          disabled={isSaving || selectedIds.length === 0}
          className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-6 py-2.5 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : selectedIds.length > 1 ? `Save for ${selectedIds.length} Roles` : 'Save Role Permissions'}
        </button>
      </div>
    </div>
  );
}
