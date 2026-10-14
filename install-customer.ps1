# ==============================================================================
# Neha Hospitals HRMS - Customer Infrastructure Automated Single-Command Installer
# ZERO docker-compose required. Native deployment for client servers.
# ==============================================================================
param (
    [string]$DbHost = 'localhost',
    [int]$DbPort = 3306,
    [string]$DbUser = 'root',
    [string]$DbPass = '',
    [string]$DbName = 'hospital_hrms',
    [int]$WebPort = 8080,
    [int]$ApiPort = 5000,
    [string]$AiServiceUrl = 'https://ai.mspkapps.in'
)

$ErrorActionPreference = 'Stop'
$scriptDir = $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Hospital HRMS - Automated Customer Infrastructure Setup " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Generate Deployment & Activation Credentials
$installId = "DEP-" + (-join ((65..90) + (48..57) | Get-Random -Count 6 | ForEach-Object { [char]$_ }))
$codePart1 = -join ((65..90) + (48..57) | Get-Random -Count 4 | ForEach-Object { [char]$_ })
$codePart2 = -join ((65..90) + (48..57) | Get-Random -Count 4 | ForEach-Object { [char]$_ })
$activationCode = "$codePart1-$codePart2"

$activationConfig = @{
    installation_id = $installId
    activation_code = $activationCode
    status = "NOT_ACTIVATED"
    installed_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
    db_name = $DbName
    api_port = $ApiPort
    web_port = $WebPort
}

$activationFile = Join-Path $scriptDir "customer_activation.json"
$activationConfig | ConvertTo-Json -Depth 4 | Set-Content -Path $activationFile -Encoding UTF8
Write-Host "  Generated Installation ID: $installId" -ForegroundColor Green
Write-Host "  Generated Activation Code: $activationCode" -ForegroundColor Green

# 2. Check Prerequisites (Node.js & MySQL)
Write-Host "`n[1/4] Verifying System Runtimes..." -ForegroundColor Yellow
try {
    $nodeVer = node -v
    Write-Host "  Node.js: $nodeVer" -ForegroundColor Green
} catch {
    Write-Error "Node.js is not found in PATH. Please install Node.js 18+ to proceed."
}

# 3. Database Initialization
Write-Host "`n[2/4] Initializing Isolated Tenant Database ($DbName)..." -ForegroundColor Yellow
$setupDbScript = @"
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '$DbHost',
      port: $DbPort,
      user: '$DbUser',
      password: '$DbPass',
      multipleStatements: true
    });
    
    await conn.query('CREATE DATABASE IF NOT EXISTS \`$DbName\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    console.log('  Database \`$DbName\` created/verified.');
    await conn.changeUser({ database: '$DbName' });

    // Apply baseline schema if database has no tables
    const [tables] = await conn.query('SHOW TABLES');
    if (tables.length === 0) {
      console.log('  Importing baseline hospital schema...');
      const schemaPath = path.resolve('$($scriptDir -replace '\\', '/')/Sql/confedential/neha_hospital_schema-v11-after_AI_service.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await conn.query(schemaSql);
        console.log('  Baseline schema imported successfully.');
      }
    }

    // Apply branch migration
    const branchSqlPath = path.resolve('$($scriptDir -replace '\\', '/')/Sql/tenant_multi_branch_migration.sql');
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
"@

$tempDbSetup = Join-Path $scriptDir "Backend\temp_customer_db.js"
Set-Content -Path $tempDbSetup -Value $setupDbScript -Encoding UTF8
Push-Location "$scriptDir\Backend"
try {
    npm install --omit=dev
    node temp_customer_db.js
} finally {
    if (Test-Path $tempDbSetup) { Remove-Item $tempDbSetup -Force }
    Pop-Location
}

# 4. Configure & Start Customer Backend Service
Write-Host "`n[3/4] Configuring Standalone Backend Service..." -ForegroundColor Yellow
$backendEnv = @"
PORT=$ApiPort
DB_HOST=$DbHost
DB_PORT=$DbPort
DB_USER=$DbUser
DB_PASS=$DbPass
DB_NAME=$DbName
NODE_ENV=production
ENABLE_CONTROL_PLANE=false
PROTECTED_ROUTES_ENABLED=true
WEB_ORIGIN=*
AI_SERVICE_URL=$AiServiceUrl
AI_INTERNAL_KEY=neha-ai-internal-key-2026
JWT_SECRET=4f59beb64dedad712f0ab2cfd455a1a98997bb6f167a605e1e474c1ddd6e2e361068033ff05bf075b2c9a3c798518b0c4035458ecd4637a65f21f89c9a65c76a
JWT_REFRESH_TOKEN=52382e23887684704eadaced2daef0862acaef97afb6cc3d98467254767538f32c4b5871a9724b83823677f0c79084f97d56b03e38499177127e0f7a543020bf
JWT_EXPIRES_IN=24h
"@
Set-Content -Path (Join-Path $scriptDir "Backend\.env") -Value $backendEnv -Encoding UTF8

# Start Backend background process
$backendJob = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "$scriptDir\Backend" -WindowStyle Hidden -PassThru
Write-Host "  Backend running as PID: $($backendJob.Id) on port $ApiPort" -ForegroundColor Green

# 5. Build & Serve Customer Frontend
Write-Host "`n[4/4] Building Customer Web Application..." -ForegroundColor Yellow
Push-Location "$scriptDir\HospitalsWeb"
try {
    $env:VITE_API_URL = "http://localhost:$ApiPort/api"
    $env:VITE_ENABLE_CONTROL_PLANE = "false"
    npm install
    npm run build
} finally {
    Pop-Location
}

# Serve frontend using lightweight node static server
$frontendServerScript = @"
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = $WebPort;
const DIST_DIR = path.resolve('$($scriptDir -replace '\\', '/')/HospitalsWeb/dist');

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
"@

$serveFile = Join-Path $scriptDir "customer_serve_web.js"
Set-Content -Path $serveFile -Value $frontendServerScript -Encoding UTF8
$webJob = Start-Process -FilePath "node" -ArgumentList "customer_serve_web.js" -WorkingDirectory $scriptDir -WindowStyle Hidden -PassThru
Write-Host "  Web Portal running as PID: $($webJob.Id) on port $WebPort" -ForegroundColor Green

# Output Final Status Banner
Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "   Hospital HRMS - Dedicated On-Premise Installation      " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Installation ID:   $installId" -ForegroundColor White
Write-Host "  Activation Status: NOT ACTIVATED" -ForegroundColor Yellow
Write-Host "  Activation Code:   $activationCode" -ForegroundColor Yellow
Write-Host ""
Write-Host "  HRMS Web Portal:   http://localhost:$WebPort" -ForegroundColor Cyan
Write-Host "  Backend API:       http://localhost:$ApiPort" -ForegroundColor Cyan
Write-Host "  Tenant Database:   $DbName ($DbHost:$DbPort)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Provide the Activation Code to your Super Administrator to activate this installation.`n" -ForegroundColor White
