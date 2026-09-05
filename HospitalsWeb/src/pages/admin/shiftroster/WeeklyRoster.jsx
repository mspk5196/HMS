import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../../util/api';
import PageHeader from '../../../components/PageHeader';
import ConfigureShiftTimingModal from './ConfigureShiftTimingModal';
import { GearIcon, InfoIcon, AlertTriangleIcon } from '../../../components/Icons';

const DAY_LABELS = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];
const MAX_CONSECUTIVE = 6;

/** Wednesday-based start of the week containing an ISO date. */
const startOfWeek = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
  const daysSinceWed = (dow - 3 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceWed);
  return d.toISOString().slice(0, 10);
};

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const dayNum = (iso) => iso.slice(8, 10);

const monthLabel = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

/** Longest run of consecutive worked days. */
const longestRun = (workedDates) => {
  const sorted = [...new Set(workedDates)].sort();
  let best = 0, run = 0, prev = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
};

export default function WeeklyRoster({ departments = [], onBack }) {
  const today = new Date().toISOString().slice(0, 10);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [grid, setGrid] = useState(null);
  // `${employeeId}|${date}` -> { is_week_off: bool, start_time: 'HH:MM', end_time: 'HH:MM' }
  const [draft, setDraft] = useState({});
  const [swapPick, setSwapPick] = useState(null); // { employeeId, date }

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showTimingModal, setShowTimingModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const rolesForDept = (departments.find((d) => String(d.id) === String(deptFilter))?.roles) || [];

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const params = new URLSearchParams({ weekStart });
      if (deptFilter) params.set('departmentId', deptFilter);
      if (roleFilter) params.set('staffRoleId', roleFilter);

      const data = await apiFetch(`/hr/roster/week?${params.toString()}`);

      // Seed the draft from stored roster entries
      const seeded = {};
      for (const e of data.entries) {
        seeded[`${e.employee_id}|${e.roster_date}`] = {
          is_week_off: Boolean(e.is_week_off),
          start_time: e.custom_start_time ? String(e.custom_start_time).slice(0, 5) : '',
          end_time: e.custom_end_time ? String(e.custom_end_time).slice(0, 5) : '',
          buffer_minutes: e.buffer_minutes ?? 10,
        };
      }
      setGrid(data);
      setDraft(seeded);
      setSwapPick(null);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load the weekly roster.');
      setGrid(null);
    } finally {
      setIsLoading(false);
    }
  }, [weekStart, deptFilter, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const getCell = (employeeId, date) =>
    draft[`${employeeId}|${date}`] || { is_week_off: false, start_time: '', end_time: '', buffer_minutes: 10 };

  const updateCell = (employeeId, date, updates) => {
    setDraft((prev) => {
      const current = prev[`${employeeId}|${date}`] || { is_week_off: false, start_time: '', end_time: '', buffer_minutes: 10 };
      return {
        ...prev,
        [`${employeeId}|${date}`]: { ...current, ...updates },
      };
    });
  };

  /** Fill employee row with standard Day timing (09:00 - 17:00) */
  const fillRowDay = (emp) => {
    if (!grid) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const d of grid.days) {
        const cur = next[`${emp.employee_id}|${d}`];
        if (!cur?.is_week_off) {
          next[`${emp.employee_id}|${d}`] = { is_week_off: false, start_time: '09:00', end_time: '17:00', buffer_minutes: cur?.buffer_minutes ?? 10 };
        }
      }
      return next;
    });
  };

  /** Fill employee row with standard Night timing (20:00 - 08:00) */
  const fillRowNight = (emp) => {
    if (!grid) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const d of grid.days) {
        const cur = next[`${emp.employee_id}|${d}`];
        if (!cur?.is_week_off) {
          next[`${emp.employee_id}|${d}`] = { is_week_off: false, start_time: '20:00', end_time: '08:00', buffer_minutes: cur?.buffer_minutes ?? 10 };
        }
      }
      return next;
    });
  };

  const clearRow = (emp) => {
    if (!grid) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const d of grid.days) {
        next[`${emp.employee_id}|${d}`] = { is_week_off: false, start_time: '', end_time: '', buffer_minutes: 10 };
      }
      return next;
    });
  };

  /** Consecutive-worked-day run per employee */
  const runsByEmployee = useMemo(() => {
    if (!grid) return {};
    const storedWorked = new Set(
      grid.entries
        .filter((e) => !e.is_week_off && e.custom_start_time)
        .map((e) => `${e.employee_id}|${e.roster_date}`)
    );
    const out = {};
    for (const emp of grid.employees) {
      const worked = [];
      for (const d of grid.days) {
        const c = getCell(emp.employee_id, d);
        if (!c.is_week_off && c.start_time && c.end_time) worked.push(d);
      }
      for (const d of [addDays(grid.weekStart, -1), addDays(grid.weekEnd, 1)]) {
        if (storedWorked.has(`${emp.employee_id}|${d}`)) worked.push(d);
      }
      out[emp.employee_id] = longestRun(worked);
    }
    return out;
  }, [grid, draft]);

  const handleSave = async () => {
    if (!grid) return;
    try {
      setIsSaving(true);
      setErrorMsg('');

      const rows = [];
      for (const emp of grid.employees) {
        for (const d of grid.days) {
          const c = getCell(emp.employee_id, d);
          if (c.is_week_off) {
            rows.push({
              employee_id: emp.employee_id,
              roster_date: d,
              is_week_off: true,
              custom_start_time: null,
              custom_end_time: null,
            });
          } else if (c.start_time && c.end_time) {
            rows.push({
              employee_id: emp.employee_id,
              roster_date: d,
              is_week_off: false,
              custom_start_time: c.start_time.length === 5 ? `${c.start_time}:00` : c.start_time,
              custom_end_time: c.end_time.length === 5 ? `${c.end_time}:00` : c.end_time,
              buffer_minutes: c.buffer_minutes !== '' && c.buffer_minutes !== undefined ? Number(c.buffer_minutes) : 10,
            });
          }
        }
      }

      if (!rows.length) {
        setErrorMsg('Nothing to save — assign at least one duty time range or week-off.');
        return;
      }

      const result = await apiFetch('/hr/roster/bulk', {
        method: 'POST',
        body: JSON.stringify({ weekStart: grid.weekStart, rows }),
      });
      flash(`Saved ${result.saved} duty roster entries.`);
      await load();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save duty roster.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwapClick = (employeeId, date) => {
    if (!swapPick) {
      setSwapPick({ employeeId, date });
      return;
    }
    if (swapPick.employeeId === employeeId) { setSwapPick(null); return; }
    if (swapPick.date !== date) {
      setErrorMsg('Swaps only work between two people on the same date.');
      setSwapPick(null);
      return;
    }
    const keyA = `${swapPick.employeeId}|${date}`;
    const keyB = `${employeeId}|${date}`;
    setDraft((prev) => ({
      ...prev,
      [keyA]: prev[keyB] || { is_week_off: false, start_time: '', end_time: '' },
      [keyB]: prev[keyA] || { is_week_off: false, start_time: '', end_time: '' },
    }));
    flash('Cells swapped in draft. Click "Save Week" to commit.');
    setSwapPick(null);
  };

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-4 py-3 rounded-xl shadow-sm">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 border border-red-200 text-rose-700 text-xs font-medium px-4 py-3 rounded-xl shadow-sm">
          {errorMsg}
        </div>
      )}

      <PageHeader
        category="Staff & Salary"
        title="Weekly Duty Roster (Day & Night)"
        subtitle={grid ? (
          <>
            Cycle: <strong>Wednesday to Wednesday</strong> ({monthLabel(grid.weekStart)} – {monthLabel(grid.weekEnd)})
          </>
        ) : null}
        onBack={onBack}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowTimingModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <GearIcon className="w-3.5 h-3.5" />
              <span>Configure Shift Timings</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading || !grid?.employees?.length}
              className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save Duty Roster'}
            </button>
          </>
        }
      />

      {/* Information Banner */}
      <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 text-xs text-blue-800 space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <InfoIcon className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Day &amp; Night Shift Allotment</span>
        </div>
        <p className="text-[11px] text-blue-700 leading-relaxed">
          The weekly duty roster runs on a <strong>Wednesday to Wednesday</strong> cycle exclusively for <strong>Day &amp; Night Shift</strong> staff.
          Enter specific time ranges (e.g. 09:00 – 17:00 or 20:00 – 08:00) or toggle Week Off (WO) for each day.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            ← Prev Week
          </button>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => e.target.value && setWeekStart(startOfWeek(e.target.value))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Next Week →
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(today))}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            This Wednesday
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Dept</span>
          <select
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setRoleFilter(''); }}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-2">Role</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            disabled={!deptFilter}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">All roles</option>
            {rolesForDept.map((r) => <option key={r.id} value={r.id}>{r.roleName}</option>)}
          </select>
        </div>

        {swapPick && (
          <div className="lg:ml-auto text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            Pick a second person on {swapPick.date} to swap duty times ·{' '}
            <button onClick={() => setSwapPick(null)} className="underline cursor-pointer">cancel</button>
          </div>
        )}
      </div>

      {/* Grid Table */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-10 text-center text-xs text-gray-400">Loading duty roster…</div>
      ) : !grid || grid.employees.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-10 text-center text-xs text-gray-500 space-y-2">
          <p className="font-semibold text-gray-700">No Day &amp; Night shift employees found in this department/role.</p>
          <p className="text-gray-400 text-[11px]">Staff with Fixed Day, Fixed Night, or General shift categories are managed with individual timings on the HR &amp; Employees page.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wider text-[10px] sticky left-0 bg-gray-50/80 z-10 min-w-[180px]">
                    Employee
                  </th>
                  {grid.days.map((d, i) => (
                    <th key={d} className="px-2 py-3 font-bold text-gray-500 uppercase tracking-wider text-[10px] text-center min-w-[130px]">
                      <div className="text-blue-700 font-extrabold">{DAY_LABELS[i]}</div>
                      <div className="text-gray-400 font-semibold">{dayNum(d)}</div>
                    </th>
                  ))}
                  <th className="px-3 py-3 font-bold text-gray-500 uppercase tracking-wider text-[10px] text-center min-w-[90px]">
                    Week-offs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {grid.employees.map((emp) => {
                  const run = runsByEmployee[emp.employee_id] ?? 0;
                  const overLimit = run > MAX_CONSECUTIVE;
                  const weekOffsInDraft = grid.days.filter(
                    (d) => getCell(emp.employee_id, d).is_week_off
                  ).length;

                  return (
                    <tr key={emp.employee_id} className={overLimit ? 'bg-rose-50/40' : 'hover:bg-gray-50/60'}>
                      <td className="px-4 py-3 sticky left-0 bg-inherit z-10">
                        <div className="font-bold text-gray-900">{emp.full_name}</div>
                        <div className="text-[10px] text-gray-400">
                          {emp.employee_code} · {emp.role_name || '—'}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <button
                            type="button"
                            onClick={() => fillRowDay(emp)}
                            className="text-[9px] font-semibold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-100 cursor-pointer"
                          >
                            Fill Day
                          </button>
                          <button
                            type="button"
                            onClick={() => fillRowNight(emp)}
                            className="text-[9px] font-semibold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded hover:bg-indigo-100 cursor-pointer"
                          >
                            Fill Night
                          </button>
                          <button
                            type="button"
                            onClick={() => clearRow(emp)}
                            className="text-[9px] font-semibold text-gray-400 hover:text-gray-700 underline cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                        {overLimit && (
                          <div className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                            <AlertTriangleIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{run} consecutive days (max is {MAX_CONSECUTIVE})</span>
                          </div>
                        )}
                      </td>

                      {grid.days.map((d) => {
                        const cell = getCell(emp.employee_id, d);
                        const isPicked = swapPick && swapPick.employeeId === emp.employee_id && swapPick.date === d;

                        return (
                          <td key={d} className="px-1.5 py-2 align-top">
                            <div className={`p-1.5 rounded-lg border text-center transition-colors ${
                              cell.is_week_off
                                ? 'bg-amber-50/70 border-amber-200'
                                : cell.start_time && cell.end_time
                                  ? 'bg-blue-50/50 border-blue-200'
                                  : 'bg-white border-gray-200'
                            }`}>
                              {cell.is_week_off ? (
                                <div className="space-y-1 py-1">
                                  <span className="inline-block font-extrabold text-[10px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                                    WEEK OFF
                                  </span>
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => updateCell(emp.employee_id, d, { is_week_off: false, start_time: '09:00', end_time: '17:00' })}
                                      className="text-[9px] font-semibold text-blue-600 hover:underline cursor-pointer"
                                    >
                                      Assign Hours
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="time"
                                      value={cell.start_time || ''}
                                      onChange={(e) => updateCell(emp.employee_id, d, { start_time: e.target.value })}
                                      className="w-full text-[10px] font-bold p-0.5 border border-gray-200 rounded text-center bg-white"
                                      placeholder="Start"
                                    />
                                    <span className="text-[10px] text-gray-400">–</span>
                                    <input
                                      type="time"
                                      value={cell.end_time || ''}
                                      onChange={(e) => updateCell(emp.employee_id, d, { end_time: e.target.value })}
                                      className="w-full text-[10px] font-bold p-0.5 border border-gray-200 rounded text-center bg-white"
                                      placeholder="End"
                                    />
                                  </div>

                                  <div className="flex items-center justify-between text-[9px] text-gray-500 bg-gray-50 px-1 py-0.5 rounded border border-gray-100">
                                    <span title="Allowed late arrival grace in minutes">Buf:</span>
                                    <div className="flex items-center gap-0.5">
                                      <input
                                        type="number"
                                        min="0"
                                        max="60"
                                        value={cell.buffer_minutes ?? 10}
                                        onChange={(e) => updateCell(emp.employee_id, d, { buffer_minutes: e.target.value })}
                                        className="w-7 text-[9px] font-bold p-0 border border-gray-200 rounded text-center bg-white text-gray-800"
                                        placeholder="10"
                                        title="Buffer / Grace minutes"
                                      />
                                      <span className="text-[8px] text-gray-400">m</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between pt-0.5">
                                    <div className="flex gap-0.5">
                                      <button
                                        type="button"
                                        onClick={() => updateCell(emp.employee_id, d, { start_time: '09:00', end_time: '17:00', buffer_minutes: cell.buffer_minutes ?? 10 })}
                                        className="text-[8px] font-bold px-1 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                                        title="Preset Day 09:00 - 17:00"
                                      >
                                        D
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateCell(emp.employee_id, d, { start_time: '20:00', end_time: '08:00', buffer_minutes: cell.buffer_minutes ?? 10 })}
                                        className="text-[8px] font-bold px-1 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                                        title="Preset Night 20:00 - 08:00"
                                      >
                                        N
                                      </button>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => updateCell(emp.employee_id, d, { is_week_off: true, start_time: '', end_time: '' })}
                                      className="text-[8px] font-bold px-1 py-0.5 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded cursor-pointer"
                                      title="Mark Week Off"
                                    >
                                      WO
                                    </button>
                                  </div>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => handleSwapClick(emp.employee_id, d)}
                                disabled={isSaving}
                                className={`mt-1 w-full text-[8px] font-bold rounded py-0.5 cursor-pointer transition-colors disabled:opacity-40 ${
                                  isPicked
                                    ? 'bg-amber-500 text-white'
                                    : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'
                                }`}
                                title="Swap this duty assignment with another person on the same day"
                              >
                                {isPicked ? 'PICKED' : 'SWAP'}
                              </button>
                            </div>
                          </td>
                        );
                      })}

                      <td className="px-3 py-3 text-center">
                        <div className={`font-bold ${
                          emp.week_offs_entitled > 0 && emp.week_offs_taken > emp.week_offs_entitled
                            ? 'text-rose-600' : 'text-gray-800'
                        }`}>
                          {emp.week_offs_taken} / {emp.week_offs_entitled || '—'}
                        </div>
                        <div className="text-[9px] text-gray-400">this month</div>
                        {weekOffsInDraft > 0 && (
                          <div className="text-[9px] text-amber-600 font-semibold mt-0.5">
                            {weekOffsInDraft} in week
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-gray-100 text-[11px] text-gray-500 flex flex-wrap items-center gap-4 bg-gray-50/50">
            <span>• Time inputs accept start and end hours for day/night duty allotment.</span>
            <span>• <strong className="text-amber-700">WO</strong> button sets Week Off for that day.</span>
            <span>• <strong className="text-blue-700">SWAP</strong> lets you exchange hours between two staff on the same date.</span>
          </div>
        </div>
      )}
      <ConfigureShiftTimingModal
        isOpen={showTimingModal}
        onClose={() => setShowTimingModal(false)}
        onSuccess={() => flash('Shift timings updated successfully!')}
      />
    </div>
  );
}
