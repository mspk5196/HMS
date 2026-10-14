const tenantPoolManager = require('../../db/tenantPoolManager');

const getPool = () => tenantPoolManager.controlPlanePool;

// ─── Super Admin Authentication ─────────────────────────────────────────────
const getSuperAdminByEmail = async (email) => {
  const [rows] = await getPool().query(
    'SELECT id, name, email, password_hash, role, created_at FROM super_admins WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
};

// ─── Organizations (Tenants) ────────────────────────────────────────────────
const listOrganizations = async () => {
  const [rows] = await getPool().query(
    `SELECT 
       o.id, o.name, o.code, o.domain, o.db_name, o.db_host, o.db_port,
       o.deployment_type, o.ai_mode, o.ai_service_url, o.status, o.created_at,
       (SELECT COUNT(*) FROM branches WHERE organization_id = o.id) AS total_branches,
       (SELECT COUNT(*) FROM biometric_connectors WHERE organization_id = o.id) AS total_connectors
     FROM organizations o
     ORDER BY o.id ASC`
  );
  return rows;
};

const getOrganizationById = async (id) => {
  const [rows] = await getPool().query(
    'SELECT * FROM organizations WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
};

const getOrganizationByCode = async (code) => {
  const [rows] = await getPool().query(
    'SELECT * FROM organizations WHERE code = ? LIMIT 1',
    [code.toUpperCase().trim()]
  );
  return rows[0] || null;
};

const createOrganization = async ({
  name,
  code,
  domain,
  db_name,
  db_host = 'localhost',
  db_port = 3306,
  db_user = 'root',
  db_password = '',
  deployment_type = 'PLATFORM_HOSTED',
  ai_mode = 'PLATFORM_SHARED',
  ai_service_url = null,
}) => {
  const [result] = await getPool().query(
    `INSERT INTO organizations (
       name, code, domain, db_name, db_host, db_port, db_user, db_password,
       deployment_type, ai_mode, ai_service_url, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      name,
      code.toUpperCase().trim(),
      domain.toLowerCase().trim(),
      db_name.toLowerCase().trim(),
      db_host,
      db_port,
      db_user,
      db_password,
      deployment_type,
      ai_mode,
      ai_service_url,
    ]
  );
  return result.insertId;
};

const updateOrganization = async (id, data) => {
  const updates = [];
  const params = [];

  const fields = ['name', 'domain', 'status', 'deployment_type', 'ai_mode', 'ai_service_url'];
  for (const f of fields) {
    if (data[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(data[f]);
    }
  }

  if (updates.length === 0) return await getOrganizationById(id);

  params.push(id);
  await getPool().query(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`, params);
  return await getOrganizationById(id);
};

// ─── Branches ───────────────────────────────────────────────────────────────
const listBranchesByOrg = async (organizationId) => {
  const [rows] = await getPool().query(
    'SELECT * FROM branches WHERE organization_id = ? ORDER BY id ASC',
    [organizationId]
  );
  return rows;
};

const createBranch = async ({ organization_id, name, code, city, timezone = 'Asia/Kolkata' }) => {
  const [result] = await getPool().query(
    `INSERT INTO branches (organization_id, name, code, city, timezone, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [organization_id, name, code.toUpperCase().trim(), city || null, timezone]
  );
  return result.insertId;
};

// ─── Connectors ─────────────────────────────────────────────────────────────
const listConnectors = async (organizationId = null) => {
  let sql = `
    SELECT 
      c.id, c.organization_id, c.branch_id, c.name, c.connector_key,
      c.public_url, c.ip_address, c.last_heartbeat, c.sync_status, c.version,
      c.created_at,
      o.name AS organization_name, o.code AS organization_code,
      b.name AS branch_name, b.code AS branch_code
    FROM biometric_connectors c
    JOIN organizations o ON o.id = c.organization_id
    JOIN branches b ON b.id = c.branch_id
  `;
  const params = [];
  if (organizationId) {
    sql += ' WHERE c.organization_id = ?';
    params.push(organizationId);
  }
  sql += ' ORDER BY c.id ASC';

  const [rows] = await getPool().query(sql, params);
  return rows;
};

const createConnector = async ({ organization_id, branch_id, name, connector_key, public_url = null }) => {
  const [result] = await getPool().query(
    `INSERT INTO biometric_connectors (organization_id, branch_id, name, connector_key, public_url, sync_status)
     VALUES (?, ?, ?, ?, ?, 'offline')`,
    [organization_id, branch_id, name, connector_key, public_url]
  );
  return result.insertId;
};

// ─── Installation Tokens ───────────────────────────────────────────────────
const createInstallationToken = async ({ organization_id, branch_id, token, token_type = 'CONNECTOR_PAIRING', expiresInHours = 24 }) => {
  const [result] = await getPool().query(
    `INSERT INTO installation_tokens (organization_id, branch_id, token, token_type, expires_at)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
    [organization_id, branch_id, token, token_type, expiresInHours]
  );
  return result.insertId;
};

const getValidInstallationToken = async (token) => {
  const [rows] = await getPool().query(
    `SELECT * FROM installation_tokens 
     WHERE token = ? AND used_at IS NULL AND expires_at > NOW() 
     LIMIT 1`,
    [token]
  );
  return rows[0] || null;
};

const markTokenUsed = async (tokenId) => {
  await getPool().query(
    'UPDATE installation_tokens SET used_at = NOW() WHERE id = ?',
    [tokenId]
  );
};

// ─── Audit Logging ──────────────────────────────────────────────────────────
const logControlPlaneAudit = async ({ super_admin_id, organization_id, action, details, ip_address }) => {
  await getPool().query(
    `INSERT INTO control_plane_audit_logs (super_admin_id, organization_id, action, details, ip_address)
     VALUES (?, ?, ?, ?, ?)`,
    [super_admin_id || null, organization_id || null, action, details ? JSON.stringify(details) : null, ip_address || null]
  );
};

module.exports = {
  getSuperAdminByEmail,
  listOrganizations,
  getOrganizationById,
  getOrganizationByCode,
  createOrganization,
  updateOrganization,
  listBranchesByOrg,
  createBranch,
  listConnectors,
  createConnector,
  createInstallationToken,
  getValidInstallationToken,
  markTokenUsed,
  logControlPlaneAudit,
};
