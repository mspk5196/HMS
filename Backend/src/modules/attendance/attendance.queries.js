/**
 * attendance.queries.js
 * All raw SQL for the Attendance module.
 * Functions return [rows] from db.execute(); callers destructure as needed.
 */

const db = require('../../config/db');

/* ─────────────────────────────────────────────
   RAW PUNCHES (eSSL biometric import)
───────────────────────────────────────────── */

/**
 * Bulk-insert raw punches from the eSSL / eTimeTracker export.
 *
 * The device only knows employee_code, so that is the authoritative key and is
 * NOT NULL; employee_id is resolved alongside it for convenience and may be
 * null if the code doesn't match anyone yet. INSERT IGNORE makes re-importing
 * the same export a no-op (see uq_raw_punch).
 */
const bulkInsertPunches = async (rows) => {
  if (!rows.length) return { inserted: 0 };
  const values = rows.map((r) => [
    r.employee_code,
    r.employee_id ?? null,
    r.device_id ?? null,
    r.punch_time,
    r.punch_type ?? null,
  ]);
  const [result] = await db.query(
    `INSERT IGNORE INTO attendance_raw_punches
       (employee_code, employee_id, device_id, punch_time, punch_type)
     VALUES ?`,
    [values]
  );
  return { inserted: result.affectedRows };
};

/** Resolve employee_code → id for a batch of codes. Returns a Map. */
const resolveEmployeeCodes = async (codes) => {
  if (!codes.length) return new Map();
  const placeholders = codes.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT id, employee_code FROM employees WHERE employee_code IN (${placeholders})`,
    codes
  );
  return new Map(rows.map((r) => [r.employee_code, r.id]));
};

/** Backfill employee_id on any punches whose code has since been registered. */
const linkOrphanPunches = async () => {
  const [res] = await db.query(
    `UPDATE attendance_raw_punches rp
       JOIN employees e ON e.employee_code = rp.employee_code
        SET rp.employee_id = e.id
      WHERE rp.employee_id IS NULL`
  );
  return res.affectedRows;
};

/** Fetch unprocessed raw punches for a given date range. */
const getUnprocessedPunches = async (fromDate, toDate) => {
  const [rows] = await db.execute(
    `SELECT arp.*, e.full_name, e.designation_id, e.department_id
     FROM attendance_raw_punches arp
     JOIN employees e ON e.id = arp.employee_id
     WHERE DATE(arp.punch_time) BETWEEN ? AND ?
       AND arp.is_processed = 0
     ORDER BY arp.employee_id, arp.punch_time`,
    [fromDate, toDate]
  );
  return rows;
};

/** Punches whose employee_code matches no employee — surfaced to the admin. */
const getUnmatchedPunches = async (fromDate, toDate) => {
  const [rows] = await db.execute(
    `SELECT employee_code, COUNT(*) AS punch_count,
            MIN(punch_time) AS first_seen, MAX(punch_time) AS last_seen
     FROM attendance_raw_punches
     WHERE employee_id IS NULL
       AND DATE(punch_time) BETWEEN ? AND ?
     GROUP BY employee_code
     ORDER BY punch_count DESC`,
    [fromDate, toDate]
  );
  return rows;
};

/* ─────────────────────────────────────────────
   BIOMETRIC WINDOW
───────────────────────────────────────────── */

/** Return the biometric window for a given date + role (most specific wins). */
const getBiometricWindow = async (windowDate, roleId) => {
  const [rows] = await db.execute(
    `SELECT * FROM attendance_biometric_windows
     WHERE window_date = ?
       AND (role_id = ? OR role_id IS NULL)
     ORDER BY role_id IS NULL ASC
     LIMIT 1`,
    [windowDate, roleId]
  );
  return rows[0] ?? null;
};

/** List all biometric windows (admin view, paginated). */
const listBiometricWindows = async (page = 1, limit = 30) => {
  const offset = (page - 1) * limit;
  const [rows] = await db.query(
    `SELECT abw.*, r.name AS role_name, u.username AS created_by_name
     FROM attendance_biometric_windows abw
     LEFT JOIN roles r ON r.id = abw.role_id
     LEFT JOIN users u ON u.id = abw.created_by
     ORDER BY abw.window_date DESC, abw.role_id IS NULL
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM attendance_biometric_windows`
  );
  return { rows, total };
};

/** Create a biometric window override for a date (optionally per role). */
const createBiometricWindow = async ({ window_date, role_id, extended_start, extended_end, reason, created_by }) => {
  const [result] = await db.execute(
    `INSERT INTO attendance_biometric_windows
       (window_date, role_id, extended_start, extended_end, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [window_date, role_id ?? null, extended_start, extended_end, reason ?? null, created_by ?? null]
  );
  return result.insertId;
};

