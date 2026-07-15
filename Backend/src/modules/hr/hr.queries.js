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
    filters.push('e.status = ?');
    params.push(status === 1 || status === 'active' || status === true ? 'active' : 'inactive');
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT e.*, d.name AS department_name, des.name AS designation_name, r.name AS role_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN designations des ON des.id = e.designation_id
     LEFT JOIN users u ON u.employee_id = e.id
     LEFT JOIN roles r ON r.id = u.role_id
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
     LEFT JOIN users u ON u.employee_id = e.id
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE e.id = ?`,
    [id]
  );
  return rows[0] ?? null;
};

const createEmployee = async (data) => {
  const { employee_code, full_name, gender, dob, date_of_joining, department_id, designation_id, mobile, phone, address, status } = data;
  const [result] = await db.execute(
    `INSERT INTO employees (employee_code, full_name, gender, date_of_birth, date_of_joining, department_id, designation_id, phone, address, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      employee_code,
      full_name,
      gender || null,
      dob || null,
      date_of_joining,
      department_id,
      designation_id,
      phone || mobile || null,
      address || null,
      status || 'active'
    ]
  );
  return result.insertId;
};

const updateEmployee = async (id, data) => {
  const allowed = ['full_name', 'gender', 'date_of_joining', 'department_id', 'designation_id', 'address', 'status', 'date_of_leaving'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(data[key]);
    }
  }
  
  // Custom mappings for aliases
  if (data.dob !== undefined) { fields.push('date_of_birth = ?'); vals.push(data.dob); }
  if (data.phone !== undefined || data.mobile !== undefined) { fields.push('phone = ?'); vals.push(data.phone || data.mobile); }
  if (data.is_active !== undefined) { fields.push('status = ?'); vals.push(data.is_active ? 'active' : 'inactive'); }
  
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

const createDepartment = async (data) => {
  const { name, is_active } = data;
  const [result] = await db.execute(
    `INSERT INTO departments (name, is_active) VALUES (?, ?)`,
    [name, is_active ?? 1]
  );
  return result.insertId;
};

const createDesignation = async (data) => {
  const { name, is_active } = data;
  const [result] = await db.execute(
    `INSERT INTO designations (name, is_active) VALUES (?, ?)`,
    [name, is_active ?? 1]
  );
  return result.insertId;
};

const createRole = async (data) => {
  const { name, description } = data;
  const [result] = await db.execute(
    `INSERT INTO roles (name, description) VALUES (?, ?)`,
    [name, description ?? null]
  );
  return result.insertId;
};

module.exports = {
  listEmployees, getEmployee, createEmployee, updateEmployee,
  listDepartments, createDepartment,
  listDesignations, createDesignation,
  listRoles, createRole,
  listShifts, createShift, updateShift,
};
