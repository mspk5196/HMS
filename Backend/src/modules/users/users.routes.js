const router = require('express').Router();
const ctrl = require('./users.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');
const { gate } = require('../../middleware/approvalGate');

router.use(verifyToken);
const canView = requirePermissions(['users.view']);

router.get('/', canView, ctrl.listUsers);
router.get('/employees-without-login', canView, ctrl.listEmployeesWithoutLogin);
router.post('/', gate('users.create', ctrl.createLogin));
router.patch('/:id', gate('users.edit', ctrl.updateUser));
router.post('/:id/reset-password', gate('users.reset_password', ctrl.resetPassword));

module.exports = router;
