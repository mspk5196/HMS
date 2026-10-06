# 🤖 Standalone AI Microservice Architecture & Integration Plan — Neha Hospitals HMS

> **Core Principle**: **100% Decoupled, Independent Service**. 
> The AI services run as a dedicated, standalone microservice (`AiService`) completely separated from the existing HMS core backend (`Backend/`) and web frontend (`HospitalsWeb/`).
> 
> **Philosophy**: AI assists and recommends, humans approve and act.
> Every AI output (Roster, Clinical Notes, Prescriptions) is a *draft proposal* requiring explicit human confirmation before saving to the HMS database.
> 
> **Privacy & Offline First**: All AI models and solvers run **100% locally on-premise** on hospital infrastructure with zero cloud data egress.

---

## 🏛️ System Topology & Separation of Concerns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HOSPITAL LAN WORKSTATIONS                         │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │               Doctor / Admin Browser (HospitalsWeb)                 │   │
│   │   - Voice Dictation UI (Web Audio API / Push-to-Talk)               │   │
│   │   - Interactive AI Duty Roster Review & Modification Grid           │   │
│   └───────────────┬─────────────────────────────────────┬───────────────┘   │
└───────────────────┼─────────────────────────────────────┼───────────────────┘
                    │                                     │
                    │ REST / WebSocket                    │ Direct Audio Stream
                    ▼                                     ▼ (or via Gateway)
