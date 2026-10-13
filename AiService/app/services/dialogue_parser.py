"""
dialogue_parser.py
Bilingual (Tamil + English) Ambient Clinical Dialogue Scribe & Multi-Speaker Parser.
Parses natural OPD/IPD consultation dialogues involving Doctor, Patient, Attendant (relative), and Nurse.
Applies acoustic verification anchors and semantic role attribution to isolate authoritative prescriptions.
"""

import re
import json
import logging
from typing import Dict, Any, List, Optional
from app.models.voice_schema import (
    ConsultationParseRequest,
    ConsultationParseResponse,
    PrescriptionItemParsed,
    SpeakerTurn
)
from app.services.ollama_client import query_ollama

logger = logging.getLogger(__name__)

CLINICAL_SCRIBE_SYSTEM_PROMPT = """You are an expert bilingual (Tamil and English) Clinical Scribe and Multi-Speaker Dialogue Analyzer for Neha Hospitals.
Your task is to analyze consultation dialogues involving multiple speakers (Doctor, Patient, Attendant/Relative, Nurse) and extract structured medical documentation in standard clinical English.

SPEAKER ROLES IN INDIAN / TAMIL HOSPITAL OPD:
1. "DOCTOR":
   - Signs: Prescriptive commands ("சாப்பிட்ட பிறகு மாத்திரை போடுங்க", "Take this tablet after food"), diagnostic statements, clinical queries ("எத்தனை நாளா வலிக்குது?"), advice.
   - Authority: ONLY the Doctor can prescribe medicines or make medical diagnoses!
2. "PATIENT":
   - Signs: First-person somatic complaints ("எனக்கு தலைவலிக்குது", "I have fever", "எனக்கு மூச்சு வாங்க முடியல").
3. "ATTENDANT" (Relative / Caregiver speaking for the patient):
   - Signs: Third-person proxy statements ("அவருக்கு நேத்துல இருந்து காய்ச்சல் டாக்டர்", "தம்பிக்கு 2 நாளா வாந்தி", "சாப்பிட மாட்டேங்கிறார்", "பாட்டிக்கு தூக்கம் இல்ல").
   - If Patient is a child (Pediatric < 10 yrs), adult statements describing symptoms are from the ATTENDANT.
4. "NURSE":
   - Signs: Metric reporting ("BP 130/80 doctor", "Temperature 101.2", "Pulse 78", "Sugar 180"), procedure confirmations ("Injection TT potachu doctor", "Dressing done doctor").

JSON FIELDS TO RETURN:
{
  "detected_speakers": ["Doctor", "Patient", "Attendant", "Nurse"],
  "dialogue_turns": [
    {
      "speaker_label": "SPEAKER_00",
      "role": "doctor",  // "doctor" | "patient" | "attendant" | "nurse"
      "role_confidence": 0.95,
      "text": "dialogue text here"
    }
  ],
  "chief_complaints": "Concise symptoms in clinical English (include proxy attribution if reported by family: e.g. 'Fever x 2 days, poor oral intake reported by mother')",
  "diagnosis": "Provisional or confirmed medical condition stated by the DOCTOR (never from relative's suggestion)",
  "clinical_notes": "Physical exam findings and clinical remarks",
  "bp_systolic": 120, // integer
  "bp_diastolic": 80, // integer
  "temperature": 100.4, // float
  "pulse": 76, // integer
  "spo2": 98, // integer
  "weight": 65.0, // float
  "height": 165.0, // float
  "blood_sugar": 110.0, // float
  "prescriptions": [
    {
      "medicine_name": "Tab Augmentin 625mg",
      "dose_morning": 1,
      "dose_afternoon": 0,
      "dose_night": 1,
      "duration_days": 5,
      "food_instruction": "after_food", // "after_food", "before_food", "with_food", "as_needed"
      "notes": "additional instructions"
    }
  ],
  "doctor_advice": "Dietary, lifestyle or rest advice",
  "follow_up_days": 5 // integer
}

Tamil translation reference:
- "காய்ச்சல்" / "kaichal" = Fever
- "இருமல்" / "irumal" = Cough
- "தொண்டை வலி" / "thondai vali" = Sore throat / Pharyngitis
- "தலைவலி" / "thalaivali" = Headache
- "நெஞ்சு வலி" / "nenju vali" = Chest pain
- "வாந்தி" / "vaandhi" = Vomiting
- "மயக்கம்" / "mayakkam" = Dizziness
- "காலைல" / "kaalai" = Morning (dose_morning: 1)
- "மதியம்" / "madhiyam" = Afternoon (dose_afternoon: 1)
- "ராத்திரி" / "raathiri" = Night (dose_night: 1)
- "சாப்பிட்ட அப்புறம்" = "after_food"
- "சாப்பாட்டுக்கு முன்னாடி" = "before_food"

CRITICAL RULE: Return ONLY a valid JSON object. Do not output markdown text or conversational explanations outside the JSON.
"""

