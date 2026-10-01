const router = require('express').Router();
const ctrl = require('./audit.controller');
const { verifyToken } = require('../../middleware/auth');

router.use(verifyToken);

// Gate by audit.view permission, Administrator role, or can_access_settings
const canViewAuditLogs = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Access denied. No user data.' });
  }
  if (
    req.user.role_name === 'Administrator' ||
    req.user.permissions?.includes('manage_all') ||
    req.user.permissions?.includes('audit.view') ||
    req.user.permissions?.includes('audit.*') ||
    req.user.can_access_settings
  ) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden. You do not have permission to view Audit Logs.' });
};

router.use(canViewAuditLogs);

router.get('/logs', ctrl.listLogs);
router.get('/stats', ctrl.getStats);

module.exports = router;
