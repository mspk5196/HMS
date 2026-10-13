from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class VoiceSegment(BaseModel):
    start: float
    end: float
    text: str

class TranscribeResponse(BaseModel):
    status: str = "SUCCESS"
    transcript: str
    language: str
    language_probability: float
    duration_seconds: float
    segments: List[VoiceSegment] = Field(default_factory=list)
    message: Optional[str] = None

class VoiceprintEnrollResponse(BaseModel):
    status: str = "SUCCESS"
    embedding: List[float]
    duration_seconds: float
    sample_rate: int
    embedding_dimension: int
    message: str = "Voiceprint enrolled successfully."

class SpeakerTurn(BaseModel):
    turn_index: int = 0
    speaker_label: str = "SPEAKER_00"  # "SPEAKER_00", "SPEAKER_01"
    role: str = "unknown"             # "doctor", "patient", "attendant", "nurse", "unknown"
    role_confidence: float = 1.0
    is_doctor_verified: bool = False
    start_sec: float = 0.0
    end_sec: float = 0.0
    text: str = ""

class PrescriptionItemParsed(BaseModel):
    medicine_name: str
    medicine_id: Optional[int] = None
    matched_catalog_name: Optional[str] = None
    dose_morning: int = 1
    dose_afternoon: int = 0
    dose_night: int = 1
    duration_days: int = 5
    food_instruction: str = "after_food"  # after_food, before_food, with_food, as_needed
    notes: Optional[str] = None

class ConsultationParseRequest(BaseModel):
    transcript: str
    language_hint: Optional[str] = "multilingual" # tamil, english, multilingual
    consultation_type: Optional[str] = "opd" # opd, ipd, discharge
    existing_complaints: Optional[str] = None
    existing_diagnosis: Optional[str] = None
    # Patient Context Anchor
    patient_name: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    # Doctor Voiceprint & Metadata
    doctor_name: Optional[str] = None
    doctor_voiceprint: Optional[List[float]] = None
    dialogue_turns: Optional[List[SpeakerTurn]] = None

class ConsultationParseResponse(BaseModel):
    status: str = "SUCCESS"
    chief_complaints: str = ""
    diagnosis: str = ""
    clinical_notes: str = ""
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    temperature: Optional[float] = None
    pulse: Optional[int] = None
    spo2: Optional[int] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    blood_sugar: Optional[float] = None
    prescriptions: List[PrescriptionItemParsed] = Field(default_factory=list)
    doctor_advice: Optional[str] = None
    follow_up_days: Optional[int] = None
    follow_up_date: Optional[str] = None
    # Multi-speaker attribution results
    doctor_verified: bool = False
    detected_speakers: List[str] = Field(default_factory=list)
    dialogue_turns: List[SpeakerTurn] = Field(default_factory=list)
    raw_dialogue_summary: Optional[str] = None
    message: Optional[str] = "Clinical dialogue parsed successfully."