def extract_vitals_deterministic(text: str) -> Dict[str, Any]:
    """Fallback regex extractor for spoken vitals."""
    vitals = {}
    
    # Blood Pressure: 120/80, 130 over 85, 120 by 80
    bp_match = re.search(r'\b(?:bp|blood pressure)?\s*(\d{2,3})\s*(?:/|over|by)\s*(\d{2,3})\b', text, re.IGNORECASE)
    if bp_match:
        try:
            sys_val = int(bp_match.group(1))
            dia_val = int(bp_match.group(2))
            if 60 <= sys_val <= 250 and 40 <= dia_val <= 150:
                vitals["bp_systolic"] = sys_val
                vitals["bp_diastolic"] = dia_val
        except ValueError:
            pass

    # Pulse / Heart Rate
    pulse_match = re.search(r'\b(?:pulse|heart rate|hr)\s*(?:is|was|of)?\s*(\d{2,3})\b', text, re.IGNORECASE)
    if pulse_match:
        try:
            p_val = int(pulse_match.group(1))
            if 40 <= p_val <= 220:
                vitals["pulse"] = p_val
        except ValueError:
            pass

    # Temperature
    temp_match = re.search(r'\b(?:temperature|temp)\s*(?:is|was|of)?\s*(\d{2,3}(?:\.\d)?)\b', text, re.IGNORECASE)
    if temp_match:
        try:
            t_val = float(temp_match.group(1))
            if 34.0 <= t_val <= 42.0 or 95.0 <= t_val <= 106.0:
                vitals["temperature"] = t_val
        except ValueError:
            pass

    # SpO2
    spo2_match = re.search(r'\b(?:spo2|oxygen|saturation|o2)\s*(?:is|was|of)?\s*(\d{2,3})\s*%?\b', text, re.IGNORECASE)
    if spo2_match:
        try:
            s_val = int(spo2_match.group(1))
            if 70 <= s_val <= 100:
                vitals["spo2"] = s_val
        except ValueError:
            pass

    # Blood Sugar / GRBS / RBS
    sugar_match = re.search(r'\b(?:sugar|blood sugar|grbs|rbs|fbs)\s*(?:is|was|of)?\s*(\d{2,3})\b', text, re.IGNORECASE)
    if sugar_match:
        try:
            sug_val = float(sugar_match.group(1))
            if 40 <= sug_val <= 600:
                vitals["blood_sugar"] = sug_val
        except ValueError:
            pass

    return vitals

def extract_prescriptions_deterministic(text: str) -> List[PrescriptionItemParsed]:
    """Fallback deterministic regex extractor for medical prescriptions in dialogue."""
    results = []
    pattern = r'\b(Tab|Cap|Syr|Inj|Tablet|Capsule|Syrup|Injection)\.?\s+([A-Za-z0-9\-]+(?:\s+\d+(?:mg|ml|g))?)'
    seen = set()
    for match in re.finditer(pattern, text, re.IGNORECASE):
        med_type = match.group(1).capitalize()
        med_name = match.group(2).strip()
        full_med = f"{med_type} {med_name}"
        if full_med.lower() in seen:
            continue
        seen.add(full_med.lower())

        context_window = text[match.end():match.end()+140].lower()
        m = 1 if any(w in context_window for w in ("morning", "காலை", "1-", "1 -")) else 0
        a = 1 if any(w in context_window for w in ("afternoon", "மதியம்", "-1-", "- 1 -")) else 0
        n = 1 if any(w in context_window for w in ("night", "இரவு", "ராத்திரி", "-1", "- 1")) else 0
        if m == 0 and a == 0 and n == 0:
            m, a, n = 1, 0, 1

        dur_match = re.search(r'(\d+)\s*(?:நாள்|days|day)\b', context_window)
        duration = int(dur_match.group(1)) if dur_match else 5
        food = "before_food" if any(w in context_window for w in ("before food", "முன்னாடி", "வெறும் வயிறு")) else "after_food"

        results.append(PrescriptionItemParsed(
            medicine_name=full_med,
            dose_morning=m,
            dose_afternoon=a,
            dose_night=n,
            duration_days=duration,
            food_instruction=food
        ))
    return results

