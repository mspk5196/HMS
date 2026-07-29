import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '../../../util/api';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_OFF = 'WO';
const MAX_CONSECUTIVE = 6;

/** Monday-based start of the week containing an ISO date. */
const startOfWeek = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
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

/** Longest run of consecutive worked days — mirrors the server-side rule. */
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

export default function WeeklyRoster({ departments = [], shifts = [], onBack }) {
  const today = new Date().toISOString().slice(0, 10);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [deptFilter, setDeptFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const [grid, setGrid] = useState(null);
  const [draft, setDraft] = useState({}); // `${employeeId}|${date}` -> shiftId | 'WO' | ''
  const [swapPick, setSwapPick] = useState(null); // { employeeId, date }

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const activeShifts = shifts.filter((s) => s.is_active);
  const rolesForDept = (departments.find((d) => String(d.id) === String(deptFilter))?.roles) || [];

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const params = new URLSearchParams({ weekStart });
      if (deptFilter) params.set('departmentId', deptFilter);
      if (roleFilter) params.set('staffRoleId', roleFilter);

      const data = await apiFetch(`/hr/roster/week?${params.toString()}`);

      // Seed the draft from what's stored so unedited cells save unchanged.
      const seeded = {};
      for (const e of data.entries) {
        seeded[`${e.employee_id}|${e.roster_date}`] = e.is_week_off ? WEEK_OFF : (e.shift_id ?? '');
      }
      setGrid(data);
      setDraft(seeded);
      setSwapPick(null);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load the roster.');
      setGrid(null);
    } finally {
      setIsLoading(false);
    }
  }, [weekStart, deptFilter, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const cellValue = (employeeId, date) => draft[`${employeeId}|${date}`] ?? '';

  const setCell = (employeeId, date, value) =>
    setDraft((prev) => ({ ...prev, [`${employeeId}|${date}`]: value }));

  /** Fill an employee's whole week with their role's default shift. */
  const fillRowWithDefault = (emp) => {
    if (!emp.default_shift_id || !grid) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const d of grid.days) next[`${emp.employee_id}|${d}`] = emp.default_shift_id;
      return next;
    });
  };

  const clearRow = (emp) => {
    if (!grid) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const d of grid.days) next[`${emp.employee_id}|${d}`] = '';
      return next;
    });
  };

  /**
   * Consecutive-worked-day run per employee, computed from the draft plus the
   * days immediately outside the week that are already stored. This mirrors the
   * server rule so the warning appears before the save is attempted.
   */
  const runsByEmployee = useMemo(() => {
    if (!grid) return {};
    const storedWorked = new Set(
      grid.entries.filter((e) => !e.is_week_off && e.shift_id).map((e) => `${e.employee_id}|${e.roster_date}`)
    );
    const out = {};
    for (const emp of grid.employees) {
      const worked = [];
      // Days inside the week come from the draft.
      for (const d of grid.days) {
        const v = cellValue(emp.employee_id, d);
        if (v && v !== WEEK_OFF) worked.push(d);
      }
      // Days just outside come from what's already stored, so runs that
      // straddle the week boundary are still visible.
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
          const v = cellValue(emp.employee_id, d);
          if (v === '') continue; // never assigned — leave the roster alone
          rows.push({
            employee_id: emp.employee_id,
            roster_date: d,
            shift_id: v === WEEK_OFF ? null : Number(v),
            is_week_off: v === WEEK_OFF,
          });
        }
      }

      if (!rows.length) {
        setErrorMsg('Nothing to save — assign at least one shift or week-off.');
        return;
      }

      const result = await apiFetch('/hr/roster/bulk', {
        method: 'POST',
        body: JSON.stringify({ weekStart: grid.weekStart, rows }),
      });
      flash(`Saved ${result.saved} roster entries.`);
      await load();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save the roster.');
    } finally {
      setIsSaving(false);
    }
  };

  /** Two clicks on the swap control exchange those two cells on the same date. */
  const handleSwapClick = async (employeeId, date) => {
    if (!swapPick) {
      setSwapPick({ employeeId, date });
      return;
    }
    if (swapPick.employeeId === employeeId) { setSwapPick(null); return; }
    if (swapPick.date !== date) {
      setErrorMsg('Swaps only work between two people on the same day.');
      setSwapPick(null);
      return;
    }
    try {
      setIsSaving(true);
      setErrorMsg('');
      await apiFetch('/hr/roster/swap', {
        method: 'POST',
        body: JSON.stringify({ employeeA: swapPick.employeeId, employeeB: employeeId, rosterDate: date }),
      });
      flash('Shifts swapped.');
      await load();
    } catch (err) {
      setErrorMsg(err.message || 'Swap failed.');
      await load();
    } finally {
      setSwapPick(null);
      setIsSaving(false);
    }
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-gray-200/80 transition-colors cursor-pointer text-gray-500 hover:text-gray-800"
            title="Back to shifts"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">
              Staff &amp; Salary &nbsp;&gt;&nbsp; Shift &amp; Roster &nbsp;&gt;&nbsp;{' '}
              <span className="text-blue-600 font-semibold">Weekly Duty Roster</span>
            </h1>
            {grid && (
              <p className="text-xs text-gray-500 mt-0.5">
                {monthLabel(grid.weekStart)} – {monthLabel(grid.weekEnd)}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || isLoading || !grid?.employees?.length}
          className="bg-[#1e40af] hover:bg-[#1c399b] text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow-sm cursor-pointer transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          {isSaving ? 'Saving…' : 'Save Week'}
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            ← Prev
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
            Next →
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(today))}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            This week
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
            Pick a second person on {swapPick.date} to swap with ·{' '}
            <button onClick={() => setSwapPick(null)} className="underline cursor-pointer">cancel</button>
          </div>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-10 text-center text-xs text-gray-400">Loading…</div>
      ) : !grid || grid.employees.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-10 text-center text-xs text-gray-500">
          No active employees match this department and role.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wider text-[10px] sticky left-0 bg-gray-50/80 z-10">
                    Employee
                  </th>
                  {grid.days.map((d, i) => (
                    <th key={d} className="px-2 py-3 font-bold text-gray-500 uppercase tracking-wider text-[10px] text-center min-w-[110px]">
                      <div>{DAY_LABELS[i]}</div>
                      <div className="text-gray-400 font-semibold">{dayNum(d)}</div>
                    </th>
                  ))}
                  <th className="px-3 py-3 font-bold text-gray-500 uppercase tracking-wider text-[10px] text-center">
                    Week-offs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {grid.employees.map((emp) => {
                  const run = runsByEmployee[emp.employee_id] ?? 0;
                  const overLimit = run > MAX_CONSECUTIVE;
                  const weekOffsInDraft = grid.days.filter(
                    (d) => cellValue(emp.employee_id, d) === WEEK_OFF
                  ).length;

                  return (
                    <tr key={emp.employee_id} className={overLimit ? 'bg-rose-50/40' : 'hover:bg-gray-50/60'}>
                      <td className="px-4 py-2.5 sticky left-0 bg-inherit z-10">
                        <div className="font-bold text-gray-900">{emp.full_name}</div>
                        <div className="text-[10px] text-gray-400">
                          {emp.employee_code} · {emp.role_name || '—'}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => fillRowWithDefault(emp)}
                            disabled={!emp.default_shift_id}
                            className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
                            title={emp.default_shift_id ? 'Fill the week with this role\'s default shift' : 'This role has no default shift'}
                          >
                            Fill week
                          </button>
                          <button
                            onClick={() => clearRow(emp)}
                            className="text-[10px] font-semibold text-gray-400 hover:text-gray-700 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                        {overLimit && (
                          <div className="text-[10px] font-bold text-rose-600 mt-1">
                            {run} consecutive days — limit is {MAX_CONSECUTIVE}
                          </div>
                        )}
                      </td>

                      {grid.days.map((d) => {
                        const value = cellValue(emp.employee_id, d);
                        const isPicked = swapPick && swapPick.employeeId === emp.employee_id && swapPick.date === d;
                        return (
                          <td key={d} className="px-1.5 py-2.5 align-top">
                            <select
                              value={value}
                              onChange={(e) => setCell(emp.employee_id, d, e.target.value)}
                              className={`w-full px-1.5 py-1.5 border rounded-lg text-[11px] font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                                value === WEEK_OFF
                                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                                  : value
                                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                                    : 'bg-white border-gray-200 text-gray-400'
                              }`}
                            >
                              <option value="">—</option>
                              <option value={WEEK_OFF}>Week Off</option>
                              {activeShifts.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleSwapClick(emp.employee_id, d)}
                              disabled={isSaving}
                              className={`mt-1 w-full text-[9px] font-bold rounded py-0.5 cursor-pointer transition-colors disabled:opacity-40 ${
                                isPicked
                                  ? 'bg-amber-500 text-white'
                                  : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'
                              }`}
                              title="Swap this assignment with another person on the same day"
                            >
                              {isPicked ? 'PICKED' : 'SWAP'}
                            </button>
                          </td>
                        );
                      })}

                      <td className="px-3 py-2.5 text-center">
                        <div className={`font-bold ${
                          emp.week_offs_entitled > 0 && emp.week_offs_taken > emp.week_offs_entitled
                            ? 'text-rose-600' : 'text-gray-800'
                        }`}>
                          {emp.week_offs_taken} / {emp.week_offs_entitled || '—'}
                        </div>
                        <div className="text-[9px] text-gray-400">this month</div>
                        {weekOffsInDraft > 0 && (
                          <div className="text-[9px] text-amber-600 font-semibold mt-0.5">
                            {weekOffsInDraft} this week
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-gray-100 text-[11px] text-gray-500 flex flex-wrap items-center gap-4">
            <span><strong className="text-gray-700">Fill week</strong> applies the role's default shift.</span>
            <span>Week-off counts come from <strong className="text-gray-700">staff_roles.weekly_off_count</strong>; a role showing "—" has no entitlement set.</span>
            <span>Cells left as "—" are not touched when you save.</span>
          </div>
        </div>
      )}
    </div>
  );
}
