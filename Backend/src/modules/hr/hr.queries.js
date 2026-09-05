const db = require('../../config/db');

/**
 * Settings > Role Permissions lists roles straight from Department & Role's
 * staff_roles (roles.staff_role_id). Every staff_role create/rename must be
 * mirrored into `roles` so it shows up there — this is the single place that
 * does it. Uses `conn` so it can run inside the same transaction as the
 * staff_role write it's mirroring.
 */
const syncRoleFromStaffRole = async (conn, staffRoleId, name, departmentName) => {
  const trimmed = name.trim();
  const [[linked]] = await conn.execute(`SELECT id FROM roles WHERE staff_role_id = ?`, [staffRoleId]);
  if (linked) {
    await conn.execute(`UPDATE roles SET name = ? WHERE id = ?`, [trimmed, linked.id]);
    return;
  }
  const [[nameClash]] = await conn.execute(`SELECT id FROM roles WHERE name = ?`, [trimmed]);
  const finalName = nameClash ? `${trimmed} (${departmentName})` : trimmed;
  const [[{ maxPriority }]] = await conn.execute(`SELECT COALESCE(MAX(priority), 0) AS maxPriority FROM roles`);
  await conn.execute(
    `INSERT INTO roles (name, description, priority, can_access_settings, staff_role_id) VALUES (?, ?, ?, 0, ?)`,
    [finalName, 'Auto-linked from Department & Role', maxPriority + 1, staffRoleId]
  );
};

/** Active employees whose staff_role is flagged is_doctor — used by doctor pickers across the app. */
const listDoctors = async () => {
  const [rows] = await db.execute(
    `SELECT e.id, e.full_name, sr.name AS designation, d.name AS department_name
     FROM employees e
     JOIN staff_roles sr ON sr.id = e.designation_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE sr.is_doctor = 1 AND e.status = 'active'
     ORDER BY e.full_name`
  );
  return rows;
};

/**
 * An employee's login role is derived from their designation (staff_role),
 * not chosen separately — Users & Authentication has no role picker. Whenever
 * an employee's designation changes and they already have a login, move
 * their login to the role mirrored from the new designation. No-op if they
 * have no login yet, or the new designation has no mirrored role.
 */
const syncUserRoleFromDesignation = async (employeeId, designationId) => {
  if (!designationId) return;
  const [[user]] = await db.execute(`SELECT id FROM users WHERE employee_id = ?`, [employeeId]);
  if (!user) return;
  const [[role]] = await db.execute(`SELECT id FROM roles WHERE staff_role_id = ?`, [designationId]);
  if (!role) return;
  await db.execute(`UPDATE users SET role_id = ? WHERE id = ?`, [role.id, user.id]);
};

