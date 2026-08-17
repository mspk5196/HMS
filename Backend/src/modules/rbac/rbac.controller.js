const svc = require('./rbac.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, fail } = require('../../utils/response');

const getPermissionCatalog = asyncHandler(async (req, res) => {
  res.json(success(await svc.getPermissionCatalog()));
});

const listRoles = asyncHandler(async (req, res) => {
  res.json(success(await svc.listRoles()));
});

const updateRolePriorities = asyncHandler(async (req, res) => {
  const { orderedIds } = req.body;
  await svc.updateRolePriorities(orderedIds);
  res.json(success(null, 'Priority order saved'));
});

const getRoleMatrix = asyncHandler(async (req, res) => {
  res.json(success(await svc.getRoleMatrix(Number(req.params.roleId))));
});

const setRoleMatrix = asyncHandler(async (req, res) => {
  await svc.setRoleMatrix(Number(req.params.roleId), req.body.entries || []);
  res.json(success(null, 'Permissions saved'));
});

const setRoleMatrixBulk = asyncHandler(async (req, res) => {
  await svc.setRoleMatrixBulk(req.body.roleIds || [], req.body.entries || []);
  res.json(success(null, 'Permissions saved for all selected roles'));
});

const getSettingsAccess = asyncHandler(async (req, res) => {
  res.json(success(await svc.getSettingsAccessRoles()));
});

const setSettingsAccess = asyncHandler(async (req, res) => {
  await svc.setSettingsAccessRoles(req.body.roleIds || []);
  res.json(success(null, 'Settings access saved'));
});

const listApprovalWorkflows = asyncHandler(async (req, res) => {
  res.json(success(await svc.listApprovalWorkflows()));
});

const upsertApprovalWorkflow = asyncHandler(async (req, res) => {
  await svc.upsertApprovalWorkflow(req.params.code, req.body);
  res.json(success(null, 'Approval workflow saved'));
});

const listMyApprovals = asyncHandler(async (req, res) => {
  res.json(success(await svc.listMyApprovals(req.user)));
});

const listAllPendingApprovals = asyncHandler(async (req, res) => {
  res.json(success(await svc.listAllPendingApprovals(req.query.status)));
});

const approveRequest = asyncHandler(async (req, res) => {
  const result = await svc.approve(Number(req.params.id), req.user);
  res.json(success(result, result.status === 'approved' ? 'Approved and executed' : 'Approved — awaiting next level'));
});

const rejectRequest = asyncHandler(async (req, res) => {
  await svc.reject(Number(req.params.id), req.user, req.body.reason);
  res.json(success(null, 'Rejected'));
});

module.exports = {
  getPermissionCatalog, listRoles, updateRolePriorities,
  getRoleMatrix, setRoleMatrix, setRoleMatrixBulk,
  getSettingsAccess, setSettingsAccess,
  listApprovalWorkflows, upsertApprovalWorkflow,
  listMyApprovals, listAllPendingApprovals, approveRequest, rejectRequest,
};
