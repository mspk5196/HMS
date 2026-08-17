/**
 * approvalGate
 *
 * Wraps a controller function with: (1) the existing permission check, and
 * (2) an optional approval step. If the requester's role has skip_approval
 * for this permission, or no approval workflow is enabled for it, the
 * controller runs immediately — otherwise a `pending_approvals` row is
 * created and the controller does NOT run; it only runs later, when an
 * approver clears it, via `replay()`.
 *
 * Every route that uses `gate(code, executor)` must pass a globally unique
 * `code` — it doubles as the registry key used to find the right executor
 * to replay once an approval clears every level. `executor` is expected to
 * be an asyncHandler-wrapped controller (the same thing every controller in
 * this codebase already exports), so it always takes (req, res, next).
 */
const { fail, success } = require('../utils/response');
const rbacQ = require('../modules/rbac/rbac.queries');

const registry = new Map();

const gate = (permissionCode, executor) => {
  if (!registry.has(permissionCode)) {
    registry.set(permissionCode, executor);
  }

  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json(fail('Access denied. No user data.'));

      if (req.user.permissions?.includes('manage_all')) {
        return executor(req, res, next);
      }
      if (!req.user.permissions?.includes(permissionCode)) {
        return res.status(403).json(fail('Forbidden. You do not have the required permission.'));
      }

      const skip = await rbacQ.hasSkipApproval(req.user.role_id, permissionCode);
      const workflow = await rbacQ.getApprovalWorkflow(permissionCode);

      if (skip || !workflow?.enabled) {
        return executor(req, res, next);
      }

      const id = await rbacQ.createPendingApproval({
        permission_code: permissionCode,
        requested_by: req.user.id,
        method: req.method,
        original_url: req.originalUrl,
        params: req.params,
        body: req.body,
        query: req.query,
      });

      return res.status(202).json(success({ id, status: 'pending_level1' }, 'Submitted for approval'));
    } catch (err) {
      next(err);
    }
  };
};

const getExecutor = (permissionCode) => registry.get(permissionCode);

/**
 * Re-invoke the original controller with the original requester's identity,
 * once an approval has fully cleared. `executor` is asyncHandler-wrapped, so
 * it never rejects directly — errors surface through the `next` we hand it.
 */
const replay = (pending, requesterUser) => {
  const executor = getExecutor(pending.permission_code);
  if (!executor) {
    return Promise.reject(new Error(`No registered action for permission code "${pending.permission_code}"`));
  }

  const mockReq = {
    params: pending.params_json ? JSON.parse(pending.params_json) : {},
    body: pending.body_json ? JSON.parse(pending.body_json) : {},
    query: pending.query_json ? JSON.parse(pending.query_json) : {},
    user: requesterUser,
  };

  return new Promise((resolve, reject) => {
    const mockRes = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body }); return this; },
    };
    Promise.resolve(executor(mockReq, mockRes, reject)).catch(reject);
  });
};

module.exports = { gate, getExecutor, replay };