/* ─── EMPLOYEES ─── */
const listEmployees = async ({ search, departmentId, status, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (search) {
    const term = `%${search.toLowerCase().trim()}%`;
    filters.push(
      '(LOWER(e.full_name) LIKE ? OR LOWER(e.employee_code) LIKE ? OR LOWER(COALESCE(e.phone, "")) LIKE ? OR LOWER(COALESCE(e.uan_number, "")) LIKE ? OR LOWER(COALESCE(e.esi_number, "")) LIKE ? OR LOWER(COALESCE(d.name, "")) LIKE ? OR LOWER(COALESCE(des.name, "")) LIKE ?)'
    );
    params.push(term, term, term, term, term, term, term);
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
  
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles des ON des.id = e.designation_id
     ${where}`,
    params
  );
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
    qualification, experience_description,
    aadhar_number, aadhar_doc_path, pan_number, pan_doc_path,
    shift_category, custom_shift_start, custom_shift_end, custom_buffer_minutes,
  } = data;
  const isDayNight = shift_category === 'day_and_night';
  const isGeneral = shift_category === 'general';
  const finalSalaryType = 'monthly';
  let finalBasicSalary = Number(basic_salary) || 0;
  let finalPerDaySalary = Number(per_day_salary) || 0;
  let finalPerNightSalary = isDayNight ? (Number(per_night_salary) || 0) : 0;

  if (isDayNight) {
    finalBasicSalary = Math.round(finalPerDaySalary * 30 * 100) / 100;
  } else {
    finalPerDaySalary = Math.round((finalBasicSalary / 30) * 100) / 100;
    finalPerNightSalary = 0;
  }

  const finalCustomBuffer = isGeneral
    ? (custom_buffer_minutes !== undefined && custom_buffer_minutes !== null && custom_buffer_minutes !== '' ? Number(custom_buffer_minutes) : 10)
    : null;

  const [result] = await db.execute(
    `INSERT INTO employees (employee_code, full_name, gender, date_of_birth, date_of_joining,
       department_id, designation_id, phone, address, status,
       bank_account_no, bank_ifsc, bank_name, uan_number,
       salary_type, basic_salary, per_day_salary, per_night_salary,
       qualification, experience_description,
       aadhar_number, aadhar_doc_path, pan_number, pan_doc_path,
       shift_category, custom_shift_start, custom_shift_end, custom_buffer_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      finalSalaryType,
      finalBasicSalary,
      finalPerDaySalary,
      finalPerNightSalary,
      qualification || null,
      experience_description || null,
      aadhar_number || null,
      aadhar_doc_path || null,
      pan_number || null,
      pan_doc_path || null,
      shift_category || null,
      custom_shift_start || null,
      custom_shift_end || null,
      finalCustomBuffer,
    ]
  );
  return result.insertId;
};

const updateEmployee = async (id, data) => {
  const allowed = [
    'employee_code', 'full_name', 'gender', 'date_of_birth', 'date_of_joining', 'department_id', 'designation_id',
    'reporting_person_id', 'phone', 'address', 'status', 'date_of_leaving',
    'bank_account_no', 'bank_ifsc', 'bank_name',
    'uan_number', 'esi_number',
    'salary_type', 'basic_salary', 'per_day_salary', 'per_night_salary',
    'qualification', 'experience_description',
    // Document & shift fields (v9)
    'aadhar_number', 'aadhar_doc_path', 'pan_number', 'pan_doc_path',
    'shift_category', 'custom_shift_start', 'custom_shift_end', 'custom_buffer_minutes',
  ];
  const booleans = ['pf_enrolled', 'esi_enrolled'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(data[key] === '' || data[key] === 'null' || data[key] === null ? null : data[key]);
    }
  }
  for (const key of booleans) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(data[key] === '1' || data[key] === 'true' || data[key] === true || data[key] === 1 ? 1 : 0);
    }
  }

  // Custom mappings for aliases
  if (data.dob !== undefined && data.date_of_birth === undefined) {
    fields.push('date_of_birth = ?');
    vals.push(data.dob === '' || data.dob === 'null' || data.dob === null ? null : data.dob);
  }
  if (data.mobile !== undefined && data.phone === undefined) {
    fields.push('phone = ?');
    vals.push(data.mobile === '' || data.mobile === 'null' || data.mobile === null ? null : data.mobile);
  }
  if (data.is_active !== undefined && data.status === undefined) {
    fields.push('status = ?');
    vals.push(data.is_active ? 'active' : 'inactive');
  }

  if (!fields.length) return;
  // Guard against any undefined entering MySQL2 bind parameters
  const safeVals = vals.map((v) => (v === undefined || v === '' ? null : v));
  safeVals.push(id);
  await db.execute(`UPDATE employees SET ${fields.join(', ')} WHERE id = ?`, safeVals);

  if (data.designation_id !== undefined) {
    await syncUserRoleFromDesignation(id, data.designation_id);
  }
};

/* ─── SHIFT OVERRIDES ─── */

/** List all single-day shift overrides for an employee. */
const listShiftOverrides = async (employeeId) => {
  const [rows] = await db.execute(
    `SELECT * FROM employee_shift_overrides
     WHERE employee_id = ?
     ORDER BY override_date DESC`,
    [employeeId]
  );
  return rows;
};

/** Insert or update a single-day shift override. */
const upsertShiftOverride = async ({ employee_id, override_date, start_time, end_time, note, created_by }) => {
  const [result] = await db.execute(
    `INSERT INTO employee_shift_overrides
       (employee_id, override_date, start_time, end_time, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       start_time  = VALUES(start_time),
       end_time    = VALUES(end_time),
       note        = VALUES(note),
       created_by  = VALUES(created_by)`,
    [employee_id, override_date, start_time, end_time, note ?? null, created_by ?? null]
  );
  return result.insertId || result.affectedRows;
};

