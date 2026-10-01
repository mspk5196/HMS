const q = require('./system.queries');
const { AppError } = require('../../utils/errors');

const updateConfig = async (key, value) => {
  await q.updateConfig(key, value);
};

const getHospitalProfile = async () => {
  return await q.getHospitalProfile();
};

const updateHospitalProfile = async (profileMap) => {
  await q.updateHospitalProfile(profileMap);
};

module.exports = {
  updateConfig,
  listConfig: q.listConfig,
  getConfig: q.getConfig,
  getHospitalProfile,
  updateHospitalProfile,
};
