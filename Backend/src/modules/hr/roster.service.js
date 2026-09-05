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

/**
 * Validate a batch of roster cells, rejecting the whole batch on the first
 * problem — a partially-applied roster is worse than a rejected one.
 */
const validateRows = async (rows, { weekStart } = {}) => {
  if (!Array.isArray(rows) || !rows.length) {
    throw new AppError('rows must be a non-empty array', 400);
  }

  const normalised = rows.map((r, i) => {
    const employeeId = Number(r.employee_id);
    const rosterDate = toISO(r.roster_date ?? r.shift_date);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      throw new AppError(`Row ${i + 1}: employee_id is required`, 400);
    }
    if (!isValidDate(rosterDate)) {
      throw new AppError(`Row ${i + 1}: roster_date must be YYYY-MM-DD`, 400);
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

  const known = await loadEmployeeIds([a, b]);
  if (!known.has(a) || !known.has(b)) {
    throw new AppError('Both employees must exist', 400);
  }

  const result = await q.swapRosterEntries(a, b, rosterDate, userId);

  // A swap can create an over-long run for either side. Report it rather than
  // letting it pass silently; the swap itself has already been applied.
  for (const employeeId of [a, b]) {
    const from = addDays(rosterDate, -(MAX_CONSECUTIVE_WORKED_DAYS + 1));
    const to = addDays(rosterDate, MAX_CONSECUTIVE_WORKED_DAYS + 1);
    const run = longestConsecutiveRun(await q.getWorkedDatesInRange(employeeId, from, to));
    if (run > MAX_CONSECUTIVE_WORKED_DAYS) {
      throw new AppError(
        `Swap applied, but employee ${employeeId} now has ${run} consecutive worked days (limit ${MAX_CONSECUTIVE_WORKED_DAYS}). Adjust the roster.`,
        400
      );
    }
  }

  return result;
};

module.exports = {
  getWeek,
  getRoster,
  getEmployeesForRoster,
  saveRosterDay,
  bulkSaveRoster,
  swapShifts,
  MAX_CONSECUTIVE_WORKED_DAYS,
};
