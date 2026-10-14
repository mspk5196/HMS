import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../util/api';

export default function DoctorVoiceEnrollModal({ doctorId, doctorName, onClose, onEnrolled }) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev >= 15) {
            stopRecording();
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const startRecording = async () => {
    try {
      setErrorMsg('');
      setAudioBlob(null);
      setAudioUrl('');
      setSeconds(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
      setErrorMsg('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSave = async () => {
    if (!audioBlob) return;
    try {
      setIsUploading(true);
      setErrorMsg('');

      // If doctorId is provided (e.g. editing existing employee), upload immediately
      if (doctorId) {
        const formData = new FormData();
        formData.append('file', audioBlob, 'doctor_voice_sample.webm');
        formData.append('doctorId', String(doctorId));

        const res = await apiFetch('/consultation/voice/doctor-voiceprint', {
          method: 'POST',
          body: formData,
        });

        setSuccessMsg('Doctor voiceprint enrolled successfully!');
        if (onEnrolled) {
          onEnrolled(res?.data || res);
        }
        setTimeout(() => {
          if (onClose) onClose();
        }, 1500);
      } else {
        // Deferred mode (e.g. adding new doctor employee): pass audioBlob back to form
        setSuccessMsg('Voice sample captured successfully! Will be saved upon creating employee.');
        if (onEnrolled) {
          onEnrolled({ audioBlob, durationSeconds: seconds, sampleUrl: audioUrl });
        }
        setTimeout(() => {
          if (onClose) onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Enrollment error:', err);
      setErrorMsg(err?.message || 'Failed to enroll doctor voiceprint. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 116 0v7.5a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Doctor Voice Profile Enrollment</h3>
              <p className="text-[11px] text-blue-200/80">Dr. {doctorName || 'Attending Physician'} • 15s One-Time Setup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs text-slate-700 dark:text-slate-300">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Guided Prompt Script */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2">
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
              Read Aloud During Recording:
            </span>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-relaxed italic">
              "வணக்கம், நான் டாக்டர் {doctorName || 'அவர்கள்'}. நேகா மருத்துவமனையில் நோயாளிகளுக்கு மருத்துவம் அளித்து மருந்துகளை பரிந்துரைக்கிறேன்."
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
              "Hello, I am Dr. {doctorName || 'Physician'}. I examine symptoms, record vitals, and prescribe medications for patients at Neha Hospitals."
            </p>
          </div>

          {/* Recording Status & Waveform Simulation */}
          <div className="flex flex-col items-center justify-center py-3 space-y-3">
            <div className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              00:{String(seconds).padStart(2, '0')} <span className="text-xs text-slate-400 font-normal">/ 00:15</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-300"
                style={{ width: `${(seconds / 15) * 100}%` }}
              />
            </div>

            {isRecording ? (
              <div className="flex items-center gap-2 text-rose-600 font-semibold animate-pulse text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                <span>Recording in progress... speak clearly into microphone</span>
              </div>
            ) : audioBlob ? (
              <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span>Voice sample captured ({seconds}s). Ready to enroll.</span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">Click button below to start 15-second enrollment.</p>
            )}

            {/* Audio Preview if recorded */}
            {audioUrl && !isRecording && (
              <div className="w-full pt-2">
                <audio controls src={audioUrl} className="w-full h-8" />
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 116 0v7.5a3 3 0 01-3 3z" />
                </svg>
                <span>{audioBlob ? 'Re-record Sample' : 'Record Voice (15s)'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Stop Recording</span>
              </button>
            )}

            {audioBlob && !isRecording && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isUploading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUploading ? 'Extracting Vector...' : 'Save & Verify Voiceprint'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
