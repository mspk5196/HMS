/**
 * auth.js middleware (reloaded)
 * 
 * - verifyToken: checks JWT and sets req.user
 * - requirePermissions: checks if req.user has required permissions
 */

const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');

const verifyToken = (req, res, next) => {
  const isProtectedEnabled = process.env.PROTECTED_ROUTES_ENABLED !== 'false';
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
  
  if (!isProtectedEnabled) {
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
        req.user = decoded;
        return next();
      } catch (err) {
        // Ignore expired/invalid token in non-protected mode
      }
    }
    // Set fallback admin user in non-protected mode
    req.user = {
      id: 1,
      username: 'admin',
      role_id: 1,
      role_name: 'Administrator',
      can_access_settings: true,
      permissions: ['manage_all']
    };
    return next();
  }

  if (!token) {
    return res.status(401).json(fail('Access denied. No token provided.'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
    req.user = decoded; // { id, username, role_id, role_name, permissions }
    next();
  } catch (err) {
    return res.status(401).json(fail('Invalid or expired token.'));
  }
};

const requirePermissions = (requiredPermissions, matchMode = 'some') => {
  return (req, res, next) => {
    // If not authenticated, let verifyToken handle it earlier, but check just in case
    if (!req.user) {
      return res.status(401).json(fail('Access denied. No user data.'));
    }

    // Admins bypass permission checks
    if (req.user.role_name === 'Administrator' || req.user.permissions?.includes('manage_all')) {
      return next();
    }

    const perms = Array.isArray(req.user.permissions) ? req.user.permissions : [];
    const checkOne = (code) => {
      if (perms.includes(code)) return true;
      if (code.includes('.')) {
        const [mod] = code.split('.');
        if (perms.includes(`${mod}.*`)) return true;
      }
      return false;
    };

    const list = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    const hasPermission = matchMode === 'every'
      ? list.every(checkOne)
      : list.some(checkOne);

    if (!hasPermission) {
      return res.status(403).json(fail('Forbidden. You do not have the required permissions.'));
    }

    next();
  };
};

/** Gate the Settings page: Administrators always pass; other roles need can_access_settings. */
const requireSettingsAccess = (req, res, next) => {
  if (!req.user) return res.status(401).json(fail('Access denied. No user data.'));
  if (req.user.permissions?.includes('manage_all') || req.user.can_access_settings) {
    return next();
  }
  return res.status(403).json(fail('Forbidden. This role cannot access Settings.'));
};

module.exports = { verifyToken, requirePermissions, requireSettingsAccess };
