const pool = require('../../config/db');

const listRequestAuditLogs = async ({
  page = 1,
  limit = 50,
  search = '',
  method = '',
  statusGroup = '',
  statusCode = '',
  startDate = '',
  endDate = '',
  role = '',
}) => {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const safeLimit = Math.min(200, Math.max(10, parseInt(limit, 10) || 50));

  const conditions = [];
  const params = [];

  if (search && search.trim()) {
    conditions.push('(endpoint LIKE ? OR username LIKE ? OR ip_address LIKE ? OR device_info LIKE ?)');
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (method && method.trim()) {
    conditions.push('method = ?');
    params.push(method.trim().toUpperCase());
  }

  if (statusCode && !isNaN(parseInt(statusCode, 10))) {
    conditions.push('status_code = ?');
    params.push(parseInt(statusCode, 10));
  } else if (statusGroup) {
    if (statusGroup === '2xx') {
      conditions.push('status_code >= 200 AND status_code < 300');
    } else if (statusGroup === '3xx') {
      conditions.push('status_code >= 300 AND status_code < 400');
    } else if (statusGroup === '4xx') {
      conditions.push('status_code >= 400 AND status_code < 500');
    } else if (statusGroup === '5xx') {
      conditions.push('status_code >= 500');
    }
  }

  if (role && role.trim()) {
    conditions.push('role_name = ?');
    params.push(role.trim());
  }

  if (startDate && startDate.trim()) {
    conditions.push('created_at >= ?');
    params.push(`${startDate.trim()} 00:00:00`);
  }

  if (endDate && endDate.trim()) {
    conditions.push('created_at <= ?');
    params.push(`${endDate.trim()} 23:59:59`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countSql = `SELECT COUNT(*) AS total FROM request_audit_logs ${whereClause}`;
  const [[{ total }]] = await pool.query(countSql, params);

  // Get paginated logs (select only metadata, no payload/headers)
  const listSql = `
    SELECT
      id,
      user_id,
      username,
      role_name,
      method,
      endpoint,
      ip_address,
      device_info,
      user_agent,
      status_code,
      response_time_ms,
      created_at
    FROM request_audit_logs
    ${whereClause}
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(listSql, [...params, safeLimit, offset]);

  return {
    logs: rows,
    total: parseInt(total, 10) || 0,
    page: parseInt(page, 10),
    limit: safeLimit,
    totalPages: Math.ceil((total || 0) / safeLimit) || 1,
  };
};

const getRequestAuditStats = async () => {
  const sql = `
    SELECT
      COUNT(*) AS total_today,
      SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) AS success_2xx,
      SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END) AS client_err_4xx,
      SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) AS server_err_5xx,
      COUNT(DISTINCT ip_address) AS unique_ips_today,
      ROUND(AVG(response_time_ms), 0) AS avg_response_ms
    FROM request_audit_logs
    WHERE created_at >= CURDATE()
  `;
  const [[stats]] = await pool.query(sql);

  const [topEndpoints] = await pool.query(`
    SELECT endpoint, method, COUNT(*) AS hit_count
    FROM request_audit_logs
    WHERE created_at >= CURDATE()
    GROUP BY endpoint, method
    ORDER BY hit_count DESC
    LIMIT 5
  `);

  return {
    today: {
      total: parseInt(stats.total_today, 10) || 0,
      success2xx: parseInt(stats.success_2xx, 10) || 0,
      clientErr4xx: parseInt(stats.client_err_4xx, 10) || 0,
      serverErr5xx: parseInt(stats.server_err_5xx, 10) || 0,
      uniqueIps: parseInt(stats.unique_ips_today, 10) || 0,
      avgLatencyMs: parseInt(stats.avg_response_ms, 10) || 0,
    },
    topEndpoints,
  };
};

module.exports = {
  listRequestAuditLogs,
  getRequestAuditStats,
};
