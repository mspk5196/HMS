const db = require('../../config/db');
const q = require('./roster.queries');
const { AppError } = require('../../utils/errors');

/**
 * Roster business rules.
 *
 * - A cell is either a real shift from the catalog, or a week-off.
 * - Nobody may be rostered more than MAX_CONSECUTIVE_WORKED_DAYS in a row.
 *   The client spec words it as "warn if a nurse would work 7 days in a row",
 *   so 6 consecutive worked days is the limit.
 */

const MAX_CONSECUTIVE_WORKED_DAYS = 6;

/* ─── helpers ─── */

const toISO = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

const isValidDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(Date.parse(s));

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Wednesday-based start of the week containing `iso`. */
const startOfWeek = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  // Wed=3, Thu=4, Fri=5, Sat=6, Sun=0, Mon=1, Tue=2
  // Days since last Wednesday: (dow - 3 + 7) % 7
  const dow = d.getUTCDay();
  const daysSinceWed = (dow - 3 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceWed);
  return d.toISOString().slice(0, 10);
};

/** Longest run of consecutive dates in a set of ISO date strings. */
const longestConsecutiveRun = (isoDates) => {
  const sorted = [...new Set(isoDates)].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of sorted) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    if (run > best) best = run;
    prev = day;
  }
  return best;
};

/* ─── validation ─── */

const isValidTime = (s) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(s ?? ''));

