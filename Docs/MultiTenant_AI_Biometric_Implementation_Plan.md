# Neha Hospital HRMS — Multi-Tenant + AI Microservice + Biometric Connector Implementation Plan

**Branch:** `multitennant`  
**Date:** October 2026  
**Status:** Approved for Implementation  
**Primary Architectures Covered:**
1. Multi-Tenant Core HRMS (Database-per-tenant, Platform-hosted & Customer-hosted)
2. Standalone Separately-Deployable AI Service (Independent domain, GPU/CPU scaling, secure server-to-server)
3. Biometric Connector Multi-Tenant Edge Integration (eSSL devices, branch isolation, backward-compatible & enhanced protocols)

---

## 1. Executive Summary & Goals

The Neha Hospitals HRMS is evolving from a single-facility system into a comprehensive, multi-tenant healthcare enterprise platform. This plan provides the definitive architectural blueprint and execution sequence for the `multitennant` branch.

### Key Objectives
1. **Database-per-Tenant Isolation:** Complete logical and physical database segregation for every hospital client (`neha_hospitals_db`, `apollo_db`, etc.) managed via a central Control Plane database (`control_plane_db`).
2. **Dual Deployment Models:**
   - **Platform-Hosted:** Shared application cluster hosting multiple hospitals on dedicated domains/subdomains (e.g. `neha.mspkapps.in`, `cityhospital.mspkapps.in`).
   - **Customer-Hosted:** Fully isolated on-premise or private cloud installation for hospitals requiring complete data sovereignty.
3. **Decoupled AI Microservice:**
   - Run the Python FastAPI AI service on its own dedicated domain (e.g. `https://ai.mspkapps.in` or `https://ai.nehahospitals.in`).
   - Independent horizontal and vertical scaling (GPU instances for Whisper speech-to-text, Ollama LLM, and Voiceprint identification).
   - Strict server-to-server security (CORS blocking browsers, `X-Internal-Key` authentication, `X-Tenant-ID` context passing).
   - Flexible deployment: Customer-hosted hospitals can either connect to Platform AI or run a local AI Docker sidecar.
4. **Biometric Edge Connector Multi-Tenant Compatibility:**
   - Support local hardware devices (eSSL / ZKTeco) running in hospital LANs without breaking live biometric sync.
   - Enable connector credential lookup at the backend that automatically maps device punches to the correct organization and branch.
   - Support dynamic device auto-sync, enrolled user push/pull, and offline punch buffering.

---

## 2. High-Level System Architecture

```text
                                       INTERNET
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            │                             │                             │
    ┌───────▼────────┐           ┌────────▼────────┐           ┌────────▼────────┐
    │ Control Plane  │           │  Tenant Web     │           │   AI Service    │
    │  Super Admin   │           │   (HRMS SPA)    │           │ (FastAPI micro) │
    │admin.mspkapps.in           │ *.mspkapps.in   │           │ ai.mspkapps.in  │
    └───────┬────────┘           └────────┬────────┘           └────────▲────────┘
            │                             │                             │
            │                             ▼                             │ (Internal API)
            │                    ┌─────────────────┐                    │ X-Internal-Key
            │                    │  HRMS Backend   ├────────────────────┘ X-Tenant-ID
            │                    │ (Node.js API)   │
            │                    └────────┬────────┘
            ▼                             │
    ┌───────────────┐            ┌────────┴────────┐
    │ control_plane │            │ Tenant DB Pool  │
    │   database    │            └─┬──────┬──────┬─┘
    └───────────────┘              │      │      │
                                   ▼      ▼      ▼
                                [DB-A] [DB-B] [DB-C]

                                          ▲
                                          │ HTTPS (REST API)
                                          │ Authorization: Bearer / X-Connector-Key
                                          │
                               ┌──────────┴──────────┐
                               │ Hospital Local LAN  │
                               │                     │
                               │  BiometricConnector │
                               │  (Node.js Edge App) │
                               └──────────┬──────────┘
                                          │ TCP 4370 (ZKTeco Protocol)
                               ┌──────────┴──────────┐
                               ▼                     ▼
                        eSSL Terminal #1      eSSL Terminal #2
                        (Reception / Erode)   (ICU / Coimbatore)
```

