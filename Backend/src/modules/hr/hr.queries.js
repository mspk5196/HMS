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

const getEmployeeByCode = async (employeeCode) => {
  const [rows] = await db.execute(
    `SELECT id, employee_code, full_name FROM employees WHERE employee_code = ?`,
    [employeeCode]
  );
  return rows[0] ?? null;
};

const createEmployee = async (data) => {
  const {
    employee_code, full_name, gender, dob, date_of_joining,
    department_id, designation_id, mobile, phone, address, status,
    bank_account_no, bank_ifsc, bank_name, uan_number,
    salary_type, basic_salary, per_day_salary, per_night_salary,
    qualification, experience_description
  } = data;
  const [result] = await db.execute(
    `INSERT INTO employees (employee_code, full_name, gender, date_of_birth, date_of_joining,
       department_id, designation_id, phone, address, status,
       bank_account_no, bank_ifsc, bank_name, uan_number,
       salary_type, basic_salary, per_day_salary, per_night_salary,
       qualification, experience_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      per_night_salary ?? 0,
      qualification || null,
      experience_description || null
    ]
  );
  return result.insertId;
};

const updateEmployee = async (id, data) => {
  const allowed = [
    'employee_code', 'full_name', 'gender', 'date_of_joining', 'department_id', 'designation_id',
    'reporting_person_id', 'address', 'status', 'date_of_leaving',
    'bank_account_no', 'bank_ifsc', 'bank_name',
    'uan_number', 'esi_number',
    'salary_type', 'basic_salary', 'per_day_salary', 'per_night_salary',
    'qualification', 'experience_description'
  ];
  const booleans = ['pf_enrolled', 'esi_enrolled'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(data[key] === '' ? null : data[key]);
    }
  }
  for (const key of booleans) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(data[key] ? 1 : 0);
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
  // Query departments with their staff counts
  const [departments] = await db.execute(`
    SELECT d.id, d.name, d.description, d.head, d.is_active, d.created_at, d.updated_at,
           COUNT(e.id) AS staffCount
    FROM departments d
    LEFT JOIN employees e ON e.department_id = d.id
    GROUP BY d.id
    ORDER BY d.name
  `);

  // Query all active staff roles
  const [roles] = await db.execute(`
    SELECT id, department_id, name AS roleName, basic_salary AS basicSalary, weekly_off_count AS weeklyOffCount, monthly_buffer_minutes AS monthlyBufferMinutes
    FROM staff_roles
    ORDER BY name
  `);

  // Map roles to their respective departments
  return departments.map(dept => ({
    id: dept.id,
    name: dept.name,
    description: dept.description,
    head: dept.head || '—',
    is_active: dept.is_active,
    staffCount: dept.staffCount,
    roles: roles
      .filter(r => r.department_id === dept.id)
      .map(r => ({ id: r.id, roleName: r.roleName, basicSalary: r.basicSalary, weeklyOffCount: r.weeklyOffCount ?? 4, monthlyBufferMinutes: r.monthlyBufferMinutes ?? 30 }))
  }));
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

const createDepartment = async (data) => {
  const { name, description, head, is_active, roles } = data;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [deptResult] = await conn.execute(
      `INSERT INTO departments (name, description, head, is_active) VALUES (?, ?, ?, ?)`,
      [name, description ?? null, head ?? null, is_active ?? 1]
    );
    const departmentId = deptResult.insertId;

    if (Array.isArray(roles) && roles.length > 0) {
      for (const r of roles) {
        if (!r.roleName) continue;
        await conn.execute(
          `INSERT INTO staff_roles (department_id, name, basic_salary, weekly_off_count, monthly_buffer_minutes) VALUES (?, ?, ?, ?, ?)`,
          [departmentId, r.roleName, r.basicSalary ?? 0.00, r.weeklyOffCount ?? 4, r.monthlyBufferMinutes ?? 30]
        );
      }
    }

    await conn.commit();
    return departmentId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const updateDepartment = async (id, data) => {
  const { name, description, head, is_active, roles } = data;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Update department table fields
    const fields = [];
    const params = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (head !== undefined) { fields.push('head = ?'); params.push(head); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (fields.length > 0) {
      params.push(id);
      await conn.execute(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`, params);
    }

    // 2. Handle nested roles updates if provided
    if (Array.isArray(roles)) {
      // Get all current roles for this department
      const [currentRoles] = await conn.execute(
        `SELECT id FROM staff_roles WHERE department_id = ?`,
        [id]
      );
      const currentIds = currentRoles.map(r => r.id);

      const keepIds = [];

      for (const r of roles) {
        if (!r.roleName) continue;
        if (r.id) {
          // Update existing role
          await conn.execute(
            `UPDATE staff_roles SET name = ?, basic_salary = ?, weekly_off_count = ?, monthly_buffer_minutes = ? WHERE id = ? AND department_id = ?`,
            [r.roleName, r.basicSalary ?? 0.00, r.weeklyOffCount ?? 4, r.monthlyBufferMinutes ?? 30, r.id, id]
          );
          keepIds.push(r.id);
        } else {
          // Insert new role
          const [insResult] = await conn.execute(
            `INSERT INTO staff_roles (department_id, name, basic_salary, weekly_off_count, monthly_buffer_minutes) VALUES (?, ?, ?, ?, ?)`,
            [id, r.roleName, r.basicSalary ?? 0.00, r.weeklyOffCount ?? 4, r.monthlyBufferMinutes ?? 30]
          );
        }
      }

      // Delete roles that were removed
      const deleteIds = currentIds.filter(cid => !keepIds.includes(cid));
      if (deleteIds.length > 0) {
        for (const did of deleteIds) {
          await conn.execute(`DELETE FROM staff_roles WHERE id = ?`, [did]);
        }
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
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
    'is_night_shift', 'grace_period_minutes',
    // Shift-definition link + the capacity/break/notes the assign-shift form collects
    'default_shift_id', 'capacity', 'break_minutes', 'notes', 'monthly_buffer_minutes'
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

// employees.designation_id points at staff_roles, not designations — joining
// designations here made this guard always return 0.
const countEmployeesWithStaffRole = async (roleName, departmentId) => {
  const [[{ count }]] = await db.execute(
    `SELECT COUNT(*) AS count
     FROM employees e
     JOIN staff_roles sr ON sr.id = e.designation_id
     WHERE sr.name = ? AND e.department_id = ?`,
    [roleName, departmentId]
  );
  return count;
};

const isShiftInUse = async (shiftId) => {
  const [[{ count: c1 }]] = await db.execute(`SELECT COUNT(*) AS count FROM roster_entries WHERE shift_id = ?`, [shiftId]);
  const [[{ count: c2 }]] = await db.execute(`SELECT COUNT(*) AS count FROM attendance_daily_summary WHERE shift_id = ?`, [shiftId]);
  const [[{ count: c3 }]] = await db.execute(`SELECT COUNT(*) AS count FROM staff_roles WHERE default_shift_id = ?`, [shiftId]);
  return (c1 + c2 + c3) > 0;
};

/* ─── REMAPPING & SALARY LOGGING ─── */

const remapEmployee = async ({ employee_id, to_department_id, to_role_id, from_date, notes }, userId = null) => {
  const emp = await getEmployee(employee_id);
  if (!emp) throw new Error('Employee not found');

  const [deptRows] = await db.execute(`SELECT name FROM departments WHERE id = ?`, [to_department_id]);
  const toDeptName = deptRows[0]?.name || '';

  const [roleRows] = await db.execute(`SELECT name FROM staff_roles WHERE id = ?`, [to_role_id]);
  const toRoleName = roleRows[0]?.name || '';

  await db.execute(
    `UPDATE employee_role_remapping_logs
     SET to_date = ?
     WHERE employee_id = ? AND to_date IS NULL`,
    [from_date, employee_id]
  );

  await db.execute(
    `INSERT INTO employee_role_remapping_logs
       (employee_id, from_department_id, from_department_name, from_role_id, from_role_name,
        to_department_id, to_department_name, to_role_id, to_role_name, from_date, remapped_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      employee_id,
      emp.department_id || null,
      emp.department_name || null,
      emp.designation_id || null,
      emp.designation_name || null,
      to_department_id,
      toDeptName,
      to_role_id,
      toRoleName,
      from_date,
      userId,
      notes || null
    ]
  );

  await db.execute(
    `UPDATE employees SET department_id = ?, designation_id = ? WHERE id = ?`,
    [to_department_id, to_role_id, employee_id]
  );
};

const listRemappingLogs = async ({ search, employeeId, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (employeeId) {
    filters.push('l.employee_id = ?');
    params.push(employeeId);
  }
  if (search) {
    filters.push('(e.full_name LIKE ? OR e.employee_code LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT l.*, e.full_name AS employee_name, e.employee_code, u.username AS remapped_by_name
     FROM employee_role_remapping_logs l
     JOIN employees e ON e.id = l.employee_id
     LEFT JOIN users u ON u.id = l.remapped_by
     ${where}
     ORDER BY l.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM employee_role_remapping_logs l
     JOIN employees e ON e.id = l.employee_id
     ${where}`,
    params
  );

  return { rows, total };
};

const updateEmployeeSalary = async (employeeId, data, userId = null) => {
  const { salary_type, basic_salary, per_day_salary, per_night_salary, effective_from, reason } = data;
  const emp = await getEmployee(employeeId);
  if (!emp) throw new Error('Employee not found');

  await db.execute(
    `INSERT INTO employee_salary_logs
       (employee_id, previous_salary_type, new_salary_type,
        previous_basic_salary, new_basic_salary,
        previous_per_day_salary, new_per_day_salary,
        previous_per_night_salary, new_per_night_salary,
        effective_from, reason, changed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      employeeId,
      emp.salary_type || 'monthly',
      salary_type || 'monthly',
      Number(emp.basic_salary) || 0,
      Number(basic_salary) || 0,
      Number(emp.per_day_salary) || 0,
      Number(per_day_salary) || 0,
      Number(emp.per_night_salary) || 0,
      Number(per_night_salary) || 0,
      effective_from,
      reason || null,
      userId
    ]
  );

  await db.execute(
    `UPDATE employees
     SET salary_type = ?, basic_salary = ?, per_day_salary = ?, per_night_salary = ?
     WHERE id = ?`,
    [salary_type || 'monthly', Number(basic_salary) || 0, Number(per_day_salary) || 0, Number(per_night_salary) || 0, employeeId]
  );
};

const listSalaryLogs = async ({ search, employeeId, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (employeeId) {
    filters.push('sl.employee_id = ?');
    params.push(employeeId);
  }
  if (search) {
    filters.push('(e.full_name LIKE ? OR e.employee_code LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT sl.*, e.full_name AS employee_name, e.employee_code, u.username AS changed_by_name
     FROM employee_salary_logs sl
     JOIN employees e ON e.id = sl.employee_id
     LEFT JOIN users u ON u.id = sl.changed_by
     ${where}
     ORDER BY sl.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM employee_salary_logs sl
     JOIN employees e ON e.id = sl.employee_id
     ${where}`,
    params
  );

  return { rows, total };
};

module.exports = {
  listEmployees, getEmployee, getEmployeeByCode, createEmployee, updateEmployee,
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  listDesignations, createDesignation,
  listRoles, createRole,
  listShifts, createShift, updateShift, deleteShift, isShiftInUse,
  listStaffRoles, getStaffRole, createStaffRole, updateStaffRole, deleteStaffRole,
  countEmployeesInDepartment, countStaffRolesInDepartment, countEmployeesWithStaffRole,
  remapEmployee, listRemappingLogs, updateEmployeeSalary, listSalaryLogs,
};
