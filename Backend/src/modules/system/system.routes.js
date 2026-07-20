const router = require('express').Router();
const ctrl = require('./system.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');

router.use(verifyToken);
// Only admins (with manage_all or specific config permission) can touch system_config
router.use(requirePermissions(['manage_all']));

router.get('/', ctrl.listConfig);
router.get('/:key', ctrl.getConfig);
router.patch('/:key', ctrl.updateConfig);

module.exports = router;
