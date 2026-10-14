"""
voiceprint_engine.py
Acoustic Speaker Voiceprint Extraction & Cosine Similarity Matching Engine.
Allows one-time enrollment of Doctor Voiceprints and matches consultation speaker clusters
to definitively identify the Doctor with 100% on-premise local execution.
"""
from __future__ import annotations
import math
import io
import os
import logging
from typing import List, Dict, Any, Tuple, Optional
try:
    import torch
    import torchaudio
    HAS_TORCH = True
except ImportError:
    torch = None
    torchaudio = None
    HAS_TORCH = False

import av

logger = logging.getLogger(__name__)

class VoiceprintEngine:
    _instance: Optional["VoiceprintEngine"] = None

    def __init__(self, sample_rate: int = 16000, n_mfcc: int = 40):
        self.sample_rate = sample_rate
        self.n_mfcc = n_mfcc
        if HAS_TORCH and torchaudio:
            self.mfcc_transform = torchaudio.transforms.MFCC(
                sample_rate=self.sample_rate,
                n_mfcc=self.n_mfcc,
                melkwargs={"n_fft": 512, "n_mels": 64, "hop_length": 160}
            )
        else:
            self.mfcc_transform = None
            logger.warning("[VoiceprintEngine] PyTorch/torchaudio not installed. Acoustic voiceprint extraction running in stub mode.")

    @classmethod
    def get_instance(cls) -> "VoiceprintEngine":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def decode_audio_bytes(self, audio_bytes: bytes) -> Tuple[torch.Tensor, float]:
        """
        Decodes any incoming audio container (webm, wav, ogg, mp3) into 16kHz mono torch Tensor.
        Returns (waveform [1, N], duration_seconds).
        """
        container = av.open(io.BytesIO(audio_bytes))
        stream = next(s for s in container.streams if s.type == "audio")
        
        frames = []
        for frame in container.decode(stream):
            # Convert frame to numpy/torch float32
            arr = frame.to_ndarray()
            frames.append(arr)
            
        if not frames:
            raise ValueError("No audio frames decoded from input.")
            
        import numpy as np
        audio_np = np.concatenate(frames, axis=-1)
        if audio_np.dtype != np.float32:
            audio_np = audio_np.astype(np.float32) / 32768.0

        # If stereo, average to mono
        if audio_np.ndim > 1 and audio_np.shape[0] > 1:
            audio_np = np.mean(audio_np, axis=0, keepdims=True)
        elif audio_np.ndim == 1:
            audio_np = audio_np[np.newaxis, :]

        waveform = torch.from_numpy(audio_np)
        original_rate = stream.codec_context.sample_rate

        if original_rate != self.sample_rate:
            resampler = torchaudio.transforms.Resample(orig_freq=original_rate, new_freq=self.sample_rate)
            waveform = resampler(waveform)

        duration = waveform.shape[-1] / float(self.sample_rate)
        return waveform, duration

    def extract_embedding_from_waveform(self, waveform: torch.Tensor) -> List[float]:
        """
        Computes normalized 240-dimensional acoustic feature vector capturing
        vocal tract resonance, formants, pitch variance, and speech dynamics.
        """
        if waveform.ndim == 1:
            waveform = waveform.unsqueeze(0)
        elif waveform.ndim > 2:
            waveform = waveform.squeeze()

        # Compute MFCCs
        mfcc = self.mfcc_transform(waveform)
        if mfcc.ndim == 3:
            mfcc = mfcc.squeeze(0)  # [40, Time]

        # First and second order derivatives (velocity and acceleration of speech)
        delta1 = torchaudio.functional.compute_deltas(mfcc)
        delta2 = torchaudio.functional.compute_deltas(delta1)

        # Statistical temporal pooling: mean and standard deviation
        m_mean = mfcc.mean(dim=-1)
        m_std = mfcc.std(dim=-1)
        d1_mean = delta1.mean(dim=-1)
        d1_std = delta1.std(dim=-1)
        d2_mean = delta2.mean(dim=-1)
        d2_std = delta2.std(dim=-1)

        features = torch.cat([m_mean, m_std, d1_mean, d1_std, d2_mean, d2_std], dim=0)
        norm = torch.norm(features, p=2) + 1e-8
        normalized = (features / norm).tolist()
        return normalized

    def extract_voiceprint(self, audio_bytes: bytes) -> Dict[str, Any]:
        """
        Processes audio bytes and returns embedding vector + audio duration.
        """
        waveform, duration = self.decode_audio_bytes(audio_bytes)
        embedding = self.extract_embedding_from_waveform(waveform)
        return {
            "embedding": embedding,
            "duration_seconds": round(duration, 2),
            "sample_rate": self.sample_rate,
            "embedding_dimension": len(embedding)
        }

    @staticmethod
    def cosine_similarity(v1: List[float], v2: List[float]) -> float:
        if not v1 or not v2 or len(v1) != len(v2):
            return 0.0
        dot = sum(a * b for a, b in zip(v1, v2))
        norm1 = math.sqrt(sum(a * a for a in v1))
        norm2 = math.sqrt(sum(b * b for b in v2))
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(dot / (norm1 * norm2))

    def match_doctor(
        self,
        target_embedding: List[float],
        enrolled_doctor_embedding: Optional[List[float]],
        threshold: float = 0.72
    ) -> Tuple[bool, float]:
        """
        Checks whether target embedding matches enrolled doctor voiceprint.
        Returns (is_match, similarity_score).
        """
        if not enrolled_doctor_embedding:
            return False, 0.0
        score = self.cosine_similarity(target_embedding, enrolled_doctor_embedding)
        return (score >= threshold), round(score, 4)
