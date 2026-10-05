# 🤖 AI Integration Plan — Neha Hospitals HMS

> **Philosophy**: AI assists and recommends, humans approve and act.
> Every AI action that changes data must go through an **approval workflow** — no silent mutations.
> **Privacy & Offline First**: All AI and Voice-to-Text models must run **100% locally on-premise** without sending sensitive patient data to third-party cloud APIs.

---

## 📑 Core AI Feature Roadmap

| Feature | Category | Model Architecture | Priority |
|---|---|---|---|
| **AI Duty Roster Generation** | Staff Scheduling | Local Constraint Solver + Rule Templates (Node.js) | ⭐ Primary (Phase 1) |
| **Doctor Voice Dictation (Notes & Prescription)** | Clinical AI | Local Speech-to-Text (Faster-Whisper / WebAssembly Whisper) | ⭐ Co-Primary (Phase 1.5) |
| **Structured Rx Extraction from Voice** | Pharmacy / OPD | Local NLP / Medical Entity Extractor & Local LLM | ⭐ Co-Primary (Phase 1.5) |
| **Attendance & Payroll AI Assists** | HR / Payroll | Deterministic Statistical ML & Anomaly Detection | Phase 2 |
| **Patient Safety & Pharmacy AI** | Clinical Safety | Rule-based Drug Matrix & Fuzzy Matchers | Phase 3 |

---

## ⭐ FEATURE 1 — AI Duty Roster Generation (Scheduling Engine)

> Automated, constraint-satisfying staff scheduling with fairness, fatigue control, and leave compliance.

### What Exists Today (in [`WeeklyRoster.jsx`](file:///I:/Project/NehaHospitals/HospitalsWeb/src/pages/admin/shiftroster/WeeklyRoster.jsx) + [`AssignShiftForm.jsx`](file:///I:/Project/NehaHospitals/HospitalsWeb/src/pages/admin/shiftroster/AssignShiftForm.jsx))
- Weekly/monthly roster grid per department
- Manual shift assignment per employee
- Shift configurations (Morning 07–15, Evening 15–23, Night 23–07, General 09–17, Emergency 20–08)
- Shift timing configuration modal

### What AI Will Add
AI takes the current empty roster period + hospital rules as input → generates a complete, constraint-satisfying roster → presents for human review → admin approves / modifies cell by cell → roster is saved.

### Rule Input System (Configurable Before Generation)
- **Coverage Requirements**: Min staff per shift, min staff per role, mandatory role coverage (e.g. Head Nurse), weekend/holiday coverage.
- **Fatigue & Fairness**: Max consecutive working days (default 6), min rest between shifts (12h), max night shifts/week (3), mandatory off after night shifts.
- **Leave & Off Constraints**: Automatic exclusion of approved leave dates, week-off enforcement.
- **Historical Balancing**: Rotate night shift burden based on previous months' roster history.

### Roster Architecture & API
```
POST /api/roster/ai/generate   -> Generates candidate roster & violations report
POST /api/roster/ai/templates  -> Saves department rule templates
POST /api/roster/ai/approve    -> Commits reviewed roster to database
```

---

## 🎙️ ⭐ FEATURE 2 — Local Voice-to-Text for Doctor's Notes & Prescriptions

> **Goal**: Doctors can dictate consultation notes, admission daily notes, and complex prescriptions using their microphone. The audio is transcribed **locally in real-time**, and medical prescriptions are automatically converted into structured medication line items (medicine, dose, frequency, duration, food advice).

### 🔒 Core Privacy & Offline Constraints
- **Zero Cloud API Reliance**: No OpenAI Whisper API, no Google Speech API, no cloud egress.
- **100% On-Premise**: Runs directly on the hospital local server or workstation.
- **Low Latency**: Near real-time transcription (< 500ms audio-to-text latency).
- **Accurate Medical & Accent Handling**: Tailored for Indian clinical English and medical nomenclature (brand names, generic names, medical Latin abbreviations like BD, TID, OD, HS, SOS, stat).

---

### 🏛️ Local Model Technical Architecture

```
                       [ Doctor Speaks into Web UI ]
                                    │ (Web Audio API / MediaRecorder)
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │               DEPLOYMENT OPTION SELECTION                │
       └────────────────────────────┬────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
   [ Option A: Local Server Sidecar ]             [ Option B: In-Browser WebGPU/WASM ]
   - Python `faster-whisper` Service               - `@xenova/transformers` (Whisper ONNX)
   - FastAPI microservice on Hospital LAN          - Runs 100% inside Doctor's Chrome/Edge
   - CPU int8 or GPU acceleration                  - Zero backend server compute needed
   - Endpoint: POST /api/v1/voice/transcribe       - Instant response for offline clinics
           │                                                 │
           └────────────────────────┬────────────────────────┘
                                    │
                                    ▼
                        [ Raw Dictated Transcript ]
              "Pantocid 40 one daily before food for five days
               and Dolo 650 three times daily after food for three days"
                                    │
                                    ▼
           ┌─────────────────────────────────────────────────────────┐
           │        LOCAL MEDICAL PARSER & ENTITY EXTRACTOR          │
           │  1. Local Regex + Medical Lexicon Tokenizer             │
           │  2. Local Lightweight Model (Ollama / Qwen2.5-1.5B)     │
           │  3. Hospital Medicine Master Database Matcher           │
           └────────────────────────┬────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────────┐
       │              STRUCTURED CLINICAL PRESCRIPTION                │
       │  [1] Pantocid 40mg  | Tab | 1-0-0 | Before Food | 5 Days   │
       │  [2] Dolo 650mg      | Tab | 1-1-1 | After Food  | 3 Days   │
       └────────────────────────────┬────────────────────────────────┘
                                    │
                                    ▼
       [ Doctor Reviews & Adjusts in UI Grid → 1-Click Approve & Print ]
```

