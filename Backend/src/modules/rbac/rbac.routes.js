const router = require('express').Router();
const ctrl = require('./rbac.controller');
const { verifyToken, requireSettingsAccess } = require('../../middleware/auth');

router.use(verifyToken);

// Approvals inbox — any authenticated user may see requests waiting on them,
// or (for admins) the full list; not gated behind Settings access.
router.get('/approvals/mine', ctrl.listMyApprovals);
router.get('/approvals', requireSettingsAccess, ctrl.listAllPendingApprovals);
router.post('/approvals/:id/approve', ctrl.approveRequest);
router.post('/approvals/:id/reject', ctrl.rejectRequest);

// Everything else configures the permission system itself — Settings-gated.
router.use(requireSettingsAccess);

router.get('/catalog', ctrl.getPermissionCatalog);

router.get('/roles', ctrl.listRoles);
router.patch('/roles/priority', ctrl.updateRolePriorities);
router.put('/roles/matrix/bulk', ctrl.setRoleMatrixBulk);
router.get('/roles/:roleId/matrix', ctrl.getRoleMatrix);
router.put('/roles/:roleId/matrix', ctrl.setRoleMatrix);

router.get('/settings-access', ctrl.getSettingsAccess);
router.put('/settings-access', ctrl.setSettingsAccess);

router.get('/approval-workflows', ctrl.listApprovalWorkflows);
router.put('/approval-workflows/:code', ctrl.upsertApprovalWorkflow);

module.exports = router;
