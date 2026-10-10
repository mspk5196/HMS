@echo off
echo ===================================================
echo Starting Neha Hospitals Standalone AI Microservice
echo Port: 8000
echo ===================================================
cd /d "%~dp0"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
