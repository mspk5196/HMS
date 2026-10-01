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
  SELECT re.id, re.employee_id, re.roster_date,
         re.is_week_off, re.is_holiday, re.is_manual_override, re.notes,
         re.custom_start_time, re.custom_end_time, re.buffer_minutes, re.is_night_shift,
         e.full_name, e.employee_code,
         d.name AS department_name, sr.name AS role_name
  FROM roster_entries re
  JOIN employees e ON e.id = re.employee_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN staff_roles sr ON sr.id = e.designation_id
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

/** Active Day & Night employees for the roster grid. */
const getEmployeesByDeptAndRole = async (departmentId, staffRoleId) => {
  const filters = ["e.status = 'active'", "e.shift_category = 'day_and_night'"];
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
       AND (custom_start_time IS NOT NULL OR shift_id IS NOT NULL)
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
    (employee_id, roster_date, is_week_off, is_holiday, is_manual_override, notes,
     custom_start_time, custom_end_time, buffer_minutes, is_night_shift, created_by)
  VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
    is_week_off        = VALUES(is_week_off),
    is_holiday         = VALUES(is_holiday),
    is_manual_override = 1,
    notes              = VALUES(notes),
    custom_start_time  = VALUES(custom_start_time),
    custom_end_time    = VALUES(custom_end_time),
    buffer_minutes     = VALUES(buffer_minutes),
    is_night_shift     = VALUES(is_night_shift)
`;

/** Upsert one cell. A week-off has no time range; a worked day requires start+end. */
const upsertEmployeeShift = async ({
  employee_id, roster_date, is_week_off, is_holiday, notes,
  custom_start_time, custom_end_time, buffer_minutes, is_night_shift, created_by,
}) => {
  const weekOff = is_week_off ? 1 : 0;
  await db.execute(UPSERT_SQL, [
    employee_id,
    roster_date,
    weekOff,
    is_holiday ? 1 : 0,
    notes ?? null,
    weekOff ? null : (custom_start_time ?? null),
    weekOff ? null : (custom_end_time ?? null),
    weekOff ? null : (buffer_minutes !== undefined && buffer_minutes !== null ? Number(buffer_minutes) : 10),
    weekOff ? 0 : (is_night_shift ? 1 : 0),
    created_by ?? null,
  ]);
};

/**
 * Upsert many cells in one transaction.
 * rows: [{ employee_id, roster_date, is_week_off, is_holiday, notes, custom_start_time, custom_end_time, buffer_minutes, is_night_shift }]
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
        weekOff,
        r.is_holiday ? 1 : 0,
        r.notes ?? null,
        weekOff ? null : (r.custom_start_time ?? null),
        weekOff ? null : (r.custom_end_time ?? null),
        weekOff ? null : (r.buffer_minutes !== undefined && r.buffer_minutes !== null ? Number(r.buffer_minutes) : 10),
        weekOff ? 0 : (r.is_night_shift ? 1 : 0),
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
        `SELECT is_week_off, is_holiday, custom_start_time, custom_end_time, buffer_minutes, is_night_shift FROM roster_entries
         WHERE employee_id = ? AND roster_date = ?`,
        [employeeId, rosterDate]
      );
      return rows[0] ?? { is_week_off: 0, is_holiday: 0, custom_start_time: null, custom_end_time: null, buffer_minutes: null, is_night_shift: 0 };
    };

    const rowA = await readCell(employeeA);
    const rowB = await readCell(employeeB);

    await conn.execute(UPSERT_SQL, [
      employeeA, rosterDate, rowB.is_week_off, rowB.is_holiday, null,
      rowB.custom_start_time, rowB.custom_end_time, rowB.buffer_minutes, rowB.is_night_shift ? 1 : 0, createdBy,
    ]);
    await conn.execute(UPSERT_SQL, [
      employeeB, rosterDate, rowA.is_week_off, rowA.is_holiday, null,
      rowA.custom_start_time, rowA.custom_end_time, rowA.buffer_minutes, rowA.is_night_shift ? 1 : 0, createdBy,
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

/** Get employees whose shift category is NOT day_and_night (Fixed Day, Fixed Night, General). */
const getNonRosterEmployees = async (departmentId = null, shiftCategory = null) => {
  const filters = ["e.status = 'active'", "e.shift_category IN ('day', 'night', 'general')"];
  const params = [];

  if (departmentId) {
    filters.push('e.department_id = ?');
    params.push(departmentId);
  }
  if (shiftCategory && ['day', 'night', 'general'].includes(shiftCategory)) {
    filters.push('e.shift_category = ?');
    params.push(shiftCategory);
  }

  const [rows] = await db.execute(
    `SELECT e.id AS employee_id, e.full_name, e.employee_code,
            e.department_id, e.designation_id, e.shift_category,
            e.custom_shift_start, e.custom_shift_end, e.custom_buffer_minutes,
            d.name AS department_name, sr.name AS role_name,
            COALESCE(sr.weekly_off_count, 4) AS weekly_off_count
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     WHERE ${filters.join(' AND ')}
     ORDER BY d.name, e.full_name`,
    params
  );
  return rows;
};

/** Get week-off dates for an employee in a given month/year. */
const getEmployeeWeekOffs = async (employeeId, month, year) => {
  const [rows] = await db.execute(
    `SELECT DATE_FORMAT(roster_date, '%Y-%m-%d') AS date, is_week_off, notes
     FROM roster_entries
     WHERE employee_id = ? AND MONTH(roster_date) = ? AND YEAR(roster_date) = ? AND is_week_off = 1
     ORDER BY roster_date ASC`,
    [employeeId, month, year]
  );
  return rows.map((r) => r.date);
};

/** Set or unset week-off for an employee on a specific date. */
const setWeekOffEntry = async (employeeId, rosterDate, isWeekOff, createdBy = null) => {
  if (isWeekOff) {
    await db.execute(UPSERT_SQL, [
      employeeId, rosterDate, 1, 0, 'Week Off',
      null, null, null, 0, createdBy,
    ]);
  } else {
    // If it was just a week-off entry, delete or set is_week_off = 0
    await db.execute(
      `DELETE FROM roster_entries WHERE employee_id = ? AND roster_date = ? AND is_week_off = 1`,
      [employeeId, rosterDate]
    );
  }
};

/** Save a duty transfer record in duty_transfers table and update roster_entries atomically. */
const executeDutyTransfer = async ({
  fromEmployeeId,
  toEmployeeId,
  dutyDate,
  shiftId = null,
  customStartTime = null,
  customEndTime = null,
  isNightShift = 0,
  leaveRequestId = null,
  reason = null,
  transferredBy = null,
}) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Relieve fromEmployeeId on dutyDate
    await conn.execute(UPSERT_SQL, [
      fromEmployeeId,
      dutyDate,
      0, // not week off
      0, // not holiday
      `Duty transferred to #${toEmployeeId}`,
      null, null, null, 0,
      transferredBy,
    ]);

    // 2. Assign shift to toEmployeeId on dutyDate
    await conn.execute(UPSERT_SQL, [
      toEmployeeId,
      dutyDate,
      0, // not week off
      0,
      `Covering duty for #${fromEmployeeId}${reason ? ' (' + reason + ')' : ''}`,
      customStartTime,
      customEndTime,
      10, // buffer
      isNightShift ? 1 : 0,
      transferredBy,
    ]);

    // 3. Insert audit into duty_transfers
    const [ins] = await conn.execute(
      `INSERT INTO duty_transfers
         (from_employee_id, to_employee_id, duty_date, shift_id,
          custom_start_time, custom_end_time, is_night_shift, leave_request_id,
          reason, transferred_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fromEmployeeId,
        toEmployeeId,
        dutyDate,
        shiftId,
        customStartTime,
        customEndTime,
        isNightShift ? 1 : 0,
        leaveRequestId,
        reason,
        transferredBy,
      ]
    );

    await conn.commit();
    return ins.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** Query duty transfers for tracking / history. */
const getDutyTransfers = async (month, year, departmentId = null) => {
  const filters = ['MONTH(dt.duty_date) = ?', 'YEAR(dt.duty_date) = ?'];
  const params = [month, year];

  if (departmentId) {
    filters.push('eFrom.department_id = ?');
    params.push(departmentId);
  }

  const [rows] = await db.execute(
    `SELECT dt.*,
            DATE_FORMAT(dt.duty_date, '%Y-%m-%d') AS duty_date,
            eFrom.full_name AS from_employee_name, eFrom.employee_code AS from_employee_code,
            eTo.full_name AS to_employee_name, eTo.employee_code AS to_employee_code,
            d.name AS department_name,
            u.username AS transferred_by_username
     FROM duty_transfers dt
     JOIN employees eFrom ON eFrom.id = dt.from_employee_id
     JOIN employees eTo ON eTo.id = dt.to_employee_id
     LEFT JOIN departments d ON d.id = eFrom.department_id
     LEFT JOIN users u ON u.id = dt.transferred_by
     WHERE ${filters.join(' AND ')}
     ORDER BY dt.duty_date DESC, dt.created_at DESC`,
    params
  );
  return rows;
};

/** Get potential replacement staff for a given date. */
const getEligibleReplacements = async (dutyDate, departmentId = null, excludeEmployeeId = null) => {
  const filters = ["e.status = 'active'"];
  const params = [dutyDate];

  if (departmentId) {
    filters.push('e.department_id = ?');
    params.push(departmentId);
  }
  if (excludeEmployeeId) {
    filters.push('e.id != ?');
    params.push(excludeEmployeeId);
  }

  const [rows] = await db.execute(
    `SELECT e.id AS employee_id, e.full_name, e.employee_code, e.shift_category,
            d.name AS department_name, sr.name AS role_name,
            COALESCE(re.is_week_off, 0) AS is_week_off,
            re.custom_start_time, re.custom_end_time, re.is_night_shift,
            (SELECT COUNT(*) FROM leave_requests lr
             WHERE lr.employee_id = e.id AND ? BETWEEN lr.from_date AND lr.to_date AND lr.result = 'approved') AS is_on_leave
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     LEFT JOIN roster_entries re ON re.employee_id = e.id AND re.roster_date = ?
     WHERE ${filters.join(' AND ')}
     ORDER BY is_week_off DESC, e.full_name ASC`,
    [dutyDate, ...params]
  );
  return rows;
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
  getNonRosterEmployees,
  getEmployeeWeekOffs,
  setWeekOffEntry,
  executeDutyTransfer,
  getDutyTransfers,
  getEligibleReplacements,
};

