# Neha Hospitals — Clinical Voice AI & Multilingual Ambient Dialogue Scribe Architecture

## 📋 Executive Overview

In real-world hospital environments, documentation is the largest driver of physician burnout. Doctors routinely spend **35% to 50% of their consultation time** typing into computers rather than maintaining eye contact with patients.

In Indian healthcare settings (such as Tamil Nadu), this challenge is amplified:
1. **High Patient Volume**: Outpatient (OPD) consultants see between 30 to 70 patients per day, leaving only 2 to 5 minutes per patient.
2. **Multilingual Code-Switching (Tanglish)**: Consultations rarely occur in pure English or pure formal Tamil. Patients frequently express symptoms in colloquial Tamil (e.g., *"மூணு நாளா நெஞ்சுல ஒரு மாதிரி பாரமா இருக்கு டாக்டர், மூச்சு விட கஷ்டமா இருக்கு"*), while doctors speak a mix of Tamil and English (*"BP செக் பண்ணலாம், ECG எடுக்கணும், Tab Sorbitrate 5mg sublingual-ஆ போட்டுக்கோங்க"*), and write formal prescriptions strictly in clinical English.

This document outlines the architecture, clinical comparison, and technical implementation of **Neha Hospitals' Multilingual Ambient Doctor-Patient Dialogue Scribe & Voice-to-Rx Engine**.

---

## 🌐 1. Industry Benchmark: Voice-to-Text in Leading HMS / EHR Systems

| Platform | Technology Stack | Workflow Model | Multilingual / Indian Accent Capabilities |
| :--- | :--- | :--- | :--- |
| **Epic Systems** *(US / Global)* | Nuance Dragon Medical One (DMO) / DAX Copilot | **Ambient Clinical Intelligence**: Microphones passively capture the room conversation; generates a draft SOAP note. | High accuracy in English & Spanish; limited out-of-the-box colloquial Indian regional language support without costly custom training. |
| **eClinicalWorks** *(US / India)* | *Sunoh.ai* & *Eva* | **Ambient Scribe & Field Mapper**: Transcribes room audio and extracts discrete fields (Vitals, Rx, HPI, Lab Orders). | Supports English and select Indian accents; relies on cloud processing. |
| **Apollo Hospitals / 24|7 EMR** *(India)* | Custom Medical ASR & Clinical NLP | **Dictation & Quick Rx**: Doctor dictates medicine brand names and notes; maps speech to Apollo's pharmacy catalog. | Tuned for Indian English and medical brand names (e.g., *Dolo 650*, *Augmentin 625*, *Pan-D*). |
| **Practo Ray / DocOn** *(India)* | Cloud Speech APIs + Regex Extractors | **Push-to-Talk Field Dictation**: Single-field dictation into notes and diagnosis boxes. | Basic single-language speech-to-text; lacks ambient multi-speaker conversational dialogue parsing. |
| **Neha Hospitals (Our Solution)** | **`faster-whisper` (Local int8) + Ollama Local LLM** | **Dual-Mode**: <br>1. *Ambient Dialogue Scribe* (Listens to Tamil + English conversation $\rightarrow$ structures SOAP + Rx)<br>2. *Direct Push-to-Talk Dictation* (Single-field dictation) | **100% Local On-Premise**: Zero patient audio sent to external clouds. Native Tamil (`ta`) + English (`en`) transcription, translation, and Indian brand name matching. |

---

## 🎙️ 2. Ambient Doctor-Patient Dialogue Recognition vs. Direct Dictation

Neha Hospitals supports **two voice interaction modes**:

### Mode A: Ambient Doctor-Patient Dialogue Scribe (Bilingual Tamil + English)
- **How it works**: The doctor taps **"Start Consultation Recording"** at the beginning of the visit. The browser records the natural conversation between the doctor and patient.
- **The Challenge**: The dialogue contains casual talk, patient complaints, doctor questions, reassurance, and medication instructions spoken in Tamil or Tanglish.
- **The AI Pipeline**:
  ```
  [Ambient Room Audio (Tamil + English)]
                 │
                 ▼
  [AiService: faster-whisper Multilingual ASR]
                 │ (Raw Bilingual Transcript / English Translation)
                 ▼
  [Ollama Clinical NLP Engine]
                 │ (Extracts & Disentangles Speakers & Intents)
     ┌───────────┴───────────┬───────────────────────┐
     ▼                       ▼                       ▼
  Chief Complaints       Diagnosis & Notes     Prescription Items
  (Patient symptoms      (Doctor assessment    (Medicine, Dose 1-0-1,
   translated to Eng)     & clinical findings)  Food, Duration days)
  ```

### Mode B: Direct Push-to-Talk Clinical Dictation
- **How it works**: Doctor clicks the microphone icon beside a specific field (e.g., *Chief Complaints*, *Doctor Notes*, or *Discharge Summary*) and dictates directly.
- **Best for**: Discharge summaries, radiology impressions, or quick note-taking where conversation with the patient is not being recorded.

---

## 🇮🇳 3. Solving the Multilingual Tamil + English (Tanglish) Challenge

### A. Spoken Colloquial vs. Written Clinical Mapping
In Tamil Nadu hospital practice, communication shifts continuously:

