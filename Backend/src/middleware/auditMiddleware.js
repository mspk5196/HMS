const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Extract public client IP address from proxy / reverse-proxy headers
 * or direct socket connection.
 */
function extractClientIp(req) {
  // Check standard reverse proxy headers (e.g., NGINX, Cloudflare, AWS ALB)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const list = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length > 0 && list[0]) {
      return list[0].replace(/^::ffff:/, '');
    }
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp.trim().replace(/^::ffff:/, '');
  }

  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (cfConnectingIp) {
    return cfConnectingIp.trim().replace(/^::ffff:/, '');
  }

  const remote = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
  return remote.replace(/^::ffff:/, '');
}

/**
 * Parse clean device & browser description from User-Agent string.
 */
function parseDevice(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return 'Unknown Device';

  let os = 'Unknown OS';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';

  let browser = 'Unknown Browser';
  if (/edg\//i.test(userAgent)) browser = 'Edge';
  else if (/opr\/|opera/i.test(userAgent)) browser = 'Opera';
  else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
  else if (/curl/i.test(userAgent)) browser = 'cURL';
  else if (/postman/i.test(userAgent)) browser = 'Postman';

  let deviceType = 'Desktop';
  if (/mobile/i.test(userAgent) || /android/i.test(userAgent) || /iphone/i.test(userAgent)) {
    deviceType = 'Mobile';
  } else if (/tablet|ipad/i.test(userAgent)) {
    deviceType = 'Tablet';
  }

  return `${browser} on ${os} (${deviceType})`;
}

/**
 * Global HTTP Request Audit Middleware.
 *
 * Captures:
 *  - Method & Endpoint ("from where")
 *  - User identity / Role ("by whom")
 *  - Timestamp ("when")
 *  - Public IP & Device ("which device (public ip)")
 *  - Response Status Code & Response Time
 *
 * STRICT PRIVACY REQUIREMENT:
 *  - NEVER logs request headers (no cookies, no authorization tokens).
 *  - NEVER logs request body or query parameter data.
 *  - ZERO sensitive hospital or patient payload data logged.
 */
function auditMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    try {
      const responseTimeMs = Date.now() - start;
      const rawUrl = req.originalUrl || req.url || '';

      // Skip static uploads and internal audit retrieval to avoid log feedback loops
      if (
        rawUrl.startsWith('/uploads') ||
        rawUrl.startsWith('/favicon.ico') ||
        rawUrl.includes('/api/audit/logs') ||
        rawUrl.includes('/api/audit/stats')
      ) {
        return;
      }

      // "From where": method + sanitized path without query parameters or payload data
      const method = (req.method || 'GET').toUpperCase();
      const endpoint = rawUrl.split('?')[0] || rawUrl;

      // "Which device (public ip)":
      const ipAddress = extractClientIp(req);
      const userAgentRaw = req.headers['user-agent'] || '';
      const deviceInfo = parseDevice(userAgentRaw);
      const userAgentSnippet = userAgentRaw.slice(0, 500);

      // "By whom":
      let userId = null;
      let username = 'Anonymous';
      let roleName = 'Public';

      if (req.user) {
        userId = req.user.id || req.user.userId || null;
        username = req.user.username || req.user.name || 'Authenticated User';
        roleName = req.user.role_name || req.user.role || 'User';
      } else {
        // Opportunistic token decode without verification (just to associate the user)
        const authHeader = req.headers.authorization;
        const token = (authHeader && authHeader.startsWith('Bearer '))
          ? authHeader.slice(7)
          : req.cookies?.token;

        if (token) {
          try {
            const decoded = jwt.decode(token);
            if (decoded && typeof decoded === 'object') {
              userId = decoded.id || decoded.userId || null;
              username = decoded.username || decoded.name || 'User';
              roleName = decoded.role_name || decoded.role || 'User';
            }
          } catch (_) {
            // Ignore decode failures
          }
        }
      }

      // "Response status code"
      const statusCode = res.statusCode || 200;

      // Async, non-blocking DB insert
      const insertSql = `
        INSERT INTO request_audit_logs
          (user_id, username, role_name, method, endpoint, ip_address, device_info, user_agent, status_code, response_time_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      pool.query(insertSql, [
        userId,
        username,
        roleName,
        method,
        endpoint,
        ipAddress,
        deviceInfo,
        userAgentSnippet,
        statusCode,
        responseTimeMs,
      ]).catch((err) => {
        console.error('Audit log write error:', err.message);
      });
    } catch (e) {
      console.error('Audit middleware error:', e.message);
    }
  });

  next();
}

module.exports = { auditMiddleware, extractClientIp, parseDevice };
