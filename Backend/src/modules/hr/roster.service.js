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

/** Monday-based start of the week containing `iso`. */
const startOfWeek = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  d.setUTCDate(d.getUTCDate() - dow);
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

const loadActiveShiftIds = async () => {
  const [rows] = await db.execute(`SELECT id FROM shifts WHERE is_active = 1`);
  return new Set(rows.map((r) => Number(r.id)));
};

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
    const shiftId = isWeekOff ? null : (r.shift_id == null ? null : Number(r.shift_id));

    if (!isWeekOff && shiftId !== null && (!Number.isInteger(shiftId) || shiftId <= 0)) {
      throw new AppError(`Row ${i + 1}: shift_id must be a valid shift`, 400);
    }

    return {
      employee_id: employeeId,
      roster_date: rosterDate,
      shift_id: shiftId,
      is_week_off: isWeekOff,
      is_holiday: !!r.is_holiday,
      notes: r.notes ?? null,
    };
  });

  // Every referenced employee must exist.
  const employeeIds = [...new Set(normalised.map((r) => r.employee_id))];
  const knownEmployees = await loadEmployeeIds(employeeIds);
  const missingEmployee = employeeIds.find((id) => !knownEmployees.has(id));
  if (missingEmployee) {
    throw new AppError(`Employee ${missingEmployee} does not exist`, 400);
  }

  // Every referenced shift must exist and be active.
  const shiftIds = [...new Set(normalised.map((r) => r.shift_id).filter((s) => s !== null))];
  if (shiftIds.length) {
    const activeShifts = await loadActiveShiftIds();
    const badShift = shiftIds.find((id) => !activeShifts.has(id));
    if (badShift) {
      throw new AppError(`Shift ${badShift} does not exist or is inactive`, 400);
    }
  }

  // No employee may exceed the consecutive-worked-day limit once this batch is
  // applied. Check a window either side of the edit so the rule holds across
  // week boundaries, not just inside the week being saved.
  for (const employeeId of employeeIds) {
    const mine = normalised.filter((r) => r.employee_id === employeeId);
    const dates = mine.map((r) => r.roster_date).sort();
    const from = addDays(dates[0], -(MAX_CONSECUTIVE_WORKED_DAYS + 1));
    const to = addDays(dates[dates.length - 1], MAX_CONSECUTIVE_WORKED_DAYS + 1);

    const existing = await q.getWorkedDatesInRange(employeeId, from, to);

    // Rows in this batch override whatever is already stored for those dates.
    const edited = new Set(dates);
    const worked = new Set(existing.filter((d) => !edited.has(d)));
    for (const r of mine) {
      if (!r.is_week_off && !r.is_holiday && r.shift_id !== null) worked.add(r.roster_date);
    }

    const run = longestConsecutiveRun([...worked]);
    if (run > MAX_CONSECUTIVE_WORKED_DAYS) {
      throw new AppError(
        `Employee ${employeeId} would be rostered ${run} consecutive days; the limit is ${MAX_CONSECUTIVE_WORKED_DAYS}.`,
        400
      );
    }
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
