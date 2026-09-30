const db = require('../../config/db');

const getUserByUsername = async (username) => {
  const normalized = String(username || '').trim().toLowerCase();
  const [rows] = await db.execute(
    `SELECT u.*, COALESCE(r.name, 'Staff') AS role_name, COALESCE(r.can_access_settings, 0) AS can_access_settings
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE LOWER(u.username) = ? AND u.is_active = 1`,
    [normalized]
  );
  return rows[0] ?? null;
};

const getUserById = async (id) => {
  const [rows] = await db.execute(
    `SELECT u.*, COALESCE(r.name, 'Staff') AS role_name, COALESCE(r.can_access_settings, 0) AS can_access_settings
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
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
    await db.execute(`UPDATE users SET last_login = NOW() WHERE id = ?`, [userId]);
  } catch (err) {
    // Ignore if last_login column doesn't exist
  }
};

module.exports = {
  getUserByUsername,
  getUserById,
  getPermissionsForRole,
  updateUserLastLogin,
};
