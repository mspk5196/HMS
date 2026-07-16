const svc = require('./system.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, fail } = require('../../utils/response');

const listConfig = asyncHandler(async (req, res) => {
  return res.json(success(await svc.listConfig()));
});

const getConfig = asyncHandler(async (req, res) => {
  const config = await svc.getConfig(req.params.key);
  if (!config) return res.status(404).json(fail('Config not found'));
  return res.json(success(config));
});

const updateConfig = asyncHandler(async (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json(fail('value is required'));
  await svc.updateConfig(req.params.key, value);
  return res.json(success(null, 'Config updated'));
});

module.exports = { listConfig, getConfig, updateConfig };
