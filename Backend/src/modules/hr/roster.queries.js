const db = require('../../config/db');

/**
 * Roster data access.
 *
 * The roster is per employee, per date, and stores a real shift_id from the
 * `shifts` catalog — a week-off is shift_id NULL + is_week_off = 1.
 * (An earlier version derived the shift from a hardcoded 'day'|'night' flag and
 * silently created shifts as a side effect of reads; both are gone.)
 */

const ROSTER_SELECT = `
  SELECT re.id, re.employee_id, re.roster_date, re.shift_id,
         re.is_week_off, re.is_holiday, re.is_manual_override, re.notes,
         s.name AS shift_name, s.start_time, s.end_time, s.is_night_shift,
         e.full_name, e.employee_code,
         d.name AS department_name, sr.name AS role_name
  FROM roster_entries re
  JOIN employees e ON e.id = re.employee_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN staff_roles sr ON sr.id = e.designation_id
  LEFT JOIN shifts s ON s.id = re.shift_id
`;

/** Roster rows for a Mon–Sun week (weekStart inclusive, 7 days). */
const getRosterForWeek = async (weekStart, departmentId, staffRoleId) => {
  const filters = ['re.roster_date >= ?', 're.roster_date < DATE_ADD(?, INTERVAL 7 DAY)'];
  const params = [weekStart, weekStart];

  if (departmentId) { filters.push('e.department_id = ?'); params.push(departmentId); }
  if (staffRoleId) { filters.push('e.designation_id = ?'); params.push(staffRoleId); }

  const [rows] = await db.execute(
    `${ROSTER_SELECT} WHERE ${filters.join(' AND ')} ORDER BY e.full_name, re.roster_date`,
    params
  );
  return rows;
};

/** Roster rows for a whole month — kept for the month view and payroll. */
const getRosterForMonth = async (month, year, departmentId, staffRoleId) => {
  const filters = ['MONTH(re.roster_date) = ?', 'YEAR(re.roster_date) = ?'];
  const params = [month, year];

  if (departmentId) { filters.push('e.department_id = ?'); params.push(departmentId); }
  if (staffRoleId) { filters.push('e.designation_id = ?'); params.push(staffRoleId); }

  const [rows] = await db.execute(
    `${ROSTER_SELECT} WHERE ${filters.join(' AND ')} ORDER BY e.full_name, re.roster_date`,
    params
  );
  return rows;
};

/** Active employees for the roster grid, with their role's default shift. */
const getEmployeesByDeptAndRole = async (departmentId, staffRoleId) => {
  const filters = ["e.status = 'active'"];
  const params = [];

  if (departmentId) { filters.push('e.department_id = ?'); params.push(departmentId); }
  if (staffRoleId) { filters.push('e.designation_id = ?'); params.push(staffRoleId); }

  const [rows] = await db.execute(
    `SELECT e.id AS employee_id, e.full_name, e.employee_code,
            e.department_id, e.designation_id,
            d.name AS department_name, sr.name AS role_name,
            sr.default_shift_id, sr.weekly_off_count
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     WHERE ${filters.join(' AND ')}
     ORDER BY e.full_name`,
    params
  );
  return rows;
};

