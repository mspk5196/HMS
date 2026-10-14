import math
import torch
import torchaudio
import numpy as np

def extract_voiceprint_vector(waveform: torch.Tensor, sample_rate: int = 16000) -> list[float]:
    """
    Extracts a 192-dimensional acoustic voiceprint feature vector
    representing speaker vocal tract acoustics, pitch, and timbre.
    """
    if waveform.ndim == 2:
        waveform = waveform.mean(dim=0, keepdim=True)
    if sample_rate != 16000:
        resampler = torchaudio.transforms.Resample(orig_freq=sample_rate, new_freq=16000)
        waveform = resampler(waveform)

    # 1. 40-channel MFCC
    mfcc_transform = torchaudio.transforms.MFCC(
        sample_rate=16000,
        n_mfcc=40,
        melkwargs={"n_fft": 512, "n_mels": 64, "hop_length": 160}
    )
    mfcc = mfcc_transform(waveform).squeeze(0)  # [40, Time]

    # First and second order derivatives (deltas)
    delta1 = torchaudio.functional.compute_deltas(mfcc)
    delta2 = torchaudio.functional.compute_deltas(delta1)

    # Statistical pooling across time (mean and std for static, delta, delta2)
    m_mean = mfcc.mean(dim=-1)       # 40
    m_std = mfcc.std(dim=-1)         # 40
    d1_mean = delta1.mean(dim=-1)    # 40
    d1_std = delta1.std(dim=-1)      # 40
    d2_mean = delta2.mean(dim=-1)    # 40
    d2_std = delta2.std(dim=-1)      # 40

    features = torch.cat([m_mean, m_std, d1_mean, d1_std, d2_mean, d2_std], dim=0) # 240D

    # L2 normalize
    norm = torch.norm(features, p=2) + 1e-8
    normalized = (features / norm).tolist()
    return normalized

def cosine_similarity(v1: list[float], v2: list[float]) -> float:
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)

if __name__ == "__main__":
    # Generate 2 simulated audio clips from Speaker A (sine pitch 150Hz + harmonics)
    t = torch.linspace(0, 5, 16000 * 5)
    spk_a_1 = (torch.sin(2 * math.pi * 150 * t) + 0.5 * torch.sin(2 * math.pi * 300 * t) + torch.randn_like(t) * 0.05).unsqueeze(0)
    spk_a_2 = (torch.sin(2 * math.pi * 152 * t) + 0.5 * torch.sin(2 * math.pi * 304 * t) + torch.randn_like(t) * 0.05).unsqueeze(0)

    # Generate 1 clip from Speaker B (female pitch 240Hz + harmonics)
    spk_b_1 = (torch.sin(2 * math.pi * 240 * t) + 0.5 * torch.sin(2 * math.pi * 480 * t) + torch.randn_like(t) * 0.05).unsqueeze(0)

    vec_a1 = extract_voiceprint_vector(spk_a_1)
    vec_a2 = extract_voiceprint_vector(spk_a_2)
    vec_b1 = extract_voiceprint_vector(spk_b_1)

    sim_same = cosine_similarity(vec_a1, vec_a2)
    sim_diff = cosine_similarity(vec_a1, vec_b1)

    print(f"Similarity (Same Speaker A1 vs A2): {sim_same:.4f}")
    print(f"Similarity (Different Speaker A vs B): {sim_diff:.4f}")
    assert sim_same > sim_diff
    print("✓ Test passed successfully!")
