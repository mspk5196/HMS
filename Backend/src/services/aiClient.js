const http = require('http');
const https = require('https');
const { AppError } = require('../utils/errors');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const AI_INTERNAL_KEY = process.env.AI_INTERNAL_KEY || 'neha-ai-internal-key-2026';

/**
 * Generic JSON requester for standalone AiService
 */
const requestAiService = async (endpoint, options = {}) => {
  const url = new URL(`${AI_SERVICE_URL}${endpoint}`);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  const method = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    'X-Internal-Key': AI_INTERNAL_KEY,
    ...(options.headers || {})
  };

  const body = options.body ? JSON.stringify(options.body) : null;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers,
        timeout: 45000 // 45s timeout
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = rawData ? JSON.parse(rawData) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(
                new AppError(
                  parsed.detail || parsed.message || `AI Service returned HTTP ${res.statusCode}`,
                  res.statusCode || 500
                )
              );
            }
          } catch (err) {
            reject(new AppError(`Failed to parse AI service response: ${err.message}`, 502));
          }
        });
      }
    );

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        reject(
          new AppError(
            'Standalone AI Service is offline or unreachable on ' + AI_SERVICE_URL + '. Please start the AI microservice.',
            503
          )
        );
      } else {
        reject(new AppError(`AI Service connection error: ${err.message}`, 502));
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new AppError('AI Service request timed out after 45 seconds', 504));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
};

const healthCheck = async () => {
  return requestAiService('/api/v1/health');
};

const solveRoster = async (payload) => {
  return requestAiService('/api/v1/roster/solve', {
    method: 'POST',
    body: payload
  });
};

module.exports = {
  healthCheck,
  solveRoster
};
