const db = require('../../config/db');

/* ─── EMPLOYEES ─── */
const listEmployees = async ({ search, departmentId, status, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (search) {
    filters.push('(e.full_name LIKE ? OR e.employee_code LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (departmentId) {
    filters.push('e.department_id = ?');
    params.push(departmentId);
  }
  if (status !== undefined && status !== null) {
    filters.push('e.is_active = ?');
    params.push(status);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await db.execute(
    `SELECT e.*, d.name AS department_name, des.name AS designation_name, r.name AS role_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN designations des ON des.id = e.designation_id
     LEFT JOIN roles r ON r.id = e.role_id
     ${where}
     ORDER BY e.full_name
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM employees e ${where}`, params);
  return { rows, total };
};

const getEmployee = async (id) => {
  const [rows] = await db.execute(
    `SELECT e.*, d.name AS department_name, des.name AS designation_name, r.name AS role_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN designations des ON des.id = e.designation_id
     LEFT JOIN roles r ON r.id = e.role_id
     WHERE e.id = ?`,
    [id]
  );
  return rows[0] ?? null;
};

const createEmployee = async (data) => {
  const { employee_code, full_name, gender, dob, date_of_joining, department_id, designation_id, role_id, mobile, email, base_salary, is_active } = data;
  const [result] = await db.execute(
    `INSERT INTO employees (employee_code, full_name, gender, dob, date_of_joining, department_id, designation_id, role_id, mobile, email, base_salary, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [employee_code, full_name, gender, dob, date_of_joining, department_id, designation_id, role_id ?? null, mobile ?? null, email ?? null, base_salary ?? 0, is_active ?? 1]
  );
  return result.insertId;
};

const updateEmployee = async (id, data) => {
  const allowed = ['full_name', 'gender', 'dob', 'date_of_joining', 'department_id', 'designation_id', 'role_id', 'mobile', 'email', 'base_salary', 'is_active', 'date_of_exit'];
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
  await db.execute(`UPDATE employees SET ${fields.join(', ')} WHERE id = ?`, vals);
};

/* ─── DEPARTMENTS ─── */
const listDepartments = async () => {
  const [rows] = await db.execute(`SELECT * FROM departments ORDER BY name`);
  return rows;
};

/* ─── DESIGNATIONS ─── */
const listDesignations = async () => {
  const [rows] = await db.execute(`SELECT * FROM designations ORDER BY name`);
  return rows;
};

/* ─── ROLES ─── */
const listRoles = async () => {
  const [rows] = await db.execute(`SELECT * FROM roles ORDER BY name`);
  return rows;
};

/* ─── SHIFTS ─── */
const listShifts = async () => {
  const [rows] = await db.execute(`SELECT * FROM shifts ORDER BY start_time`);
  return rows;
};

const createShift = async (data) => {
  const { name, start_time, end_time, is_night_shift, grace_period_minutes } = data;
  const [result] = await db.execute(
    `INSERT INTO shifts (name, start_time, end_time, is_night_shift, grace_period_minutes) VALUES (?, ?, ?, ?, ?)`,
    [name, start_time, end_time, is_night_shift ? 1 : 0, grace_period_minutes ?? 0]
  );
  return result.insertId;
};

const updateShift = async (id, data) => {
  const allowed = ['name', 'start_time', 'end_time', 'is_night_shift', 'grace_period_minutes', 'is_active'];
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
  await db.execute(`UPDATE shifts SET ${fields.join(', ')} WHERE id = ?`, vals);
};

module.exports = {
  listEmployees, getEmployee, createEmployee, updateEmployee,
  listDepartments, listDesignations, listRoles,
  listShifts, createShift, updateShift,
};
