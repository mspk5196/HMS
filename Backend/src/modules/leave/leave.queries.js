/**
 * leave.queries.js
 * All raw SQL for the Leave module — rewritten against the real schema.
 *
 * The previous version referenced columns that never existed
 * (leave_types.max_days_per_year/is_paid/carry_forward_allowed,
 * leave_requests.casual_days/privilege_days/lop_days,
 * week_off_policies.role_id/department_id/days_per_week) — every write failed.
 * The real leave_requests table already models the two-step approval flow
 * (reporting_person_status → hr_status) and a single `result` enum per
 * request, so that is what the service layer works with.
 */

const db = require('../../config/db');

/* ─── LEAVE TYPES ─── */

const listLeaveTypes = async (includeInactive = true) => {
  const where = includeInactive ? '' : 'WHERE is_active = 1';
  const [rows] = await db.execute(`SELECT * FROM leave_types ${where} ORDER BY name`);
  return rows;
};

const getLeaveType = async (id) => {
  const [rows] = await db.execute(`SELECT * FROM leave_types WHERE id = ?`, [id]);
  return rows[0] ?? null;
};

const createLeaveType = async (data) => {
  const { name, quota_days, quota_period, is_lop_applicable, can_carry_forward, max_carry_forward_days, is_active } = data;
  const [result] = await db.execute(
    // is_half_day_allowed is always 0 — half-day leave is out of scope by decision.
    `INSERT INTO leave_types
       (name, quota_days, quota_period, is_half_day_allowed, is_active, is_lop_applicable, can_carry_forward, max_carry_forward_days)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
    [name, quota_days ?? 0, quota_period ?? 'yearly', is_active === false ? 0 : 1,
     is_lop_applicable === false ? 0 : 1, can_carry_forward ? 1 : 0, max_carry_forward_days ?? 0]
  );
  return result.insertId;
};

const updateLeaveType = async (id, data) => {
  const allowed = ['name', 'quota_days', 'quota_period', 'is_active', 'is_lop_applicable', 'can_carry_forward', 'max_carry_forward_days'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(['is_active', 'is_lop_applicable', 'can_carry_forward'].includes(key) ? (data[key] ? 1 : 0) : data[key]);
    }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE leave_types SET ${fields.join(', ')} WHERE id = ?`, vals);
};

const deleteLeaveType = async (id) => {
  await db.execute(`UPDATE leave_types SET is_active = 0 WHERE id = ?`, [id]);
};

/* ─── HOLIDAYS ─── */

const listHolidays = async (year) => {
  let query = `SELECT * FROM holidays`;
  const params = [];
  if (year) { query += ` WHERE YEAR(holiday_date) = ?`; params.push(year); }
  query += ` ORDER BY holiday_date`;
  const [rows] = await db.execute(query, params);
  return rows;
};

const createHoliday = async (data) => {
  const { name, holiday_date, is_optional, created_by } = data;
  const [result] = await db.execute(
    `INSERT INTO holidays (name, holiday_date, is_optional, created_by) VALUES (?, ?, ?, ?)`,
    [name, holiday_date, is_optional ? 1 : 0, created_by ?? null]
  );
  return result.insertId;
};

/* ─── LEAVE BALANCES ─── */
// balance_days is a generated column (allocated_days - used_days) — never write it.

const getLeaveBalances = async (employeeId, year) => {
  const [rows] = await db.execute(
    `SELECT lb.*, lt.name AS leave_type_name, lt.is_lop_applicable
     FROM leave_balances lb
     JOIN leave_types lt ON lt.id = lb.leave_type_id
     WHERE lb.employee_id = ? AND lb.year = ?
     ORDER BY lt.name`,
    [employeeId, year]
  );
  return rows;
};

const getLeaveBalance = async (employeeId, leaveTypeId, year) => {
  const [rows] = await db.execute(
    `SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?`,
    [employeeId, leaveTypeId, year]
  );
  return rows[0] ?? null;
};

/**
 * Total remaining paid-leave balance across every leave type for a year.
 *
 * Deliberately not filtered by leave_types.is_lop_applicable: a pseudo type
 * like "Loss of Pay" carries a 0-day quota, so it contributes 0 to the sum on
 * its own — no extra filtering needed, and it sidesteps an ambiguous flag
 * whose intended meaning conflicts between how it reads and how the (never
 * run) seed script sets it.
 */
const getTotalRemainingBalance = async (employeeId, year) => {
  const [rows] = await db.execute(
    `SELECT COALESCE(SUM(lb.balance_days), 0) AS remaining
     FROM leave_balances lb
     WHERE lb.employee_id = ? AND lb.year = ?`,
    [employeeId, year]
  );
  return Number(rows[0]?.remaining ?? 0);
};

const upsertLeaveBalance = async ({ employee_id, leave_type_id, year, allocated_days, used_days }) => {
  await db.execute(
    `INSERT INTO leave_balances (employee_id, leave_type_id, year, allocated_days, used_days)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       allocated_days = VALUES(allocated_days),
       used_days = VALUES(used_days)`,
    [employee_id, leave_type_id, year, allocated_days ?? 0, used_days ?? 0]
  );
};

