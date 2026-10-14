const router = require('express').Router();
const ctrl = require('./branch.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');
const { gate } = require('../../middleware/approvalGate');

// Protect all branch management routes
router.use(verifyToken);

router.get('/', ctrl.listBranches);
router.get('/:id', ctrl.getBranch);
router.post('/', gate('branch.manage', ctrl.createBranch));
router.put('/:id', gate('branch.manage', ctrl.updateBranch));
router.delete('/:id', gate('branch.manage', ctrl.deleteBranch));

module.exports = router;
