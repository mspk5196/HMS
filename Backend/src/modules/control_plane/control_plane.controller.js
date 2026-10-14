const cpSvc = require('./control_plane.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created } = require('../../utils/response');

const login = asyncHandler(async (req, res) => {
  const result = await cpSvc.loginSuperAdmin(req.body);
  return res.json(success(result, 'Super Admin authenticated successfully'));
});

const listOrganizations = asyncHandler(async (req, res) => {
  const orgs = await cpSvc.listOrganizations();
  return res.json(success(orgs, 'Organizations fetched successfully'));
});

const getOrganization = asyncHandler(async (req, res) => {
  const org = await cpSvc.getOrganization(req.params.id);
  return res.json(success(org, 'Organization details fetched'));
});

const createOrganization = asyncHandler(async (req, res) => {
  const org = await cpSvc.createOrganization(req.body);
  return res.status(201).json(created(org, 'Tenant organization onboarded successfully'));
});

const updateOrganization = asyncHandler(async (req, res) => {
  const updated = await cpSvc.updateOrganization(req.params.id, req.body);
  return res.json(success(updated, 'Organization updated successfully'));
});

const listConnectors = asyncHandler(async (req, res) => {
  const connectors = await cpSvc.listConnectors(req.query.organization_id);
  return res.json(success(connectors, 'Biometric connectors fetched'));
});

const generateToken = asyncHandler(async (req, res) => {
  const tokenData = await cpSvc.generateConnectorToken(req.body);
  return res.status(201).json(created(tokenData, 'Pairing token generated successfully'));
});

const pairConnector = asyncHandler(async (req, res) => {
  const result = await cpSvc.pairConnector(req.body);
  return res.json(success(result, 'Biometric connector paired successfully'));
});

module.exports = {
  login,
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  listConnectors,
  generateToken,
  pairConnector,
};
