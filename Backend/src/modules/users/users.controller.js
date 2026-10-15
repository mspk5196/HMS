const svc = require('./users.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created, fail } = require('../../utils/response');

const listUsers = asyncHandler(async (req, res) => {
  res.json(success(await svc.listUsers()));
});

const listEmployeesWithoutLogin = asyncHandler(async (req, res) => {
  res.json(success(await svc.listEmployeesWithoutLogin(req.query.search)));
});

const createLogin = asyncHandler(async (req, res) => {
  const id = await svc.createLogin(req.body);
  res.status(201).json(created({ id }, 'Login created'));
});

const updateUser = asyncHandler(async (req, res) => {
  await svc.updateUser(Number(req.params.id), req.body);
  res.json(success(null, 'User updated'));
});

const resetPassword = asyncHandler(async (req, res) => {
  await svc.resetPassword(Number(req.params.id), req.body.password);
  res.json(success(null, 'Password reset'));
});

const updateAuthMethods = asyncHandler(async (req, res) => {
  const isSelf = req.params.id === 'me';
  const targetId = isSelf ? req.user.id : Number(req.params.id);
  const result = await svc.updateAuthMethods(targetId, req.body, { isSelf });
  res.json(success(result, 'Authentication methods updated'));
});

const listLoginHistory = asyncHandler(async (req, res) => {
  const { search, method, status, limit, offset } = req.query;
  const history = await svc.listLoginHistory({ search, method, status, limit, offset });
  res.json(success(history, 'Login audit history retrieved'));
});

module.exports = {
  listUsers,
  listEmployeesWithoutLogin,
  createLogin,
  updateUser,
  resetPassword,
  updateAuthMethods,
  listLoginHistory,
};
