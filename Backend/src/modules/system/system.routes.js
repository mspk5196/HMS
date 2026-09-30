const router = require('express').Router();
const ctrl = require('./system.controller');
const { verifyToken, requireSettingsAccess } = require('../../middleware/auth');

router.use(verifyToken);
router.use(requireSettingsAccess);

router.get('/', ctrl.listConfig);
router.get('/:key', ctrl.getConfig);
router.patch('/:key', ctrl.updateConfig);

module.exports = router;
