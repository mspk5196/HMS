#!/usr/bin/env bash
# ==============================================================================
# Neha Hospitals HRMS - Customer Infrastructure Automated Single-Command Installer
# ZERO docker-compose required. Native deployment for Linux customer servers.
# ==============================================================================
set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_NAME="${DB_NAME:-hospital_hrms}"
WEB_PORT="${WEB_PORT:-8080}"
API_PORT="${API_PORT:-5000}"
AI_SERVICE_URL="${AI_SERVICE_URL:-https://ai.mspkapps.in}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================================="
echo "   Hospital HRMS - Automated Customer Infrastructure Setup "
echo "=========================================================="

# 1. Generate Deployment & Activation Credentials
INSTALL_ID="DEP-$(tr -dc A-Z0-9 </dev/urandom | head -c 6)"
CODE_PART1="$(tr -dc A-Z0-9 </dev/urandom | head -c 4)"
CODE_PART2="$(tr -dc A-Z0-9 </dev/urandom | head -c 4)"
ACTIVATION_CODE="${CODE_PART1}-${CODE_PART2}"

cat <<EOF > "${SCRIPT_DIR}/customer_activation.json"
{
  "installation_id": "${INSTALL_ID}",
  "activation_code": "${ACTIVATION_CODE}",
  "status": "NOT_ACTIVATED",
  "installed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "db_name": "${DB_NAME}",
  "api_port": ${API_PORT},
  "web_port": ${WEB_PORT}
}
EOF

echo -e "  Generated Installation ID: \033[32m${INSTALL_ID}\033[0m"
echo -e "  Generated Activation Code: \033[33m${ACTIVATION_CODE}\033[0m"

# 2. Check Prerequisites (Node.js & MySQL client)
echo -e "\n[1/4] Verifying System Runtimes..."
if ! command -v node &> /dev/null; then
  echo "Error: Node.js 18+ is required. Please install Node.js." >&2
  exit 1
fi
echo -e "  Node.js Detected: \033[32m$(node -v)\033[0m"

# 3. Database Initialization
echo -e "\n[2/4] Initializing Isolated Tenant Database (${DB_NAME})..."
cd "${SCRIPT_DIR}/Backend"
npm install --omit=dev

node -e "
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '${DB_HOST}',
      port: ${DB_PORT},
      user: '${DB_USER}',
      password: '${DB_PASS}',
      multipleStatements: true
    });

    await conn.query('CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    console.log('  Database \`${DB_NAME}\` created/verified.');
    await conn.changeUser({ database: '${DB_NAME}' });

    const [tables] = await conn.query('SHOW TABLES');
    if (tables.length === 0) {
      console.log('  Importing baseline hospital schema...');
      const schemaPath = path.resolve('${SCRIPT_DIR}/Sql/confedential/neha_hospital_schema-v11-after_AI_service.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await conn.query(schemaSql);
        console.log('  Baseline schema imported successfully.');
      }
    }

    const branchSqlPath = path.resolve('${SCRIPT_DIR}/Sql/tenant_multi_branch_migration.sql');
    if (fs.existsSync(branchSqlPath)) {
      const branchSql = fs.readFileSync(branchSqlPath, 'utf8');
      await conn.query(branchSql);
      console.log('  Multi-branch schema migration applied.');
    }

    await conn.end();
  } catch (err) {
    console.error('  Database initialization error:', err.message);
    process.exit(1);
  }
})();
"

# 4. Configure & Start Customer Backend Service
echo -e "\n[3/4] Configuring Standalone Backend Service..."
cat <<EOF > "${SCRIPT_DIR}/Backend/.env"
PORT=${API_PORT}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_NAME=${DB_NAME}
NODE_ENV=production
ENABLE_CONTROL_PLANE=false
PROTECTED_ROUTES_ENABLED=true
WEB_ORIGIN=*
AI_SERVICE_URL=${AI_SERVICE_URL}
AI_INTERNAL_KEY=neha-ai-internal-key-2026
JWT_SECRET=4f59beb64dedad712f0ab2cfd455a1a98997bb6f167a605e1e474c1ddd6e2e361068033ff05bf075b2c9a3c798518b0c4035458ecd4637a65f21f89c9a65c76a
JWT_REFRESH_TOKEN=52382e23887684704eadaced2daef0862acaef97afb6cc3d98467254767538f32c4b5871a9724b83823677f0c79084f97d56b03e38499177127e0f7a543020bf
JWT_EXPIRES_IN=24h
EOF

nohup node server.js > backend.log 2>&1 &
echo -e "  Backend service started in background on port \033[32m${API_PORT}\033[0m"

# 5. Build & Serve Customer Frontend
echo -e "\n[4/4] Building Customer Web Application..."
cd "${SCRIPT_DIR}/HospitalsWeb"
VITE_API_URL="http://localhost:${API_PORT}/api" VITE_ENABLE_CONTROL_PLANE="false" npm install
VITE_API_URL="http://localhost:${API_PORT}/api" VITE_ENABLE_CONTROL_PLANE="false" npm run build

# Start frontend static server
cd "${SCRIPT_DIR}"
cat <<EOF > customer_serve_web.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = ${WEB_PORT};
const DIST_DIR = path.resolve('${SCRIPT_DIR}/HospitalsWeb/dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  let filePath = path.join(DIST_DIR, reqPath === '/' ? 'index.html' : reqPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading ' + reqPath);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content, 'utf-8');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Customer Web Portal serving at http://localhost:' + PORT);
});
EOF

nohup node customer_serve_web.js > frontend.log 2>&1 &
echo -e "  Frontend service started in background on port \033[32m${WEB_PORT}\033[0m"

# Output Final Status Banner
echo -e "\n=========================================================="
echo -e "   \033[32mHospital HRMS - Dedicated On-Premise Installation\033[0m"
echo -e "=========================================================="
echo -e "  Installation ID:   \033[1m${INSTALL_ID}\033[0m"
echo -e "  Activation Status: \033[33mNOT ACTIVATED\033[0m"
echo -e "  Activation Code:   \033[33;1m${ACTIVATION_CODE}\033[0m"
echo ""
echo -e "  HRMS Web Portal:   \033[36mhttp://localhost:${WEB_PORT}\033[0m"
echo -e "  Backend API:       \033[36mhttp://localhost:${API_PORT}\033[0m"
echo -e "  Tenant Database:   \033[36m${DB_NAME} (${DB_HOST}:${DB_PORT})\033[0m"
echo -e "=========================================================="
echo -e "Provide the Activation Code to your Super Administrator to activate this installation.\n"
