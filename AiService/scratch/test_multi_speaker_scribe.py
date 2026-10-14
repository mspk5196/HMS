import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import json
from app.models.voice_schema import ConsultationParseRequest, SpeakerTurn
from app.services.dialogue_parser import parse_clinical_dialogue

def test_multi_speaker_consultation():
    sample_dialogue = """
Doctor: "வாங்க, உட்காருங்க. என்ன பண்ணுது பாப்பாக்கு?"
Attendant: "தம்பிக்கு ரெண்டு நாளா கடுமையான காய்ச்சல் டாக்டர். சாப்பாடே சாப்பிட மாட்டேங்கிறான்."
Patient: "தொண்டை வலிக்குது டாக்டர், முழுங்க முடியல."
Nurse: "Doctor, Temperature 101.5°F, Pulse 88, SpO2 99%."
Doctor: "சரிங்கம்மா, தொண்டையில acute pharyngitis infection இருக்கு. Tab Paracetamol 250mg காலை இரவு 3 நாள் குடுங்க, Syr Amoxclav 5ml காலை இரவு சாப்பிட்ட பிறகு 5 நாள் எடுத்துக்கோங்க."
Attendant: "பக்கத்து வீட்டுல இந்த மருந்து வேணாம்னு சொன்னாங்க டாக்டர், குடுக்கலாமா?"
Doctor: "இல்லம்மா, இது கட்டாயம் குடுக்கணும். வேற மாத்திரை எதுவும் குடுக்காதீங்க."
"""

    turns = [
        SpeakerTurn(turn_index=0, speaker_label="SPEAKER_00", is_doctor_verified=True, text="வாங்க, உட்காருங்க. என்ன பண்ணுது பாப்பாக்கு?"),
        SpeakerTurn(turn_index=1, speaker_label="SPEAKER_01", text="தம்பிக்கு ரெண்டு நாளா கடுமையான காய்ச்சல் டாக்டர். சாப்பாடே சாப்பிட மாட்டேங்கிறான்."),
        SpeakerTurn(turn_index=2, speaker_label="SPEAKER_02", text="தொண்டை வலிக்குது டாக்டர், முழுங்க முடியல."),
        SpeakerTurn(turn_index=3, speaker_label="SPEAKER_03", text="Doctor, Temperature 101.5°F, Pulse 88, SpO2 99%."),
        SpeakerTurn(turn_index=4, speaker_label="SPEAKER_00", is_doctor_verified=True, text="சரிங்கம்மா, தொண்டையில acute pharyngitis infection இருக்கு. Tab Paracetamol 250mg காலை இரவு 3 நாள் குடுங்க, Syr Amoxclav 5ml காலை இரவு சாப்பிட்ட பிறகு 5 நாள் எடுத்துக்கோங்க."),
        SpeakerTurn(turn_index=5, speaker_label="SPEAKER_01", text="பக்கத்து வீட்டுல இந்த மருந்து வேணாம்னு சொன்னாங்க டாக்டர், குடுக்கலாமா?"),
        SpeakerTurn(turn_index=6, speaker_label="SPEAKER_00", is_doctor_verified=True, text="இல்லம்மா, இது கட்டாயம் குடுக்கணும். வேற மாத்திரை எதுவும் குடுக்காதீங்க.")
    ]

    req = ConsultationParseRequest(
        transcript=sample_dialogue,
        patient_name="Baby Kavin",
        patient_age=4,
        patient_gender="Male",
        doctor_name="Premkumar",
        doctor_voiceprint=[0.1] * 240,
        dialogue_turns=turns
    )

    result = parse_clinical_dialogue(req)
    print("=== MULTI-SPEAKER CONSULTATION PARSE RESULT ===")
    print("Status:", result.status)
    print("Doctor Verified:", result.doctor_verified)
    print("Detected Speakers:", result.detected_speakers)
    print("Chief Complaints:", result.chief_complaints)
    print("Diagnosis:", result.diagnosis)
    print("Vitals:", f"Temp: {result.temperature}, Pulse: {result.pulse}, SpO2: {result.spo2}")
    print("Prescriptions Count:", len(result.prescriptions))
    for p in result.prescriptions:
        print(f" - {p.medicine_name} (M{p.dose_morning}/A{p.dose_afternoon}/N{p.dose_night}) x {p.duration_days}d [{p.food_instruction}]")
    print("Dialogue Turns Count:", len(result.dialogue_turns))
    for t in result.dialogue_turns:
        print(f" [{t.role.upper()}]: {t.text[:40]}...")

    assert len(result.prescriptions) >= 1
    assert result.temperature is not None
    print("\nAll Multi-Speaker Verification Tests Passed!")

if __name__ == "__main__":
    test_multi_speaker_consultation()
