import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../util/api';
import DoctorVoiceEnrollModal from './DoctorVoiceEnrollModal';

export default function AmbientScribeWidget({ appointment, user, onApplyData }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [language, setLanguage] = useState('auto'); // 'auto', 'ta', 'en'
  const [parsedResult, setParsedResult] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Doctor Voiceprint Enrollment State
  const [isVoiceEnrolled, setIsVoiceEnrolled] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [checkingVoiceStatus, setCheckingVoiceStatus] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const doctorId = appointment?.doctor_id || user?.employee_id || user?.id;
  const doctorName = appointment?.doctor_name || user?.name || 'Physician';

  // Check doctor voiceprint status
  const checkDoctorVoiceStatus = async () => {
    if (!doctorId) return;
    try {
      setCheckingVoiceStatus(true);
      const res = await apiFetch(`/consultation/voice/doctor-voiceprint/${doctorId}`);
      if (res?.enrolled || res?.data?.enrolled) {
        setIsVoiceEnrolled(true);
      } else {
        setIsVoiceEnrolled(false);
      }
    } catch {
      setIsVoiceEnrolled(false);
    } finally {
      setCheckingVoiceStatus(false);
    }
  };

  useEffect(() => {
    checkDoctorVoiceStatus();
  }, [doctorId]);

  // Timer tick
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording, isPaused]);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      setErrorMsg('');
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setErrorMsg('Microphone access was denied. Please allow microphone permissions.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  const finishRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      setRecordingSeconds(0);
      audioChunksRef.current = [];
    }
  };

  const processAudio = async (audioBlob) => {
    try {
      setIsProcessing(true);
      setErrorMsg('');

      const formData = new FormData();
      formData.append('file', audioBlob, 'consultation.webm');
      if (language && language !== 'auto') {
        formData.append('language', language);
      }
      formData.append('consultation_type', 'opd');

      // Multi-speaker and patient context parameters
      if (appointment?.id) formData.append('appointmentId', String(appointment.id));
      if (doctorId) formData.append('doctorId', String(doctorId));
      if (appointment?.patient_name) formData.append('patientName', appointment.patient_name);
      if (appointment?.age_years) formData.append('patientAge', String(appointment.age_years));
      if (appointment?.gender) formData.append('patientGender', appointment.gender);
      if (doctorName) formData.append('doctorName', doctorName);

      const data = await apiFetch('/consultation/voice/ambient-scribe', {
        method: 'POST',
        body: formData,
      });

      if (data) {
        setParsedResult(data);
        setShowReviewModal(true);
      } else {
        setErrorMsg('Failed to extract consultation entities from speech.');
      }
    } catch (err) {
      console.error('Ambient scribe failed:', err);
      setErrorMsg(err?.message || 'AI Ambient Scribe processing failed. Please check AI Service.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (parsedResult && onApplyData) {
      onApplyData(parsedResult);
      setShowReviewModal(false);
      setParsedResult(null);
    }
  };

  const getRoleBadge = (role, isVerified) => {
    const r = (role || '').toLowerCase();
    if (r === 'doctor') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
          <span>Doctor</span>
          {isVerified && <span className="text-[9px] text-blue-600 dark:text-blue-400 font-extrabold">✓ Voice Verified</span>}
        </span>
      );
    }
    if (r === 'patient') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          <span>Patient</span>
        </span>
      );
    }
    if (r === 'attendant') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
          <span>Attendant (Family)</span>
        </span>
      );
    }
    if (r === 'nurse') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
          <span>Nurse / Staff</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        Speaker
      </span>
    );
  };

  return (
    <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/80 dark:from-slate-800/80 dark:via-slate-850 dark:to-slate-800/80 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-4 shadow-sm mb-5 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Info & Title */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl shadow-xs transition-all ${
            isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-indigo-600 text-white'
          }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 116 0v7.5a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                Ambient Consultation Scribe
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold uppercase tracking-wider">
                  Tamil + English AI
                </span>
              </h3>

              {/* Doctor Voice Verification Status Pill */}
              {isVoiceEnrolled ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800" title="Doctor acoustic voiceprint verified">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Dr. {doctorName} (Voice Verified)</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEnrollModal(true)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-200 transition-colors cursor-pointer"
                  title="Click to enroll 15s voiceprint to differentiate doctor from patient & relatives"
                >
                  <span>+ Enroll Doctor Voiceprint (15s)</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {isRecording
                ? `Recording room dialogue (${formatTime(recordingSeconds)})... Differentiating Doctor, Patient, Relative & Nurse.`
                : 'Listen to room dialogue, auto-extract symptoms, vitals, diagnosis, and prescription rows.'}
            </p>
          </div>
        </div>

        {/* Right: Controls & Language */}
        <div className="flex items-center gap-2">
          {!isRecording && !isProcessing && (
            <div className="flex items-center gap-2">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-pointer shadow-2xs"
              >
                <option value="auto">🌐 Multilingual (Tamil + English)</option>
                <option value="ta">🇮🇳 Tamil (தமிழ்)</option>
                <option value="en">🇬🇧 English</option>
              </select>

              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-sm transition-all cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                Start Ambient Scribe
              </button>
            </div>
          )}

          {isRecording && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-200 dark:border-rose-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                {formatTime(recordingSeconds)}
              </span>

              {isPaused ? (
                <button
                  type="button"
                  onClick={resumeRecording}
                  className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer"
                >
                  ▶️ Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseRecording}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
                >
                  ⏸️ Pause
                </button>
              )}

              <button
                type="button"
                onClick={finishRecording}
                className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>✓</span> Finish &amp; Generate Rx
              </button>

              <button
                type="button"
                onClick={cancelRecording}
                className="px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                title="Cancel &amp; Discard Audio"
              >
                ✕
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>AI Disentangling Speakers &amp; Parsing Dialogue...</span>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mt-3 text-xs font-semibold px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-rose-500 hover:text-rose-700 cursor-pointer font-bold">✕</button>
        </div>
      )}

      {/* Voice Enrollment Modal */}
      {showEnrollModal && (
        <DoctorVoiceEnrollModal
          doctorId={doctorId}
          doctorName={doctorName}
          onClose={() => setShowEnrollModal(false)}
          onEnrolled={() => {
            setIsVoiceEnrolled(true);
            setShowEnrollModal(false);
          }}
        />
      )}

      {/* Review & Edit Modal */}
      {showReviewModal && parsedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Review Extracted Clinical Consultation
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Patient: {appointment?.patient_name || 'Patient'} • Attending: Dr. {doctorName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Multi-Speaker Dialogue Timeline Card */}
              {parsedResult.dialogue_turns?.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                      Multi-Speaker Dialogue Turns ({parsedResult.dialogue_turns.length})
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Differentiated via Acoustic Voiceprint &amp; Language Cues
                    </span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedResult.dialogue_turns.map((turn, idx) => (
                      <div key={idx} className="pt-2 first:pt-0 flex items-start gap-2.5">
                        <div className="shrink-0 mt-0.5">
                          {getRoleBadge(turn.role, turn.is_doctor_verified)}
                        </div>
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed flex-1">
                          "{turn.text}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Clinical Entities: Complaints & Diagnosis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Chief Complaints (Patient / Attendant)
                  </label>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {parsedResult.chief_complaints || '—'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 space-y-1">
                  <label className="text-[10px] font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider block">
                    Provisional Diagnosis (Doctor Confirmed)
                  </label>
                  <p className="font-bold text-indigo-700 dark:text-indigo-400">
                    {parsedResult.diagnosis || '—'}
                  </p>
                </div>
              </div>

              {/* Vitals */}
              {(parsedResult.bp_systolic || parsedResult.pulse || parsedResult.temperature || parsedResult.spo2 || parsedResult.blood_sugar) && (
                <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60">
                  <label className="text-[11px] font-bold text-blue-950 dark:text-blue-300 uppercase tracking-wider block mb-1.5">
                    Spoken Vitals Detected (Nurse / Doctor)
                  </label>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {parsedResult.bp_systolic && (
                      <span>BP: <strong className="text-blue-700">{parsedResult.bp_systolic}/{parsedResult.bp_diastolic || '—'}</strong> mmHg</span>
                    )}
                    {parsedResult.pulse && (
                      <span>Pulse: <strong className="text-blue-700">{parsedResult.pulse}</strong> bpm</span>
                    )}
                    {parsedResult.temperature && (
                      <span>Temp: <strong className="text-blue-700">{parsedResult.temperature}</strong> °F</span>
                    )}
                    {parsedResult.spo2 && (
                      <span>SpO2: <strong className="text-blue-700">{parsedResult.spo2}%</strong></span>
                    )}
                    {parsedResult.blood_sugar && (
                      <span>Blood Sugar: <strong className="text-blue-700">{parsedResult.blood_sugar}</strong> mg/dL</span>
                    )}
                  </div>
                </div>
              )}

              {/* Prescriptions Table (Doctor Only) */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Prescription Items ({parsedResult.prescriptions?.length || 0})
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✓ Authoritative Doctor Orders Only
                  </span>
                </div>
                {parsedResult.prescriptions?.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                        <tr>
                          <th className="p-2">Medicine</th>
                          <th className="p-2 text-center">Dosage (M-A-N)</th>
                          <th className="p-2 text-center">Timing</th>
                          <th className="p-2 text-center">Days</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {parsedResult.prescriptions.map((p, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-bold text-slate-900 dark:text-white">{p.medicine_name}</td>
                            <td className="p-2 text-center font-mono font-bold text-indigo-600">
                              {p.dose_morning}-{p.dose_afternoon}-{p.dose_night}
                            </td>
                            <td className="p-2 text-center capitalize">{p.food_instruction?.replace('_', ' ')}</td>
                            <td className="p-2 text-center font-semibold">{p.duration_days} d</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 italic">No prescription items mentioned in dialogue.</p>
                )}
              </div>

              {/* Doctor Advice / Notes */}
              {(parsedResult.doctor_advice || parsedResult.clinical_notes) && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Doctor Advice &amp; Examination Notes
                  </label>
                  <p className="text-slate-800 dark:text-slate-200">
                    {parsedResult.doctor_advice || parsedResult.clinical_notes}
                  </p>
                </div>
              )}

              {/* Raw Transcript */}
              {parsedResult.raw_dialogue_summary && (
                <div className="p-2.5 rounded-lg bg-slate-100/70 dark:bg-slate-800/20 text-[10px] text-slate-500 space-y-1">
                  <span className="font-bold uppercase tracking-wider block">Raw Spoken Dialogue Transcript:</span>
                  <p className="italic">"{parsedResult.raw_dialogue_summary}"</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
              >
                <span>✓</span> Apply to Consultation Form
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
