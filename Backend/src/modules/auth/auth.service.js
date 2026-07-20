const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const q = require('./auth.queries');
const { AppError } = require('../../utils/errors');

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

  const permissions = await q.getPermissionsForRole(user.role_id);
  
  // JWT payload
  const payload = {
    id: user.id,
    username: user.username,
    role_id: user.role_id,
    role_name: user.role_name,
    employee_id: user.employee_id,
    permissions,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET || 'supersecret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  await q.updateUserLastLogin(user.id);

  return { token, user: payload };
};

module.exports = { login };
