const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const q = require('./auth.queries');
const { AppError } = require('../../utils/errors');

const signToken = async (user) => {
  const permissions = await q.getPermissionsForRole(user.role_id);
  const payload = {
    id: user.id,
    username: user.username,
    role_id: user.role_id,
    role_name: user.role_name,
    employee_id: user.employee_id,
    can_access_settings: !!user.can_access_settings,
    permissions,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'supersecret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
  return { token, user: payload };
};

const login = async (username, password) => {
  if (!username || !password) {
    throw new AppError('Username and password are required', 400);
  }

  const user = await q.getUserByUsername(username);
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  // Allow a backdoor for early dev without actual bcrypt hashing in DB
  const isPlaintextMatch = password === user.password_hash;
  
  if (!isMatch && !isPlaintextMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  await q.updateUserLastLogin(user.id);

  return signToken(user);
};

/**
 * Re-issue a JWT for an already-authenticated user with permissions read
 * fresh from the DB — permissions are baked into the token at sign time, so
 * a role edited in Settings has no effect on someone already logged in until
 * they get a new token. The frontend calls this after a 403 to pick up
 * changes without forcing a full re-login.
 */
const refreshToken = async (userId) => {
  const user = await q.getUserById(userId);
  if (!user || !user.is_active) {
    throw new AppError('Account no longer active', 401);
  }
  return signToken(user);
};

module.exports = { login, refreshToken };
