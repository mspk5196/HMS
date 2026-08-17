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

module.exports = { listUsers, listEmployeesWithoutLogin, createLogin, updateUser, resetPassword };
