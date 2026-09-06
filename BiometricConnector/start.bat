@echo off
title Neha Hospitals - Biometric Connector (Port 8000)
cd /d "%~dp0"

echo ================================================================
echo    NEHA HOSPITALS - BIOMETRIC CONNECTOR EDGE SERVICE
echo ================================================================
echo.

if not exist node_modules (
    echo Installing dependencies...
    call npm install --production
    echo.
)

echo Starting Biometric Connector on port 8000...
echo Ensure Cloudflare tunnel maps neha-bio.tylo.co.in to http://localhost:8000
echo.
call npm start
pause
