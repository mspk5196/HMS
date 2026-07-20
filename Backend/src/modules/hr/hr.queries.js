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
    `SELECT e.*, d.name AS department_name, des.name AS designation_name, 
            des.casual_leave_count, des.privilege_leave_count, r.name AS role_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles des ON des.id = e.designation_id
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
    `SELECT e.*, d.name AS department_name, des.name AS designation_name, 
            des.casual_leave_count, des.privilege_leave_count, r.name AS role_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles des ON des.id = e.designation_id
     LEFT JOIN users u ON u.employee_id = e.id
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE e.id = ?`,
    [id]
  );
  return rows[0] ?? null;
};

const createEmployee = async (data) => {
  const {
    employee_code, full_name, gender, dob, date_of_joining,
    department_id, designation_id, mobile, phone, address, status,
    bank_account_no, bank_ifsc, bank_name, uan_number,
    salary_type, basic_salary, per_day_salary, per_night_salary
  } = data;
  const [result] = await db.execute(
    `INSERT INTO employees (employee_code, full_name, gender, date_of_birth, date_of_joining,
       department_id, designation_id, phone, address, status,
       bank_account_no, bank_ifsc, bank_name, uan_number,
       salary_type, basic_salary, per_day_salary, per_night_salary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      status || 'active',
      bank_account_no || null,
      bank_ifsc || null,
      bank_name || null,
      uan_number || null,
      salary_type || 'monthly',
      basic_salary ?? 0,
      per_day_salary ?? 0,
      per_night_salary ?? 0
    ]
  );
  return result.insertId;
};

const updateEmployee = async (id, data) => {
  const allowed = [
    'full_name', 'gender', 'date_of_joining', 'department_id', 'designation_id',
    'address', 'status', 'date_of_leaving',
    'bank_account_no', 'bank_ifsc', 'bank_name', 'uan_number',
    'salary_type', 'basic_salary', 'per_day_salary', 'per_night_salary'
  ];
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
  const [rows] = await db.execute(`SELECT * FROM shifts ORDER BY name`);
  return rows;
};

const createShift = async (data) => {
  const { name, start_time, end_time, is_night_shift, grace_period_minutes, biometric_in_start, biometric_in_end, biometric_out_start, biometric_out_end } = data;
  const [result] = await db.execute(
    `INSERT INTO shifts (name, start_time, end_time, is_night_shift, grace_period_minutes, biometric_in_start, biometric_in_end, biometric_out_start, biometric_out_end) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name, start_time, end_time, is_night_shift ? 1 : 0, grace_period_minutes ?? 0, 
      biometric_in_start ?? null, biometric_in_end ?? null, biometric_out_start ?? null, biometric_out_end ?? null
    ]
  );
  return result.insertId;
};

const updateShift = async (id, data) => {
  const allowed = [
    'name', 'start_time', 'end_time', 'is_night_shift', 'grace_period_minutes', 
    'biometric_in_start', 'biometric_in_end', 'biometric_out_start', 'biometric_out_end', 'is_active'
  ];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(key === 'is_night_shift' || key === 'is_active' ? (data[key] ? 1 : 0) : data[key]);
    }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE shifts SET ${fields.join(', ')} WHERE id = ?`, vals);
};

const deleteShift = async (id) => {
  await db.execute(`DELETE FROM shifts WHERE id = ?`, [id]);
};

/* ─── DEPARTMENTS ─── */
const createDepartment = async (data) => {
  const { name, description, is_active } = data;
  const [result] = await db.execute(
    `INSERT INTO departments (name, description, is_active) VALUES (?, ?, ?)`,
    [name, description ?? null, is_active ?? 1]
  );
  return result.insertId;
};