/* ─────────────────────────────────────────────
   DAILY SUMMARY
───────────────────────────────────────────── */

/** Get daily attendance summary for an employee on a specific date. */
const getDailySummary = async (employeeId, date) => {
  const [rows] = await db.execute(
    `SELECT ads.*, ads.first_in_time AS first_punch_in, ads.last_out_time AS last_punch_out, e.full_name, s.name AS shift_name
     FROM attendance_daily_summary ads
     JOIN employees e ON e.id = ads.employee_id
     LEFT JOIN shifts s ON s.id = ads.shift_id
     WHERE ads.employee_id = ? AND ads.attendance_date = ?`,
    [employeeId, date]
  );
  return rows[0] ?? null;
};

/** List daily summaries for a date range, optionally filtered by employee. */
const listDailySummaries = async ({ fromDate, toDate, employeeId, departmentId, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  filters.push('ads.attendance_date BETWEEN ? AND ?');
  params.push(fromDate, toDate);

  if (employeeId) { filters.push('ads.employee_id = ?'); params.push(employeeId); }
  if (departmentId) { filters.push('e.department_id = ?'); params.push(departmentId); }

  const where = filters.join(' AND ');

  const [rows] = await db.query(
    `SELECT ads.*, ads.first_in_time AS first_punch_in, ads.last_out_time AS last_punch_out, e.full_name, e.employee_code, d.name AS department_name, s.name AS shift_name
     FROM attendance_daily_summary ads
     JOIN employees e ON e.id = ads.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN shifts s ON s.id = ads.shift_id
     WHERE ${where}
     ORDER BY ads.attendance_date DESC, e.full_name
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM attendance_daily_summary ads
     JOIN employees e ON e.id = ads.employee_id
     WHERE ${where}`,
    params
  );

  return { rows, total };
};

/** Upsert a processed daily summary row. */
const upsertDailySummary = async (data) => {
  const {
    employee_id, attendance_date, shift_id, status,
    first_punch_in, last_punch_out, worked_minutes, break_minutes,
    late_minutes, early_leave_minutes, is_missed_punch,
    biometric_window_extended, overtime_minutes,
  } = data;

  await db.execute(
    `INSERT INTO attendance_daily_summary
       (employee_id, attendance_date, shift_id, status,
        first_in_time, last_out_time, worked_minutes, break_minutes,
        late_minutes, early_leave_minutes, is_missed_punch,
        biometric_window_extended, overtime_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       shift_id = VALUES(shift_id),
       status = VALUES(status),
       first_in_time = VALUES(first_in_time),
       last_out_time = VALUES(last_out_time),
       worked_minutes = VALUES(worked_minutes),
       break_minutes = VALUES(break_minutes),
       late_minutes = VALUES(late_minutes),
       early_leave_minutes = VALUES(early_leave_minutes),
       is_missed_punch = VALUES(is_missed_punch),
       biometric_window_extended = VALUES(biometric_window_extended),
       overtime_minutes = VALUES(overtime_minutes)`,
    [employee_id, attendance_date, shift_id ?? null, status,
     first_punch_in ?? null, last_punch_out ?? null,
     worked_minutes ?? 0, break_minutes ?? 0,
     late_minutes ?? 0, early_leave_minutes ?? 0, is_missed_punch ? 1 : 0,
     biometric_window_extended ? 1 : 0, overtime_minutes ?? 0]
  );
};

/**
 * Overlay a leave/LOP status onto a date range without disturbing any punch
 * data already recorded for those days (a partial update — only `status` and
 * the leave flag change). Used by leave approval, not the punch engine.
 */
const markLeaveDays = async (employeeId, dates, status) => {
  if (!dates.length) return;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const date of dates) {
      await conn.execute(
        `INSERT INTO attendance_daily_summary (employee_id, attendance_date, status)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
        [employeeId, date, status]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** Admin manually marks an employee present/absent for a date. */
const adminMarkAttendance = async (employeeId, date, status, markedBy) => {
  await db.execute(
    `INSERT INTO attendance_daily_summary
       (employee_id, attendance_date, status, is_manually_marked, manually_marked_by, manually_marked_at)
     VALUES (?, ?, ?, 1, ?, NOW())
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       is_manually_marked = 1,
       manually_marked_by = VALUES(manually_marked_by),
       manually_marked_at = NOW()`,
    [employeeId, date, status, markedBy]
  );
};

/* ─────────────────────────────────────────────
   LATE-BUFFER POOL
───────────────────────────────────────────── */

/** Get or create the buffer record for an employee + period.
 *  Reads the allocation from the employee's role (staff_roles.monthly_buffer_minutes).
 *  Falls back to defaultMinutes if no role found. */
const getOrCreateBuffer = async (employeeId, month, year, defaultMinutes = 30) => {
  // Fetch the role-based allocation
  const [roleRows] = await db.execute(
    `SELECT COALESCE(sr.monthly_buffer_minutes, ?) AS alloc
     FROM employees e
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     WHERE e.id = ?`,
    [defaultMinutes, employeeId]
  );
  const allocMinutes = roleRows[0]?.alloc ?? defaultMinutes;

  await db.execute(
    // buffer_remaining_minutes is a generated column — never write to it.
    `INSERT IGNORE INTO employee_attendance_buffers
       (employee_id, period_month, period_year, buffer_allocated_minutes, buffer_used_minutes)
     VALUES (?, ?, ?, ?, 0)`,
    [employeeId, month, year, allocMinutes]
  );
  const [rows] = await db.execute(
    `SELECT * FROM employee_attendance_buffers
     WHERE employee_id = ? AND period_month = ? AND period_year = ?`,
    [employeeId, month, year]
  );
  return rows[0];
};

/** Get full buffer status for one employee in a period, including role allocation. */
const getEmployeeBufferWithRole = async (employeeId, month, year) => {
  // Ensure buffer row exists
  const [roleRows] = await db.execute(
    `SELECT COALESCE(sr.monthly_buffer_minutes, 30) AS alloc, sr.name AS role_name
     FROM employees e
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     WHERE e.id = ?`,
    [employeeId]
  );
  const allocMinutes = roleRows[0]?.alloc ?? 30;
  const roleName = roleRows[0]?.role_name ?? 'Unknown';

  await db.execute(
    // buffer_remaining_minutes is a generated column — never write to it.
    `INSERT IGNORE INTO employee_attendance_buffers
       (employee_id, period_month, period_year, buffer_allocated_minutes, buffer_used_minutes)
     VALUES (?, ?, ?, ?, 0)`,
    [employeeId, month, year, allocMinutes]
  );
  const [rows] = await db.execute(
    `SELECT eab.*, e.full_name
     FROM employee_attendance_buffers eab
     JOIN employees e ON e.id = eab.employee_id
     WHERE eab.employee_id = ? AND eab.period_month = ? AND eab.period_year = ?`,
    [employeeId, month, year]
  );
  return { ...rows[0], role_name: roleName, role_allocated_minutes: allocMinutes };
};

/** Deduct lateMinutes from the pool. buffer_remaining_minutes is generated. */
const deductFromBuffer = async (bufferId, lateMinutes) => {
  await db.execute(
    `UPDATE employee_attendance_buffers
     SET buffer_used_minutes = LEAST(buffer_allocated_minutes, buffer_used_minutes + ?)
     WHERE id = ?`,
    [lateMinutes, bufferId]
  );
};

/** Log a buffer deduction event. */
const logBufferDeduction = async ({ employee_id, attendance_date, late_minutes_deducted, buffer_remaining_after, attendance_summary_id }) => {
  await db.execute(
    `INSERT INTO buffer_deductions
       (employee_id, attendance_date, late_minutes_deducted, buffer_remaining_after, attendance_summary_id)
     VALUES (?, ?, ?, ?, ?)`,
    [employee_id, attendance_date, late_minutes_deducted, buffer_remaining_after, attendance_summary_id]
  );
};

/** Get buffer summary for all employees in a given month. */
const getBufferSummary = async (month, year, departmentId = null) => {
  const params = [month, year];
  let deptFilter = '';
  if (departmentId) {
    deptFilter = 'AND e.department_id = ?';
    params.push(departmentId);
  }
  const [rows] = await db.execute(
    `SELECT eab.*, e.full_name, e.employee_code, d.name AS department_name
     FROM employee_attendance_buffers eab
     JOIN employees e ON e.id = eab.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE eab.period_month = ? AND eab.period_year = ?
       ${deptFilter}
     ORDER BY e.full_name`,
    params
  );
  return rows;
};

/* ─────────────────────────────────────────────
   CORRECTION REQUESTS
───────────────────────────────────────────── */

const listCorrectionRequests = async ({ status, employeeId, page = 1, limit = 30 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (status) { filters.push('acr.status = ?'); params.push(status); }
  if (employeeId) { filters.push('acr.employee_id = ?'); params.push(employeeId); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT acr.*, e.full_name, e.employee_code,
            u.username AS reviewed_by_name
     FROM attendance_correction_requests acr
     JOIN employees e ON e.id = acr.employee_id
     LEFT JOIN users u ON u.id = acr.reviewed_by
     ${where}
     ORDER BY acr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM attendance_correction_requests acr ${where}`,
    params
  );
  return { rows, total };
};

const getCorrectionRequest = async (id) => {
  const [rows] = await db.execute(
    `SELECT * FROM attendance_correction_requests WHERE id = ?`, [id]
  );
  return rows[0] ?? null;
};

const createCorrectionRequest = async ({ employee_id, attendance_date, requested_in_time, requested_out_time, reason }) => {
  const [result] = await db.execute(
    `INSERT INTO attendance_correction_requests
       (employee_id, attendance_date, requested_in_time, requested_out_time, reason, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [employee_id, attendance_date, requested_in_time ?? null, requested_out_time ?? null, reason]
  );
  return result.insertId;
};

// Note: this table has no reviewer_notes column — the decision is the record.
const reviewCorrectionRequest = async (id, { status, reviewed_by }) => {
  await db.execute(
    `UPDATE attendance_correction_requests
     SET status = ?, reviewed_by = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [status, reviewed_by ?? null, id]
  );
};

const deleteRawPunches = async (employeeId, date) => {
  await db.execute(
    `DELETE FROM attendance_raw_punches
     WHERE employee_id = ? AND DATE(punch_time) = ?`,
    [employeeId, date]
  );
};

module.exports = {
  bulkInsertPunches,
  resolveEmployeeCodes,
  linkOrphanPunches,
  getUnprocessedPunches,
  getUnmatchedPunches,
  getCorrectionRequest,
  getBiometricWindow,
  listBiometricWindows,
  createBiometricWindow,
  getDailySummary,
  listDailySummaries,
  upsertDailySummary,
  markLeaveDays,
  adminMarkAttendance,
  getOrCreateBuffer,
  getEmployeeBufferWithRole,
  deductFromBuffer,
  logBufferDeduction,
  getBufferSummary,
  listCorrectionRequests,
  createCorrectionRequest,
  reviewCorrectionRequest,
  deleteRawPunches,
};
