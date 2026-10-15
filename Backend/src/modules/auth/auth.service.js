const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const q = require('./auth.queries');
const { AppError } = require('../../utils/errors');

const signToken = async (user, isTemporary = false) => {
  const permissions = await q.getPermissionsForRole(user.role_id);
  const payload = {
    id: user.id,
    username: user.username,
    role_id: user.role_id,
    role_name: user.role_name,
    employee_id: user.employee_id,
    employee_name: user.employee_name,
    can_access_settings: !!user.can_access_settings,
    must_change_password: !!user.must_change_password,
    google_login_enabled: user.google_login_enabled !== undefined ? !!user.google_login_enabled : true,
    password_login_enabled: user.password_login_enabled !== undefined ? !!user.password_login_enabled : true,
    auth_methods_locked: !!user.auth_methods_locked,
    permissions,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET || 'supersecret', {
    expiresIn: isTemporary ? '30m' : (process.env.JWT_EXPIRES_IN || '24h'),
  });
  return { token, user: payload };
};

const login = async (username, password, { ipAddress, userAgent } = {}) => {
  if (!username || !password) {
    throw new AppError('Username and password are required', 400);
  }

  const user = await q.getUserByUsername(username);
  if (!user) {
    await q.recordLoginAttempt({
      username,
      method: 'PASSWORD',
      ipAddress,
      userAgent,
      status: 'FAILED',
      failureReason: 'User not found or inactive',
    });
    throw new AppError('Invalid credentials', 401);
  }

  // Check if password login is disabled for this user
  if (user.password_login_enabled === 0) {
    await q.recordLoginAttempt({
      userId: user.id,
      username: user.username,
      employeeName: user.employee_name,
      method: 'PASSWORD',
      ipAddress,
      userAgent,
      status: 'FAILED',
      failureReason: 'Password login is disabled for this employee',
    });
    throw new AppError('Password login is disabled for your account. Please sign in with Google.', 403);
  }
  //  console.log(await bcrypt.hash(password, 20));
  
  const isMatch = await bcrypt.compare(password, user.password_hash);
  const isPlaintextMatch = password === user.password_hash;
  
  if (!isMatch && !isPlaintextMatch) {
    await q.recordLoginAttempt({
      userId: user.id,
      username: user.username,
      employeeName: user.employee_name,
      method: 'PASSWORD',
      ipAddress,
      userAgent,
      status: 'FAILED',
      failureReason: 'Incorrect password',
    });
    throw new AppError('Invalid credentials', 401);
  }

  // Record successful login in audit trail
  await q.recordLoginAttempt({
    userId: user.id,
    username: user.username,
    employeeName: user.employee_name,
    method: 'PASSWORD',
    ipAddress,
    userAgent,
    status: 'SUCCESS',
  });

  await q.updateUserLastLogin(user.id);

  // If user must change password, return temporary flag
  if (user.must_change_password) {
    const authData = await signToken(user, true);
    return {
      ...authData,
      mustChangePassword: true,
      message: 'First-time login detected. You must set a new password before accessing the system.',
    };
  }

  return signToken(user);
};

/**
 * Handle Google Single Sign-On (SSO) Authentication
 */
const googleLogin = async ({ email, googleId, name, photoUrl }, { ipAddress, userAgent } = {}) => {
  if (!email) {
    throw new AppError('Google email is required for authentication', 400);
  }

  const user = await q.getUserByGoogleEmailOrId(email, googleId);
  if (!user) {
    await q.recordLoginAttempt({
      username: email,
      method: 'GOOGLE',
      ipAddress,
      userAgent,
      status: 'FAILED',
      failureReason: `No hospital account found associated with Google account ${email}`,
    });
    throw new AppError(
      `No hospital staff profile found associated with Google account (${email}). Please contact your administrator.`,
      403
    );
  }

  // Check if Google login is enabled for this employee
  if (user.google_login_enabled === 0) {
    await q.recordLoginAttempt({
      userId: user.id,
      username: user.username,
      employeeName: user.employee_name,
      method: 'GOOGLE',
      ipAddress,
      userAgent,
      status: 'FAILED',
      failureReason: 'Google login is disabled for this employee',
    });
    throw new AppError('Google login is disabled for your account. Please sign in with your password.', 403);
  }

  // Link Google Account identifiers if not yet bound
  if (!user.google_id && googleId) {
    await q.linkGoogleAccount(user.id, googleId, email);
  }

  // Record audit log
  await q.recordLoginAttempt({
    userId: user.id,
    username: user.username,
    employeeName: user.employee_name,
    method: 'GOOGLE',
    ipAddress,
    userAgent,
    status: 'SUCCESS',
  });

  await q.updateUserLastLogin(user.id);

  return signToken(user);
};

/**
 * Set permanent password on first-time login
 */
const firstTimeChangePassword = async (userId, newPassword) => {
  if (!newPassword || newPassword.length < 6) {
    throw new AppError('New password must be at least 6 characters long', 400);
  }

  const user = await q.getUserById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  await q.updatePasswordAndClearMustChange(userId, passwordHash);

  // Return fresh full token with must_change_password = false
  const updatedUser = { ...user, must_change_password: 0 };
  return signToken(updatedUser, false);
};

/**
 * Re-issue a JWT for an already-authenticated user with permissions read fresh
 */
const refreshToken = async (userId) => {
  const user = await q.getUserById(userId);
  if (!user || !user.is_active) {
    throw new AppError('Account no longer active', 401);
  }
  return signToken(user);
};

module.exports = {
  login,
  googleLogin,
  firstTimeChangePassword,
  refreshToken,
};
