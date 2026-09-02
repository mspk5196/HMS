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

/** Fetch all raw biometric punches with employee details and flexible filters */
const listRawPunches = async ({ employeeId, employeeCode, departmentId, fromDate, toDate, search, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (employeeId) {
    conditions.push('arp.employee_id = ?');
    params.push(employeeId);
  }
  if (employeeCode) {
    conditions.push('arp.employee_code = ?');
    params.push(employeeCode);
  }
  if (departmentId) {
    conditions.push('e.department_id = ?');
    params.push(departmentId);
  }
  if (fromDate) {
    conditions.push('DATE(arp.punch_time) >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('DATE(arp.punch_time) <= ?');
    params.push(toDate);
  }
  if (search) {
    conditions.push('(e.full_name LIKE ? OR arp.employee_code LIKE ? OR arp.device_id LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT arp.*,
            e.full_name AS employee_name,
            e.employee_code AS registered_employee_code,
            d.name AS department_name,
            sr.name AS designation_name,
            COALESCE(s.name, sr.shift_name, 'Day Shift') AS shift_name,
            COALESCE(s.start_time, sr.shift_start_time, '09:00:00') AS shift_start_time,
            COALESCE(s.end_time, sr.shift_end_time, '17:00:00') AS shift_end_time,
            COALESCE(s.biometric_in_start, sr.biometric_in_start) AS biometric_in_start,
            COALESCE(s.biometric_in_end, sr.biometric_in_end) AS biometric_in_end,
            COALESCE(s.biometric_out_start, sr.biometric_out_start) AS biometric_out_start,
            COALESCE(s.biometric_out_end, sr.biometric_out_end) AS biometric_out_end
     FROM attendance_raw_punches arp
     LEFT JOIN employees e ON (e.id = arp.employee_id OR e.employee_code = arp.employee_code)
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     LEFT JOIN shifts s ON s.id = sr.default_shift_id
     ${whereClause}
     ORDER BY arp.punch_time DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM attendance_raw_punches arp
     LEFT JOIN employees e ON (e.id = arp.employee_id OR e.employee_code = arp.employee_code)
     ${whereClause}`,
    params
  );

  return { rows, total };
};

/** Get comprehensive biometric punch timeline & daily summary for a specific employee */
const getEmployeeBiometricTimeline = async (employeeId, fromDate, toDate) => {
  // 1. Employee Info & Assigned Shift
  const [empRows] = await db.query(
    `SELECT e.*, d.name AS department_name, sr.name AS designation_name,
            COALESCE(s.name, sr.shift_name, 'Day Shift') AS shift_name,
            COALESCE(s.start_time, sr.shift_start_time, '09:00:00') AS shift_start,
            COALESCE(s.end_time, sr.shift_end_time, '17:00:00') AS shift_end,
            COALESCE(s.biometric_in_start, sr.biometric_in_start) AS biometric_in_start,
            COALESCE(s.biometric_in_end, sr.biometric_in_end) AS biometric_in_end,
            COALESCE(s.biometric_out_start, sr.biometric_out_start) AS biometric_out_start,
            COALESCE(s.biometric_out_end, sr.biometric_out_end) AS biometric_out_end,
            COALESCE(s.grace_period_minutes, sr.grace_period_minutes, 10) AS grace_period_minutes
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     LEFT JOIN shifts s ON s.id = sr.default_shift_id
     WHERE e.id = ?`,
    [employeeId]
  );
  const employee = empRows[0] ?? null;
  if (!employee) return null;

  // 2. Raw Punches in Date Range
  const [punches] = await db.query(
    `SELECT arp.*, DATE(arp.punch_time) AS punch_date, TIME(arp.punch_time) AS punch_clock
     FROM attendance_raw_punches arp
     WHERE (arp.employee_id = ? OR arp.employee_code = ?)
       AND DATE(arp.punch_time) BETWEEN ? AND ?
     ORDER BY arp.punch_time ASC`,
    [employeeId, employee.employee_code, fromDate, toDate]
  );

  // 3. Processed Daily Summaries in Date Range
  const [summaries] = await db.query(
    `SELECT ads.*, DATE(ads.attendance_date) AS summary_date
     FROM attendance_daily_summary ads
     WHERE ads.employee_id = ?
       AND ads.attendance_date BETWEEN ? AND ?
     ORDER BY ads.attendance_date ASC`,
    [employeeId, fromDate, toDate]
  );

  return { employee, punches, summaries };
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

/* ─────────────────────────────────────────────
   BIOMETRIC DEVICES (eSSL / ZKTeco Terminals)
───────────────────────────────────────────── */

/** Helper to parse multiple .env devices (JSON, comma-separated, or single IP) */
const getEnvDevices = () => {
  const devices = [];

  // 1. JSON Array: ESSL_DEVICES='[{"name":"Main Reception","ip":"192.168.1.201","port":4370,"location":"Reception"},{"name":"ICU","ip":"192.168.1.202","port":4370,"location":"ICU"}]'
  if (process.env.ESSL_DEVICES) {
    try {
      const parsed = JSON.parse(process.env.ESSL_DEVICES);
      if (Array.isArray(parsed)) {
        parsed.forEach((d, idx) => {
          const ip = d.ip || d.ip_address;
          if (ip) {
            devices.push({
              id: idx + 1,
              name: d.name || `eSSL Device ${idx + 1}`,
              device_type: d.device_type || 'essl_standalone',
              ip_address: ip,
              port: Number(d.port) || 4370,
              comm_key: String(d.comm_key || '0'),
              location: d.location || `Location ${idx + 1}`,
              status: 'offline',
              auto_sync_enabled: d.auto_sync_enabled !== false ? 1 : 0,
              sync_interval_mins: Number(d.sync_interval_mins) || 15,
              is_from_env: true,
            });
          }
        });
      }
    } catch (e) {
      console.warn('Failed to parse ESSL_DEVICES JSON from .env:', e.message);
    }
  }

  // 2. Comma-separated list: ESSL_DEVICE_IPS=192.168.1.201,192.168.1.202
  if (devices.length === 0 && process.env.ESSL_DEVICE_IPS) {
    const ips = process.env.ESSL_DEVICE_IPS.split(',').map((s) => s.trim()).filter(Boolean);
    ips.forEach((ip, idx) => {
      devices.push({
        id: idx + 1,
        name: `eSSL Device ${idx + 1} (${ip})`,
        device_type: 'essl_standalone',
        ip_address: ip,
        port: Number(process.env.ESSL_DEVICE_PORT) || 4370,
        comm_key: process.env.ESSL_DEVICE_COMM_KEY || '0',
        location: `Location ${idx + 1}`,
        status: 'offline',
        auto_sync_enabled: 1,
        sync_interval_mins: Number(process.env.ESSL_AUTO_SYNC_INTERVAL_MINS) || 15,
        is_from_env: true,
      });
    });
  }

  // 3. Single device: ESSL_DEVICE_IP=192.168.1.201
  if (devices.length === 0 && process.env.ESSL_DEVICE_IP) {
    devices.push({
      id: 1,
      name: process.env.ESSL_DEVICE_NAME || 'eSSL Main Entrance',
      device_type: 'essl_standalone',
      ip_address: process.env.ESSL_DEVICE_IP,
      port: Number(process.env.ESSL_DEVICE_PORT) || 4370,
      comm_key: process.env.ESSL_DEVICE_COMM_KEY || '0',
      location: process.env.ESSL_DEVICE_LOCATION || 'Main Entrance Reception',
      status: 'offline',
      auto_sync_enabled: process.env.ESSL_AUTO_SYNC_ENABLED !== 'false' ? 1 : 0,
      sync_interval_mins: Number(process.env.ESSL_AUTO_SYNC_INTERVAL_MINS) || 15,
      is_from_env: true,
    });
  }

  return devices;
};

/** Ensure biometric_devices table exists and seed from .env if needed */
const ensureBiometricDevicesTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS \`biometric_devices\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`name\` varchar(100) NOT NULL,
      \`device_type\` enum('essl_standalone', 'essl_adms_push', 'zkteco') NOT NULL DEFAULT 'essl_standalone',
      \`ip_address\` varchar(50) NOT NULL,
      \`port\` int unsigned NOT NULL DEFAULT 4370,
      \`comm_key\` varchar(50) NULL DEFAULT '0',
      \`serial_number\` varchar(100) NULL DEFAULT NULL,
      \`location\` varchar(100) NULL DEFAULT 'Main Entrance',
      \`status\` enum('online', 'offline', 'unreachable') NOT NULL DEFAULT 'offline',
      \`last_sync_at\` datetime NULL DEFAULT NULL,
      \`last_sync_count\` int unsigned NOT NULL DEFAULT 0,
      \`auto_sync_enabled\` tinyint(1) NOT NULL DEFAULT 1,
      \`sync_interval_mins\` int unsigned NOT NULL DEFAULT 15,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
  `);

  // Upsert any devices defined in .env
  const envDevices = getEnvDevices();
  for (const dev of envDevices) {
    try {
      await db.query(`
        INSERT INTO biometric_devices (id, name, device_type, ip_address, port, comm_key, location, auto_sync_enabled, sync_interval_mins)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          ip_address = VALUES(ip_address),
          port = VALUES(port),
          comm_key = VALUES(comm_key),
          location = VALUES(location);
      `, [dev.id, dev.name, dev.device_type, dev.ip_address, dev.port, dev.comm_key, dev.location, dev.auto_sync_enabled, dev.sync_interval_mins]);
    } catch (e) {
      console.warn(`Failed to seed device ${dev.name}:`, e.message);
    }
  }
};

/** List all configured biometric devices */
const listBiometricDevices = async () => {
  try {
    await ensureBiometricDevicesTable();
    const [rows] = await db.query(
      `SELECT * FROM biometric_devices ORDER BY id ASC`
    );
    if (rows && rows.length > 0) return rows;
    return getEnvDevices();
  } catch (err) {
    console.error('listBiometricDevices query error:', err);
    return getEnvDevices();
  }
};

/** Get biometric device by ID */
const getBiometricDevice = async (id) => {
  try {
    await ensureBiometricDevicesTable();
    const [rows] = await db.execute(
      `SELECT * FROM biometric_devices WHERE id = ?`,
      [id]
    );
    if (rows[0]) return rows[0];
  } catch (err) {
    console.error('getBiometricDevice error:', err);
  }
  const envDevices = getEnvDevices();
  return envDevices.find((d) => d.id === Number(id)) || envDevices[0] || null;
};

/** Create a new biometric device entry */
const createBiometricDevice = async (data) => {
  await ensureBiometricDevicesTable();
  const { name, device_type, ip_address, port, comm_key, location, auto_sync_enabled, sync_interval_mins } = data;
  const [res] = await db.execute(
    `INSERT INTO biometric_devices
       (name, device_type, ip_address, port, comm_key, location, auto_sync_enabled, sync_interval_mins, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'offline')`,
    [
      name,
      device_type || 'essl_standalone',
      ip_address,
      port || 4370,
      comm_key || '0',
      location || 'Main Entrance',
      auto_sync_enabled !== undefined ? (auto_sync_enabled ? 1 : 0) : 1,
      sync_interval_mins || 15,
    ]
  );
  return res.insertId;
};

/** Update an existing biometric device entry */
const updateBiometricDevice = async (id, data) => {
  await ensureBiometricDevicesTable();
  const { name, device_type, ip_address, port, comm_key, location, auto_sync_enabled, sync_interval_mins, status } = data;
  const fields = [];
  const params = [];

  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (device_type !== undefined) { fields.push('device_type = ?'); params.push(device_type); }
  if (ip_address !== undefined) { fields.push('ip_address = ?'); params.push(ip_address); }
  if (port !== undefined) { fields.push('port = ?'); params.push(port); }
  if (comm_key !== undefined) { fields.push('comm_key = ?'); params.push(comm_key); }
  if (location !== undefined) { fields.push('location = ?'); params.push(location); }
  if (auto_sync_enabled !== undefined) { fields.push('auto_sync_enabled = ?'); params.push(auto_sync_enabled ? 1 : 0); }
  if (sync_interval_mins !== undefined) { fields.push('sync_interval_mins = ?'); params.push(sync_interval_mins); }
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }

  if (!fields.length) return false;
  params.push(id);

  const [res] = await db.execute(
    `UPDATE biometric_devices SET ${fields.join(', ')} WHERE id = ?`,
    params
  );
  return res.affectedRows > 0;
};

/** Delete a biometric device entry */
const deleteBiometricDevice = async (id) => {
  await ensureBiometricDevicesTable();
  const [res] = await db.execute(
    `DELETE FROM biometric_devices WHERE id = ?`,
    [id]
  );
  return res.affectedRows > 0;
};

/** Update device live status and last sync timestamp */
const updateDeviceSyncStatus = async (id, { status, last_sync_at, last_sync_count }) => {
  await ensureBiometricDevicesTable();
  await db.execute(
    `UPDATE biometric_devices
     SET status = ?, last_sync_at = ?, last_sync_count = ?
     WHERE id = ?`,
    [status || 'offline', last_sync_at || new Date(), last_sync_count || 0, id]
  );
};

module.exports = {
  bulkInsertPunches,
  resolveEmployeeCodes,
  linkOrphanPunches,
  getUnprocessedPunches,
  getUnmatchedPunches,
  listRawPunches,
  getEmployeeBiometricTimeline,
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
  ensureBiometricDevicesTable,
  listBiometricDevices,
  getBiometricDevice,
  createBiometricDevice,
  updateBiometricDevice,
  deleteBiometricDevice,
  updateDeviceSyncStatus,
};