/** Allocate (or top up) a year's quota for an employee without touching usage. */
const allocateLeaveBalance = async (employeeId, leaveTypeId, year, allocatedDays) => {
  await db.execute(
    `INSERT INTO leave_balances (employee_id, leave_type_id, year, allocated_days, used_days)
     VALUES (?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE allocated_days = VALUES(allocated_days)`,
    [employeeId, leaveTypeId, year, allocatedDays]
  );
};

/* ─── LEAVE REQUESTS ─── */

const listLeaveRequests = async ({ employeeId, reportingPersonId, status, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (employeeId) { filters.push('lr.employee_id = ?'); params.push(employeeId); }
  if (reportingPersonId) { filters.push('lr.reporting_person_id = ?'); params.push(reportingPersonId); }
  if (status === 'pending_reporting') filters.push(`lr.reporting_person_status = 'pending'`);
  else if (status === 'pending_hr') filters.push(`lr.reporting_person_status = 'approved' AND lr.hr_status = 'pending'`);
  else if (status) { filters.push('lr.result = ?'); params.push(status); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT lr.*, e.full_name, e.employee_code,
            lt.name AS leave_type_name, lt.is_lop_applicable,
            rp.full_name AS reporting_person_name,
            u.username AS hr_user_name
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     JOIN leave_types lt ON lt.id = lr.leave_type_id
     LEFT JOIN employees rp ON rp.id = lr.reporting_person_id
     LEFT JOIN users u ON u.id = lr.hr_user_id
     ${where}
     ORDER BY lr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM leave_requests lr ${where}`, params);
  return { rows, total };
};

const getLeaveRequest = async (id) => {
  const [rows] = await db.execute(
    `SELECT lr.*, e.full_name, e.employee_code, e.reporting_person_id AS employee_reporting_person_id,
            lt.name AS leave_type_name, lt.is_lop_applicable, lt.quota_period
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     JOIN leave_types lt ON lt.id = lr.leave_type_id
     WHERE lr.id = ?`,
    [id]
  );
  return rows[0] ?? null;
};

/** Any request (any status short of rejected) that overlaps a date for an employee. */
const findRequestCoveringDate = async (employeeId, date) => {
  const [rows] = await db.execute(
    `SELECT * FROM leave_requests
     WHERE employee_id = ? AND ? BETWEEN from_date AND to_date AND result != 'rejected'
     LIMIT 1`,
    [employeeId, date]
  );
  return rows[0] ?? null;
};

const createLeaveRequest = async ({ employee_id, leave_type_id, from_date, to_date, reason, reporting_person_id }) => {
  const [result] = await db.execute(
    `INSERT INTO leave_requests
       (employee_id, leave_type_id, from_date, to_date, is_half_day, reason,
        reporting_person_status, reporting_person_id, hr_status, result)
     VALUES (?, ?, ?, ?, 0, ?, 'pending', ?, 'pending', 'pending')`,
    [employee_id, leave_type_id, from_date, to_date, reason ?? null, reporting_person_id ?? null]
  );
  return result.insertId;
};

// reporting_person_id is fixed at application time from the employee's own
// record (employees.reporting_person_id) — it identifies WHO the reporting
// person is (an employees.id), not who is logged in performing this review,
// so the acting user's id must never be written here.
const setReportingPersonDecision = async (id, status) => {
  await db.execute(
    `UPDATE leave_requests
     SET reporting_person_status = ?, reporting_person_acted_at = NOW()
     WHERE id = ?`,
    [status, id]
  );
};

const setHrDecision = async (id, { hr_status, result, hr_user_id }) => {
  await db.execute(
    `UPDATE leave_requests
     SET hr_status = ?, result = ?, hr_user_id = ?, hr_acted_at = NOW()
     WHERE id = ?`,
    [hr_status, result, hr_user_id ?? null, id]
  );
};

/* ─── WEEK-OFF POLICIES (per staff role/designation) ─── */
// staff_roles.weekly_off_count is what the roster actually reads; this table
// is a secondary, more detailed record (preferred day) keyed one-per-role.

const listWeekOffPolicies = async () => {
  const [rows] = await db.execute(
    `SELECT wop.*, sr.name AS role_name, sr.department_id
     FROM week_off_policies wop
     JOIN staff_roles sr ON sr.id = wop.designation_id`
  );
  return rows;
};

const upsertWeekOffPolicy = async ({ designation_id, week_offs_per_month, preferred_day_of_week, notes }) => {
  await db.execute(
    `INSERT INTO week_off_policies (designation_id, week_offs_per_month, preferred_day_of_week, notes)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       week_offs_per_month = VALUES(week_offs_per_month),
       preferred_day_of_week = VALUES(preferred_day_of_week),
       notes = VALUES(notes)`,
    [designation_id, week_offs_per_month ?? 4, preferred_day_of_week ?? null, notes ?? null]
  );
};

module.exports = {
  listLeaveTypes, getLeaveType, createLeaveType, updateLeaveType, deleteLeaveType,
  listHolidays, createHoliday,
  getLeaveBalances, getLeaveBalance, getTotalRemainingBalance, upsertLeaveBalance, allocateLeaveBalance,
  listLeaveRequests, getLeaveRequest, findRequestCoveringDate,
  createLeaveRequest, setReportingPersonDecision, setHrDecision,
  listWeekOffPolicies, upsertWeekOffPolicy,
};
