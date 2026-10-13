"""
stt_engine.py
High-Performance Local Multilingual Speech-to-Text Engine for Neha Hospitals.
Powered by faster-whisper (CTranslate2) with GPU/CPU auto-detection and Tamil + English support.
"""

import os
import sys
import tempfile
import time
import logging
from typing import Tuple, List, Optional
from faster_whisper import WhisperModel
from app.models.voice_schema import VoiceSegment, TranscribeResponse
from app.core.config import settings

logger = logging.getLogger(__name__)

# Medical vocabulary conditioning prompt in Tamil + English
CLINICAL_INITIAL_PROMPT = (
    "Doctor-patient medical consultation in Tamil and English: "
    "chief complaints, fever, cough, headache, chest pain, breathlessness, nausea, vomiting, "
    "BP 120/80, pulse, temperature, SpO2, blood sugar, "
    "Tab Augmentin 625mg, Tab Dolo 650, Cap Pan-D, Tab Azithral 500mg, Syr Ascoril, "
    "morning, afternoon, night, 1-0-1, 1-1-1, 1-0-0, after food, before food, "
    "ரத்த அழுத்தம், காய்ச்சல், இருமல், தலைவலி, நெஞ்சு வலி, மூச்சுத்திணறல், மாத்திரை, மருந்துகள்."
)

class WhisperEngine:
    _instance: Optional["WhisperEngine"] = None
    _model: Optional[WhisperModel] = None

    def __init__(self, model_size: Optional[str] = None):
        self.model_size = model_size or settings.WHISPER_MODEL_SIZE
        self._initialize_model()

    @classmethod
    def get_instance(cls, model_size: Optional[str] = None) -> "WhisperEngine":
        if cls._instance is None:
            cls._instance = cls(model_size=model_size)
        return cls._instance

    def _initialize_model(self):
        try:
            import torch
            has_cuda = torch.cuda.is_available()
        except ImportError:
            has_cuda = False

        if settings.WHISPER_DEVICE == "cuda":
            device = "cuda"
        elif settings.WHISPER_DEVICE == "cpu":
            device = "cpu"
        else:
            device = "cuda" if has_cuda else "cpu"

        if settings.WHISPER_COMPUTE_TYPE in ("float16", "int8", "default"):
            compute_type = settings.WHISPER_COMPUTE_TYPE
        else:
            compute_type = "float16" if (device == "cuda" and has_cuda) else "int8"

        cache_dir = os.path.abspath(settings.WHISPER_CACHE_DIR)
        os.makedirs(cache_dir, exist_ok=True)

        print(f"[WhisperEngine] Loading faster-whisper '{self.model_size}' model on {device.upper()} ({compute_type})...")
        start_t = time.time()
        
        self._model = WhisperModel(
            self.model_size,
            device=device,
            compute_type=compute_type,
            download_root=cache_dir
        )
        print(f"[WhisperEngine] Model loaded successfully in {round(time.time() - start_t, 2)}s.")

    def transcribe(
        self,
        audio_data: bytes,
        filename: str = "audio.webm",
        language: Optional[str] = None,
        task: str = "transcribe",
        prompt: Optional[str] = None
    ) -> TranscribeResponse:
        """
        Transcribes audio bytes to text.
        Supports Tamil ('ta'), English ('en'), or auto-detection.
        task can be 'transcribe' or 'translate' (translates spoken audio directly into English).
        """
        if self._model is None:
            self._initialize_model()

        # Write to temporary file for PyAV decoding
        suffix = os.path.splitext(filename)[1] if filename else ".webm"
        if not suffix:
            suffix = ".webm"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_file.write(audio_data)
            tmp_path = tmp_file.name

        try:
            start_t = time.time()
            initial_prompt = prompt or CLINICAL_INITIAL_PROMPT

            # Run transcription with beam search
            segments_gen, info = self._model.transcribe(
                tmp_path,
                beam_size=5,
                language=language,
                task=task,
                initial_prompt=initial_prompt,
                vad_filter=True, # Voice Activity Detection filters background silence
                vad_parameters=dict(min_silence_duration_ms=500)
            )

            segments_list: List[VoiceSegment] = []
            full_text_parts: List[str] = []

            for seg in segments_gen:
                clean_text = seg.text.strip()
                if clean_text:
                    segments_list.append(VoiceSegment(
                        start=round(seg.start, 2),
                        end=round(seg.end, 2),
                        text=clean_text
                    ))
                    full_text_parts.append(clean_text)

            duration = round(time.time() - start_t, 2)
            full_transcript = " ".join(full_text_parts).strip()

            return TranscribeResponse(
                status="SUCCESS",
                transcript=full_transcript,
                language=info.language or "unknown",
                language_probability=round(info.language_probability, 3),
                duration_seconds=duration,
                segments=segments_list,
                message=f"Transcribed successfully in {duration}s."
            )

        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

def get_stt_engine() -> WhisperEngine:
    return WhisperEngine.get_instance()