const updateDepartment = async (id, data) => {
  const { name, description, is_active } = data;
  const fields = [];
  const params = [];
  if (name !== undefined) { fields.push('name = ?'); params.push(name); }
  if (description !== undefined) { fields.push('description = ?'); params.push(description); }
  if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (!fields.length) return;
  params.push(id);
  await db.execute(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`, params);
};

const deleteDepartment = async (id) => {
  await db.execute(`DELETE FROM departments WHERE id = ?`, [id]);
};

const countEmployeesInDepartment = async (departmentId) => {
  const [[{ count }]] = await db.execute(`SELECT COUNT(*) AS count FROM employees WHERE department_id = ?`, [departmentId]);
  return count;
};

const countStaffRolesInDepartment = async (departmentId) => {
  const [[{ count }]] = await db.execute(`SELECT COUNT(*) AS count FROM staff_roles WHERE department_id = ?`, [departmentId]);
  return count;
};

/* ─── DESIGNATIONS ─── */
const createDesignation = async (data) => {
  const { name, is_active } = data;
  const [result] = await db.execute(
    `INSERT INTO designations (name, is_active) VALUES (?, ?)`,
    [name, is_active ?? 1]
  );
  return result.insertId;
};

/* ─── ROLES (AUTHORIZATION) ─── */
const createRole = async (data) => {
  const { name, description } = data;
  const [result] = await db.execute(
    `INSERT INTO roles (name, description) VALUES (?, ?)`,
    [name, description ?? null]
  );
  return result.insertId;
};

/* ─── STAFF ROLES (DEPARTMENT-SPECIFIC WITH SALARY) ─── */
const listStaffRoles = async (departmentId) => {
  let query = `
    SELECT r.*, d.name AS department_name 
    FROM staff_roles r
    JOIN departments d ON d.id = r.department_id
  `;
  const params = [];
  if (departmentId) {
    query += ' WHERE r.department_id = ?';
    params.push(departmentId);
  }
  query += ' ORDER BY d.name, r.name';
  const [rows] = await db.execute(query, params);
  return rows;
};

const getStaffRole = async (id) => {
  const [rows] = await db.execute(
    `SELECT r.*, d.name AS department_name 
     FROM staff_roles r
     JOIN departments d ON d.id = r.department_id
     WHERE r.id = ?`,
    [id]
  );
  return rows[0] ?? null;
};

const createStaffRole = async (data) => {
  const {
    department_id, name, description, is_active,
    basic_salary, hra, da, lop_deduction, casual_leave_count, privilege_leave_count, weekly_off_count,
    shift_name, shift_start_time, shift_end_time,
    biometric_in_start, biometric_in_end, biometric_out_start, biometric_out_end,
    is_night_shift, grace_period_minutes
  } = data;
  const [result] = await db.execute(
    `INSERT INTO staff_roles 
       (department_id, name, description, is_active, basic_salary, hra, da, lop_deduction, casual_leave_count, privilege_leave_count, weekly_off_count,
        shift_name, shift_start_time, shift_end_time, biometric_in_start, biometric_in_end, biometric_out_start, biometric_out_end,
        is_night_shift, grace_period_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      department_id, name, description ?? null, is_active ?? 1,
      basic_salary ?? 0.00, hra ?? 0.00, da ?? 0.00, lop_deduction ?? 0.00,
      casual_leave_count ?? 0, privilege_leave_count ?? 0, weekly_off_count ?? 0,
      shift_name ?? null, shift_start_time ?? null, shift_end_time ?? null,
      biometric_in_start ?? null, biometric_in_end ?? null, biometric_out_start ?? null, biometric_out_end ?? null,
      is_night_shift ? 1 : 0, grace_period_minutes ?? 0
    ]
  );
  return result.insertId;
};

const updateStaffRole = async (id, data) => {
  const allowed = [
    'department_id', 'name', 'description', 'is_active',
    'basic_salary', 'hra', 'da', 'lop_deduction', 'casual_leave_count', 'privilege_leave_count', 'weekly_off_count',
    'shift_name', 'shift_start_time', 'shift_end_time',
    'biometric_in_start', 'biometric_in_end', 'biometric_out_start', 'biometric_out_end',
    'is_night_shift', 'grace_period_minutes'
  ];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(key === 'is_active' || key === 'is_night_shift' ? (data[key] ? 1 : 0) : data[key]);
    }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE staff_roles SET ${fields.join(', ')} WHERE id = ?`, vals);
};

const deleteStaffRole = async (id) => {
  await db.execute(`DELETE FROM staff_roles WHERE id = ?`, [id]);
};

const countEmployeesWithStaffRole = async (roleName, departmentId) => {
  // Let's check how employees are assigned to a role. Currently employees table has department_id and designation_id. 
  // Wait, if staff_roles maps roles under department, let's see how employees map to it. 
  // For checking if role is used, we can query if any employee designation matches this role name.
  const [[{ count }]] = await db.execute(
    `SELECT COUNT(*) AS count 
     FROM employees e
     JOIN designations d ON d.id = e.designation_id
     WHERE d.name = ? AND e.department_id = ?`,
    [roleName, departmentId]
  );
  return count;
};

const isShiftInUse = async (shiftId) => {
  const [[{ count: c1 }]] = await db.execute(`SELECT COUNT(*) AS count FROM employee_shifts WHERE shift_id = ?`, [shiftId]);
  const [[{ count: c2 }]] = await db.execute(`SELECT COUNT(*) AS count FROM roster_entries WHERE shift_id = ?`, [shiftId]);
  const [[{ count: c3 }]] = await db.execute(`SELECT COUNT(*) AS count FROM attendance_daily_summary WHERE shift_id = ?`, [shiftId]);
  return (c1 + c2 + c3) > 0;
};

module.exports = {
  listEmployees, getEmployee, createEmployee, updateEmployee,
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  listDesignations, createDesignation,
  listRoles, createRole,
  listShifts, createShift, updateShift, deleteShift, isShiftInUse,
  listStaffRoles, getStaffRole, createStaffRole, updateStaffRole, deleteStaffRole,
  countEmployeesInDepartment, countStaffRolesInDepartment, countEmployeesWithStaffRole,
};