/** Week-offs already taken in the month containing `onDate`, per employee. */
const countWeekOffsInMonth = async (employeeIds, onDate) => {
  if (!employeeIds.length) return {};
  const placeholders = employeeIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT employee_id, COUNT(*) AS week_offs
     FROM roster_entries
     WHERE employee_id IN (${placeholders})
       AND is_week_off = 1
       AND MONTH(roster_date) = MONTH(?)
       AND YEAR(roster_date)  = YEAR(?)
     GROUP BY employee_id`,
    [...employeeIds, onDate, onDate]
  );
  return Object.fromEntries(rows.map((r) => [r.employee_id, Number(r.week_offs)]));
};

/**
 * Worked (non-week-off, non-holiday) roster dates for one employee in a window.
 * Used to enforce the "no more than 6 consecutive worked days" rule, which has
 * to look outside the week being edited to be correct at the boundaries.
 */
const getWorkedDatesInRange = async (employeeId, fromDate, toDate) => {
  const [rows] = await db.execute(
    `SELECT roster_date
     FROM roster_entries
     WHERE employee_id = ?
       AND roster_date BETWEEN ? AND ?
       AND is_week_off = 0
       AND is_holiday = 0
       AND shift_id IS NOT NULL
     ORDER BY roster_date`,
    [employeeId, fromDate, toDate]
  );
  return rows.map((r) => (r.roster_date instanceof Date
    ? r.roster_date.toISOString().slice(0, 10)
    : String(r.roster_date).slice(0, 10)));
};

const getRosterEntry = async (employeeId, rosterDate) => {
  const [rows] = await db.execute(
    `SELECT * FROM roster_entries WHERE employee_id = ? AND roster_date = ?`,
    [employeeId, rosterDate]
  );
  return rows[0] ?? null;
};

const UPSERT_SQL = `
  INSERT INTO roster_entries
    (employee_id, roster_date, shift_id, is_week_off, is_holiday, is_manual_override, notes, created_by)
  VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  ON DUPLICATE KEY UPDATE
    shift_id           = VALUES(shift_id),
    is_week_off        = VALUES(is_week_off),
    is_holiday         = VALUES(is_holiday),
    is_manual_override = 1,
    notes              = VALUES(notes)
`;

/** Upsert one cell. A week-off is shift_id NULL + is_week_off 1. */
const upsertEmployeeShift = async ({
  employee_id, roster_date, shift_id, is_week_off, is_holiday, notes, created_by,
}) => {
  const weekOff = is_week_off ? 1 : 0;
  await db.execute(UPSERT_SQL, [
    employee_id,
    roster_date,
    weekOff ? null : (shift_id ?? null),
    weekOff,
    is_holiday ? 1 : 0,
    notes ?? null,
    created_by ?? null,
  ]);
};

/**
 * Upsert many cells in one transaction.
 * rows: [{ employee_id, roster_date, shift_id, is_week_off, is_holiday, notes }]
 */
const bulkUpsertShifts = async (rows, createdBy = null) => {
  if (!rows.length) return 0;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of rows) {
      const weekOff = r.is_week_off ? 1 : 0;
      await conn.execute(UPSERT_SQL, [
        r.employee_id,
        r.roster_date,
        weekOff ? null : (r.shift_id ?? null),
        weekOff,
        r.is_holiday ? 1 : 0,
        r.notes ?? null,
        createdBy,
      ]);
    }
    await conn.commit();
    return rows.length;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** Swap two employees' assignments on the same date, atomically. */
const swapRosterEntries = async (employeeA, employeeB, rosterDate, createdBy = null) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const readCell = async (employeeId) => {
      const [rows] = await conn.execute(
        `SELECT shift_id, is_week_off, is_holiday FROM roster_entries
         WHERE employee_id = ? AND roster_date = ?`,
        [employeeId, rosterDate]
      );
      // A missing row is a valid state to swap into — treat it as "unassigned".
      return rows[0] ?? { shift_id: null, is_week_off: 0, is_holiday: 0 };
    };

    const rowA = await readCell(employeeA);
    const rowB = await readCell(employeeB);

    await conn.execute(UPSERT_SQL, [
      employeeA, rosterDate, rowB.shift_id, rowB.is_week_off, rowB.is_holiday, null, createdBy,
    ]);
    await conn.execute(UPSERT_SQL, [
      employeeB, rosterDate, rowA.shift_id, rowA.is_week_off, rowA.is_holiday, null, createdBy,
    ]);

    await conn.commit();
    return { employeeA: rowB, employeeB: rowA };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  getRosterForWeek,
  getRosterForMonth,
  getEmployeesByDeptAndRole,
  countWeekOffsInMonth,
  getWorkedDatesInRange,
  getRosterEntry,
  upsertEmployeeShift,
  bulkUpsertShifts,
  swapRosterEntries,
};
