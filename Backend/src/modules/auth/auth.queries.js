const db = require('../../config/db');

const getUserByUsername = async (username) => {
  const normalized = String(username || '').trim().toLowerCase();
  const [rows] = await db.execute(
    `SELECT u.*, COALESCE(r.name, 'Staff') AS role_name, COALESCE(r.can_access_settings, 0) AS can_access_settings,
            e.full_name AS employee_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN employees e ON e.id = u.employee_id
     WHERE LOWER(u.username) = ? AND u.is_active = 1`,
    [normalized]
  );
  return rows[0] ?? null;
};

const getUserByGoogleEmailOrId = async (email, googleId) => {
  try {
    const normalized = String(email || '').trim().toLowerCase();
    const [rows] = await db.execute(
      `SELECT u.*, COALESCE(r.name, 'Staff') AS role_name, COALESCE(r.can_access_settings, 0) AS can_access_settings,
              e.full_name AS employee_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN employees e ON e.id = u.employee_id
       WHERE (LOWER(COALESCE(u.google_email, '')) = ? 
              OR LOWER(COALESCE(u.email, '')) = ? 
              OR (u.google_id IS NOT NULL AND u.google_id = ?))
         AND u.is_active = 1
       LIMIT 1`,
      [normalized, normalized, googleId || '']
    );
    return rows[0] ?? null;
  } catch (err) {
    return null;
  }
};

const linkGoogleAccount = async (userId, googleId, googleEmail) => {
  try {
    await db.execute(
      `UPDATE users SET google_id = COALESCE(google_id, ?), google_email = COALESCE(google_email, ?) WHERE id = ?`,
      [googleId, googleEmail, userId]
    );
  } catch (err) {
    console.warn('[linkGoogleAccount] Warning:', err.message);
  }
};

const recordLoginAttempt = async ({
  userId,
  username,
  employeeName,
  method = 'PASSWORD',
  ipAddress,
  userAgent,
  status,
  failureReason,
}) => {
  try {
    await db.execute(
      `INSERT INTO user_login_history 
       (user_id, username, employee_name, login_method, ip_address, user_agent, status, failure_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId ?? null,
        username,
        employeeName ?? null,
        method,
        ipAddress ?? null,
        userAgent ? String(userAgent).slice(0, 250) : null,
        status,
        failureReason ? String(failureReason).slice(0, 250) : null,
      ]
    );
  } catch (err) {
    // If table doesn't exist yet, gracefully catch without breaking auth
    console.warn('[recordLoginAttempt] Warning:', err.message);
  }
};

const updatePasswordAndClearMustChange = async (userId, passwordHash) => {
  await db.execute(
    `UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = NOW() WHERE id = ?`,
    [passwordHash, userId]
  );
};

const getUserById = async (id) => {
  const [rows] = await db.execute(
    `SELECT u.*, COALESCE(r.name, 'Staff') AS role_name, COALESCE(r.can_access_settings, 0) AS can_access_settings,
            e.full_name AS employee_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN employees e ON e.id = u.employee_id
     WHERE u.id = ?`,
    [id]
  );
  return rows[0] ?? null;
};

const getPermissionsForRole = async (roleId) => {
  const [roles] = await db.execute(`SELECT name FROM roles WHERE id = ?`, [roleId]);
  if (roles[0] && roles[0].name === 'Administrator') {
    return ['manage_all'];
  }

  const [rows] = await db.execute(
    `SELECT p.code
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = ?`,
    [roleId]
  );
  return rows.map(r => r.code);
};

const updateUserLastLogin = async (userId) => {
  try {
    await db.execute(`UPDATE users SET last_login_at = NOW() WHERE id = ?`, [userId]);
  } catch (err) {
    try {
      await db.execute(`UPDATE users SET last_login = NOW() WHERE id = ?`, [userId]);
    } catch (e) {}
  }
};

module.exports = {
  getUserByUsername,
  getUserById,
  getUserByGoogleEmailOrId,
  linkGoogleAccount,
  recordLoginAttempt,
  updatePasswordAndClearMustChange,
  getPermissionsForRole,
  updateUserLastLogin,
};
