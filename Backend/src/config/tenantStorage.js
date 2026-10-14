const { AsyncLocalStorage } = require('node:async_hooks');

/**
 * AsyncLocalStorage container for per-request tenant execution context.
 * Enables zero-boilerplate database and AI service tenant awareness across all services.
 */
const tenantStorage = new AsyncLocalStorage();

/**
 * Returns the current active tenant context, or null if executing outside an HTTP request.
 * Context structure:
 * {
 *   tenant: { id, code, name, domain, db_name, ai_mode, ai_service_url },
 *   branchId: number | null,
 *   pool: mysql.Pool
 * }
 */
const getTenantContext = () => {
  return tenantStorage.getStore() || null;
};

module.exports = {
  tenantStorage,
  getTenantContext
};
