const db = require('../../config/db');

/* ─── LEAVE TYPES ─── */
const listLeaveTypes = async () => {
  const [rows] = await db.execute(`SELECT * FROM leave_types ORDER BY name`);
  return rows;
};

const createLeaveType = async (data) => {
  const { name, max_days_per_year, is_paid, carry_forward_allowed, max_carry_forward } = data;
  const [result] = await db.execute(
    `INSERT INTO leave_types (name, max_days_per_year, is_paid, carry_forward_allowed, max_carry_forward)
     VALUES (?, ?, ?, ?, ?)`,
    [name, max_days_per_year ?? 0, is_paid ? 1 : 0, carry_forward_allowed ? 1 : 0, max_carry_forward ?? 0]
  );
  return result.insertId;
};

const updateLeaveType = async (id, data) => {
  const allowed = ['name', 'max_days_per_year', 'is_paid', 'carry_forward_allowed', 'max_carry_forward'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(data[key]);
    }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE leave_types SET ${fields.join(', ')} WHERE id = ?`, vals);
};

/* ─── HOLIDAYS ─── */
const listHolidays = async (year) => {
  let query = `SELECT * FROM holidays`;
  const params = [];
  if (year) {
    query += ` WHERE YEAR(holiday_date) = ?`;
    params.push(year);
  }
  query += ` ORDER BY holiday_date`;
  const [rows] = await db.execute(query, params);
  return rows;
};

const createHoliday = async (data) => {
  const { name, holiday_date, is_optional } = data;
  const [result] = await db.execute(
    `INSERT INTO holidays (name, holiday_date, is_optional) VALUES (?, ?, ?)`,
    [name, holiday_date, is_optional ? 1 : 0]
  );
  return result.insertId;
};

/* ─── LEAVE BALANCES ─── */
const getLeaveBalances = async (employeeId, year) => {
  const [rows] = await db.execute(
    `SELECT lb.*, lt.name AS leave_type_name, lt.is_paid
     FROM leave_balances lb
     JOIN leave_types lt ON lt.id = lb.leave_type_id
     WHERE lb.employee_id = ? AND lb.year = ?`,
    [employeeId, year]
  );
  return rows;
};

const upsertLeaveBalance = async (data) => {
  const { employee_id, leave_type_id, year, allocated_days, used_days, carried_forward_days } = data;
  await db.execute(
    `INSERT INTO leave_balances (employee_id, leave_type_id, year, allocated_days, used_days, carried_forward_days)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       allocated_days = VALUES(allocated_days),
       used_days = VALUES(used_days),
       carried_forward_days = VALUES(carried_forward_days)`,
    [employee_id, leave_type_id, year, allocated_days ?? 0, used_days ?? 0, carried_forward_days ?? 0]
  );
};

/* ─── LEAVE REQUESTS ─── */
const listLeaveRequests = async ({ employeeId, status, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (employeeId) { filters.push('lr.employee_id = ?'); params.push(employeeId); }
  if (status) { filters.push('lr.status = ?'); params.push(status); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.execute(
    `SELECT lr.*, e.full_name, e.employee_code, lt.name AS leave_type_name, 
            ap.username AS approved_by_name
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     JOIN leave_types lt ON lt.id = lr.leave_type_id
     LEFT JOIN users ap ON ap.id = lr.approved_by
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
    `SELECT lr.*, e.full_name, lt.name AS leave_type_name 
     FROM leave_requests lr 
     JOIN employees e ON e.id = lr.employee_id
     JOIN leave_types lt ON lt.id = lr.leave_type_id
     WHERE lr.id = ?`,
    [id]
  );
  return rows[0] ?? null;
};

const createLeaveRequest = async (data) => {
  const { employee_id, leave_type_id, start_date, end_date, total_days, reason, document_path } = data;
  const [result] = await db.execute(
    `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, total_days, reason, document_path, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [employee_id, leave_type_id, start_date, end_date, total_days, reason, document_path ?? null]
  );
  return result.insertId;
};

const updateLeaveRequestStatus = async (id, status, { approved_by, rejection_reason }) => {
  await db.execute(
    `UPDATE leave_requests SET status = ?, approved_by = ?, approved_at = NOW(), rejection_reason = ?
     WHERE id = ?`,
    [status, approved_by ?? null, rejection_reason ?? null, id]
  );
};

/* ─── WEEK-OFF POLICIES ─── */
const listWeekOffPolicies = async () => {
  const [rows] = await db.execute(`SELECT * FROM week_off_policies`);
  return rows;
};

const createWeekOffPolicy = async (data) => {
  const { role_id, department_id, employee_id, days_per_week, preferred_day_of_week } = data;
  const [result] = await db.execute(
    `INSERT INTO week_off_policies (role_id, department_id, employee_id, days_per_week, preferred_day_of_week)
     VALUES (?, ?, ?, ?, ?)`,
    [role_id ?? null, department_id ?? null, employee_id ?? null, days_per_week ?? 1, preferred_day_of_week ?? 'Sunday']
  );
  return result.insertId;
};

module.exports = {
  listLeaveTypes, createLeaveType, updateLeaveType,
  listHolidays, createHoliday,
  getLeaveBalances, upsertLeaveBalance,
  listLeaveRequests, getLeaveRequest, createLeaveRequest, updateLeaveRequestStatus,
  listWeekOffPolicies, createWeekOffPolicy,
};
