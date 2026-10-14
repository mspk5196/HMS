import sys
import os
import wave
import struct
import math

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.voice_schema import ConsultationParseRequest
from app.services.dialogue_parser import parse_clinical_dialogue, extract_vitals_deterministic
from app.services.stt_engine import get_stt_engine

def create_synthetic_wav(filename="test_tone.wav", duration_s=1.0, freq=440.0):
    """Generates a small valid WAV file for testing Whisper audio decoding."""
    sample_rate = 16000
    num_samples = int(sample_rate * duration_s)
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1) # mono
        wav_file.setsampwidth(2) # 16-bit
        wav_file.setframerate(sample_rate)
        for i in range(num_samples):
            value = int(32767.0 * 0.1 * math.sin(2.0 * math.pi * freq * (i / sample_rate)))
            data = struct.pack('<h', value)
            wav_file.writeframesraw(data)
    with open(filename, 'rb') as f:
        bytes_data = f.read()
    if os.path.exists(filename):
        os.remove(filename)
    return bytes_data

def run_tests():
    print("=================================================================")
    print("TEST 1: Deterministic Vitals Extraction")
    print("=================================================================")
    sample_text = "Patient checked. BP is 130/85 mmHg, pulse was 76, temp 99.4 F, SpO2 98 percent."
    vitals = extract_vitals_deterministic(sample_text)
    print("Extracted Vitals:", vitals)
    assert vitals.get("bp_systolic") == 130
    assert vitals.get("bp_diastolic") == 85
    assert vitals.get("pulse") == 76
    assert vitals.get("temperature") == 99.4
    assert vitals.get("spo2") == 98
    print(">>> TEST 1 PASSED!\n")

    print("=================================================================")
    print("TEST 2: Bilingual Tamil + English Dialogue Scribe Parsing")
    print("=================================================================")
    tamil_tanglish_transcript = (
        "Doctor: வணக்கம், என்ன ஆச்சு?\n"
        "Patient: ரெண்டு நாளா பயங்கர காய்ச்சல் டாக்டர், தொண்டை வலிக்குது, இருமலும் இருக்கு.\n"
        "Doctor: சரி, நாக்கு காட்டுங்க... தொண்டையில infection இருக்கு. BP செக் பண்றேன்... BP 120/80 normal. Pulse 78. "
        "Acute Pharyngitis and Viral Fever.\n"
        "இந்த மாத்திரை சாப்பிடுங்க: Tab Augmentin 625mg காலைல ஒன்னு ராத்திரி ஒன்னு சாப்பிட்ட அப்புறம் 5 நாள். "
        "Tab Dolo 650 காய்ச்சல் வரும்போது 1-1-1 சாப்பிடுங்க 3 நாள். வெந்நீர் குடிங்க, 5 நாள் கழிச்சு வாங்க."
    )
    req = ConsultationParseRequest(
        transcript=tamil_tanglish_transcript,
        language_hint="multilingual",
        consultation_type="opd"
    )
    res = parse_clinical_dialogue(req)
    print("Complaints:", res.chief_complaints)
    print("Diagnosis:", res.diagnosis)
    print("BP:", f"{res.bp_systolic}/{res.bp_diastolic}", "Pulse:", res.pulse)
    print("Prescriptions count:", len(res.prescriptions))
    for rx in res.prescriptions:
        print(f"  - {rx.medicine_name}: {rx.dose_morning}-{rx.dose_afternoon}-{rx.dose_night} ({rx.food_instruction}) x {rx.duration_days} days")
    
    assert res.bp_systolic == 120
    assert res.bp_diastolic == 80
    assert len(res.prescriptions) >= 1
    print(">>> TEST 2 PASSED!\n")

    print("=================================================================")
    print("TEST 3: Whisper Model Initialization & Audio Transcribe Pipeline")
    print("=================================================================")
    audio_bytes = create_synthetic_wav()
    engine = get_stt_engine()
    stt_res = engine.transcribe(audio_bytes, filename="test.wav", task="transcribe")
    print(f"STT Response Status: {stt_res.status}, Duration: {stt_res.duration_seconds}s")
    print(">>> TEST 3 PASSED!\n")

if __name__ == "__main__":
    run_tests()