┌───────────────────────────────────────┐   ┌─────────────────────────────────┐
│     EXISTING CORE HMS BACKEND         │   │     STANDALONE AI SERVICE       │
│           (Node.js / Express)         │   │        (Python FastAPI)         │
│          Port: :5000 / :3000          │   │           Port: :8000           │
├───────────────────────────────────────┤   ├─────────────────────────────────┤
│ • Authentication & RBAC               │   │ • Google OR-Tools CP-SAT Solver │
│ • Core Business Logic & Billing       │   │   (Roster Optimization Engine)  │
│ • Patient / IPD / OPD Management      │   │ • Faster-Whisper STT Engine     │
│ • PostgreSQL Direct Connection        │◄─►│ • Medical NLP & Rx Extractor    │
│ • Approval Workflows & Auditing       │   │ • Anomaly Detection Engines     │
└───────────────────┬───────────────────┘   └─────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│        POSTGRESQL DATABASE            │
│         (nehahospitals)               │
└───────────────────────────────────────┘
```

### Why a Standalone Architecture?
1. **Decoupled Lifecycle & Zero Bloat**: The main Node.js backend remains lightweight and fast. Heavy computational packages (PyTorch, CTranslate2, Google OR-Tools, Transformers) are isolated in their own Python environment.
2. **Scalability & Resource Allocation**: The AI microservice can run on a dedicated machine/VM with a GPU or multi-core CPU without affecting HMS transactional database performance.
3. **Fault Isolation**: If an AI job or memory-intensive transcription crashes, the core HMS hospital operations (Billing, Admissions, Pharmacy, OPD) remain 100% unaffected.
4. **Independent Upgrades**: AI models and solvers can be updated, benchmarked, and tuned independently of HMS core release cycles.

---

## 📦 Directory Structure (`AiService/`)

```
NehaHospitals/
├── AiService/                      # 🌟 COMPLETELY STANDALONE MICROSERVICE
│   ├── app/
│   │   ├── api/                    # FastAPI route controllers
│   │   │   ├── v1/
│   │   │   │   ├── roster.py       # Roster optimization endpoints
│   │   │   │   ├── voice.py        # Voice-to-Text dictation endpoints
│   │   │   │   ├── prescription.py # Structured Rx extraction
│   │   │   │   └── health.py       # Service & model health checks
│   │   ├── core/                   # Configuration, logging, security
│   │   │   ├── config.py           # Model paths, worker counts, tokens
│   │   │   └── security.py         # Internal HMAC / JWT service auth
│   │   ├── models/                 # Pydantic request/response schemas
│   │   │   ├── roster_schema.py
│   │   │   └── voice_schema.py
│   │   ├── services/               # Core AI Engines
│   │   │   ├── roster_solver.py    # Google OR-Tools CP-SAT scheduling engine
│   │   │   ├── stt_engine.py       # Faster-Whisper local transcription manager
│   │   │   └── rx_parser.py        # Rule-based + Local LLM Rx entity extractor
│   │   └── main.py                 # FastAPI application entrypoint
│   ├── models_cache/               # Local on-premise weights (Whisper, ONNX)
│   ├── requirements.txt            # Python dependencies (fastapi, ortools, faster-whisper)
│   ├── Dockerfile                  # Standalone Docker container definition
│   └── run_service.bat             # Standalone Windows service runner
├── Backend/                        # Core Node.js HMS Backend (Unchanged dependencies)
├── HospitalsWeb/                   # React Frontend
└── Sql/                            # Database Schemas & Migrations
```

---

## 📑 Core AI Feature Roadmap

| Feature | Subsystem | Technology in `AiService` | Priority |
|---|---|---|---|
| **AI Duty Roster Generation** | Scheduling Engine | Google OR-Tools (CP-SAT Constraint Solver) | ⭐ Primary (Phase 1) |
| **Doctor Voice Dictation (Notes & Rx)** | Clinical AI | `faster-whisper` (Local CTranslate2 int8 model) | ⭐ Co-Primary (Phase 1.5) |
| **Structured Rx Extraction from Voice** | Pharmacy / OPD | Local Medical Lexicon + Fast NER / Local SLM | ⭐ Co-Primary (Phase 1.5) |
| **Attendance & Payroll Anomaly AI** | HR / Payroll | Deterministic Statistical ML & Anomaly Detection | Phase 2 |
| **Drug-Drug Interaction & Patient Safety** | Clinical Safety | Drug Matrix Graph & Fuzzy Matchers | Phase 3 |

---

## ⭐ FEATURE 1 — AI Duty Roster Scheduling Engine (`roster_solver.py`)

### Problem
Scheduling 50–200 hospital staff across 3 shifts (Morning, Evening, Night), adhering to department coverage requirements, role-specific mandatory presence, leave requests, maximum fatigue limits, and fair weekend/night rotations is a high-complexity NP-hard combinatorial problem.

### AI Engine Architecture (Google OR-Tools CP-SAT)
Using Python's **Google OR-Tools CP-SAT** in the standalone service provides millisecond-to-second global optimization with mathematical guarantees:

1. **Hard Constraints (Must Satisfy)**:
   - **Minimum Staffing Coverage**: Shift $s$ on Day $d$ must have at least $N_{s,d}$ nurses/doctors.
   - **Mandatory Role Coverage**: Each emergency/ICU shift must have at least 1 Senior Doctor and 1 Charge Nurse.
   - **No Double Shifts**: An employee cannot work two overlapping or consecutive shifts without mandatory rest.
   - **Approved Leave Enforcement**: Zero assignment on approved leave / off days.
   - **Minimum Rest Period**: At least 12–16 hours of rest between consecutive shifts.
   - **Night Shift Rest Rule**: Mandatory 24h rest following a Night shift.

2. **Soft Constraints & Fairness Optimization (Objective Function)**:
   - Fair distribution of Night shifts across all eligible staff.
   - Fair distribution of weekend duties.
   - Honor employee shift preferences where possible.
   - Maximize consecutive days off (e.g. 2 continuous days off rather than split days).

### API Contract (Node.js Backend ↔ Standalone AI Service)

#### `POST http://localhost:8000/api/v1/roster/solve`
**Request Payload from HMS**:
```json
{
  "department_id": 4,
  "period_start": "2026-10-01",
  "period_end": "2026-10-31",
  "employees": [
    { "id": 101, "name": "Dr. Sarah", "role": "Senior Consultant", "max_night_shifts_per_month": 4 },
    { "id": 102, "name": "Nurse Priya", "role": "Staff Nurse", "max_consecutive_days": 6 }
  ],
  "shifts": [
    { "id": 1, "code": "M", "name": "Morning", "start_time": "07:00", "end_time": "15:00" },
    { "id": 2, "code": "E", "name": "Evening", "start_time": "15:00", "end_time": "23:00" },
    { "id": 3, "code": "N", "name": "Night", "start_time": "23:00", "end_time": "07:00" }
  ],
  "rules": {
    "min_staff_per_shift": { "M": 4, "E": 3, "N": 2 },
    "min_rest_hours_between_shifts": 12,
    "max_consecutive_working_days": 6,
    "approved_leaves": [
      { "employee_id": 102, "date": "2026-10-15" }
    ]
  }
}
```

