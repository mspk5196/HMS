const tenantPoolManager = require('../db/tenantPoolManager');
const { tenantStorage } = require('../config/tenantStorage');

/**
 * Tenant Resolver Middleware
 * Identifies the tenant organization for each request using:
 * 1. Connector API Key (for Biometric Edge Gateways)
 * 2. Explicit tenant headers ('x-tenant-code' or 'x-tenant-id')
 * 3. Incoming Hostname / Domain (for Web & Mobile clients)
 * 
 * Attaches tenant and database pool to request and initializes AsyncLocalStorage context.
 */
async function tenantResolver(req, res, next) {
  // Always allow root health check without tenant resolution
  if (req.path === '/api/health' || req.path === '/health' || req.path === '/') {
    return next();
  }

  try {
    // 1. Check for Biometric Connector Key
    const connectorKey = req.headers['x-api-key'] || req.headers['x-connector-key'];
    if (connectorKey) {
      const connContext = await tenantPoolManager.resolveByConnectorKey(connectorKey);
      if (connContext) {
        req.tenant = connContext.tenant;
        req.branch = connContext.branch;
        req.branchId = connContext.branch.id;
        req.connector = connContext.connector;
        req.db = connContext.pool;

        return tenantStorage.run(
          {
            tenant: connContext.tenant,
            branchId: connContext.branch.id,
            pool: connContext.pool,
          },
          () => next()
        );
      }
      // If connector key was provided but failed lookup, reject immediately
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid or revoked Biometric Connector credentials',
      });
    }

    // 2. Check for explicit Tenant Code header
    const explicitTenantCode = req.headers['x-tenant-code'];
    let tenant = null;

    if (explicitTenantCode) {
      tenant = await tenantPoolManager.resolveTenantByCode(explicitTenantCode);
    }

    // 3. Resolve by hostname / domain
    if (!tenant) {
      const rawHost = req.headers['x-forwarded-host'] || req.headers.host || req.hostname;
      tenant = await tenantPoolManager.resolveTenantByDomain(rawHost);
    }

    // Fallback to default tenant if not resolved (e.g. dev localhost)
    if (!tenant) {
      tenant = await tenantPoolManager.getDefaultTenant();
    }

    if (!tenant || tenant.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Inactive or unregistered organization domain',
      });
    }

    // Get or initialize tenant connection pool
    const pool = tenantPoolManager.getOrCreatePool(tenant.db_name);
    const branchId = req.headers['x-branch-id'] ? Number(req.headers['x-branch-id']) : null;

    req.tenant = tenant;
    req.branchId = branchId;
    req.db = pool;

    // Run downstream request within the tenant's AsyncLocalStorage context
    return tenantStorage.run(
      {
        tenant,
        branchId,
        pool,
      },
      () => next()
    );
  } catch (err) {
    console.error('[TenantResolverError]', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error resolving tenant organization',
    });
  }
}

module.exports = tenantResolver;
