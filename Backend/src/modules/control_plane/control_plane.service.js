const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cpQ = require('./control_plane.queries');
const { AppError } = require('../../utils/errors');
const tenantPoolManager = require('../../db/tenantPoolManager');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// ─── Super Admin Authentication ─────────────────────────────────────────────
const loginSuperAdmin = async ({ email, password }) => {
  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const admin = await cpQ.getSuperAdminByEmail(email.toLowerCase().trim());
  if (!admin) {
    throw new AppError('Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: 'SUPER_ADMIN',
      isControlPlane: true,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return {
    token,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    },
  };
};

// ─── Organizations / Tenants ────────────────────────────────────────────────
const listOrganizations = async () => {
  return await cpQ.listOrganizations();
};

const getOrganization = async (id) => {
  const org = await cpQ.getOrganizationById(id);
  if (!org) throw new AppError('Organization not found', 404);
  const branches = await cpQ.listBranchesByOrg(id);
  const connectors = await cpQ.listConnectors(id);
  return { ...org, branches, connectors };
};

const createOrganization = async (data) => {
  const { name, code, domain, db_name, deployment_type, ai_mode, ai_service_url } = data;
  if (!name || !code || !domain || !db_name) {
    throw new AppError('Name, code, domain, and database name are required', 400);
  }

  const existingCode = await cpQ.getOrganizationByCode(code);
  if (existingCode) {
    throw new AppError(`Organization code "${code}" already exists`, 409);
  }

  const orgId = await cpQ.createOrganization({
    name,
    code,
    domain,
    db_name,
    db_host: data.db_host || process.env.DB_HOST || 'localhost',
    db_port: Number(data.db_port || process.env.DB_PORT) || 3306,
    db_user: data.db_user || process.env.DB_USER || 'root',
    db_password: data.db_password || process.env.DB_PASS || '',
    deployment_type: deployment_type || 'PLATFORM_HOSTED',
    ai_mode: ai_mode || 'PLATFORM_SHARED',
    ai_service_url: ai_service_url || null,
  });

  // Seed default primary branch in Control Plane
  await cpQ.createBranch({
    organization_id: orgId,
    name: `${name} - Main Branch`,
    code: 'MAIN',
    city: data.city || null,
  });

  return await getOrganization(orgId);
};

const updateOrganization = async (id, data) => {
  await getOrganization(id);
  return await cpQ.updateOrganization(id, data);
};

// ─── Biometric Connectors & Pairing ─────────────────────────────────────────
const listConnectors = async (organizationId) => {
  return await cpQ.listConnectors(organizationId);
};

const generateConnectorToken = async ({ organization_id, branch_id, expiresInHours = 48 }) => {
  if (!organization_id || !branch_id) {
    throw new AppError('Organization ID and Branch ID are required', 400);
  }

  const token = `nh_conn_${crypto.randomBytes(20).toString('hex')}`;
  await cpQ.createInstallationToken({
    organization_id,
    branch_id,
    token,
    token_type: 'CONNECTOR_PAIRING',
    expiresInHours,
  });

  return {
    pairing_token: token,
    expires_in_hours: expiresInHours,
    instructions: `Run on Edge machine: npx neha-bio-connector --token=${token}`,
  };
};

const pairConnector = async ({ token, name, public_url }) => {
  if (!token) {
    throw new AppError('Pairing token is required', 400);
  }

  const installToken = await cpQ.getValidInstallationToken(token);
  if (!installToken) {
    throw new AppError('Invalid, expired, or already used pairing token', 401);
  }

  const connectorKey = crypto.randomBytes(32).toString('hex');
  const connectorName = name || `Edge Gateway Branch #${installToken.branch_id}`;

  const connectorId = await cpQ.createConnector({
    organization_id: installToken.organization_id,
    branch_id: installToken.branch_id,
    name: connectorName,
    connector_key: connectorKey,
    public_url: public_url || null,
  });

  await cpQ.markTokenUsed(installToken.id);

  return {
    connector_id: connectorId,
    connector_key: connectorKey,
    organization_id: installToken.organization_id,
    branch_id: installToken.branch_id,
    message: 'Biometric Connector paired successfully.',
  };
};

module.exports = {
  loginSuperAdmin,
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  listConnectors,
  generateConnectorToken,
  pairConnector,
};
