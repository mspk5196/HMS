#!/usr/bin/env bash
# ==============================================================================
# Neha Hospitals HRMS - One-Command Automated Installer (Linux / Bash)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-local}"

echo "=========================================================="
echo "  Neha Hospitals HRMS & Multi-Tenant Platform Installer   "
echo "=========================================================="

if [ "$MODE" = "local" ]; then
    echo -e "\n[1/2] Verifying Docker..."
    if ! command -v docker &> /dev/null || ! docker compose version &> /dev/null; then
        echo "Error: Docker and Docker Compose are required for local testing." >&2
        exit 1
    fi
    echo "  Docker & Compose Detected."

    echo -e "\n[2/2] Launching Local Docker Stack (docker/docker-compose.local.yml)..."
    docker compose -f docker/docker-compose.local.yml up -d --build

    echo -e "\n=========================================================="
    echo "  Local Docker Testing Stack Successfully Started!        "
    echo "=========================================================="
    echo "  Web Application (Frontend):  http://localhost:8086"
    echo "  Super Admin Control Plane:   http://localhost:8086/#super-admin"
    echo "  Backend API:                 http://localhost:5006"
    echo "  Standalone AI Service:       http://localhost:8000"
    echo "  Local MySQL Database:        localhost:3312"
    echo "=========================================================="

elif [ "$MODE" = "customer" ]; then
    echo -e "\nLaunching Customer Infrastructure Installer (ZERO docker-compose)..."
    bash "${SCRIPT_DIR}/install-customer.sh"

elif [ "$MODE" = "connector" ]; then
    TOKEN="${2}"
    if [ -z "$TOKEN" ]; then
        read -rp "Enter Pairing Token (nh_conn_...): " TOKEN
    fi
    if [ -z "$TOKEN" ]; then
        echo "Error: Pairing token is required." >&2
        exit 1
    fi

    cd "${SCRIPT_DIR}/BiometricConnector"
    npm install
    echo "Starting Biometric Connector with token..."
    node src/server.js --token="$TOKEN"
fi
