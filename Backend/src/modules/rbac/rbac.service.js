const q = require('./rbac.queries');
const { AppError } = require('../../utils/errors');
const { replay } = require('../../middleware/approvalGate');

/* ─── Catalog / Matrix ─── */

const getPermissionCatalog = () => q.getPermissionCatalog();
const listRoles = () => q.listRoles();

const updateRolePriorities = async (orderedIds) => {
  if (!Array.isArray(orderedIds) || !orderedIds.length) {
    throw new AppError('orderedIds must be a non-empty array', 400);
  }
  await q.updateRolePriorities(orderedIds.map(Number));
};

const getRoleMatrix = async (roleId) => {
  const roles = await q.listRoles();
  if (!roles.some((r) => r.id === Number(roleId))) throw new AppError('Role not found', 404);
  return q.getRoleMatrix(roleId);
};

const setRoleMatrix = async (roleId, entries) => {
  if (!Array.isArray(entries)) throw new AppError('entries must be an array', 400);
  await q.setRoleMatrix(roleId, entries);
};

const setRoleMatrixBulk = async (roleIds, entries) => {
  if (!Array.isArray(roleIds) || !roleIds.length) throw new AppError('roleIds must be a non-empty array', 400);
  if (!Array.isArray(entries)) throw new AppError('entries must be an array', 400);
  const roles = await q.listRoles();
  const validIds = new Set(roles.map((r) => r.id));
  for (const id of roleIds) {
    if (!validIds.has(Number(id))) throw new AppError(`Role ${id} not found`, 404);
  }
  await q.setRoleMatrixBulk(roleIds.map(Number), entries);
};

/* ─── Settings Access ─── */

const getSettingsAccessRoles = () => q.getSettingsAccessRoles();
const setSettingsAccessRoles = async (roleIds) => {
  if (!Array.isArray(roleIds)) throw new AppError('roleIds must be an array', 400);
  await q.setSettingsAccessRoles(roleIds.map(Number));
};

/* ─── Approval Workflows (config) ─── */

const listApprovalWorkflows = () => q.listApprovalWorkflows();

const upsertApprovalWorkflow = async (permissionCode, data) => {
  const existing = await q.getApprovalWorkflow(permissionCode);
  if (!existing) throw new AppError('No such approvable action', 404);
  await q.upsertApprovalWorkflow(permissionCode, data);
};

/* ─── Pending Approvals ─── */

const listMyApprovals = (user) => q.listApprovalsForApprover(user);
const listAllPendingApprovals = (status) => q.listAllPendingApprovals(status);

const isEligibleApprover = (workflow, level, user) => {
  if (user.permissions?.includes('manage_all')) return true;
  const type = level === 1 ? workflow.level1_type : workflow.level2_type;
  const roleId = level === 1 ? workflow.level1_role_id : workflow.level2_role_id;
  const userId = level === 1 ? workflow.level1_user_id : workflow.level2_user_id;
  if (type === 'role') return roleId === user.role_id;
  return userId === user.id;
};

const approve = async (pendingId, approverUser) => {
  const pending = await q.getPendingApproval(pendingId);
  if (!pending) throw new AppError('Approval request not found', 404);
  if (!['pending_level1', 'pending_level2'].includes(pending.status)) {
    throw new AppError(`This request is already ${pending.status}`, 400);
  }

  const workflow = await q.getApprovalWorkflow(pending.permission_code);
  if (!workflow) throw new AppError('Approval workflow no longer configured for this action', 400);

  const level = pending.status === 'pending_level1' ? 1 : 2;
  if (!isEligibleApprover(workflow, level, approverUser)) {
    throw new AppError('You are not an approver for this request', 403);
  }

  if (level === 1) {
    await q.markLevel1Approved(pendingId, approverUser.id);
    if (workflow.level2_enabled) {
      return { status: 'pending_level2' };
    }
    // No second level — finalize now.
    return finalize(pendingId, pending);
  }

  // level === 2
  await q.markLevel2Approved(pendingId, approverUser.id);
  return finalize(pendingId, pending);
};

const finalize = async (pendingId, pending) => {
  const requester = await q.getUserById(pending.requested_by);
  if (!requester) throw new AppError('Original requester no longer exists', 400);

  const requesterUser = {
    id: requester.id,
    username: requester.username,
    role_id: requester.role_id,
    role_name: requester.role_name,
    employee_id: requester.employee_id,
    permissions: [], // deliberately not manage_all — this replay must go through the same checks conceptually already cleared
  };

  try {
    const result = await replay(pending, requesterUser);
    await q.markResolved(pendingId, { status: 'approved', result: result.body });
    return { status: 'approved', result: result.body };
  } catch (err) {
    await q.markResolved(pendingId, { status: 'approved', error: err.message || 'Action failed on replay' });
    throw new AppError(`Approved, but the action failed when executed: ${err.message}`, 500);
  }
};

const reject = async (pendingId, approverUser, reason) => {
  const pending = await q.getPendingApproval(pendingId);
  if (!pending) throw new AppError('Approval request not found', 404);
  if (!['pending_level1', 'pending_level2'].includes(pending.status)) {
    throw new AppError(`This request is already ${pending.status}`, 400);
  }

  const workflow = await q.getApprovalWorkflow(pending.permission_code);
  const level = pending.status === 'pending_level1' ? 1 : 2;
  if (workflow && !isEligibleApprover(workflow, level, approverUser)) {
    throw new AppError('You are not an approver for this request', 403);
  }

  await q.markRejected(pendingId, approverUser.id, reason);
};

module.exports = {
  getPermissionCatalog, listRoles, updateRolePriorities,
  getRoleMatrix, setRoleMatrix, setRoleMatrixBulk,
  getSettingsAccessRoles, setSettingsAccessRoles,
  listApprovalWorkflows, upsertApprovalWorkflow,
  listMyApprovals, listAllPendingApprovals, approve, reject,
};
