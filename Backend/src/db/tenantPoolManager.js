const mysql = require('mysql2/promise');
require('dotenv').config();

// Helper to format CA certificate if it's a single line PEM string
const formatCaCert = (cert) => {
  if (!cert) return undefined;
  const header = "-----BEGIN CERTIFICATE-----";
  const footer = "-----END CERTIFICATE-----";
  if (cert.includes(header) && cert.includes(footer)) {
    let body = cert.replace(header, "").replace(footer, "").trim().replace(/\s+/g, "");
    const chunks = [];
    for (let i = 0; i < body.length; i += 64) {
      chunks.push(body.substring(i, i + 64));
    }
    return `${header}\n${chunks.join("\n")}\n${footer}\n`;
  }
  return cert;
};

// Base connection parameters from environment
const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 50,
  timezone: '+05:30',
  dateStrings: true,
  ...(process.env.DB_CA_CERT
    ? {
        ssl: {
          rejectUnauthorized: true,
          ca: formatCaCert(process.env.DB_CA_CERT),
        },
      }
    : process.env.DB_SSL === 'true'
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
};

const CONTROL_PLANE_DB = process.env.CONTROL_PLANE_DB_NAME || 'control_plane_db';
const DEFAULT_TENANT_DB = process.env.DB_NAME || 'nehahospitals';
const IS_CONTROL_PLANE_ENABLED = process.env.ENABLE_CONTROL_PLANE !== 'false';

class TenantPoolManager {
  constructor() {
    this.controlPlanePool = null;
    this.tenantPools = new Map();
    this.orgCacheByDomain = new Map();
    this.orgCacheByCode = new Map();
    this.connectorCacheByKey = new Map();
    this.defaultPool = null;
    this.isControlPlaneEnabled = IS_CONTROL_PLANE_ENABLED;
    this.init();
  }

  init() {
    // 1. Control Plane Connection Pool (Mounted ONLY on platform server, never customer infrastructure)
    if (this.isControlPlaneEnabled) {
      try {
        this.controlPlanePool = mysql.createPool({
          ...baseConfig,
          database: CONTROL_PLANE_DB,
          connectionLimit: 5,
        });
        this.controlPlanePool.on('connection', (connection) => {
          connection.query("SET time_zone = '+05:30'");
        });
      } catch (err) {
        console.warn(`[TenantPoolManager] Control plane pool init skipped: ${err.message}`);
        this.controlPlanePool = null;
      }
    }

    // 2. Default Tenant Pool (Fallback for single-tenant / customer-hosted routes & background tasks)
    this.defaultPool = this.getOrCreatePool(DEFAULT_TENANT_DB);

    // 3. Periodic cache eviction every 2 minutes to pick up newly added tenants or connector keys
    if (this.isControlPlaneEnabled) {
      setInterval(() => this.clearCaches(), 120000);
    }
  }

  clearCaches() {
    this.orgCacheByDomain.clear();
    this.orgCacheByCode.clear();
    this.connectorCacheByKey.clear();
  }

  /**
   * Retrieves or initializes a connection pool for a specific tenant database
   */
  getOrCreatePool(dbName, tenantSpecificConfig = {}) {
    if (!dbName) dbName = DEFAULT_TENANT_DB;
    if (this.tenantPools.has(dbName)) {
      return this.tenantPools.get(dbName);
    }

    const poolConfig = {
      ...baseConfig,
      ...tenantSpecificConfig,
      database: dbName,
    };

    const pool = mysql.createPool(poolConfig);
    pool.on('connection', (connection) => {
      connection.query("SET time_zone = '+05:30'");
    });

    this.tenantPools.set(dbName, pool);
    console.log(`[TenantPoolManager] Initialized pool for tenant database: "${dbName}"`);
    return pool;
  }

