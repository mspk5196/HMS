const router = require('express').Router();
const ctrl = require('./audit.controller');
const { verifyToken, requireSettingsAccess } = require('../../middleware/auth');

router.use(verifyToken);
router.use(requireSettingsAccess);

router.get('/logs', ctrl.listLogs);
router.get('/stats', ctrl.getStats);

module.exports = router;
