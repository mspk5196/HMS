import React, { useState, useRef } from 'react';
import { apiFetch } from '../util/api';

export default function FieldDictationButton({ onTranscribed, language = 'auto', prompt = '' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const toggleRecording = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
      return;
    }

    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleTranscribe(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
      alert('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const handleTranscribe = async (audioBlob) => {
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('file', audioBlob, 'dictation.webm');
      if (language && language !== 'auto') {
        formData.append('language', language);
      }
      if (prompt) {
        formData.append('prompt', prompt);
      }

      const res = await apiFetch('/consultation/voice/transcribe', {
        method: 'POST',
        body: formData
      });

      const text = res?.transcript || res?.data?.transcript || '';
      if (text && onTranscribed) {
        onTranscribed(text);
      }
    } catch (err) {
      console.error('Dictation transcription failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleRecording}
      disabled={isProcessing}
      title={isRecording ? 'Click to stop dictation' : 'Click to dictate with voice (Tamil/English)'}
      className={`p-1.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer ${
        isRecording
          ? 'bg-rose-500 text-white animate-pulse ring-2 ring-rose-400'
          : isProcessing
          ? 'bg-indigo-50 text-indigo-400 cursor-wait'
          : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-slate-700'
      }`}
    >
      {isProcessing ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : isRecording ? (
        <>
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span className="text-[10px]">Listening...</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15a3 3 0 01-3-3V4.5a3 3 0 116 0v7.5a3 3 0 01-3 3z" />
          </svg>
          <span className="text-[10px] hidden sm:inline">Voice</span>
        </>
      )}
    </button>
  );
}