---

## 3. Component Architecture & Detailed Specifications

### 3.1 Component 1: Control Plane & Tenant Resolution

The Control Plane manages system tenants, branch structures, connector registrations, and licensing.

#### 3.1.1 Control Plane Database Schema (`control_plane_db`)
```sql
CREATE DATABASE IF NOT EXISTS control_plane_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE control_plane_db;

-- 1. Organizations (Tenants)
CREATE TABLE organizations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,             -- e.g. 'NEHA', 'APOLLO'
    domain VARCHAR(255) UNIQUE NOT NULL,           -- e.g. 'neha.mspkapps.in'
    db_host VARCHAR(200) DEFAULT 'localhost',
    db_port INT UNSIGNED DEFAULT 3306,
    db_name VARCHAR(100) UNIQUE NOT NULL,         -- e.g. 'neha_hospitals_db'
    db_user VARCHAR(100) NOT NULL,
    db_password VARCHAR(255) NOT NULL,
    deployment_type ENUM('PLATFORM_HOSTED', 'CUSTOMER_HOSTED') DEFAULT 'PLATFORM_HOSTED',
    ai_mode ENUM('PLATFORM_SHARED', 'CUSTOMER_LOCAL', 'DISABLED') DEFAULT 'PLATFORM_SHARED',
    ai_service_url VARCHAR(255) NULL,             -- overrides default AI URL if customer-local
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Branches (Physical facilities per organization)
CREATE TABLE branches (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id INT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,                   -- e.g. 'Erode Main Branch'
    code VARCHAR(50) NOT NULL,                    -- e.g. 'ERD'
    city VARCHAR(100),
    state VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE KEY uk_org_branch_code (organization_id, code)
);

-- 3. Biometric Connectors
CREATE TABLE biometric_connectors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id INT UNSIGNED NOT NULL,
    branch_id INT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,                   -- e.g. 'Erode Edge Gateway 01'
    connector_key VARCHAR(128) UNIQUE NOT NULL,   -- API Key in CONNECTOR_API_KEY
    public_url VARCHAR(255) NULL,                 -- e.g. 'https://neha-bio.mspk.in'
    ip_address VARCHAR(50) NULL,
    last_heartbeat TIMESTAMP NULL,
    sync_status ENUM('online', 'offline', 'error') DEFAULT 'offline',
    version VARCHAR(30) DEFAULT '1.0.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- 4. Biometric Devices (Mapped to connectors & branches)
CREATE TABLE biometric_devices (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id INT UNSIGNED NOT NULL,
    branch_id INT UNSIGNED NOT NULL,
    connector_id INT UNSIGNED NOT NULL,
    device_name VARCHAR(150) NOT NULL,
    device_ip VARCHAR(50) NOT NULL,
    device_port INT UNSIGNED DEFAULT 4370,
    comm_key VARCHAR(50) DEFAULT '0',
    location VARCHAR(150),
    device_identifier VARCHAR(100),               -- e.g. Serial number / MAC
    status ENUM('online', 'offline', 'error') DEFAULT 'offline',
    last_synced_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (connector_id) REFERENCES biometric_connectors(id) ON DELETE CASCADE
);

-- 5. Control Plane Super Admins
CREATE TABLE super_admins (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('SUPER_ADMIN', 'SUPPORT') DEFAULT 'SUPER_ADMIN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3.1.2 Tenant Resolution Mechanism
1. **Web Requests (`HospitalsWeb` → `Backend`):**
   - The browser reaches `https://neha.mspkapps.in/api/...`.
   - Nginx preserves the `Host` header (`proxy_set_header Host $host;`).
   - The `tenantResolver.js` middleware parses the incoming `req.hostname`.
   - It queries the in-memory cache (backed by `control_plane_db.organizations`).
   - Upon resolution, attaches `req.tenant = { id, code, name, db_name, ai_mode, ai_service_url }` and `req.db = tenantPool.getConnection(org.db_name)`.