**Response Payload from AI Service**:
```json
{
  "status": "OPTIMAL",
  "solve_time_seconds": 0.42,
  "roster": [
    { "employee_id": 101, "date": "2026-10-01", "shift_id": 1, "shift_code": "M" },
    { "employee_id": 102, "date": "2026-10-01", "shift_id": 2, "shift_code": "E" }
  ],
  "metrics": {
    "fairness_score": 98.4,
    "total_shifts_assigned": 480,
    "uncovered_shifts": []
  }
}
```

---

## 🎙️ ⭐ FEATURE 2 — Local Voice-to-Text & Structured Rx Extractor

### Architecture
Doctor speaks into `HospitalsWeb` → Audio chunk sent to `AiService` (:8000) → `faster-whisper` processes audio locally in ~300ms → `rx_parser.py` extracts structured prescription JSON → sent back to UI for doctor approval.

### Standalone Endpoints:
1. `POST http://localhost:8000/api/v1/voice/transcribe`
   - Accepts: Audio file / stream (`multipart/form-data` or WebSocket PCM)
   - Returns: `{ "transcript": "Tab Augmentin 625mg twice daily after food for 5 days" }`
2. `POST http://localhost:8000/api/v1/voice/parse-prescription`
   - Accepts: `{ "transcript": "...", "department": "OPD" }`
   - Returns: Structured JSON matching hospital medicine master catalog.

---

## 🔒 Service Communication & Security

1. **Private Network Binding**: The `AiService` binds strictly to `127.0.0.1` (or internal Docker network `ai-network`), never exposed directly to the public internet.
2. **Service Token Authentication**: Requests between the Node.js backend and `AiService` use a shared secret header (`X-Internal-Service-Key`).
3. **Stateless Operations**: `AiService` does not hold database write locks; it receives optimization requests and returns candidate solutions. The core HMS backend is the only service that writes committed records to PostgreSQL.

---

## 📅 Implementation Roadmap (PostgreSQL Migration First)

```
Prerequisite: Finalize PostgreSQL Migration & Schema Validation
  └── Zero errors on psql import & database verification

Phase 1 — Standalone AiService Foundation & Duty Roster Engine
  ├── Scaffold `AiService/` (FastAPI + OR-Tools + Pydantic + Uvicorn)
  ├── Implement `roster_solver.py` with CP-SAT constraint engine
  ├── Add Node.js client proxy in `Backend/src/services/aiClient.js`
  └── Build interactive Roster Generation & Review UI in `HospitalsWeb`

Phase 1.5 — Local Clinical Voice-to-Text & Rx Extractor
  ├── Integrate `faster-whisper` (int8 quantized local engine) in `AiService/`
  ├── Implement Medical Lexicon Tokenizer & Regex/SLM Rx Parser
  └── Add Voice Dictation mic controls in OPD, IPD, and Prescription screens

Phase 2 — Attendance & Payroll AI Assists (Standalone)
Phase 3 — Patient Safety & Pharmacy Intelligence (Standalone)
```

---

> [!IMPORTANT]
> **Plan Status**: Updated and saved. Implementation will **NOT** proceed until the user reviews this decoupled architecture plan and gives explicit approval.
