const q = require('./system.queries');
const { AppError } = require('../../utils/errors');

const updateConfig = async (key, value) => {
  const config = await q.getConfig(key);
  if (!config) throw new AppError(`Config key '${key}' not found`, 404);
  await q.updateConfig(key, value);
};

module.exports = {
  updateConfig,
  listConfig: q.listConfig,
  getConfig: q.getConfig,
};