2. **Biometric Connector Requests (`BiometricConnector` → `Backend`):**
   - Connector calls `POST /api/attendance/punches/import` with header `x-api-key: <CONNECTOR_API_KEY>` or `X-Connector-Key`.
   - The `connectorAuthMiddleware.js` looks up the key in `control_plane_db.biometric_connectors`.
   - It retrieves `organization_id`, `branch_id`, and the associated tenant's `db_name`.
   - Attaches `req.tenant` and `req.branchId` to the request, routing all SQL queries seamlessly to the correct tenant DB.

---

### 3.2 Component 2: Standalone AI Service

The AI Service is a microservice built with Python 3.11, FastAPI, Faster-Whisper, Ollama (Llama3/Qwen), and SpeechBrain.

#### 3.2.1 Why Standalone?
- **Resource Specialization:** STT and LLM workloads require high RAM (8GB–16GB) and GPU acceleration (NVIDIA CUDA / TensorRT). Placing them on the same node as MySQL and Node.js leads to CPU starvation.
- **Independent Scaling:** AI service can be deployed on a GPU cloud VM (or on-premise GPU workstation) with its own domain (`https://ai.mspkapps.in`).
- **Zero Browser Exposure:** Browser clients NEVER communicate directly with the AI service. All requests proxy through `Backend`, ensuring strict key management and tenant accounting.

#### 3.2.2 Endpoints Handled
- `POST /api/v1/voice/transcribe` — High-speed Whisper speech-to-text.
- `POST /api/v1/voice/enroll-voiceprint` — Doctor/clinician acoustic voiceprint embedding generation.
- `POST /api/v1/voice/ambient-scribe` — Full ambient conversation processing, speaker diarization, clinical structuring.
- `POST /api/v1/voice/parse-dialogue` — NLP extraction into clinical SOAP format.
- `POST /api/v1/roster/solve` — OR-Tools shift and roster scheduling optimizer.
- `GET /api/v1/health` — Hardware and model readiness health check.

#### 3.2.3 Security & Multi-Tenant Protocol
1. **Internal Key:** AI service requires `X-Internal-Key: <platform-secret>` on all `/api/v1/*` routes.
2. **Tenant & Branch Context:** Backend sends:
   ```http
   X-Internal-Key: neha-ai-internal-key-2026
   X-Tenant-ID: 1
   X-Tenant-Code: NEHA
   X-Branch-ID: 2
   ```
   The AI service uses these headers to log usage, enforce rate limits per organization, and store doctor voiceprints namespaced by tenant:
   `models_cache/voiceprints/{tenant_id}/{doctor_id}.pt`.
3. **CORS Restrictions:**
   `app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_BACKEND_HOSTS, ...)` strictly blocks direct cross-origin browser requests.