  /**
   * Resolves tenant metadata from incoming domain or hostname
   */
  async resolveTenantByDomain(rawHost) {
    if (!rawHost || !this.controlPlanePool) return this.getDefaultTenant();

    // Clean hostname: remove port if present (e.g. 'localhost:5173' -> 'localhost')
    const hostname = rawHost.split(':')[0].toLowerCase();

    // Check memory cache
    if (this.orgCacheByDomain.has(hostname)) {
      return this.orgCacheByDomain.get(hostname);
    }

    try {
      // Query control plane for matching domain or subdomain
      const [rows] = await this.controlPlanePool.query(
        'SELECT * FROM organizations WHERE domain = ? AND status = "active" LIMIT 1',
        [hostname]
      );

      if (rows.length > 0) {
        const tenant = rows[0];
        this.orgCacheByDomain.set(hostname, tenant);
        this.orgCacheByCode.set(tenant.code, tenant);
        return tenant;
      }

      // Handle localhost, 127.0.0.1, or existing tylo domain as default Neha Hospitals tenant
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.includes('neha.tylo.co.in') ||
        hostname.includes('mspkapps.in')
      ) {
        return this.getDefaultTenant();
      }

      return null;
    } catch (err) {
      console.warn(`[TenantPoolManager] Error querying control plane for domain "${hostname}": ${err.message}. Falling back to default tenant.`);
      return this.getDefaultTenant();
    }
  }

  /**
   * Resolves tenant metadata from tenant code (e.g. 'NEHA')
   */
  async resolveTenantByCode(code) {
    if (!code || !this.controlPlanePool) return this.getDefaultTenant();
    const cleanCode = code.toUpperCase().trim();

    if (this.orgCacheByCode.has(cleanCode)) {
      return this.orgCacheByCode.get(cleanCode);
    }

    try {
      const [rows] = await this.controlPlanePool.query(
        'SELECT * FROM organizations WHERE code = ? AND status = "active" LIMIT 1',
        [cleanCode]
      );

      if (rows.length > 0) {
        const tenant = rows[0];
        this.orgCacheByCode.set(cleanCode, tenant);
        return tenant;
      }
      return null;
    } catch (err) {
      console.warn(`[TenantPoolManager] Error resolving tenant by code "${cleanCode}": ${err.message}`);
      return this.getDefaultTenant();
    }
  }

  /**
   * Resolves tenant, branch, and connector metadata using the biometric connector key
   */
  async resolveByConnectorKey(connectorKey) {
    if (!connectorKey) return null;

    if (!this.controlPlanePool) {
      // Customer-hosted mode: bind directly to local database and primary branch
      const defTenant = await this.getDefaultTenant();
      return {
        connector: { id: 1, name: 'Local Edge Gateway', key: connectorKey },
        tenant: defTenant,
        branch: { id: 1, name: 'Main Hospital Facility', code: 'MAIN' },
        pool: this.defaultPool,
      };
    }

    if (this.connectorCacheByKey.has(connectorKey)) {
      return this.connectorCacheByKey.get(connectorKey);
    }

    try {
      const [rows] = await this.controlPlanePool.query(
        `SELECT 
           c.id AS connector_id,
           c.name AS connector_name,
           c.connector_key,
           c.branch_id,
           c.sync_status,
           o.id AS organization_id,
           o.name AS organization_name,
           o.code AS organization_code,
           o.domain AS organization_domain,
           o.db_name,
           o.ai_mode,
           o.ai_service_url,
           b.name AS branch_name,
           b.code AS branch_code
         FROM biometric_connectors c
         INNER JOIN organizations o ON c.organization_id = o.id
         INNER JOIN branches b ON c.branch_id = b.id
         WHERE c.connector_key = ? AND o.status = "active"
         LIMIT 1`,
        [connectorKey]
      );

      if (rows.length > 0) {
        const record = rows[0];
        const result = {
          connector: {
            id: record.connector_id,
            name: record.connector_name,
            key: record.connector_key,
          },
          tenant: {
            id: record.organization_id,
            name: record.organization_name,
            code: record.organization_code,
            domain: record.organization_domain,
            db_name: record.db_name,
            ai_mode: record.ai_mode,
            ai_service_url: record.ai_service_url,
          },
          branch: {
            id: record.branch_id,
            name: record.branch_name,
            code: record.branch_code,
          },
          pool: this.getOrCreatePool(record.db_name),
        };

        this.connectorCacheByKey.set(connectorKey, result);

        // Update heartbeat asynchronously
        this.controlPlanePool.query(
          'UPDATE biometric_connectors SET last_heartbeat = NOW(), sync_status = "online" WHERE id = ?',
          [record.connector_id]
        ).catch(() => {});

        return result;
      }
      return null;
    } catch (err) {
      console.warn(`[TenantPoolManager] Error resolving connector key: ${err.message}`);
      return null;
    }
  }

  /**
   * Default fallback tenant object for single-facility / initial deployment
   */
  async getDefaultTenant() {
    try {
      const [rows] = await this.controlPlanePool.query(
        'SELECT * FROM organizations WHERE code = "NEHA" OR db_name = ? LIMIT 1',
        [DEFAULT_TENANT_DB]
      );
      if (rows.length > 0) {
        return rows[0];
      }
    } catch (err) {
      // ignore
    }

    return {
      id: 1,
      name: 'Neha Hospitals',
      code: 'NEHA',
      domain: 'neha.mspkapps.in',
      db_name: DEFAULT_TENANT_DB,
      deployment_type: 'PLATFORM_HOSTED',
      ai_mode: 'PLATFORM_SHARED',
      status: 'active',
    };
  }

  getDefaultPool() {
    return this.defaultPool;
  }
}

const tenantPoolManager = new TenantPoolManager();
module.exports = tenantPoolManager;