| What the Patient / Doctor Says (Spoken) | Transcript & Translation (Whisper) | Structured Clinical Output in HMS |
| :--- | :--- | :--- |
| *"ரெண்டு நாளா பயங்கர தலைவலி டாக்டர், வாந்தி வர மாதிரி இருக்கு"* | *"Severe headache for 2 days, feeling like vomiting."* | **Complaints**: Severe headache for 2 days, nausea / emesis sensation. |
| *"நாளைக்கு காலையில fasting-ல blood sugar டெஸ்ட் எடுக்கணும்"* | *"Blood sugar test should be taken tomorrow morning in fasting."* | **Investigations / Advice**: Fasting Blood Sugar (FBS) scheduled tomorrow. |
| *"Dolo 650 மாத்திரை காலைல ஒன்னு, ராத்திரி ஒன்னு சாப்பிட்டதுக்கு அப்புறம் 3 நாள் போடுங்க"* | *"Tab Dolo 650 one in the morning, one at night after food for 3 days."* | **Rx**: `Dolo 650mg` \| Dose: `1-0-1` \| Food: `After Food` \| Duration: `3 Days` |
| *"Pan-D காலையில வெறும் வயித்துல போடுங்க"* | *"Cap Pan-D morning on empty stomach."* | **Rx**: `Pan-D Capsule` \| Dose: `1-0-0` \| Food: `Before Food` \| Duration: `5 Days` |

### B. Whisper Multilingual Model Strategy
- OpenAI's **Whisper model architecture** (running efficiently via `faster-whisper` CTranslate2) has extensive training on **Tamil (`ta`)** and **English (`en`)**.
- **Whisper Task Options**:
  1. `task="transcribe"`: Transcribes Tamil audio into Tamil script (தமிழ்) and English audio into Latin script.
  2. `task="translate"`: Transcribes any spoken Tamil or multilingual audio **directly into fluent English text** in a single pass!
- **Our Hybrid Scribe Pipeline**:
  1. We run `faster-whisper` with `task="transcribe"` (or `task="translate"`) to produce a faithful transcript.
  2. The transcript is piped into our local **Ollama Clinical LLM**, which acts as the medical scribe, organizing the dialogue into the standard international **SOAP format** (Subjective, Objective, Assessment, Plan).

---

## 🏥 4. Clinical Fields Automatically Populated in Neha Hospitals

In [`ConsultationRx.jsx`](file:///i:/Project/NehaHospitals/HospitalsWeb/src/pages/admin/ConsultationRx.jsx), the AI parses the dialogue and populates:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AUTOMATICALLY POPULATED FIELDS                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Chief Complaints     : Symptom onset, duration, severity                 │
│ 2. Vitals & Exam        : Spoken BP (e.g. "130 by 80"), Pulse, Temp, SpO2   │
│ 3. Clinical Diagnosis   : Provisional / confirmed medical condition          │
│ 4. Prescription Table   : Discrete Medicine rows:                           │
│                           ├── Medicine Name (Fuzzy matched against Pharmacy)│
│                           ├── Dose Morning (e.g. 1)                         │
│                           ├── Dose Afternoon (e.g. 0)                       │
│                           ├── Dose Night (e.g. 1)                           │
│                           ├── Duration Days (e.g. 5)                        │
│                           └── Food Timing (Before Food / After Food)        │
│ 5. Clinical Advice      : Dietary precautions, follow-up date, test orders  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔒 5. Privacy, Security & On-Premise Compliance (DISHA & HIPAA)

- **Zero Cloud Leakage**: Patient voices and clinical dialogues never leave the hospital premise.
- **Local AI Microservice (`AiService`)**:
  - Speech Recognition: Runs locally via `faster-whisper` (`base` / `small` multilingual int8 quantized model).
  - Dialogue Structuring: Runs locally via `Ollama` (`qwen2.5-coder:1.5b` or medical prompt).
- **Human-in-the-Loop Verification**:
  - The AI **never commits records directly to the database**.
  - All transcribed text and structured prescription rows are presented to the doctor as an interactive editable draft.
  - The doctor reviews, adjusts if necessary, and clicks **"Save & Finalize"**.

---

## 📅 6. Step-by-Step Implementation Roadmap

```
Step 1: AiService Dependencies & STT Core
  ├── Add `faster-whisper` + audio processing libraries to `AiService/requirements.txt`
  ├── Create `app/services/stt_engine.py` (Whisper model loader with Tamil & English support)
  └── Implement API endpoint: `POST /api/v1/voice/transcribe`

Step 2: Multilingual Clinical Dialogue & Rx Parser
  ├── Create `app/services/dialogue_parser.py` (Disentangles Tamil/English room dialogue into SOAP notes)
  ├── Create `app/services/rx_parser.py` (Extracts discrete medicine dosages 1-0-1, timings, durations)
  └── Implement API endpoint: `POST /api/v1/voice/parse-consultation`

Step 3: Frontend Web Audio & Ambient Mic Widget
  ├── Build `VoiceRecorderModal.jsx` / `AmbientScribeWidget.jsx` with audio visualizer, pause, resume, and language toggle
  ├── Integrate into `ConsultationRx.jsx` (Ambient Consultation & Push-to-Talk)
  └── Integrate into `Discharge.jsx` (Discharge Summary Dictation)

Step 4: End-to-End Validation
  ├── Test with Tamil clinical dialogue samples (fever, cough, chest pain)
  ├── Test with English/Tanglish prescription dictation
  └── Verify 1-click population into Neha Hospitals' Consultation & Rx tables
```
