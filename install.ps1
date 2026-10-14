# ==============================================================================
# Neha Hospitals HRMS - One-Command Automated Installer (Windows PowerShell)
# ==============================================================================
param (
    [Parameter(Mandatory=$false)]
    [ValidateSet('local', 'customer', 'connector')]
    [string]$Mode = 'local',

    [Parameter(Mandatory=$false)]
    [string]$Token = ''
)

$ErrorActionPreference = 'Stop'
$scriptDir = $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Neha Hospitals HRMS & Multi-Tenant Platform Installer   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Select Installation Mode if not provided
if (-not $PSBoundParameters.ContainsKey('Mode')) {
    Write-Host "`nChoose Deployment Topology:" -ForegroundColor Yellow
    Write-Host "  1) Local Docker Desktop Testing Stack (Multi-Tenant Platform + Control Plane + AI) [Default]"
    Write-Host "  2) Customer Infrastructure Automated Deployment (Zero Docker-Compose, Native DB & App)"
    Write-Host "  3) Edge Biometric Connector Gateway (LAN Hardware Bridge)"
    $choice = Read-Host "Enter option [1-3] (Default 1)"
    switch ($choice) {
        '2' { $Mode = 'customer' }
        '3' { $Mode = 'connector' }
        default { $Mode = 'local' }
    }
}

if ($Mode -eq 'local') {
    Write-Host "`n[1/2] Verifying Docker Desktop..." -ForegroundColor Yellow
    try {
        $dockerVer = docker --version
        $composeVer = docker compose version
        Write-Host "  $dockerVer | $composeVer" -ForegroundColor Green
    } catch {
        Write-Error "Docker Desktop is not running or not in PATH."
    }

    Write-Host "`n[2/2] Launching Local Docker Stack (docker/docker-compose.local.yml)..." -ForegroundColor Cyan
    docker compose -f docker/docker-compose.local.yml up -d --build

    Write-Host "`n==========================================================" -ForegroundColor Green
    Write-Host "  Local Docker Testing Stack Successfully Started!        " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  Web Application (Frontend):  http://localhost:8086" -ForegroundColor White
    Write-Host "  Super Admin Control Plane:   http://localhost:8086/#super-admin" -ForegroundColor White
    Write-Host "  Backend API:                 http://localhost:5006" -ForegroundColor White
    Write-Host "  Standalone AI Service:       http://localhost:8000" -ForegroundColor White
    Write-Host "  Local MySQL Database:        localhost:3312 (root/rootpassword)" -ForegroundColor White
    Write-Host "==========================================================" -ForegroundColor Green
}
elseif ($Mode -eq 'customer') {
    Write-Host "`nLaunching Customer Infrastructure Installer (ZERO docker-compose)..." -ForegroundColor Cyan
    & "$scriptDir\install-customer.ps1"
}
elseif ($Mode -eq 'connector') {
    Write-Host "`nConfiguring Biometric Edge Gateway Connector..." -ForegroundColor Cyan
    if (-not $Token) {
        $Token = Read-Host "Enter Pairing Token (nh_conn_...)"
    }
    if (-not $Token) {
        Write-Error "Pairing token is required to initialize the Biometric Connector."
    }

    Set-Location -Path "$scriptDir\BiometricConnector"
    npm install
    Write-Host "Starting Biometric Connector with token..." -ForegroundColor Cyan
    node src/server.js --token=$Token
}
