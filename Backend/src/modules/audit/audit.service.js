const queries = require('./audit.queries');

const listLogs = async (filters) => {
  return await queries.listRequestAuditLogs(filters);
};

const getStats = async () => {
  return await queries.getRequestAuditStats();
};

module.exports = {
  listLogs,
  getStats,
};
