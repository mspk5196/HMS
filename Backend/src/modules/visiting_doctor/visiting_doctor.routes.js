const router = require('express').Router();
const ctrl = require('./visiting_doctor.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');
const { gate } = require('../../middleware/approvalGate');
const queries = require('./visiting_doctor.queries');

// Ensure the visiting_doctors table exists on first load
queries.ensureTable().catch((err) => console.error('visiting_doctors table init error:', err));

router.use(verifyToken);

const canView = requirePermissions(['visiting_doctor.view']);

router.get('/',         canView, ctrl.list);
router.get('/:id',      canView, ctrl.get);
router.post('/',        gate('visiting_doctor.create', ctrl.create));
router.patch('/:id',    gate('visiting_doctor.edit', ctrl.update));
router.delete('/:id',   gate('visiting_doctor.delete', ctrl.remove));

module.exports = router;