#### 3.2.4 Docker & Deployment Config
```dockerfile
# AiService/Dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    build-essential \
    libsndfile1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
ENV PYTHONPATH=/app
ENV MODEL_STORAGE_PATH=/app/models_cache
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

---

### 3.3 Component 3: Biometric Connector Edge Microservice

The Biometric Connector is a local Node.js application deployed inside the hospital local network.

#### 3.3.1 Hardware Interfacing
- Communicates with eSSL / ZKTeco terminals over local TCP (port 4370) using the ZK protocol (`node-zklib` / `zklib-js` wrapper in `essl.driver.js`).
- Pulls punches: attendance punch records (`user_id`, `timestamp`, `punch_type`).
- Syncs users: fetches biometric enrolled users from hardware memory.

#### 3.3.2 Backend Sync Architecture
- **Inbound Config Sync (`/api/attendance/devices`):**
  - Connector pulls the device inventory configured in the HRMS for this branch every 60 seconds.
  - Automatically provisions new devices without restarting the connector service.
- **Outbound Punch Import (`/api/attendance/punches/import`):**
  - Connector fetches new punch events and posts them in batches to `MAIN_BACKEND_URL`.
  - Backend inspects `x-api-key`, maps to tenant & branch, checks for duplicates, and inserts into `attendance_logs` and updates `attendance_records`.
- **Enrolled Users Forwarding (`/api/attendance/enrolled-users`):**
  - Synced to populate staff biometric enrollment mapping (`biometric_id` to `employee_id`).

#### 3.3.3 Multi-Tenant Compatibility Guarantee
- **No breaking changes:** The existing connector environment configuration:
  ```env
  PORT=7500
  CONNECTOR_API_KEY=ce8f14ad422e2e1c1fe2429f96c0edf8186055bb671d23a5c287b56737f3e2c4
  MAIN_BACKEND_URL=https://neha.tylo.co.in
  ```
  remains 100% functional.
- **Enhanced Configuration (Multi-Branch & Registration Handshake):**
  The connector is enhanced to optionally accept:
  ```env
  TENANT_CODE=NEHA
  BRANCH_CODE=ERODE-01
  CONNECTOR_TOKEN=ey...
  ```
  allowing automatic registration through the Super Admin panel.

---

## 4. Tenant Core Database Migration (`nehahospitals`)

To make individual tenant databases branch-aware and multi-branch compliant, the following schema updates are executed across all tenant databases:

```sql
-- 1. Ensure branches table exists inside tenant database for local querying
CREATE TABLE IF NOT EXISTS branches (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default branch for existing Neha Hospitals deployment
INSERT IGNORE INTO branches (id, name, code, address, is_active)
VALUES (1, 'Main Hospital Branch', 'MAIN', 'Default Hospital Facility', TRUE);

-- 2. Add branch_id to core entity tables if not already present
ALTER TABLE employees 
    ADD COLUMN IF NOT EXISTS branch_id INT UNSIGNED DEFAULT 1,
    ADD CONSTRAINT fk_emp_branch FOREIGN KEY (branch_id) REFERENCES branches(id);

ALTER TABLE attendance_records 
    ADD COLUMN IF NOT EXISTS branch_id INT UNSIGNED DEFAULT 1,
    ADD CONSTRAINT fk_att_branch FOREIGN KEY (branch_id) REFERENCES branches(id);

ALTER TABLE biometric_devices 
    ADD COLUMN IF NOT EXISTS branch_id INT UNSIGNED DEFAULT 1;

ALTER TABLE duty_rosters 
    ADD COLUMN IF NOT EXISTS branch_id INT UNSIGNED DEFAULT 1;

ALTER TABLE leave_requests 
    ADD COLUMN IF NOT EXISTS branch_id INT UNSIGNED DEFAULT 1;

ALTER TABLE payroll_runs 
    ADD COLUMN IF NOT EXISTS branch_id INT UNSIGNED NULL;
```

---

## 5. Step-by-Step Implementation Roadmap

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │ PHASE 0: Standalone AI Service Deployment (ai.mspkapps.in)             │
 │ - Dockerfile & docker-compose configuration                            │
 │ - Strict CORS & X-Tenant-ID support in FastAPI                         │
 │ - Verification: Whisper STT, Scribe & Voiceprint test                  │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
 ┌───────────────────────────────────▼────────────────────────────────────┐
 │ PHASE 1: Control Plane & Dynamic Tenant Pool                           │
 │ - Create control_plane_db & seed Neha Hospitals tenant & branch        │
 │ - Implement Backend tenantResolver & connection pool manager           │
 │ - Connect AI Client to new domain with header forwarding               │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
 ┌───────────────────────────────────▼────────────────────────────────────┐
 │ PHASE 2: Biometric Connector Multi-Tenant Integration                  │
 │ - Wire connector key authentication in Backend                         │
 │ - Verify punch forwarding and device sync with zero regressions        │
 │ - Implement branch-aware punch ingestion                               │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
 ┌───────────────────────────────────▼────────────────────────────────────┐
 │ PHASE 3: Frontend Tenant Routing & Branch Controls                     │
 │ - Domain-aware tenant branding in HospitalsWeb                         │
 │ - Branch switcher for multi-branch administrators                      │
 │ - Route all AI widgets through secure backend proxy                    │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
 ┌───────────────────────────────────▼────────────────────────────────────┐
 │ PHASE 4: Customer-Hosted Package & Super Admin Panel                   │
 │ - Single-command installer script (docker-compose.customer.yml)        │
 │ - Super Admin web portal for tenant and connector onboarding           │
 └────────────────────────────────────────────────────────────────────────┘
```

### Phase 0: Standalone AI Service
1. **Dockerfile:** Create `AiService/Dockerfile` with Python 3.11, PyTorch, Whisper, and audio libraries.
2. **Security:** Update `AiService/app/main.py` and `app/core/config.py` to accept `AI_ALLOWED_ORIGINS` and validate `X-Internal-Key`.
3. **Tenant Context:** Add `X-Tenant-ID` logger to AI requests.
4. **Backend AI Client:** Configure `Backend/.env` with `AI_SERVICE_URL=https://ai.mspkapps.in` (fallback to `http://localhost:8000` in dev).

### Phase 1: Control Plane & Tenant Resolution
1. **DDL Execution:** Run `control_plane_schema.sql` on MySQL server.
2. **Seed Initial Org:** Seed `Neha Hospitals` pointing to `nehahospitals` DB.
3. **Tenant Manager:** Create `Backend/src/db/tenantManager.js` to cache tenant configs and manage MySQL pool instances dynamically.
4. **Tenant Resolver:** Create `Backend/src/middleware/tenantResolver.js` to route incoming HTTP requests to the proper DB pool.

### Phase 2: Biometric Connector Multi-Tenant Integration
1. **Connector Auth:** Implement `connectorAuthMiddleware.js` in Backend. Validate incoming `x-api-key` against `control_plane_db.biometric_connectors`.
2. **Tenant + Branch Association:** Map punches automatically to the connector's assigned `organization_id` and `branch_id`.
3. **Test Connector Sync:** Run `syncAllDevices()` and verify punches write to `nehahospitals.attendance_records` seamlessly.

### Phase 3: Frontend Multi-Tenant Adaptations
1. **Host-Based Initialization:** In `HospitalsWeb/src/services/api.js`, dynamic base URL and tenant state.
2. **Branch Selector:** Add top navigation branch switcher for admins managing multiple branches.
3. **Clinical AI Proxy:** Verify Ambient Scribe, Voice Enrollment, and SOAP generation widgets function without exposing AI service URL to client.

### Phase 4: Packaging & Production Verification
1. **Nginx Templates:** Produce production Nginx configurations for `*.mspkapps.in` and `ai.mspkapps.in`.
2. **Docker Compose:** Maintain unified `docker-compose.yml` for platform hosting and `docker-compose.customer.yml` for customer-hosted installations.
3. **End-to-End Test Suite:**
   - [x] Biometric punch auto-sync from eSSL device to tenant DB.
   - [x] Ambient voice recording transcribed by separate AI domain.
   - [x] Multiple tenant isolation verified with no cross-database leaks.

---

## 6. Implementation Checklist

| Task | Component | File Path | Status |
|------|-----------|-----------|--------|
| Add Dockerfile | AiService | `AiService/Dockerfile` | Ready |
| Restrict CORS & Add Tenant Header | AiService | `AiService/app/main.py` | Ready |
| Add AI Service Docker compose entry | Infrastructure | `docker-compose.yml` | Ready |
| Create Control Plane DDL script | Database | `Sql/control_plane_schema.sql` | Ready |
| Seed Neha Hospitals Tenant | Database | `Sql/seed_control_plane.sql` | Ready |
| Create Tenant Pool Manager | Backend | `Backend/src/db/tenantManager.js` | Ready |
| Create Tenant Resolver Middleware | Backend | `Backend/src/middleware/tenantResolver.js` | Ready |
| Wire Connector Key Auth | Backend | `Backend/src/middleware/connectorAuth.js` | Ready |
| Update AI Client for Tenant Headers | Backend | `Backend/src/services/aiClient.js` | Ready |
| Verify Biometric Connector Zero-Impact | BiometricConnector | `BiometricConnector/src/services/deviceManager.js` | Ready |

---

*This document serves as the authoritative implementation guide for the `multitennant` branch.*
