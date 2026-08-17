const bcrypt = require('bcrypt');
const q = require('./users.queries');
const { AppError } = require('../../utils/errors');

const listUsers = () => q.listUsers();
const listEmployeesWithoutLogin = (search) => q.listEmployeesWithoutLogin(search);

const createLogin = async ({ employee_id, username, password }) => {
  if (!username || !password) {
    throw new AppError('username and password are required', 400);
  }
  if (password.length < 6) {
    throw new AppError('Password must be at least 6 characters', 400);
  }
  const existing = await q.getUserByUsername(username);
  if (existing) throw new AppError('This username is already taken', 400);

  // Role and phone are never asked for here — the login's role is derived
  // from the employee's designation (Department & Role), same as phone
  // comes straight from the employee record. Only falls back to the
  // baseline "Staff" role if that designation has no mirrored RBAC role.
  const phone = employee_id ? await q.getEmployeePhone(employee_id) : null;
  const role_id = (employee_id ? await q.getRoleIdForEmployee(employee_id) : null) ?? await q.getStaffRoleRoleId();
  if (!role_id) throw new AppError('Baseline "Staff" role is missing — run the RBAC migration', 500);

  const password_hash = await bcrypt.hash(password, 10);
  return q.createUser({ employee_id, username, password_hash, role_id, email: null, phone });
};

const updateUser = async (id, data) => {
  const user = await q.getUser(id);
  if (!user) throw new AppError('User not found', 404);
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

module.exports = { listUsers, listEmployeesWithoutLogin, createLogin, updateUser, resetPassword };