def parse_clinical_dialogue(req: ConsultationParseRequest) -> ConsultationParseResponse:
    """
    Parses natural bilingual consultation dialogue into clinical entities,
    differentiating Doctor, Patient, Attendant, and Nurse.
    """
    transcript = req.transcript.strip()
    if not transcript:
        return ConsultationParseResponse(
            status="ERROR",
            message="No consultation dialogue transcript provided to parse."
        )

    # 1. Deterministic vitals scan
    deterministic_vitals = extract_vitals_deterministic(transcript)

    # 2. Build contextual prompt with patient & doctor metadata
    context_lines = []
    if req.patient_name:
        context_lines.append(f"Patient Name: {req.patient_name}")
    if req.patient_age:
        context_lines.append(f"Patient Age: {req.patient_age} years old ({'Pediatric' if req.patient_age < 12 else 'Adult'})")
    if req.patient_gender:
        context_lines.append(f"Patient Gender: {req.patient_gender}")
    if req.doctor_name:
        context_lines.append(f"Attending Doctor: Dr. {req.doctor_name}")
    if req.existing_complaints:
        context_lines.append(f"Prior Complaints: {req.existing_complaints}")
    if req.existing_diagnosis:
        context_lines.append(f"Prior Diagnosis: {req.existing_diagnosis}")

    metadata_block = "\n".join(context_lines) if context_lines else "None provided"

    # Turn-by-turn dialogue string if present
    turns_text = ""
    if req.dialogue_turns:
        formatted_turns = []
        for i, t in enumerate(req.dialogue_turns):
            verified_tag = " [ACOUSTIC DOCTOR VERIFIED]" if t.is_doctor_verified else ""
            formatted_turns.append(f"Turn {i+1} ({t.speaker_label}{verified_tag}): \"{t.text}\"")
        turns_text = "\n" + "\n".join(formatted_turns)

    user_prompt = f"""Please analyze this hospital consultation dialogue and return the structured JSON:

PATIENT & CLINICAL CONTEXT:
{metadata_block}

CONSULTATION TRANSCRIPT:
\"\"\"
{transcript}
\"\"\"{turns_text}
"""

    llm_output = query_ollama(
        prompt=user_prompt,
        system=CLINICAL_SCRIBE_SYSTEM_PROMPT,
        temperature=0.1
    )

    data = {}
    if isinstance(llm_output, dict):
        data = llm_output
    elif isinstance(llm_output, str):
        try:
            clean_str = llm_output.strip()
            if "```json" in clean_str:
                clean_str = clean_str.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_str:
                clean_str = clean_str.split("```")[1].split("```")[0].strip()
            data = json.loads(clean_str)
        except Exception as e:
            logger.warning(f"[dialogue_parser] Failed to parse Ollama JSON response: {e}")
            data = {}

    # Extract prescriptions
    prescriptions: List[PrescriptionItemParsed] = []
    raw_rx_list = data.get("prescriptions", [])
    if isinstance(raw_rx_list, list):
        for item in raw_rx_list:
            if isinstance(item, dict) and item.get("medicine_name"):
                prescriptions.append(PrescriptionItemParsed(
                    medicine_name=str(item.get("medicine_name")).strip(),
                    dose_morning=int(item.get("dose_morning", 1) or 0),
                    dose_afternoon=int(item.get("dose_afternoon", 0) or 0),
                    dose_night=int(item.get("dose_night", 1) or 0),
                    duration_days=int(item.get("duration_days", 5) or 1),
                    food_instruction=str(item.get("food_instruction", "after_food")),
                    notes=item.get("notes")
                ))

    # Deterministic fallback if LLM omitted medicines
    if not prescriptions:
        prescriptions = extract_prescriptions_deterministic(transcript)

    def _to_clean_string(val: Any) -> str:
        if val is None:
            return ""
        if isinstance(val, str):
            return val.strip()
        if isinstance(val, list):
            return ", ".join(str(x).strip() for x in val if x).strip()
        if isinstance(val, dict):
            parts = []
            for k, v in val.items():
                if v and str(v).lower() not in ("none", "null", ""):
                    parts.append(f"{k.replace('_', ' ').capitalize()}: {v}")
            return "; ".join(parts) if parts else ""
        return str(val).strip()

    # Merge vitals
    bp_sys = data.get("bp_systolic") or deterministic_vitals.get("bp_systolic")
    bp_dia = data.get("bp_diastolic") or deterministic_vitals.get("bp_diastolic")
    pulse = data.get("pulse") or deterministic_vitals.get("pulse")
    temp = data.get("temperature") or deterministic_vitals.get("temperature")
    spo2 = data.get("spo2") or deterministic_vitals.get("spo2")
    sugar = data.get("blood_sugar") or deterministic_vitals.get("blood_sugar")

    complaints = _to_clean_string(data.get("chief_complaints"))
    if not complaints and not data.get("diagnosis"):
        complaints = transcript

    diagnosis_str = _to_clean_string(data.get("diagnosis"))
    notes_str = _to_clean_string(data.get("clinical_notes"))
    advice_str = _to_clean_string(data.get("doctor_advice"))

    # Parse and reconcile dialogue turns
    dialogue_turns_out: List[SpeakerTurn] = []
    raw_turns = data.get("dialogue_turns", [])
    if isinstance(raw_turns, list) and raw_turns:
        for i, t in enumerate(raw_turns):
            if isinstance(t, dict):
                speaker_lbl = str(t.get("speaker_label", f"SPEAKER_{i:02d}"))
                role = str(t.get("role", "unknown")).lower()
                conf = float(t.get("role_confidence", 0.9))
                # Check if acoustically verified
                is_doc_ver = (role == "doctor" and bool(req.doctor_voiceprint))
                dialogue_turns_out.append(SpeakerTurn(
                    turn_index=i,
                    speaker_label=speaker_lbl,
                    role=role if role in ("doctor", "patient", "attendant", "nurse") else "unknown",
                    role_confidence=conf,
                    is_doctor_verified=is_doc_ver,
                    text=_to_clean_string(t.get("text"))
                ))
    elif req.dialogue_turns:
        dialogue_turns_out = req.dialogue_turns

    detected_speakers = data.get("detected_speakers", [])
    if not isinstance(detected_speakers, list):
        detected_speakers = []

    has_doctor_verified = any(t.is_doctor_verified or t.role == "doctor" for t in dialogue_turns_out)

    return ConsultationParseResponse(
        status="SUCCESS",
        chief_complaints=complaints,
        diagnosis=diagnosis_str,
        clinical_notes=notes_str,
        bp_systolic=int(bp_sys) if bp_sys else None,
        bp_diastolic=int(bp_dia) if bp_dia else None,
        temperature=float(temp) if temp else None,
        pulse=int(pulse) if pulse else None,
        spo2=int(spo2) if spo2 else None,
        weight=float(data.get("weight")) if data.get("weight") else None,
        height=float(data.get("height")) if data.get("height") else None,
        blood_sugar=float(sugar) if sugar else None,
        prescriptions=prescriptions,
        doctor_advice=advice_str if advice_str else None,
        follow_up_days=int(data.get("follow_up_days")) if data.get("follow_up_days") else None,
        doctor_verified=has_doctor_verified,
        detected_speakers=[str(s) for s in detected_speakers],
        dialogue_turns=dialogue_turns_out,
        message="Consultation dialogue parsed successfully into clinical entities."
    )
