@echo off
title Neha Hospitals — Biometric Staff Enrollment
cd /d "%~dp0"
echo ======================================================================
echo   Starting Biometric Staff Enrollment Assistant...
echo ======================================================================
node scripts/register-staff.js
echo.
pause