/** Delete a single-day shift override by employee + date. */
const deleteShiftOverride = async (employeeId, overrideDate) => {
  const [result] = await db.execute(
    `DELETE FROM employee_shift_overrides WHERE employee_id = ? AND override_date = ?`,
    [employeeId, overrideDate]
  );
  return result.affectedRows;
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
    SELECT id, department_id, name AS roleName, basic_salary AS basicSalary, weekly_off_count AS weeklyOffCount, monthly_buffer_minutes AS monthlyBufferMinutes, is_doctor AS isDoctor
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
      .map(r => ({ id: r.id, roleName: r.roleName, basicSalary: r.basicSalary, weeklyOffCount: r.weeklyOffCount ?? 4, monthlyBufferMinutes: r.monthlyBufferMinutes ?? 30, isDoctor: !!r.isDoctor }))
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

const updateShiftTimings = async (data) => {
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.id) {
        await updateShift(item.id, item);
      }
    }
  } else {
    if (data.dayShift) {
      const { start_time, end_time, grace_period_minutes } = data.dayShift;
      const [rows] = await db.execute(`SELECT id, start_time, end_time FROM shifts WHERE is_night_shift = 0 ORDER BY id ASC LIMIT 1`);
      if (rows.length) {
        const sTime = start_time || rows[0].start_time;
        const eTime = end_time || rows[0].end_time;
        await db.execute(
          `UPDATE shifts 
           SET start_time = ?, end_time = ?, grace_period_minutes = COALESCE(?, grace_period_minutes),
               biometric_in_start = SUBTIME(?, '01:00:00'),
               biometric_in_end = ?,
               biometric_out_start = ?,
               biometric_out_end = ADDTIME(?, '01:00:00')
           WHERE id = ?`,
          [sTime, eTime, grace_period_minutes !== undefined ? Number(grace_period_minutes) : null, sTime, sTime, eTime, eTime, rows[0].id]
        );
      }
    }
    if (data.nightShift) {
      const { start_time, end_time, grace_period_minutes } = data.nightShift;
      const [rows] = await db.execute(`SELECT id, start_time, end_time FROM shifts WHERE is_night_shift = 1 ORDER BY id ASC LIMIT 1`);
      if (rows.length) {
        const sTime = start_time || rows[0].start_time;
        const eTime = end_time || rows[0].end_time;
        await db.execute(
          `UPDATE shifts 
           SET start_time = ?, end_time = ?, grace_period_minutes = COALESCE(?, grace_period_minutes),
               biometric_in_start = SUBTIME(?, '01:00:00'),
               biometric_in_end = ?,
               biometric_out_start = ?,
               biometric_out_end = ADDTIME(?, '01:00:00')
           WHERE id = ?`,
          [sTime, eTime, grace_period_minutes !== undefined ? Number(grace_period_minutes) : null, sTime, sTime, eTime, eTime, rows[0].id]
        );
      }
    }
  }
  return listShifts();
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
        const [ins] = await conn.execute(
          `INSERT INTO staff_roles (department_id, name, basic_salary, weekly_off_count, monthly_buffer_minutes, is_doctor) VALUES (?, ?, ?, ?, ?, ?)`,
          [departmentId, r.roleName, r.basicSalary ?? 0.00, r.weeklyOffCount ?? 4, r.monthlyBufferMinutes ?? 30, r.isDoctor ? 1 : 0]
        );
        await syncRoleFromStaffRole(conn, ins.insertId, r.roleName, name);
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

      const [[dept]] = await conn.execute(`SELECT name FROM departments WHERE id = ?`, [id]);
      const departmentName = dept?.name ?? '';

      const keepIds = [];

      for (const r of roles) {
        if (!r.roleName) continue;
        if (r.id) {
          // Update existing role
          await conn.execute(
            `UPDATE staff_roles SET name = ?, basic_salary = ?, weekly_off_count = ?, monthly_buffer_minutes = ?, is_doctor = ? WHERE id = ? AND department_id = ?`,
            [r.roleName, r.basicSalary ?? 0.00, r.weeklyOffCount ?? 4, r.monthlyBufferMinutes ?? 30, r.isDoctor ? 1 : 0, r.id, id]
          );
          await syncRoleFromStaffRole(conn, r.id, r.roleName, departmentName);
          keepIds.push(r.id);
        } else {
          // Insert new role
          const [insResult] = await conn.execute(
            `INSERT INTO staff_roles (department_id, name, basic_salary, weekly_off_count, monthly_buffer_minutes, is_doctor) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, r.roleName, r.basicSalary ?? 0.00, r.weeklyOffCount ?? 4, r.monthlyBufferMinutes ?? 30, r.isDoctor ? 1 : 0]
          );
          await syncRoleFromStaffRole(conn, insResult.insertId, r.roleName, departmentName);
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
    is_night_shift, grace_period_minutes, is_doctor
  } = data;
  const [result] = await db.execute(
    `INSERT INTO staff_roles
       (department_id, name, description, is_active, basic_salary, hra, da, lop_deduction, casual_leave_count, privilege_leave_count, weekly_off_count,
        shift_name, shift_start_time, shift_end_time, biometric_in_start, biometric_in_end, biometric_out_start, biometric_out_end,
        is_night_shift, grace_period_minutes, is_doctor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      department_id, name, description ?? null, is_active ?? 1,
      basic_salary ?? 0.00, hra ?? 0.00, da ?? 0.00, lop_deduction ?? 0.00,
      casual_leave_count ?? 0, privilege_leave_count ?? 0, weekly_off_count ?? 0,
      shift_name ?? null, shift_start_time ?? null, shift_end_time ?? null,
      biometric_in_start ?? null, biometric_in_end ?? null, biometric_out_start ?? null, biometric_out_end ?? null,
      is_night_shift ? 1 : 0, grace_period_minutes ?? 0, is_doctor ? 1 : 0
    ]
  );
  const [[dept]] = await db.execute(`SELECT name FROM departments WHERE id = ?`, [department_id]);
  await syncRoleFromStaffRole(db, result.insertId, name, dept?.name ?? '');
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
    'default_shift_id', 'capacity', 'break_minutes', 'notes', 'monthly_buffer_minutes', 'is_doctor'
  ];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(key === 'is_active' || key === 'is_night_shift' || key === 'is_doctor' ? (data[key] ? 1 : 0) : data[key]);
    }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE staff_roles SET ${fields.join(', ')} WHERE id = ?`, vals);

  if (data.name !== undefined) {
    const [[sr]] = await db.execute(
      `SELECT sr.name, d.name AS department_name FROM staff_roles sr JOIN departments d ON d.id = sr.department_id WHERE sr.id = ?`,
      [id]
    );
    if (sr) await syncRoleFromStaffRole(db, id, sr.name, sr.department_name);
  }
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

  await syncUserRoleFromDesignation(employee_id, to_role_id);
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
    const term = `%${search.toLowerCase().trim()}%`;
    filters.push('(LOWER(e.full_name) LIKE ? OR LOWER(e.employee_code) LIKE ?)');
    params.push(term, term);
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
  const { basic_salary, per_day_salary, per_night_salary, effective_from, reason } = data;
  const emp = await getEmployee(employeeId);
  if (!emp) throw new Error('Employee not found');

  const isDayNight = emp.shift_category === 'day_and_night';
  const finalSalaryType = 'monthly';
  let finalBasicSalary = Number(basic_salary) || 0;
  let finalPerDaySalary = Number(per_day_salary) || 0;
  let finalPerNightSalary = isDayNight ? (Number(per_night_salary) || 0) : 0;

  if (isDayNight) {
    finalBasicSalary = Math.round(finalPerDaySalary * 30 * 100) / 100;
  } else {
    finalPerDaySalary = Math.round((finalBasicSalary / 30) * 100) / 100;
    finalPerNightSalary = 0;
  }

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
      finalSalaryType,
      Number(emp.basic_salary) || 0,
      finalBasicSalary,
      Number(emp.per_day_salary) || 0,
      finalPerDaySalary,
      Number(emp.per_night_salary) || 0,
      finalPerNightSalary,
      effective_from,
      reason || null,
      userId
    ]
  );

  await db.execute(
    `UPDATE employees
     SET salary_type = ?, basic_salary = ?, per_day_salary = ?, per_night_salary = ?
     WHERE id = ?`,
    [finalSalaryType, finalBasicSalary, finalPerDaySalary, finalPerNightSalary, employeeId]
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
    const term = `%${search.toLowerCase().trim()}%`;
    filters.push('(LOWER(e.full_name) LIKE ? OR LOWER(e.employee_code) LIKE ?)');
    params.push(term, term);
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

/**
 * Bulk imports an array of employee records.
 * Automatically resolves/creates departments and designations,
 * upserts employees by employee_code, and sets baseline salaries.
 */
const bulkImportEmployees = async (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { total: 0, inserted: 0, updated: 0, errors: [] };
  }

  // 1. Fetch current departments and staff roles to cache lookups
  const [allDepts] = await db.query(`SELECT id, name FROM departments`);
  const deptMap = new Map();
  allDepts.forEach((d) => {
    deptMap.set(String(d.id), d.id);
    deptMap.set(d.name.trim().toLowerCase(), d.id);
  });

  const [allRoles] = await db.query(`SELECT id, department_id, name FROM staff_roles`);
  const roleMap = new Map();
  allRoles.forEach((r) => {
    roleMap.set(String(r.id), r.id);
    roleMap.set(`${r.department_id}_${r.name.trim().toLowerCase()}`, r.id);
  });

  let inserted = 0;
  let updated = 0;
  const errors = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNum = idx + 2; // spreadsheet row number (1-based + 1 header)

    const empCode = String(row.employee_code || row.employeeCode || row['Employee Code'] || row['Code'] || '').trim();
    const fullName = String(row.full_name || row.fullName || row.name || row['Full Name'] || row['Name'] || '').trim();

    if (!empCode) {
      errors.push({ row: rowNum, error: 'Employee Code is required.' });
      continue;
    }
    if (!fullName) {
      errors.push({ row: rowNum, employee_code: empCode, error: 'Full Name is required.' });
      continue;
    }

    try {
      // Resolve Department
      const rawDept = String(row.department_name || row.department || row['Department Name'] || row['Department'] || row.department_id || 'General').trim();
      let deptId = deptMap.get(rawDept.toLowerCase()) || deptMap.get(rawDept);

      if (!deptId) {
        const [deptRes] = await db.query(
          `INSERT INTO departments (name, description) VALUES (?, 'Created via bulk employee import')`,
          [rawDept]
        );
        deptId = deptRes.insertId;
        deptMap.set(rawDept.toLowerCase(), deptId);
        deptMap.set(String(deptId), deptId);
      }

      // Resolve Role / Designation
      const rawRole = String(row.designation_name || row.designation || row.position || row['Designation'] || row['Role'] || row.designation_id || 'Staff Member').trim();
      const roleKey = `${deptId}_${rawRole.toLowerCase()}`;
      let designationId = roleMap.get(roleKey) || roleMap.get(rawRole);

      if (!designationId) {
        const [roleRes] = await db.query(
          `INSERT INTO staff_roles (department_id, name, basic_salary, hra, da, pf_applicable, esi_applicable, casual_leave_count, privilege_leave_count)
           VALUES (?, ?, ?, 0, 0, 1, 1, 12, 15)`,
          [deptId, rawRole, Number(row.basic_salary || row['Basic Salary'] || 0)]
        );
        designationId = roleRes.insertId;
        roleMap.set(roleKey, designationId);
        roleMap.set(String(designationId), designationId);
      }

      // Format Dates
      const parseDate = (d) => {
        if (!d) return null;
        if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        const str = String(d).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        const parsed = new Date(str);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
        return null;
      };

      const dateOfJoining = parseDate(row.date_of_joining || row['Date of Joining'] || row.dateOfJoining) || new Date().toISOString().slice(0, 10);
      const dateOfBirth = parseDate(row.date_of_birth || row['Date of Birth'] || row.dateOfBirth);

      // Sanitize fields
      const rawGender = String(row.gender || row['Gender'] || '').toLowerCase();
      const gender = ['male', 'female', 'other'].includes(rawGender) ? rawGender : 'male';
      const phone = row.phone || row['Mobile'] || row['Phone'] || null;
      const address = row.address || row['Address'] || null;
      const qualification = row.qualification || row['Qualification'] || null;
      const experienceDescription = row.experience_description || row['Experience'] || row['Experience Description'] || 'Healthcare professional';
      const salaryType = String(row.salary_type || row['Salary Type'] || 'monthly').toLowerCase().includes('day') ? 'per_day' : 'monthly';
      const basicSalary = Number(row.basic_salary || row['Basic Salary'] || row['Salary'] || 0);
      const perDaySalary = Number(row.per_day_salary || row['Per Day Salary'] || 0);
      const perNightSalary = Number(row.per_night_salary || row['Per Night Salary'] || 0);
      const bankName = row.bank_name || row['Bank Name'] || null;
      const bankAccountNo = row.bank_account_no || row['Bank Account No'] || row['Account No'] || null;
      const bankIfsc = row.bank_ifsc || row['Bank IFSC'] || row['IFSC'] || null;
      const uanNumber = row.uan_number || row['UAN Number'] || row['UAN'] || null;
      const esiNumber = row.esi_number || row['ESI Number'] || row['ESI'] || null;
      const pfEnrolled = [1, '1', true, 'true', 'yes', 'y'].includes(String(row.pf_enrolled || row['PF Enrolled'] || '').toLowerCase()) ? 1 : 0;
      const esiEnrolled = [1, '1', true, 'true', 'yes', 'y'].includes(String(row.esi_enrolled || row['ESI Enrolled'] || '').toLowerCase()) ? 1 : 0;
      const status = String(row.status || row['Status'] || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';

      // Check existing
      const [existingRows] = await db.query(`SELECT id FROM employees WHERE employee_code = ?`, [empCode]);

      let employeeId;
      if (existingRows.length > 0) {
        employeeId = existingRows[0].id;
        await db.query(
          `UPDATE employees
           SET full_name = ?, department_id = ?, designation_id = ?, date_of_joining = ?,
               date_of_birth = ?, gender = ?, phone = ?, address = ?, qualification = ?,
               experience_description = ?, salary_type = ?, basic_salary = ?, per_day_salary = ?,
               per_night_salary = ?, bank_name = ?, bank_account_no = ?, bank_ifsc = ?,
               uan_number = ?, pf_enrolled = ?, esi_number = ?, esi_enrolled = ?, status = ?
           WHERE id = ?`,
          [
            fullName, deptId, designationId, dateOfJoining, dateOfBirth, gender, phone, address, qualification,
            experienceDescription, salaryType, basicSalary, perDaySalary, perNightSalary, bankName,
            bankAccountNo, bankIfsc, uanNumber, pfEnrolled, esiNumber, esiEnrolled, status, employeeId
          ]
        );
        updated++;
      } else {
        const [insertRes] = await db.query(
          `INSERT INTO employees (
            employee_code, full_name, department_id, designation_id, date_of_joining,
            date_of_birth, gender, phone, address, qualification, experience_description,
            salary_type, basic_salary, per_day_salary, per_night_salary, bank_name,
            bank_account_no, bank_ifsc, uan_number, pf_enrolled, esi_number, esi_enrolled, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            empCode, fullName, deptId, designationId, dateOfJoining, dateOfBirth, gender, phone, address, qualification,
            experienceDescription, salaryType, basicSalary, perDaySalary, perNightSalary, bankName,
            bankAccountNo, bankIfsc, uanNumber, pfEnrolled, esiNumber, esiEnrolled, status
          ]
        );
        employeeId = insertRes.insertId;
        inserted++;
      }

      // Upsert baseline salary structure if basic salary is set
      if (basicSalary > 0 && employeeId) {
        try {
          await db.query(
            `INSERT INTO salary_structures (
               employee_id, salary_basis, fixed_salary, basic_da_amount, hra_amount,
               pf_applicable, esi_applicable, effective_from
             ) VALUES (?, 'monthly', ?, ?, 0, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               fixed_salary = VALUES(fixed_salary),
               basic_da_amount = VALUES(basic_da_amount),
               pf_applicable = VALUES(pf_applicable),
               esi_applicable = VALUES(esi_applicable)`,
            [employeeId, basicSalary, basicSalary, pfEnrolled, esiEnrolled, dateOfJoining]
          );
        } catch (e) {
          // ignore duplicate or non-fatal structure errors
        }
      }
    } catch (rowErr) {
      errors.push({ row: rowNum, employee_code: empCode, error: rowErr.message });
    }
  }

  return { total: rows.length, inserted, updated, errors };
};

module.exports = {
  listEmployees, listDoctors, getEmployee, getEmployeeByCode, createEmployee, updateEmployee, bulkImportEmployees,
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  listDesignations, createDesignation,
  listRoles, createRole,
  listShifts, createShift, updateShift, updateShiftTimings, deleteShift, isShiftInUse,
  listStaffRoles, getStaffRole, createStaffRole, updateStaffRole, deleteStaffRole,
  countEmployeesInDepartment, countStaffRolesInDepartment, countEmployeesWithStaffRole,
  remapEmployee, listRemappingLogs, updateEmployeeSalary, listSalaryLogs,
  listShiftOverrides, upsertShiftOverride, deleteShiftOverride,
};
