const router = require('express').Router();
const ctrl = require('./users.controller');
const { verifyToken, requireSettingsAccess } = require('../../middleware/auth');

router.use(verifyToken);
router.use(requireSettingsAccess);

router.get('/', ctrl.listUsers);
router.get('/employees-without-login', ctrl.listEmployeesWithoutLogin);
router.post('/', ctrl.createLogin);
router.patch('/:id', ctrl.updateUser);
router.post('/:id/reset-password', ctrl.resetPassword);

module.exports = router;
