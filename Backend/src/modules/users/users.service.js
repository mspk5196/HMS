const bcrypt = require('bcrypt');
const q = require('./users.queries');
const { AppError } = require('../../utils/errors');

const listUsers = () => q.listUsers();
const listEmployeesWithoutLogin = (search) => q.listEmployeesWithoutLogin(search);

const sanitizeUsername = (raw) => {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
};

const createLogin = async ({ employee_id, username, password, role_id: explicitRoleId }) => {
  if (!username || !password) {
    throw new AppError('username and password are required', 400);
  }
  const cleanUsername = sanitizeUsername(username);
  if (cleanUsername.length < 3) {
    throw new AppError('Username must contain only lowercase letters, numbers, and hyphens (min 3 chars)', 400);
  }
  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }
  const existing = await q.getUserByUsername(cleanUsername);
  if (existing) throw new AppError('This username is already taken', 400);

  const phone = employee_id ? await q.getEmployeePhone(employee_id) : null;
  const role_id = (explicitRoleId ? Number(explicitRoleId) : null)
    || (employee_id ? await q.getRoleIdForEmployee(employee_id) : null)
    || await q.getStaffRoleRoleId();
  if (!role_id) throw new AppError('Baseline "Staff" role is missing', 500);

  const password_hash = await bcrypt.hash(password, 10);
  return q.createUser({ employee_id, username: cleanUsername, password_hash, role_id, email: null, phone });
};

const updateUser = async (id, data) => {
  const user = await q.getUser(id);
  if (!user) throw new AppError('User not found', 404);

  if (data.username !== undefined) {
    const cleanUsername = sanitizeUsername(data.username);
    if (cleanUsername.length < 3) {
      throw new AppError('Username must contain only lowercase letters, numbers, and hyphens (min 3 chars)', 400);
    }
    const existing = await q.getUserByUsername(cleanUsername, id);
    if (existing) throw new AppError('This username is already taken by another account', 400);
    data.username = cleanUsername;
  }

  await q.updateUser(id, data);
};

const resetPassword = async (id, password) => {
  const user = await q.getUser(id);
  if (!user) throw new AppError('User not found', 404);
  if (!password || password.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }
  const password_hash = await bcrypt.hash(password, 10);
  await q.setPasswordHash(id, password_hash);
};

const updateAuthMethods = async (id, body = {}) => {
  const user = await q.getUser(id);
  if (!user) throw new AppError('User not found', 404);

  const googleInput = body.google_login_enabled !== undefined ? body.google_login_enabled : body.googleLoginEnabled;
  const passwordInput = body.password_login_enabled !== undefined ? body.password_login_enabled : body.passwordLoginEnabled;

  const nextGoogle = googleInput !== undefined ? (googleInput === true || googleInput === 1 || googleInput === '1') : (user.google_login_enabled !== 0);
  const nextPassword = passwordInput !== undefined ? (passwordInput === true || passwordInput === 1 || passwordInput === '1') : (user.password_login_enabled !== 0);

  if (!nextGoogle && !nextPassword) {
    throw new AppError('At least one login method (Password or Google) must remain enabled', 400);
  }

  await q.updateAuthMethods(id, { google_login_enabled: nextGoogle, password_login_enabled: nextPassword });
  return { id, google_login_enabled: nextGoogle ? 1 : 0, password_login_enabled: nextPassword ? 1 : 0 };
};

const listLoginHistory = (filters) => q.listLoginHistory(filters);

module.exports = {
  listUsers,
  listEmployeesWithoutLogin,
  createLogin,
  updateUser,
  resetPassword,
  updateAuthMethods,
  listLoginHistory,
};
