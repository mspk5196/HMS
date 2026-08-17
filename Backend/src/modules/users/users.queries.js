const db = require('../../config/db');

const listUsers = async () => {
  const [rows] = await db.execute(
    `SELECT u.id, u.username, u.email, u.phone, u.role_id, u.is_active, u.last_login_at, u.created_at,
            r.name AS role_name,
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
  let where = 'WHERE u.id IS NULL';
  if (search) {
    where += ' AND (e.full_name LIKE ? OR e.employee_code LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
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
  const [[row]] = await db.execute(`SELECT id FROM roles WHERE name = 'Staff'`);
  return row?.id ?? null;
};

/** The role mirrored from this employee's designation (staff_role) — the login role is derived, never picked. */
const getRoleIdForEmployee = async (employeeId) => {
  const [[row]] = await db.execute(
    `SELECT r.id
     FROM employees e
     JOIN roles r ON r.staff_role_id = e.designation_id
     WHERE e.id = ?`,
    [employeeId]
  );
  return row?.id ?? null;
};

const getUserByUsername = async (username) => {
  const [[row]] = await db.execute(`SELECT id FROM users WHERE username = ?`, [username]);
  return row ?? null;
};

const getUser = async (id) => {
  const [[row]] = await db.execute(
    `SELECT u.*, r.name AS role_name, e.full_name AS employee_name
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
    `INSERT INTO users (employee_id, username, email, phone, password_hash, role_id, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [employee_id ?? null, username, email ?? null, phone ?? null, password_hash, role_id]
  );
  return result.insertId;
};

const updateUser = async (id, data) => {
  const allowed = ['role_id', 'email', 'phone', 'is_active'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(key === 'is_active' ? (data[key] ? 1 : 0) : data[key]);
    }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
};

const setPasswordHash = async (id, passwordHash) => {
  await db.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, id]);
};

module.exports = {
  listUsers, listEmployeesWithoutLogin, getUserByUsername, getUser,
  createUser, updateUser, setPasswordHash, getEmployeePhone, getStaffRoleRoleId, getRoleIdForEmployee,
};