const loadEmployeeIds = async (ids) => {
  if (!ids.length) return new Set();
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT id FROM employees WHERE id IN (${placeholders})`,
    ids
  );
  return new Set(rows.map((r) => Number(r.id)));
};

const getTodayISO = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

/**
 * Validate a batch of roster cells, rejecting the whole batch on the first
 * problem — a partially-applied roster is worse than a rejected one.
 */
const validateRows = async (rows, { weekStart } = {}) => {
  if (!Array.isArray(rows) || !rows.length) {
    throw new AppError('rows must be a non-empty array', 400);
  }

  const today = getTodayISO();

  const normalised = rows.map((r, i) => {
    const employeeId = Number(r.employee_id);
    const rosterDate = toISO(r.roster_date ?? r.shift_date);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      throw new AppError(`Row ${i + 1}: employee_id is required`, 400);
    }
    if (!isValidDate(rosterDate)) {
      throw new AppError(`Row ${i + 1}: roster_date must be YYYY-MM-DD`, 400);
    }
    if (rosterDate < today) {
      throw new AppError(
        `Row ${i + 1}: Cannot create or modify duty for previous date (${rosterDate}). Duties for past days are locked.`,
        400
      );
    }
    if (weekStart) {
      const weekEnd = addDays(weekStart, 6);
      if (rosterDate < weekStart || rosterDate > weekEnd) {
        throw new AppError(
          `Row ${i + 1}: ${rosterDate} falls outside the week ${weekStart} – ${weekEnd}`,
          400
        );
      }
    }

    const isWeekOff = !!r.is_week_off;
    const customStart = isWeekOff ? null : (r.custom_start_time ?? null);
    const customEnd   = isWeekOff ? null : (r.custom_end_time ?? null);
    const bufferMinutes = isWeekOff ? null : (
      r.buffer_minutes !== undefined && r.buffer_minutes !== null && r.buffer_minutes !== ''
        ? Math.max(0, Math.min(120, Number(r.buffer_minutes) || 0))
        : 10
    );
    const isNightShift = isWeekOff
      ? false
      : (r.is_night_shift !== undefined && r.is_night_shift !== null
          ? Boolean(r.is_night_shift)
          : (customStart >= '18:00' || (customEnd && customEnd < customStart)));

    // A worked cell requires both time fields
    if (!isWeekOff && !r.is_holiday) {
      if (!isValidTime(customStart) || !isValidTime(customEnd)) {
        throw new AppError(`Row ${i + 1}: custom_start_time and custom_end_time are required for worked days (HH:MM)`, 400);
      }
    }

    return {
      employee_id: employeeId,
      roster_date: rosterDate,
      custom_start_time: customStart,
      custom_end_time: customEnd,
      buffer_minutes: bufferMinutes,
      is_night_shift: isNightShift,
      is_week_off: isWeekOff,
      is_holiday: !!r.is_holiday,
      notes: r.notes ?? null,
    };
  });

  // Every referenced employee must exist and be a Day & Night employee.
  const employeeIds = [...new Set(normalised.map((r) => r.employee_id))];
  const knownEmployees = await loadEmployeeIds(employeeIds);
  const missingEmployee = employeeIds.find((id) => !knownEmployees.has(id));
  if (missingEmployee) {
    throw new AppError(`Employee ${missingEmployee} does not exist`, 400);
  }

  return normalised;
};

/* ─── read ─── */

/**
 * The full grid for one week: every active employee in scope, their cells, and
 * the week-off count for the month so the UI can show it against the role's
 * entitlement (staff_roles.weekly_off_count).
 */
const getWeek = async ({ weekStart, departmentId, staffRoleId }) => {
  if (!isValidDate(weekStart)) {
    throw new AppError('weekStart must be YYYY-MM-DD', 400);
  }
  const start = startOfWeek(weekStart);

  const [employees, entries] = await Promise.all([
    q.getEmployeesByDeptAndRole(departmentId, staffRoleId),
    q.getRosterForWeek(start, departmentId, staffRoleId),
  ]);

  const weekOffsTaken = await q.countWeekOffsInMonth(
    employees.map((e) => e.employee_id),
    start
  );

  return {
    weekStart: start,
    weekEnd: addDays(start, 6),
    days: Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    employees: employees.map((e) => ({
      ...e,
      week_offs_taken: weekOffsTaken[e.employee_id] ?? 0,
      week_offs_entitled: e.weekly_off_count ?? 0,
    })),
    entries: entries.map((e) => ({ ...e, roster_date: toISO(e.roster_date) })),
  };
};

const getRoster = async (month, year, departmentId, staffRoleId) => {
  const rows = await q.getRosterForMonth(month, year, departmentId, staffRoleId);
  return rows.map((r) => ({ ...r, roster_date: toISO(r.roster_date) }));
};

const getEmployeesForRoster = async (departmentId, staffRoleId) =>
  q.getEmployeesByDeptAndRole(departmentId, staffRoleId);

/* ─── write ─── */

const saveRosterDay = async (data, userId) => {
  const [row] = await validateRows([data]);
  await q.upsertEmployeeShift({ ...row, created_by: userId });
  return row;
};

const bulkSaveRoster = async (rows, userId, weekStart) => {
  const normalised = await validateRows(rows, { weekStart });
  const saved = await q.bulkUpsertShifts(normalised, userId);
  return { saved };
};

const swapShifts = async ({ employeeA, employeeB, rosterDate }, userId) => {
  const a = Number(employeeA);
  const b = Number(employeeB);
  if (!a || !b) throw new AppError('employeeA and employeeB are required', 400);
  if (a === b) throw new AppError('Cannot swap an employee with themselves', 400);
  if (!isValidDate(rosterDate)) throw new AppError('rosterDate must be YYYY-MM-DD', 400);

  const today = getTodayISO();
  if (rosterDate < today) {
    throw new AppError(
      `Cannot swap duty for past date (${rosterDate}). Duties for previous days are locked.`,
      400
    );
  }

  const known = await loadEmployeeIds([a, b]);
  if (!known.has(a) || !known.has(b)) {
    throw new AppError('Both employees must exist', 400);
  }

  const result = await q.swapRosterEntries(a, b, rosterDate, userId);
  return result;
};

/* ─── Non-Roster Week-Off Services ─── */

const listNonRosterEmployees = async (departmentId, shiftCategory, month, year) => {
  const m = Number(month) || (new Date().getMonth() + 1);
  const y = Number(year) || new Date().getFullYear();

  const emps = await q.getNonRosterEmployees(departmentId, shiftCategory);
  if (!emps.length) return [];

  const empIds = emps.map((e) => e.employee_id);
  const weekOffCounts = await q.countWeekOffsInMonth(empIds, `${y}-${String(m).padStart(2, '0')}-01`);

  return emps.map((e) => ({
    ...e,
    month: m,
    year: y,
    week_offs_taken: weekOffCounts[e.employee_id] ?? 0,
    week_offs_entitled: e.weekly_off_count ?? 4,
  }));
};

const getEmployeeWeekOffCalendar = async (employeeId, month, year) => {
  const empId = Number(employeeId);
  if (!empId) throw new AppError('Valid employeeId is required', 400);

  const m = Number(month) || (new Date().getMonth() + 1);
  const y = Number(year) || new Date().getFullYear();

  const dates = await q.getEmployeeWeekOffs(empId, m, y);
  return { employee_id: empId, month: m, year: y, week_off_dates: dates };
};

const setEmployeeWeekOffDate = async (employeeId, date, isWeekOff, userId) => {
  const empId = Number(employeeId);
  if (!empId) throw new AppError('Valid employeeId is required', 400);
  if (!isValidDate(date)) throw new AppError('date must be YYYY-MM-DD', 400);

  await q.setWeekOffEntry(empId, date, Boolean(isWeekOff), userId);
  return { employee_id: empId, date, is_week_off: Boolean(isWeekOff) };
};

const setGroupWeekOffs = async ({ employeeIds, dates, isWeekOff = true }, userId) => {
  if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
    throw new AppError('employeeIds must be a non-empty array', 400);
  }
  if (!Array.isArray(dates) || dates.length === 0) {
    throw new AppError('dates must be a non-empty array of YYYY-MM-DD', 400);
  }

  for (const d of dates) {
    if (!isValidDate(d)) throw new AppError(`Invalid date: ${d}`, 400);
  }

  let totalApplied = 0;
  for (const empId of employeeIds) {
    for (const d of dates) {
      await q.setWeekOffEntry(Number(empId), d, Boolean(isWeekOff), userId);
      totalApplied++;
    }
  }

  return { total_applied: totalApplied, employee_count: employeeIds.length, date_count: dates.length };
};

/* ─── Duty Transfer / Replacement Services ─── */

const transferDuty = async ({
  fromEmployeeId,
  toEmployeeId,
  dutyDate,
  reason,
  leaveRequestId,
}, userId) => {
  const fromId = Number(fromEmployeeId);
  const toId = Number(toEmployeeId);

  if (!fromId || !toId) throw new AppError('Both fromEmployeeId and toEmployeeId are required', 400);
  if (fromId === toId) throw new AppError('Cannot transfer duty to the same employee', 400);
  if (!isValidDate(dutyDate)) throw new AppError('dutyDate must be YYYY-MM-DD', 400);

  // Check fromEmployee duty on dutyDate
  const entry = await q.getRosterEntry(fromId, dutyDate);
  let startTime = entry?.custom_start_time || null;
  let endTime = entry?.custom_end_time || null;
  let isNight = entry?.is_night_shift ? 1 : 0;

  // If no specific roster entry, fallback to standard shifts or employee category
  if (!startTime || !endTime) {
    const [empRows] = await db.execute(
      `SELECT shift_category, custom_shift_start, custom_shift_end FROM employees WHERE id = ?`,
      [fromId]
    );
    const emp = empRows[0];
    if (emp?.shift_category === 'night') {
      startTime = '20:00:00';
      endTime = '08:00:00';
      isNight = 1;
    } else {
      startTime = emp?.custom_shift_start || '08:30:00';
      endTime = emp?.custom_shift_end || '18:30:00';
      isNight = 0;
    }
  }

  const transferId = await q.executeDutyTransfer({
    fromEmployeeId: fromId,
    toEmployeeId: toId,
    dutyDate,
    shiftId: null,
    customStartTime: startTime,
    customEndTime: endTime,
    isNightShift: isNight,
    leaveRequestId: leaveRequestId ? Number(leaveRequestId) : null,
    reason: reason || 'Shift replacement / cover',
    transferredBy: userId,
  });

  return {
    transfer_id: transferId,
    from_employee_id: fromId,
    to_employee_id: toId,
    duty_date: dutyDate,
    shift_details: {
      start_time: startTime,
      end_time: endTime,
      is_night_shift: isNight,
    },
    reason,
  };
};

const getEligibleReplacements = async (dutyDate, departmentId, excludeEmployeeId) => {
  if (!isValidDate(dutyDate)) throw new AppError('dutyDate must be YYYY-MM-DD', 400);
  return q.getEligibleReplacements(dutyDate, departmentId, excludeEmployeeId);
};

const listDutyTransfers = async (month, year, departmentId) => {
  const m = Number(month) || (new Date().getMonth() + 1);
  const y = Number(year) || new Date().getFullYear();
  return q.getDutyTransfers(m, y, departmentId);
};

module.exports = {
  getWeek,
  getRoster,
  getEmployeesForRoster,
  saveRosterDay,
  bulkSaveRoster,
  swapShifts,
  listNonRosterEmployees,
  getEmployeeWeekOffCalendar,
  setEmployeeWeekOffDate,
  setGroupWeekOffs,
  transferDuty,
  getEligibleReplacements,
  listDutyTransfers,
  MAX_CONSECUTIVE_WORKED_DAYS,
};