---

### 🛠️ Technology Stack Options for Local Voice-to-Text

#### 1. Primary Engine: `faster-whisper` Local Microservice (Recommended)
- **Engine**: CTranslate2-based implementation of OpenAI Whisper (4x faster than vanilla Whisper, 70% less memory).
- **Model Choice**: `whisper-small.en` or `whisper-medium` (quantized `int8`).
- **Resource Footprint**: ~400MB–1GB RAM on CPU; handles typical sentences in ~0.3s.
- **Deployment**: Runs as a lightweight local background daemon (Python FastAPI) bundled with the backend or inside a Docker container on the hospital server.

#### 2. Alternative Engine: In-Browser Client-Side WebAssembly / WebGPU
- **Library**: `@xenova/transformers` / ONNX Runtime Web.
- **Model Choice**: `Xenova/whisper-tiny.en` or `whisper-base`.
- **Benefit**: Zero server load; the audio never leaves the browser tab.

---

### 🏥 Clinical Use Cases & UI Workflows

#### Use Case A: Doctor's Clinical Notes Dictation (OPD & IPD)
- **Target Screens**:
  - OPD Consultation Screen (`/consultations`)
  - IPD Daily Notes (`/admissions/daily-notes`)
  - Discharge Summary Notes (`/discharges`)
- **UI Element**: Floating / Inline Mic Button with real-time audio waveform visualizer.
- **Features**:
  - Push-to-Talk or Toggle Continuous Dictation.
  - Dictation of: Chief Complaints, History of Present Illness (HPI), Examination Findings, Diagnosis, and Treatment Advice.
  - Automatic punctuation insertion ("full stop", "comma", "new line" voice commands).

#### Use Case B: Prescription Dictation & Automatic Structured Parsing
- **Target Screens**:
  - Doctor Prescription Modal (`PrescriptionForm.jsx`)
  - Pharmacy Bill Creation (`PharmacyBillForm.jsx`)
- **Workflow**:
  1. Doctor clicks **"🎙️ Dictate Prescription"**.
  2. Doctor speaks: *"Tab Augmentin 625mg twice daily after food for 5 days, Syrup Ascoril LS 5ml thrice daily for 5 days, Cap Rabeprazole 20mg once daily before breakfast for 7 days."*
  3. The local parser maps the spoken text into structured JSON:
```json
[
  {
    "medicine_name": "Augmentin",
    "form_factor": "Tablet",
    "strength": "625mg",
    "dosage_frequency": "1-0-1",
    "food_instruction": "after_food",
    "duration_days": 5,
    "matched_inventory_id": 412
  },
  {
    "medicine_name": "Ascoril LS",
    "form_factor": "Syrup",
    "strength": "5ml",
    "dosage_frequency": "1-1-1",
    "food_instruction": "after_food",
    "duration_days": 5,
    "matched_inventory_id": 189
  },
  {
    "medicine_name": "Rabeprazole",
    "form_factor": "Capsule",
    "strength": "20mg",
    "dosage_frequency": "1-0-0",
    "food_instruction": "before_food",
    "duration_days": 7,
    "matched_inventory_id": 95
  }
]
```
  4. The structured table populates in the UI.
  5. The doctor reviews/edits any dosage or medicine, and clicks **"Save & Print"**.

---

### 🗄️ Database Schema Additions for Voice & Clinical AI

```sql
-- Audio / Dictation Transcripts Log (for audit & medical records)
CREATE TABLE clinical_voice_transcripts (
  id              BIGSERIAL PRIMARY KEY,
  doctor_id       BIGINT NOT NULL REFERENCES users(id),
  patient_id      BIGINT NOT NULL REFERENCES patients(id),
  encounter_type  VARCHAR(30) NOT NULL, -- 'opd_consultation', 'ipd_daily_note', 'prescription'
  encounter_id    BIGINT NOT NULL,      -- consultation_id, admission_id, prescription_id
  raw_transcript  TEXT NOT NULL,
  structured_data JSONB NULL,
  audio_duration_secs DECIMAL(6,2) NULL,
  model_used      VARCHAR(50) NOT NULL DEFAULT 'faster-whisper-small-int8',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_voice_doctor_patient ON clinical_voice_transcripts (doctor_id, patient_id);
```

---

## 📋 Complete Rollout Phases

```
Phase 1 — AI Duty Roster Generation
  ├── Roster Rules Panel (Coverage, Fatigue, Offs)
  ├── Local Node.js Constraint Solver (Zero API Cost)
  ├── Visual Conflict & Violations Highlighting
  └── Rule Template Management

Phase 1.5 — Local Voice-to-Text & Rx Extractor (On-Premise)
  ├── Local Whisper Microservice / WebAssembly Audio Engine
  ├── Mic UI Component with Waveform & Live Feedback
  ├── Clinical Notes Dictation (OPD & IPD Daily Notes)
  ├── Structured Prescription Voice Parsing & Medicine Auto-Match
  └── Doctor Review & 1-Click Verification

Phase 2 — Attendance & Payroll AI Assists
  ├── Missed Punch Suggestions
  └── Salary Anomaly Detection

Phase 3 — Patient Safety & Pharmacy Intelligence
  ├── Drug-Drug Interaction Warning Matrix
  ├── Duplicate Patient Fuzzy Matcher
  └── Medicine Stockout Consumption Forecasting
```

---

> [!IMPORTANT]
> **Summary of Offline Guarantee**: Both the **Duty Roster AI** and the **Voice-to-Text Clinical Dictation** run **100% locally on-premise**. No external cloud tokens, API keys, or subscriptions are required, guaranteeing hospital compliance, privacy, and zero recurring API costs.
