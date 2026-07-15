/**
 * attendance.queries.js
 * All raw SQL for the Attendance module.
 * Functions return [rows] from db.execute(); callers destructure as needed.
 */

const db = require('../../config/db');

/* ─────────────────────────────────────────────
   RAW PUNCHES (eSSL biometric import)
───────────────────────────────────────────── */

/** Bulk-insert raw punches coming from eTimeTracker export.
 *  Uses INSERT IGNORE to safely skip duplicate device+timestamp pairs. */
const bulkInsertPunches = async (rows) => {
  if (!rows.length) return;
  const values = rows.map((r) => [r.employee_id, r.device_id ?? null, r.punch_time, r.punch_type ?? 'in']);
  await db.query(
    `INSERT IGNORE INTO attendance_raw_punches
       (employee_id, device_id, punch_time, punch_type)
     VALUES ?`,
    [values]
  );
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
    `SELECT ads.*, e.full_name, s.name AS shift_name
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
    `SELECT ads.*, e.full_name, e.employee_code, d.name AS department_name, s.name AS shift_name
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
    first_punch_in, last_punch_out, worked_minutes,
    late_minutes, is_missed_punch,
  } = data;

  await db.execute(
    `INSERT INTO attendance_daily_summary
       (employee_id, attendance_date, shift_id, status,
        first_punch_in, last_punch_out, worked_minutes,
        late_minutes, is_missed_punch)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       shift_id = VALUES(shift_id),
       status = VALUES(status),
       first_punch_in = VALUES(first_punch_in),
       last_punch_out = VALUES(last_punch_out),
       worked_minutes = VALUES(worked_minutes),
       late_minutes = VALUES(late_minutes),
       is_missed_punch = VALUES(is_missed_punch)`,
    [employee_id, attendance_date, shift_id ?? null, status,
     first_punch_in ?? null, last_punch_out ?? null,
     worked_minutes ?? 0, late_minutes ?? 0, is_missed_punch ? 1 : 0]
  );
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

/** Get or create the buffer record for an employee + period. */
const getOrCreateBuffer = async (employeeId, month, year, defaultMinutes = 30) => {
  await db.execute(
    `INSERT IGNORE INTO employee_attendance_buffers
       (employee_id, period_month, period_year, buffer_allocated_minutes)
     VALUES (?, ?, ?, ?)`,
    [employeeId, month, year, defaultMinutes]
  );
  const [rows] = await db.execute(
    `SELECT * FROM employee_attendance_buffers
     WHERE employee_id = ? AND period_month = ? AND period_year = ?`,
    [employeeId, month, year]
  );
  return rows[0];
};

/** Deduct lateMinutes from the buffer, update used_minutes. */
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

const createCorrectionRequest = async ({ employee_id, attendance_date, requested_first_in, requested_last_out, reason }) => {
  const [result] = await db.execute(
    `INSERT INTO attendance_correction_requests
       (employee_id, attendance_date, requested_first_in, requested_last_out, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [employee_id, attendance_date, requested_first_in ?? null, requested_last_out ?? null, reason]
  );
  return result.insertId;
};

const reviewCorrectionRequest = async (id, { status, reviewer_notes, reviewed_by }) => {
  await db.execute(
    `UPDATE attendance_correction_requests
     SET status = ?, reviewer_notes = ?, reviewed_by = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [status, reviewer_notes ?? null, reviewed_by, id]
  );
};

module.exports = {
  bulkInsertPunches,
  getUnprocessedPunches,
  getBiometricWindow,
  listBiometricWindows,
  createBiometricWindow,
  getDailySummary,
  listDailySummaries,
  upsertDailySummary,
  adminMarkAttendance,
  getOrCreateBuffer,
  deductFromBuffer,
  logBufferDeduction,
  getBufferSummary,
  listCorrectionRequests,
  createCorrectionRequest,
  reviewCorrectionRequest,
};
