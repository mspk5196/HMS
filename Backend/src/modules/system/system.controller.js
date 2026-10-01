const fs = require('fs');
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

const getHospitalProfile = asyncHandler(async (req, res) => {
  const profile = await svc.getHospitalProfile();
  return res.json(success(profile));
});

const updateHospitalProfile = asyncHandler(async (req, res) => {
  const profileData = req.body.configs || req.body;
  if (!profileData || typeof profileData !== 'object') {
    return res.status(400).json(fail('Profile data object is required'));
  }
  await svc.updateHospitalProfile(profileData);
  const updated = await svc.getHospitalProfile();
  return res.json(success(updated, 'Hospital profile updated successfully'));
});

const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json(fail('No logo file uploaded'));
  }

  const logoUrl = `/uploads/${req.file.filename}`;
  let base64Data = '';
  try {
    const fileBuf = fs.readFileSync(req.file.path);
    base64Data = `data:${req.file.mimetype};base64,${fileBuf.toString('base64')}`;
  } catch (err) {
    console.error('Failed to convert logo to base64:', err);
  }

  await svc.updateConfig('HOSPITAL_LOGO_PATH', logoUrl);
  if (base64Data) {
    await svc.updateConfig('HOSPITAL_LOGO_DATA', base64Data);
  }

  const profile = await svc.getHospitalProfile();
  return res.json(success({ logoUrl, base64Data, profile }, 'Logo uploaded successfully'));
});

const deleteLogo = asyncHandler(async (req, res) => {
  await svc.updateConfig('HOSPITAL_LOGO_PATH', '');
  await svc.updateConfig('HOSPITAL_LOGO_DATA', '');
  const profile = await svc.getHospitalProfile();
  return res.json(success(profile, 'Hospital logo removed successfully'));
});

module.exports = {
  listConfig,
  getConfig,
  updateConfig,
  getHospitalProfile,
  updateHospitalProfile,
  uploadLogo,
  deleteLogo,
};
