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

  // Auto-record newly seen employee codes into biometric_enrolled_users
  try {
    const codes = Array.from(new Set(rows.map((r) => String(r.employee_code || '').trim()).filter(Boolean)));
    if (codes.length > 0) {
      await autoRecordPunchesInEnrolledUsers(codes);
    }
  } catch (err) {
    console.warn('[bulkInsertPunches] Warning recording enrolled users:', err.message);
  }

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

/** Fetch all raw punches for a given date range (including already processed). */
const getPunchesForDate = async (fromDate, toDate) => {
  const [rows] = await db.execute(
    `SELECT arp.*, e.full_name, e.designation_id, e.department_id
     FROM attendance_raw_punches arp
     JOIN employees e ON e.id = arp.employee_id
     WHERE DATE(arp.punch_time) BETWEEN ? AND ?
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
    `SELECT e.*, d.name AS department_name, sr.name AS designation_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     WHERE e.id = ?`,
    [employeeId]
  );
  let employee = empRows[0] ?? null;
  if (!employee) return null;

  let shiftName = 'Day Shift';
  let shiftStart = '08:00:00';
  let shiftEnd = '18:00:00';
  let graceMins = 10;

  if (employee.shift_category === 'night') {
    const [sRows] = await db.query(`SELECT name, start_time, end_time, grace_period_minutes FROM shifts WHERE is_night_shift = 1 ORDER BY id ASC LIMIT 1`);
    if (sRows.length) {
      shiftName = sRows[0].name || 'Night Shift';
      shiftStart = sRows[0].start_time || '18:00:00';
      shiftEnd = sRows[0].end_time || '08:00:00';
      graceMins = sRows[0].grace_period_minutes ?? 10;
    }
  } else if (employee.shift_category === 'day') {
    const [sRows] = await db.query(`SELECT name, start_time, end_time, grace_period_minutes FROM shifts WHERE is_night_shift = 0 ORDER BY id ASC LIMIT 1`);
    if (sRows.length) {
      shiftName = sRows[0].name || 'Day Shift';
      shiftStart = sRows[0].start_time || '08:00:00';
      shiftEnd = sRows[0].end_time || '18:00:00';
      graceMins = sRows[0].grace_period_minutes ?? 10;
    }
  } else if (employee.shift_category === 'general') {
    shiftName = 'General Shift';
    shiftStart = employee.custom_shift_start || '09:00:00';
    shiftEnd = employee.custom_shift_end || '17:00:00';
    graceMins = employee.custom_buffer_minutes ?? 10;
  } else if (employee.shift_category === 'day_and_night') {
    shiftName = 'Day & Night Shift';
    shiftStart = employee.custom_shift_start || '08:00:00';
    shiftEnd = employee.custom_shift_end || '18:00:00';
    graceMins = 10;
  }

  const adjustMins = (t, delta) => {
    if (!t) return null;
    const [h, m] = String(t).split(':').map(Number);
    const adj = (h * 60 + m + delta + 14400) % 1440;
    return `${String(Math.floor(adj / 60)).padStart(2, '0')}:${String(adj % 60).padStart(2, '0')}:00`;
  };

  employee = {
    ...employee,
    shift_name: shiftName,
    shift_start: shiftStart,
    shift_end: shiftEnd,
    biometric_in_start: adjustMins(shiftStart, -60),
    biometric_in_end: shiftStart,
    biometric_out_start: shiftEnd,
    biometric_out_end: adjustMins(shiftEnd, 60),
    grace_period_minutes: graceMins,
  };

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

  // 4. Leave Applications in Date Range
  const [leaves] = await db.query(
    `SELECT lr.*, lt.name AS leave_type_name
     FROM leave_requests lr
     JOIN leave_types lt ON lt.id = lr.leave_type_id
     WHERE lr.employee_id = ?
       AND lr.from_date <= ? AND lr.to_date >= ?
     ORDER BY lr.from_date ASC`,
    [employeeId, toDate, fromDate]
  );

  return { employee, punches, summaries, leaves };
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

/** List daily summaries for a date range, optionally filtered by employee, department, search, and status. */
/** List daily summaries for a date range, optionally filtered by employee, department, search, and status. */
const listDailySummaries = async ({ fromDate, toDate, employeeId, departmentId, search, status, page = 1, limit = 50 }) => {
  const isSingleDay = fromDate === toDate;
  const isAll = Number(limit) === -1 || Number(limit) >= 1000;
  const lim = isAll ? 5000 : Math.max(1, Number(limit) || 50);
  const offset = isAll ? 0 : (Math.max(1, Number(page) || 1) - 1) * lim;

  // If viewing a single date (Daily Log view), start from employees to include all staff
  if (isSingleDay) {
    const filters = ["e.status = 'active'"];
    const params = [fromDate]; // For ON ads.attendance_date = ?

    if (employeeId) {
      filters.push('e.id = ?');
      params.push(employeeId);
    }
    if (departmentId) {
      filters.push('e.department_id = ?');
      params.push(departmentId);
    }
    if (search && String(search).trim()) {
      filters.push('(e.full_name LIKE ? OR e.employee_code LIKE ?)');
      params.push(`%${String(search).trim()}%`, `%${String(search).trim()}%`);
    }
    if (status && status !== 'all') {
      if (status === 'missed_punch') {
        filters.push('ads.is_missed_punch = 1');
      } else if (status === 'absent') {
        filters.push("(ads.status = 'absent' OR ads.status IS NULL)");
      } else {
        filters.push('ads.status = ?');
        params.push(status);
      }
    }

    const where = filters.join(' AND ');

    const [rows] = await db.query(
      `SELECT
         COALESCE(ads.id, NULL) AS id,
         e.id AS employee_id,
         ? AS attendance_date,
         ads.shift_id,
         COALESCE(ads.status, 'absent') AS status,
         ads.first_in_time AS first_punch_in,
         ads.last_out_time AS last_punch_out,
         ads.first_in_time,
         ads.last_out_time,
         COALESCE(ads.worked_minutes, 0) AS worked_minutes,
         COALESCE(ads.break_minutes, 0) AS break_minutes,
         COALESCE(ads.late_minutes, 0) AS late_minutes,
         COALESCE(ads.early_leave_minutes, 0) AS early_leave_minutes,
         COALESCE(ads.is_missed_punch, 0) AS is_missed_punch,
         COALESCE(ads.is_manually_marked, 0) AS is_manually_marked,
         ads.manually_marked_by,
         ads.manually_marked_at,
         ads.manual_marking_reason,
         COALESCE(u_emp.full_name, u.username, 'Admin') AS marked_by_user_name,
         e.full_name,
         e.employee_code,
         d.name AS department_name,
         COALESCE(s.name, e.shift_category, 'General Duty') AS shift_name
       FROM employees e
       LEFT JOIN attendance_daily_summary ads ON ads.employee_id = e.id AND ads.attendance_date = ?
       LEFT JOIN users u ON u.id = ads.manually_marked_by
       LEFT JOIN employees u_emp ON u_emp.id = u.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN shifts s ON s.id = ads.shift_id
       WHERE ${where}
       ORDER BY
         (CASE WHEN ads.first_in_time IS NOT NULL OR ads.status IN ('present', 'late_present') THEN 0 ELSE 1 END),
         COALESCE(ads.last_out_time, ads.first_in_time) DESC,
         ads.first_in_time DESC,
         d.name ASC,
         e.full_name ASC
       LIMIT ? OFFSET ?`,
      [fromDate, fromDate, ...params.slice(1), lim, offset]
    );

    const [[{ total }]] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM employees e
       LEFT JOIN attendance_daily_summary ads ON ads.employee_id = e.id AND ads.attendance_date = ?
       WHERE ${where}`,
      [fromDate, ...params.slice(1)]
    );

    return { rows, total };
  }

  // Multi-day range query:
  const filters = [];
  const params = [fromDate, toDate];
  filters.push('ads.attendance_date BETWEEN ? AND ?');

  if (employeeId) { filters.push('ads.employee_id = ?'); params.push(employeeId); }
  if (departmentId) { filters.push('e.department_id = ?'); params.push(departmentId); }
  if (search && String(search).trim()) {
    filters.push('(e.full_name LIKE ? OR e.employee_code LIKE ?)');
    params.push(`%${String(search).trim()}%`, `%${String(search).trim()}%`);
  }
  if (status && status !== 'all') {
    if (status === 'missed_punch') {
      filters.push('ads.is_missed_punch = 1');
    } else {
      filters.push('ads.status = ?');
      params.push(status);
    }
  }

  const where = filters.join(' AND ');

  const [rows] = await db.query(
    `SELECT ads.*, ads.first_in_time AS first_punch_in, ads.last_out_time AS last_punch_out, e.full_name, e.employee_code, d.name AS department_name, s.name AS shift_name
     FROM attendance_daily_summary ads
     JOIN employees e ON e.id = ads.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN shifts s ON s.id = ads.shift_id
     WHERE ${where}
     ORDER BY ads.attendance_date DESC, COALESCE(ads.last_out_time, ads.first_in_time) DESC, ads.first_in_time DESC, e.full_name ASC
     LIMIT ? OFFSET ?`,
    [...params, lim, offset]
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

/** Get comprehensive attendance register & matrix (daily/weekly/monthly) */
const getAttendanceRegister = async ({ fromDate, toDate, departmentId, search, status }) => {
  const empFilters = ["e.status = 'active'"];
  const empParams = [];

  if (departmentId) {
    empFilters.push('e.department_id = ?');
    empParams.push(departmentId);
  }
  if (search && String(search).trim()) {
    empFilters.push('(e.full_name LIKE ? OR e.employee_code LIKE ?)');
    empParams.push(`%${String(search).trim()}%`, `%${String(search).trim()}%`);
  }

  const empWhere = empFilters.join(' AND ');

  const [employees] = await db.query(
    `SELECT e.id, e.employee_code, e.full_name, e.department_id, e.designation_id, e.shift_category,
            d.name AS department_name, sr.name AS designation_name,
            e.custom_shift_start, e.custom_shift_end
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     WHERE ${empWhere}
     ORDER BY d.name ASC, e.full_name ASC`,
    empParams
  );

  const sumFilters = ['ads.attendance_date BETWEEN ? AND ?'];
  const sumParams = [fromDate, toDate];
  if (departmentId) {
    sumFilters.push('e.department_id = ?');
    sumParams.push(departmentId);
  }
  const sumWhere = sumFilters.join(' AND ');

  const [summaries] = await db.query(
    `SELECT ads.employee_id, ads.attendance_date, ads.status, ads.first_in_time, ads.last_out_time,
            ads.worked_minutes, ads.late_minutes, ads.early_leave_minutes, ads.is_missed_punch,
            COALESCE(ads.is_manually_marked, 0) AS is_manually_marked,
            ads.manually_marked_by,
            ads.manually_marked_at,
            ads.manual_marking_reason,
            COALESCE(u_emp.full_name, u.username, 'Admin') AS marked_by_user_name,
            s.name AS shift_name
     FROM attendance_daily_summary ads
     JOIN employees e ON e.id = ads.employee_id
     LEFT JOIN users u ON u.id = ads.manually_marked_by
     LEFT JOIN employees u_emp ON u_emp.id = u.employee_id
     LEFT JOIN shifts s ON s.id = ads.shift_id
     WHERE ${sumWhere}
     ORDER BY ads.attendance_date ASC`,
    sumParams
  );

  // Group summaries by employee_id
  const summaryMap = new Map();
  for (const row of summaries) {
    if (!summaryMap.has(row.employee_id)) {
      summaryMap.set(row.employee_id, {});
    }
    const dStr = String(row.attendance_date).slice(0, 10);
    summaryMap.get(row.employee_id)[dStr] = row;
  }

  // Build matrix results
  let overallPresent = 0;
  let overallLate = 0;
  let overallAbsent = 0;
  let overallLeaves = 0;
  let overallWorkedMinutes = 0;

  const resultRows = [];

  for (const emp of employees) {
    const dayMap = summaryMap.get(emp.id) || {};
    let pCount = 0;
    let lCount = 0;
    let aCount = 0;
    let leaveCount = 0;
    let lopCount = 0;
    let woCount = 0;
    let hdCount = 0;
    let mpCount = 0;
    let totalMins = 0;

    for (const dStr of Object.keys(dayMap)) {
      const rec = dayMap[dStr];
      if (rec.status === 'present') pCount++;
      else if (rec.status === 'late_present') { pCount++; lCount++; }
      else if (rec.status === 'absent') aCount++;
      else if (rec.status === 'on_leave') leaveCount++;
      else if (rec.status === 'lop') lopCount++;
      else if (rec.status === 'week_off') woCount++;
      else if (rec.status === 'holiday') hdCount++;

      if (rec.is_missed_punch) mpCount++;
      totalMins += (Number(rec.worked_minutes) || 0);
    }

    // Apply status filter if requested
    if (status && status !== 'all') {
      if (status === 'present' && pCount === 0) continue;
      if (status === 'absent' && aCount === 0) continue;
      if (status === 'late_present' && lCount === 0) continue;
      if (status === 'on_leave' && (leaveCount === 0 && lopCount === 0)) continue;
      if (status === 'missed_punch' && mpCount === 0) continue;
    }

    overallPresent += pCount;
    overallLate += lCount;
    overallAbsent += aCount;
    overallLeaves += (leaveCount + lopCount);
    overallWorkedMinutes += totalMins;

    resultRows.push({
      employee_id: emp.id,
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      department_name: emp.department_name,
      designation_name: emp.designation_name,
      shift_category: emp.shift_category,
      days: dayMap,
      metrics: {
        present_days: pCount,
        late_days: lCount,
        absent_days: aCount,
        leave_days: leaveCount,
        lop_days: lopCount,
        week_off_days: woCount,
        holiday_days: hdCount,
        missed_punch_days: mpCount,
        total_worked_minutes: totalMins,
        total_worked_hours: (totalMins / 60).toFixed(1),
        attendance_percentage: (pCount + aCount + leaveCount > 0) 
          ? Math.round((pCount / (pCount + aCount + leaveCount)) * 100) 
          : 0
      }
    });
  }

  return {
    fromDate,
    toDate,
    totalEmployees: resultRows.length,
    overallMetrics: {
      total_present_days: overallPresent,
      total_late_days: overallLate,
      total_absent_days: overallAbsent,
      total_leave_days: overallLeaves,
      total_worked_hours: (overallWorkedMinutes / 60).toFixed(1),
      avg_attendance_percentage: resultRows.length > 0 
        ? Math.round(resultRows.reduce((s, r) => s + r.metrics.attendance_percentage, 0) / resultRows.length)
        : 0
    },
    rows: resultRows
  };
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

/** Admin manually marks an employee present/absent for a date with optional in/out times and mandatory reason. */
const adminMarkAttendance = async (employeeId, date, status, markedBy, inTime = null, outTime = null, reason = '') => {
  const fullIn = inTime ? (inTime.includes(' ') ? inTime : `${date} ${inTime.length === 5 ? inTime + ':00' : inTime}`) : null;
  const fullOut = outTime ? (outTime.includes(' ') ? outTime : `${date} ${outTime.length === 5 ? outTime + ':00' : outTime}`) : null;
  const isPresent = status === 'present';

  await db.execute(
    `INSERT INTO attendance_daily_summary
       (employee_id, attendance_date, status, first_in_time, last_out_time,
        worked_minutes, late_minutes, is_missed_punch, is_manually_marked, manually_marked_by, manually_marked_at, manual_marking_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       first_in_time = IF(VALUES(first_in_time) IS NOT NULL, VALUES(first_in_time), first_in_time),
       last_out_time = IF(VALUES(last_out_time) IS NOT NULL, VALUES(last_out_time), last_out_time),
       worked_minutes = IF(VALUES(status) = 'present', GREATEST(COALESCE(worked_minutes, 0), 480), worked_minutes),
       late_minutes = IF(VALUES(status) = 'present', 0, late_minutes),
       is_missed_punch = IF(VALUES(status) = 'present', 0, is_missed_punch),
       is_manually_marked = 1,
       manually_marked_by = VALUES(manually_marked_by),
       manually_marked_at = NOW(),
       manual_marking_reason = VALUES(manual_marking_reason)`,
    [
      employeeId,
      date,
      status,
      fullIn,
      fullOut,
      isPresent ? 480 : 0,
      isPresent ? 0 : 0,
      markedBy ?? null,
      reason || null,
    ]
  );

  // Insert into attendance_manual_logs audit table
  try {
    await db.execute(
      `INSERT INTO attendance_manual_logs
         (employee_id, attendance_date, status, first_in_time, last_out_time, reason, marked_by, marked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        employeeId,
        date,
        status,
        fullIn,
        fullOut,
        reason || 'Manual attendance marking',
        markedBy ?? null,
      ]
    );
  } catch (err) {
    console.error('Failed to write to attendance_manual_logs:', err.message);
  }
};

/* ─────────────────────────────────────────────
   LATE-BUFFER POOL
───────────────────────────────────────────── */

/** Helper to get monthly buffer minutes configured for a shift category */
const getShiftCategoryBuffer = async (shiftCategory) => {
  try {
    if (shiftCategory === 'night') {
      const [rows] = await db.query("SELECT buffer_minutes FROM shifts WHERE is_night_shift = 1 ORDER BY id ASC LIMIT 1");
      if (rows.length && rows[0].buffer_minutes != null) return Number(rows[0].buffer_minutes);
      return 30;
    }
    if (shiftCategory === 'day') {
      const [rows] = await db.query("SELECT buffer_minutes FROM shifts WHERE is_night_shift = 0 ORDER BY id ASC LIMIT 1");
      if (rows.length && rows[0].buffer_minutes != null) return Number(rows[0].buffer_minutes);
      return 30;
    }
    if (shiftCategory === 'day_and_night') {
      const [rows] = await db.query("SELECT config_value FROM system_config WHERE config_key = 'BUFFER_POOL_DAY_AND_NIGHT' LIMIT 1");
      if (rows.length && rows[0].config_value != null) return Number(rows[0].config_value);
      return 30;
    }
    if (shiftCategory === 'general') {
      const [rows] = await db.query("SELECT config_value FROM system_config WHERE config_key = 'BUFFER_POOL_GENERAL' LIMIT 1");
      if (rows.length && rows[0].config_value != null) return Number(rows[0].config_value);
      return 30;
    }
    const [rows] = await db.query("SELECT buffer_minutes FROM shifts WHERE is_night_shift = 0 ORDER BY id ASC LIMIT 1");
    if (rows.length && rows[0].buffer_minutes != null) return Number(rows[0].buffer_minutes);
  } catch (err) {
    // Fallback in case table/columns don't exist yet
  }
  return 30;
};

/** Get or create the buffer record for an employee + period.
 *  Reads the allocation from the employee's shift category.
 *  Falls back to defaultMinutes if not found. */
const getOrCreateBuffer = async (employeeId, month, year, defaultMinutes = 30) => {
  const [empRows] = await db.execute(
    `SELECT e.shift_category FROM employees e WHERE e.id = ?`,
    [employeeId]
  );
  const shiftCat = empRows[0]?.shift_category || 'day';
  const allocMinutes = await getShiftCategoryBuffer(shiftCat);

  await db.execute(
    // buffer_remaining_minutes is a generated column — never write to it.
    `INSERT INTO employee_attendance_buffers
       (employee_id, period_month, period_year, buffer_allocated_minutes, buffer_used_minutes)
     VALUES (?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE
       buffer_allocated_minutes = VALUES(buffer_allocated_minutes)`,
    [employeeId, month, year, allocMinutes]
  );
  const [rows] = await db.execute(
    `SELECT * FROM employee_attendance_buffers
     WHERE employee_id = ? AND period_month = ? AND period_year = ?`,
    [employeeId, month, year]
  );
  return rows[0];
};

/** Get full buffer status for one employee in a period, including shift category allocation. */
const getEmployeeBufferWithRole = async (employeeId, month, year) => {
  const [empRows] = await db.execute(
    `SELECT e.shift_category, sr.name AS role_name
     FROM employees e
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     WHERE e.id = ?`,
    [employeeId]
  );
  const shiftCat = empRows[0]?.shift_category || 'day';
  const roleName = empRows[0]?.role_name ?? 'Unknown';
  const allocMinutes = await getShiftCategoryBuffer(shiftCat);

  await db.execute(
    // buffer_remaining_minutes is a generated column — never write to it.
    `INSERT INTO employee_attendance_buffers
       (employee_id, period_month, period_year, buffer_allocated_minutes, buffer_used_minutes)
     VALUES (?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE
       buffer_allocated_minutes = VALUES(buffer_allocated_minutes)`,
    [employeeId, month, year, allocMinutes]
  );
  const [rows] = await db.execute(
    `SELECT eab.*, e.full_name
     FROM employee_attendance_buffers eab
     JOIN employees e ON e.id = eab.employee_id
     WHERE eab.employee_id = ? AND eab.period_month = ? AND eab.period_year = ?`,
    [employeeId, month, year]
  );
  return { ...rows[0], role_name: roleName, role_allocated_minutes: allocMinutes, shift_category: shiftCat };
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

/** Get buffer summary for all active employees in a given month. */
const getBufferSummary = async (month, year, departmentId = null) => {
  const m = Number(month);
  const y = Number(year);

  // 1. Fetch current global shift buffer allocations
  const [dayRows] = await db.query("SELECT buffer_minutes FROM shifts WHERE is_night_shift = 0 ORDER BY id ASC LIMIT 1");
  const [nightRows] = await db.query("SELECT buffer_minutes FROM shifts WHERE is_night_shift = 1 ORDER BY id ASC LIMIT 1");
  const [cfgRows] = await db.query("SELECT config_key, config_value FROM system_config WHERE config_key IN ('BUFFER_POOL_DAY_AND_NIGHT', 'BUFFER_POOL_GENERAL', 'DEFAULT_BUFFER_MINUTES')");
  
  const cfgMap = {};
  for (const c of cfgRows) cfgMap[c.config_key] = c.config_value;

  const dayAlloc = (dayRows.length && dayRows[0].buffer_minutes != null) ? Number(dayRows[0].buffer_minutes) : 30;
  const nightAlloc = (nightRows.length && nightRows[0].buffer_minutes != null) ? Number(nightRows[0].buffer_minutes) : 30;
  const dayNightAlloc = cfgMap['BUFFER_POOL_DAY_AND_NIGHT'] ? Number(cfgMap['BUFFER_POOL_DAY_AND_NIGHT']) : 30;
  const generalAlloc = cfgMap['BUFFER_POOL_GENERAL'] ? Number(cfgMap['BUFFER_POOL_GENERAL']) : 30;

  const shiftAllocMap = {
    day: dayAlloc,
    night: nightAlloc,
    day_and_night: dayNightAlloc,
    general: generalAlloc,
  };

  // 2. Fetch all active employees
  const params = [m, y];
  let deptFilter = '';
  if (departmentId) {
    deptFilter = 'AND e.department_id = ?';
    params.push(departmentId);
  }

  const [rows] = await db.query(
    `SELECT 
       e.id AS employee_id,
       e.full_name,
       e.employee_code,
       e.shift_category,
       e.department_id,
       d.name AS department_name,
       sr.name AS designation_name,
       eab.id AS buffer_id,
       eab.buffer_allocated_minutes,
       eab.buffer_used_minutes
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     LEFT JOIN employee_attendance_buffers eab 
       ON eab.employee_id = e.id AND eab.period_month = ? AND eab.period_year = ?
     WHERE e.status = 'active'
       ${deptFilter}
     ORDER BY d.name ASC, e.full_name ASC`,
    params
  );

  return rows.map((r) => {
    const shiftCat = r.shift_category || 'day';
    const categoryAlloc = shiftAllocMap[shiftCat] ?? 30;
    const allocated = Number(r.buffer_allocated_minutes ?? categoryAlloc);
    const used = Number(r.buffer_used_minutes ?? 0);
    const remaining = Math.max(0, allocated - used);
    const excess = Math.max(0, used - allocated);

    return {
      id: r.buffer_id || `emp-${r.employee_id}`,
      employee_id: r.employee_id,
      full_name: r.full_name,
      employee_code: r.employee_code,
      department_id: r.department_id,
      department_name: r.department_name,
      designation_name: r.designation_name,
      shift_category: shiftCat,
      period_month: m,
      period_year: y,
      buffer_allocated_minutes: allocated,
      buffer_used_minutes: used,
      buffer_remaining_minutes: remaining,
      buffer_excess_minutes: excess,
    };
  });
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

/* ─────────────────────────────────────────────
   BIOMETRIC ENROLLED USERS (Staff Registrations)
───────────────────────────────────────────── */

/** Ensures biometric_enrolled_users table exists */
const ensureBiometricEnrolledUsersTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS \`biometric_enrolled_users\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`enroll_code\` varchar(50) NOT NULL,
      \`name\` varchar(150) NULL DEFAULT NULL,
      \`device_id\` varchar(100) NULL DEFAULT NULL,
      \`card_number\` varchar(50) NULL DEFAULT NULL,
      \`privilege\` varchar(20) NOT NULL DEFAULT 'user',
      \`has_fingerprint\` tinyint(1) NOT NULL DEFAULT 0,
      \`has_face\` tinyint(1) NOT NULL DEFAULT 0,
      \`has_password\` tinyint(1) NOT NULL DEFAULT 0,
      \`template_count\` int unsigned NOT NULL DEFAULT 0,
      \`registered_at\` datetime NULL DEFAULT NULL,
      \`is_linked\` tinyint(1) NOT NULL DEFAULT 0,
      \`linked_employee_id\` bigint unsigned NULL DEFAULT NULL,
      \`raw_details\` json NULL,
      \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_enroll_code\` (\`enroll_code\`),
      KEY \`idx_is_linked\` (\`is_linked\`),
      KEY \`idx_linked_employee_id\` (\`linked_employee_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
  `);
};

/** Upsert biometric enrolled users */
const upsertBiometricEnrolledUsers = async (users) => {
  if (!Array.isArray(users) || users.length === 0) return { upserted: 0 };
  await ensureBiometricEnrolledUsersTable();

  let count = 0;
  for (const u of users) {
    const enrollCode = String(u.enroll_code || u.employee_code || u.userId || '').trim();
    if (!enrollCode) continue;

    const name = u.name ? String(u.name).trim() : null;
    const deviceId = u.device_id || u.deviceName || 'Biometric Terminal';
    const cardNum = u.card_number || u.cardNumber || null;
    const privilege = u.privilege || 'user';
    const hasFinger = u.has_fingerprint || u.fingerprint ? 1 : 0;
    const hasFace = u.has_face || u.face ? 1 : 0;
    const hasPass = u.has_password || u.password ? 1 : 0;
    const templateCount = Number(u.template_count || u.templateCount) || 0;
    const registeredAt = u.registered_at ? new Date(u.registered_at) : null;
    const rawDetails = u.raw_details ? JSON.stringify(u.raw_details) : null;

    await db.query(
      `INSERT INTO biometric_enrolled_users
        (enroll_code, name, device_id, card_number, privilege, has_fingerprint, has_face, has_password, template_count, registered_at, raw_details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        name = COALESCE(VALUES(name), name),
        device_id = VALUES(device_id),
        card_number = COALESCE(VALUES(card_number), card_number),
        privilege = VALUES(privilege),
        has_fingerprint = GREATEST(has_fingerprint, VALUES(has_fingerprint)),
        has_face = GREATEST(has_face, VALUES(has_face)),
        template_count = GREATEST(template_count, VALUES(template_count)),
        raw_details = COALESCE(VALUES(raw_details), raw_details)`,
      [enrollCode, name, deviceId, cardNum, privilege, hasFinger, hasFace, hasPass, templateCount, registeredAt, rawDetails]
    );
    count++;
  }

  // Auto-link with existing employees
  await autoLinkEnrolledUsers();
  return { upserted: count };
};

/** Automatically links any unlinked enrolled users whose enroll_code matches an employee */
const autoLinkEnrolledUsers = async () => {
  await ensureBiometricEnrolledUsersTable();
  const [res] = await db.query(`
    UPDATE biometric_enrolled_users b
    JOIN employees e ON b.enroll_code = e.employee_code
    SET b.is_linked = 1, b.linked_employee_id = e.id
    WHERE b.is_linked = 0
  `);
  return res.affectedRows;
};

/** Auto-records employee_codes from punches if not already in enrolled users */
const autoRecordPunchesInEnrolledUsers = async (codes) => {
  if (!codes || codes.length === 0) return;
  await ensureBiometricEnrolledUsersTable();
  for (const c of codes) {
    await db.query(`
      INSERT IGNORE INTO biometric_enrolled_users (enroll_code, device_id, has_fingerprint)
      VALUES (?, 'Biometric Punch Terminal', 1)
    `, [c]);
  }
  await autoLinkEnrolledUsers();
};

/** List enrolled users with employee details */
const listBiometricEnrolledUsers = async ({ unlinkedOnly = false, search = '', limit = 100, offset = 0 } = {}) => {
  await ensureBiometricEnrolledUsersTable();
  let where = '1=1';
  const params = [];

  if (unlinkedOnly) {
    where += ' AND b.is_linked = 0';
  }
  if (search) {
    where += ' AND (b.enroll_code LIKE ? OR b.name LIKE ? OR e.full_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const [rows] = await db.query(
    `SELECT 
       b.id,
       b.enroll_code,
       b.name,
       b.device_id,
       b.card_number,
       b.privilege,
       b.has_fingerprint,
       b.has_face,
       b.has_password,
       b.template_count,
       b.registered_at,
       b.is_linked,
       b.linked_employee_id,
       b.created_at,
       b.updated_at,
       e.full_name AS employee_name,
       e.employee_code AS employee_code,
       d.name AS department_name,
       COALESCE(sr.name, des.name) AS designation_title
     FROM biometric_enrolled_users b
     LEFT JOIN employees e ON b.linked_employee_id = e.id OR b.enroll_code = e.employee_code
     LEFT JOIN departments d ON e.department_id = d.id
     LEFT JOIN staff_roles sr ON e.designation_id = sr.id
     LEFT JOIN designations des ON e.designation_id = des.id
     WHERE ${where}
     ORDER BY b.is_linked ASC, b.registered_at DESC, b.id DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM biometric_enrolled_users b
     LEFT JOIN employees e ON b.linked_employee_id = e.id OR b.enroll_code = e.employee_code
     WHERE ${where}`,
    params
  );

  return { users: rows, total: countRows[0].total };
};

/**
 * Calculates the next recommended employee / biometric enrollment code.
 * Scans both biometric_enrolled_users and employees to find the maximum numeric ID.
 */
const getNextBiometricEnrollCode = async () => {
  await ensureBiometricEnrolledUsersTable();
  let maxCode = 1000;
  try {
    const [empRows] = await db.query(`
      SELECT employee_code FROM employees WHERE employee_code IS NOT NULL AND employee_code != ''
    `);
    const [bioRows] = await db.query(`
      SELECT enroll_code FROM biometric_enrolled_users WHERE enroll_code IS NOT NULL AND enroll_code != ''
    `);

    for (const r of empRows) {
      const num = parseInt(String(r.employee_code).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxCode && num < 1000000) maxCode = num;
    }
    for (const r of bioRows) {
      const num = parseInt(String(r.enroll_code).replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxCode && num < 1000000) maxCode = num;
    }
  } catch (err) {
    console.warn('[getNextBiometricEnrollCode] fallback scan:', err.message);
  }
  return String(maxCode + 1);
};

/**
 * Directly records a newly enrolled employee from Windows system or biometric hardware.
 */
const registerSingleBiometricUser = async (data = {}) => {
  await ensureBiometricEnrolledUsersTable();
  const enrollCode = String(data.enroll_code || data.employee_code || data.userId || '').trim();
  if (!enrollCode) throw new Error('Biometric enroll_code / employee ID is required.');

  const name = data.name ? String(data.name).trim() : null;
  const deviceId = data.device_id || data.deviceName || 'Windows Enrollment Station';
  const cardNum = data.card_number || data.cardNumber || null;
  const privilege = data.privilege || 'user';
  const hasFinger = data.has_fingerprint !== undefined ? (data.has_fingerprint ? 1 : 0) : 1;
  const hasFace = data.has_face !== undefined ? (data.has_face ? 1 : 0) : 1;
  const hasPass = data.has_password ? 1 : 0;
  const templateCount = Number(data.template_count) || 0;
  const registeredAt = data.registered_at ? new Date(data.registered_at) : new Date();
  const rawDetails = data.raw_details ? JSON.stringify(data.raw_details) : null;

  // Check if this enrollCode already corresponds to an existing employee
  const [empMatches] = await db.query(
    'SELECT id, employee_code, full_name FROM employees WHERE employee_code = ? LIMIT 1',
    [enrollCode]
  );
  const matchedEmp = empMatches[0] || null;
  const isLinked = matchedEmp ? 1 : 0;
  const linkedEmployeeId = matchedEmp ? matchedEmp.id : null;

  await db.query(
    `INSERT INTO biometric_enrolled_users
      (enroll_code, name, device_id, card_number, privilege, has_fingerprint, has_face, has_password, template_count, registered_at, is_linked, linked_employee_id, raw_details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      name = COALESCE(VALUES(name), name),
      device_id = VALUES(device_id),
      card_number = COALESCE(VALUES(card_number), card_number),
      privilege = VALUES(privilege),
      has_fingerprint = GREATEST(has_fingerprint, VALUES(has_fingerprint)),
      has_face = GREATEST(has_face, VALUES(has_face)),
      template_count = GREATEST(template_count, VALUES(template_count)),
      is_linked = IF(is_linked = 1, 1, VALUES(is_linked)),
      linked_employee_id = COALESCE(linked_employee_id, VALUES(linked_employee_id)),
      raw_details = COALESCE(VALUES(raw_details), raw_details)`,
    [
      enrollCode,
      name,
      deviceId,
      cardNum,
      privilege,
      hasFinger,
      hasFace,
      hasPass,
      templateCount,
      registeredAt,
      isLinked,
      linkedEmployeeId,
      rawDetails,
    ]
  );

  // If linked, also link any past unlinked punches with this enrollCode
  if (linkedEmployeeId) {
    try {
      await db.query(
        'UPDATE employee_attendance_punches SET employee_id = ? WHERE (employee_id IS NULL OR employee_id = 0) AND employee_code = ?',
        [linkedEmployeeId, enrollCode]
      );
    } catch (_) {}
  }

  // Retrieve saved record
  const [rows] = await db.query('SELECT * FROM biometric_enrolled_users WHERE enroll_code = ? LIMIT 1', [enrollCode]);
  return rows[0];
};

/**
 * Links or unlinks a biometric enrollment record with an employee.
 */
const linkBiometricUser = async (id, employeeId) => {
  await ensureBiometricEnrolledUsersTable();
  const [existing] = await db.query('SELECT * FROM biometric_enrolled_users WHERE id = ?', [id]);
  if (!existing || existing.length === 0) {
    throw new Error(`Biometric enrollment record with ID ${id} not found`);
  }
  const bioUser = existing[0];

  if (!employeeId) {
    // Unlink
    await db.query(
      'UPDATE biometric_enrolled_users SET is_linked = 0, linked_employee_id = NULL WHERE id = ?',
      [id]
    );
    return { id, is_linked: 0, linked_employee_id: null, message: 'Unlinked successfully' };
  }

  // Link to target employee
  const [empRows] = await db.query('SELECT id, employee_code, full_name FROM employees WHERE id = ?', [employeeId]);
  if (!empRows || empRows.length === 0) {
    throw new Error(`Employee with ID ${employeeId} not found`);
  }
  const emp = empRows[0];

  await db.query(
    'UPDATE biometric_enrolled_users SET is_linked = 1, linked_employee_id = ? WHERE id = ?',
    [emp.id, id]
  );

  // Connect past raw punches for both this bio user's enroll_code and emp's employee_code
  try {
    await db.query(
      'UPDATE employee_attendance_punches SET employee_id = ? WHERE (employee_id IS NULL OR employee_id = 0) AND employee_code IN (?, ?)',
      [emp.id, bioUser.enroll_code, emp.employee_code]
    );
  } catch (_) {}

  return {
    id,
    is_linked: 1,
    linked_employee_id: emp.id,
    employee_name: emp.full_name,
    employee_code: emp.employee_code,
  };
};

/* ─────────────────────────────────────────────
   LATE ATTENDANCE FINES (Manual buffer overage fine assignment)
───────────────────────────────────────────── */

/** Ensure Late Attendance Fine type exists in fine_types table */
const ensureLateFineType = async () => {
  const [rows] = await db.query(
    "SELECT id FROM fine_types WHERE name = 'Late Attendance Fine' LIMIT 1"
  );
  if (rows.length) return rows[0].id;

  const [res] = await db.query(
    `INSERT INTO fine_types (name, default_amount, trigger_rule, calculation_basis, description, is_active)
     VALUES ('Late Attendance Fine', 100.00, 'manual', 'flat', 'Fine levied for late biometric attendance exceeding monthly buffer', 1)`
  );
  return res.insertId;
};

/** Get employees eligible/candidates for late attendance fines for a given month and year */
const getLateFineCandidates = async ({ month, year, departmentId, search, filterMode = 'exceeded' }) => {
  const m = Number(month);
  const y = Number(year);
  const lastDay = new Date(y, m, 0).getDate();
  const fromDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const toDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const empFilters = ["e.status = 'active'"];
  const empParams = [m, y];

  if (departmentId) {
    empFilters.push('e.department_id = ?');
    empParams.push(departmentId);
  }
  if (search && String(search).trim()) {
    empFilters.push('(e.full_name LIKE ? OR e.employee_code LIKE ?)');
    empParams.push(`%${String(search).trim()}%`, `%${String(search).trim()}%`);
  }

  const [employees] = await db.query(
    `SELECT e.id, e.employee_code, e.full_name, e.department_id, d.name AS department_name,
            sr.name AS designation_name, sr.is_doctor,
            e.shift_category, e.custom_shift_start, e.custom_shift_end,
            eab.buffer_allocated_minutes, eab.buffer_used_minutes, eab.buffer_remaining_minutes
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     LEFT JOIN employee_attendance_buffers eab 
            ON eab.employee_id = e.id AND eab.period_month = ? AND eab.period_year = ?
     WHERE ${empFilters.join(' AND ')}
     ORDER BY e.full_name ASC`,
    empParams
  );

  const [lateRows] = await db.query(
    `SELECT ads.employee_id, DATE_FORMAT(ads.attendance_date, '%Y-%m-%d') AS attendance_date,
            ads.late_minutes, ads.first_in_time, ads.last_out_time, ads.status
     FROM attendance_daily_summary ads
     WHERE ads.attendance_date BETWEEN ? AND ?
       AND (ads.late_minutes > 0 OR ads.status = 'late_present')
     ORDER BY ads.attendance_date ASC`,
    [fromDate, toDate]
  );

  const [fines] = await db.query(
    `SELECT f.id, f.employee_id, f.amount, f.fine_date, f.reason, f.status, f.created_at, u.username AS created_by_name
     FROM fines f
     LEFT JOIN users u ON u.id = f.created_by
     WHERE f.assigned_month = ? AND f.assigned_year = ? AND f.status != 'cancelled'
     ORDER BY f.created_at DESC`,
    [m, y]
  );

  const lateMap = {};
  for (const r of lateRows) {
    if (!lateMap[r.employee_id]) lateMap[r.employee_id] = [];
    lateMap[r.employee_id].push(r);
  }

  const finesMap = {};
  for (const f of fines) {
    if (!finesMap[f.employee_id]) finesMap[f.employee_id] = [];
    finesMap[f.employee_id].push(f);
  }

  let candidates = [];
  for (const emp of employees) {
    const lates = lateMap[emp.id] || [];
    const empFines = finesMap[emp.id] || [];
    const defaultShiftAlloc = await getShiftCategoryBuffer(emp.shift_category);
    const allocated = Number(emp.buffer_allocated_minutes ?? defaultShiftAlloc);
    const used = Number(emp.buffer_used_minutes ?? 0);
    const remaining = Number(emp.buffer_remaining_minutes ?? Math.max(0, allocated - used));
    const totalLateMinutes = lates.reduce((acc, l) => acc + Number(l.late_minutes || 0), 0);
    const excessMinutes = Math.max(0, used - allocated);
    const isExceeded = remaining <= 0 || used >= allocated;

    // Filter out if no late punches at all
    if (lates.length === 0) continue;

    // Check filterMode
    if (filterMode === 'exceeded' && !isExceeded) continue;

    const activeFines = empFines.filter((f) => f.status === 'active' || f.status === 'deducted');
    const hasActiveFine = activeFines.length > 0;
    const activeFineAmount = activeFines.reduce((s, f) => s + Number(f.amount || 0), 0);

    candidates.push({
      employee_id: emp.id,
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      department_name: emp.department_name || 'General',
      designation_name: emp.designation_name || '',
      is_doctor: emp.is_doctor ? 1 : 0,
      shift_category: emp.shift_category,
      buffer_allocated_minutes: allocated,
      buffer_used_minutes: used,
      buffer_remaining_minutes: remaining,
      buffer_excess_minutes: excessMinutes,
      total_late_minutes: totalLateMinutes,
      total_late_days: lates.length,
      is_buffer_exceeded: isExceeded,
      late_dates: lates,
      existing_fines: empFines,
      has_active_fine: hasActiveFine,
      active_fine_amount: activeFineAmount,
    });
  }

  return {
    candidates,
    total_candidates: candidates.length,
    month: m,
    year: y,
    period_from: fromDate,
    period_to: toDate,
  };
};

/** Bulk apply late attendance fines to selected employees */
const applyLateFines = async ({ month, year, fines, fineDate, createdBy }) => {
  if (!Array.isArray(fines) || fines.length === 0) {
    throw new Error('No employee fine selections provided.');
  }

  const fineTypeId = await ensureLateFineType();
  const m = Number(month);
  const y = Number(year);
  const defaultDate = fineDate || `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

  const createdIds = [];
  let totalAmount = 0;

  for (const item of fines) {
    const empId = Number(item.employee_id);
    const amt = Number(item.amount || 0);
    if (!empId || amt <= 0) continue;

    const reason = String(item.reason || `Late Attendance Fine - ${m}/${y} (${item.late_days || 1} late day(s))`).trim();
    const dateToUse = item.fine_date || defaultDate;

    const [res] = await db.execute(
      `INSERT INTO fines (employee_id, fine_type_id, amount, fine_date, reason, created_by,
         is_auto_generated, assigned_month, assigned_year, status)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'active')`,
      [empId, fineTypeId, amt, dateToUse, reason, createdBy ?? null, m, y]
    );

    createdIds.push(res.insertId);
    totalAmount += amt;
  }

  return {
    applied_count: createdIds.length,
    total_amount: totalAmount,
    fine_ids: createdIds,
  };
};

/** Cancel a fine */
const cancelLateFine = async (fineId, { reason, cancelledBy }) => {
  await db.execute(
    `UPDATE fines SET status = 'cancelled', waived_by = ?, waived_at = NOW(), waiver_reason = ?
     WHERE id = ?`,
    [cancelledBy ?? null, reason || 'Cancelled by admin', fineId]
  );
  return { success: true };
};

/** Waive a fine */
const waiveLateFine = async (fineId, { reason, waivedBy }) => {
  await db.execute(
    `UPDATE fines SET status = 'waived', waived_by = ?, waived_at = NOW(), waiver_reason = ?
     WHERE id = ?`,
    [waivedBy ?? null, reason || 'Waived by admin', fineId]
  );
  return { success: true };
};

module.exports = {
  bulkInsertPunches,
  resolveEmployeeCodes,
  linkOrphanPunches,
  getUnprocessedPunches,
  getPunchesForDate,
  getUnmatchedPunches,
  listRawPunches,
  getEmployeeBiometricTimeline,
  getCorrectionRequest,
  getBiometricWindow,
  listBiometricWindows,
  createBiometricWindow,
  getDailySummary,
  listDailySummaries,
  getAttendanceRegister,
  upsertDailySummary,
  markLeaveDays,
  adminMarkAttendance,
  getShiftCategoryBuffer,
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
  ensureBiometricEnrolledUsersTable,
  upsertBiometricEnrolledUsers,
  autoLinkEnrolledUsers,
  autoRecordPunchesInEnrolledUsers,
  listBiometricEnrolledUsers,
  getNextBiometricEnrollCode,
  registerSingleBiometricUser,
  linkBiometricUser,
  getLateFineCandidates,
  applyLateFines,
  cancelLateFine,
  waiveLateFine,
};

