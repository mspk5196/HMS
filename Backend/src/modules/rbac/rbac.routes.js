const router = require('express').Router();
const ctrl = require('./rbac.controller');
const { verifyToken, requireSettingsAccess } = require('../../middleware/auth');

router.use(verifyToken);

const canViewApprovals = (req, res, next) => {
  if (
    req.user?.role_name === 'Administrator' ||
    req.user?.permissions?.includes('manage_all') ||
    req.user?.permissions?.includes('approval.view') ||
    req.user?.permissions?.includes('leave.review_reporting') ||
    req.user?.permissions?.includes('leave.review_hr') ||
    req.user?.can_access_settings
  ) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden. You do not have permission to view approvals.' });
};

// Approvals inbox — any authenticated user may see requests waiting on them,
// or users with approval permissions may see the full list.
router.get('/approvals/mine', ctrl.listMyApprovals);
router.get('/approvals', canViewApprovals, ctrl.listAllPendingApprovals);
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
