import json
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from typing import Optional, List
import logging

from app.models.voice_schema import (
    TranscribeResponse,
    ConsultationParseRequest,
    ConsultationParseResponse,
    VoiceprintEnrollResponse,
    SpeakerTurn
)
from app.services.stt_engine import get_stt_engine
from app.services.dialogue_parser import parse_clinical_dialogue
from app.services.voiceprint_engine import VoiceprintEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Clinical Voice AI"])

@router.post("/enroll-voiceprint", response_model=VoiceprintEnrollResponse)
async def enroll_voiceprint(
    file: UploadFile = File(...)
):
    """
    Enrolls a Doctor Voiceprint:
    Accepts 10-15s audio clip, extracts 240D acoustic feature vector,
    and returns the normalized vector to be saved in hospital database.
    """
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Audio file is empty.")

        engine = VoiceprintEngine.get_instance()
        data = engine.extract_voiceprint(audio_bytes)
        return VoiceprintEnrollResponse(
            status="SUCCESS",
            embedding=data["embedding"],
            duration_seconds=data["duration_seconds"],
            sample_rate=data["sample_rate"],
            embedding_dimension=data["embedding_dimension"],
            message="Doctor voiceprint profile extracted successfully."
        )
    except Exception as e:
        logger.error(f"[Voice API] Error enrolling voiceprint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Voice enrollment failed: {str(e)}")

@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    task: Optional[str] = Form("transcribe"), # "transcribe" or "translate"
    prompt: Optional[str] = Form(None)
):
    """
    Transcribes uploaded audio (WebM, WAV, MP3, etc.) using local faster-whisper.
    Supports bilingual Tamil ('ta') and English ('en') speech.
    """
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

        engine = get_stt_engine()
        result = engine.transcribe(
            audio_data=audio_bytes,
            filename=file.filename or "audio.webm",
            language=language if language and language != "auto" else None,
            task=task or "transcribe",
            prompt=prompt
        )
        return result
    except Exception as e:
        logger.error(f"[Voice API] Error during transcription: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@router.post("/parse-dialogue", response_model=ConsultationParseResponse)
async def parse_dialogue(request: ConsultationParseRequest):
    """
    Parses a clinical transcript into structured HMS entities:
    Chief Complaints, Clinical Diagnosis, Vitals, and Prescription table rows.
    """
    try:
        return parse_clinical_dialogue(request)
    except Exception as e:
        logger.error(f"[Voice API] Error parsing dialogue: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Dialogue parsing failed: {str(e)}")

@router.post("/ambient-scribe", response_model=ConsultationParseResponse)
async def ambient_scribe(
    file: UploadFile = File(...),
    consultation_type: Optional[str] = Form("opd"),
    language: Optional[str] = Form(None),
    task: Optional[str] = Form("transcribe"),
    doctor_voiceprint: Optional[str] = Form(None), # JSON array of floats
    doctor_name: Optional[str] = Form(None),
    patient_name: Optional[str] = Form(None),
    patient_age: Optional[int] = Form(None),
    patient_gender: Optional[str] = Form(None)
):
    """
    All-in-One Multi-Speaker Ambient Scribe Endpoint:
    1. Transcribes room audio (doctor-patient-attendant-nurse consultation).
    2. Aligns speech turns and verifies Doctor's voiceprint against enrolled profile.
    3. Separates Doctor, Patient, Attendant, and Nurse roles.
    4. Extracts authoritative Prescriptions, Diagnosis, Complaints, and Vitals.
    """
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

        # Decode doctor voiceprint JSON if provided
        parsed_doc_vp: Optional[List[float]] = None
        if doctor_voiceprint:
            try:
                parsed_doc_vp = json.loads(doctor_voiceprint)
                if not isinstance(parsed_doc_vp, list):
                    parsed_doc_vp = None
            except Exception:
                parsed_doc_vp = None

        # 1. Transcribe audio with Whisper
        engine = get_stt_engine()
        stt_result = engine.transcribe(
            audio_data=audio_bytes,
            filename=file.filename or "audio.webm",
            language=language if language and language != "auto" else None,
            task=task or "transcribe"
        )

        # 2. Build preliminary dialogue turns from STT segments
        dialogue_turns: List[SpeakerTurn] = []
        for i, seg in enumerate(stt_result.segments):
            dialogue_turns.append(SpeakerTurn(
                turn_index=i,
                speaker_label=f"SPEAKER_{i:02d}",
                role="unknown",
                role_confidence=1.0,
                is_doctor_verified=False,
                start_sec=seg.start,
                end_sec=seg.end,
                text=seg.text.strip()
            ))

        # 3. Request multi-speaker dialogue parsing with patient & doctor context
        parse_req = ConsultationParseRequest(
            transcript=stt_result.transcript,
            language_hint=stt_result.language,
            consultation_type=consultation_type,
            patient_name=patient_name,
            patient_age=patient_age,
            patient_gender=patient_gender,
            doctor_name=doctor_name,
            doctor_voiceprint=parsed_doc_vp,
            dialogue_turns=dialogue_turns
        )

        consultation_data = parse_clinical_dialogue(parse_req)
        consultation_data.raw_dialogue_summary = stt_result.transcript
        return consultation_data

    except Exception as e:
        logger.error(f"[Voice API] Error in ambient scribe pipeline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ambient scribe failed: {str(e)}")
