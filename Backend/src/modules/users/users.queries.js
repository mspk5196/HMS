const db = require('../../config/db');

const listUsers = async () => {
  const [rows] = await db.execute(
    `SELECT u.id, u.username, u.email, u.phone, u.role_id, u.is_active, u.last_login_at, u.created_at,
            COALESCE(u.must_change_password, 0) AS must_change_password,
            COALESCE(u.google_login_enabled, 1) AS google_login_enabled,
            COALESCE(u.password_login_enabled, 1) AS password_login_enabled,
            COALESCE(u.auth_methods_locked, 0) AS auth_methods_locked,
            u.google_email, u.google_id,
            COALESCE(r.name, 'Staff') AS role_name,
            e.id AS employee_id, e.full_name AS employee_name, e.employee_code,
            d.name AS department_name, sr.name AS designation_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN employees e ON e.id = u.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     ORDER BY u.created_at DESC`
  );
  return rows;
};

/** Employees who don't have a login yet — the picker for "Set Login". */
const listEmployeesWithoutLogin = async (search) => {
  const params = [];
  let where = 'WHERE u.id IS NULL AND e.status = \'active\'';
  if (search) {
    const term = `%${search.toLowerCase().trim()}%`;
    where += ' AND (LOWER(e.full_name) LIKE ? OR LOWER(e.employee_code) LIKE ?)';
    params.push(term, term);
  }
  const [rows] = await db.query(
    `SELECT e.id, e.full_name, e.employee_code, d.name AS department_name, sr.name AS designation_name
     FROM employees e
     LEFT JOIN users u ON u.employee_id = e.id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     ${where}
     ORDER BY e.full_name
     LIMIT 50`,
    params
  );
  return rows;
};

const getEmployeePhone = async (employeeId) => {
  const [[row]] = await db.execute(`SELECT phone FROM employees WHERE id = ?`, [employeeId]);
  return row?.phone ?? null;
};

const getStaffRoleRoleId = async () => {
  const [[row]] = await db.execute(`SELECT id FROM roles WHERE name = 'Staff' LIMIT 1`);
  if (row) return row.id;
  const [[firstRole]] = await db.execute(`SELECT id FROM roles ORDER BY id ASC LIMIT 1`);
  return firstRole?.id ?? 1;
};

/** The role mirrored from this employee's designation (staff_role) or designation category. */
const getRoleIdForEmployee = async (employeeId) => {
  // 1. Check direct staff_role_id link in roles
  const [[row]] = await db.execute(
    `SELECT r.id
     FROM employees e
     JOIN roles r ON r.staff_role_id = e.designation_id
     WHERE e.id = ? LIMIT 1`,
    [employeeId]
  );
  if (row?.id) return row.id;

  // 2. Fallback matching by designation title / type
  const [[emp]] = await db.execute(
    `SELECT sr.name, sr.is_doctor FROM employees e
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     WHERE e.id = ?`,
    [employeeId]
  );
  if (emp?.is_doctor) {
    const [[docRole]] = await db.execute(`SELECT id FROM roles WHERE name = 'Doctor' LIMIT 1`);
    if (docRole) return docRole.id;
  }
  if (emp?.name) {
    const desLower = emp.name.toLowerCase();
    if (desLower.includes('nurse')) {
      const [[nurseRole]] = await db.execute(`SELECT id FROM roles WHERE name = 'Nurse' LIMIT 1`);
      if (nurseRole) return nurseRole.id;
    }
    if (desLower.includes('pharmac')) {
      const [[pharmRole]] = await db.execute(`SELECT id FROM roles WHERE name = 'Pharmacist' LIMIT 1`);
      if (pharmRole) return pharmRole.id;
    }
    if (desLower.includes('admin') || desLower.includes('reception')) {
      const [[recRole]] = await db.execute(`SELECT id FROM roles WHERE name = 'Receptionist' LIMIT 1`);
      if (recRole) return recRole.id;
    }
  }

  // 3. Fallback to Staff baseline role
  return getStaffRoleRoleId();
};

const getUserByUsername = async (username, excludeUserId = null) => {
  const normalized = String(username || '').trim().toLowerCase();
  const params = [normalized];
  let query = `SELECT id, username FROM users WHERE LOWER(username) = ?`;
  if (excludeUserId) {
    query += ` AND id != ?`;
    params.push(excludeUserId);
  }
  const [[row]] = await db.execute(query, params);
  return row ?? null;
};

const getUser = async (id) => {
  const [[row]] = await db.execute(
    `SELECT u.*, COALESCE(r.name, 'Staff') AS role_name, e.full_name AS employee_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN employees e ON e.id = u.employee_id
     WHERE u.id = ?`,
    [id]
  );
  return row ?? null;
};

const createUser = async ({ employee_id, username, password_hash, role_id, email, phone }) => {
  const [result] = await db.execute(
    `INSERT INTO users (employee_id, username, email, phone, password_hash, role_id, is_active, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
    [employee_id ?? null, username, email ?? null, phone ?? null, password_hash, role_id]
  );
  return result.insertId;
};

const updateUser = async (id, data) => {
  const allowed = ['username', 'role_id', 'email', 'phone', 'is_active', 'google_login_enabled', 'password_login_enabled', 'auth_methods_locked'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(typeof data[key] === 'boolean' ? (data[key] ? 1 : 0) : data[key]);
    }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
};

const setPasswordHash = async (id, passwordHash) => {
  await db.execute(
    `UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = NOW() WHERE id = ?`,
    [passwordHash, id]
  );
};

const updateAuthMethods = async (id, { google_login_enabled, password_login_enabled, auth_methods_locked }) => {
  const fields = [];
  const vals = [];
  if (google_login_enabled !== undefined) {
    fields.push('google_login_enabled = ?');
    vals.push(google_login_enabled ? 1 : 0);
  }
  if (password_login_enabled !== undefined) {
    fields.push('password_login_enabled = ?');
    vals.push(password_login_enabled ? 1 : 0);
  }
  if (auth_methods_locked !== undefined) {
    fields.push('auth_methods_locked = ?');
    vals.push(auth_methods_locked ? 1 : 0);
  }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
};

const listLoginHistory = async ({ search, method, status, limit = 50, offset = 0 } = {}) => {
  try {
    let where = 'WHERE 1=1';
    const params = [];
    if (search) {
      where += ' AND (LOWER(username) LIKE ? OR LOWER(COALESCE(employee_name, "")) LIKE ?)';
      const t = `%${search.toLowerCase().trim()}%`;
      params.push(t, t);
    }
    if (method && method !== 'ALL') {
      where += ' AND login_method = ?';
      params.push(method);
    }
    if (status && status !== 'ALL') {
      where += ' AND status = ?';
      params.push(status);
    }
    params.push(Number(limit) || 50, Number(offset) || 0);

    const [rows] = await db.query(
      `SELECT id, user_id, username, employee_name, login_method, ip_address, user_agent, status, failure_reason, created_at
       FROM user_login_history
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      params
    );
    return rows;
  } catch (err) {
    console.warn('[listLoginHistory] Warning:', err.message);
    return [];
  }
};

module.exports = {
  listUsers,
  listEmployeesWithoutLogin,
  getUserByUsername,
  getUser,
  createUser,
  updateUser,
  setPasswordHash,
  updateAuthMethods,
  listLoginHistory,
  getEmployeePhone,
  getStaffRoleRoleId,
  getRoleIdForEmployee,
};
