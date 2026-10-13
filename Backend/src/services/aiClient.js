const http = require('http');
const https = require('https');
const { AppError } = require('../utils/errors');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const AI_INTERNAL_KEY = process.env.AI_INTERNAL_KEY || 'neha-ai-internal-key-2026';

/**
 * Generic JSON requester for standalone AiService
 */
const requestAiService = async (endpoint, options = {}) => {
  const url = new URL(`${AI_SERVICE_URL}${endpoint}`);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  const method = options.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    'X-Internal-Key': AI_INTERNAL_KEY,
    ...(options.headers || {})
  };

  const body = options.body ? JSON.stringify(options.body) : null;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers,
        timeout: 45000 // 45s timeout
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = rawData ? JSON.parse(rawData) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(
                new AppError(
                  parsed.detail || parsed.message || `AI Service returned HTTP ${res.statusCode}`,
                  res.statusCode || 500
                )
              );
            }
          } catch (err) {
            reject(new AppError(`Failed to parse AI service response: ${err.message}`, 502));
          }
        });
      }
    );

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        reject(
          new AppError(
            'Standalone AI Service is offline or unreachable on ' + AI_SERVICE_URL + '. Please start the AI microservice.',
            503
          )
        );
      } else {
        reject(new AppError(`AI Service connection error: ${err.message}`, 502));
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new AppError('AI Service request timed out after 45 seconds', 504));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
};

const healthCheck = async () => {
  return requestAiService('/api/v1/health');
};

const solveRoster = async (payload) => {
  return requestAiService('/api/v1/roster/solve', {
    method: 'POST',
    body: payload
  });
};

const transcribeAudio = async (fileBuffer, fileName, { language, task, prompt } = {}) => {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'audio/webm' });
  formData.append('file', blob, fileName || 'recording.webm');
  if (language) formData.append('language', language);
  if (task) formData.append('task', task);
  if (prompt) formData.append('prompt', prompt);

  const res = await fetch(`${AI_SERVICE_URL}/api/v1/voice/transcribe`, {
    method: 'POST',
    body: formData,
    headers: {
      'X-Internal-Key': AI_INTERNAL_KEY
    }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new AppError(`AI Voice Transcription failed: ${errText}`, res.status);
  }
  return res.json();
};

const enrollVoiceprint = async (fileBuffer, fileName) => {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'audio/webm' });
  formData.append('file', blob, fileName || 'voice_sample.webm');

  const res = await fetch(`${AI_SERVICE_URL}/api/v1/voice/enroll-voiceprint`, {
    method: 'POST',
    body: formData,
    headers: {
      'X-Internal-Key': AI_INTERNAL_KEY
    }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new AppError(`Doctor Voiceprint Enrollment failed: ${errText}`, res.status);
  }
  return res.json();
};

const ambientScribe = async (
  fileBuffer,
  fileName,
  {
    consultationType,
    language,
    task,
    doctorVoiceprint,
    doctorName,
    patientName,
    patientAge,
    patientGender
  } = {}
) => {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'audio/webm' });
  formData.append('file', blob, fileName || 'dialogue.webm');
  if (consultationType) formData.append('consultation_type', consultationType);
  if (language) formData.append('language', language);
  if (task) formData.append('task', task);
  if (doctorVoiceprint) {
    formData.append(
      'doctor_voiceprint',
      typeof doctorVoiceprint === 'string' ? doctorVoiceprint : JSON.stringify(doctorVoiceprint)
    );
  }
  if (doctorName) formData.append('doctor_name', doctorName);
  if (patientName) formData.append('patient_name', patientName);
  if (patientAge !== undefined && patientAge !== null) formData.append('patient_age', String(patientAge));
  if (patientGender) formData.append('patient_gender', patientGender);

  const res = await fetch(`${AI_SERVICE_URL}/api/v1/voice/ambient-scribe`, {
    method: 'POST',
    body: formData,
    headers: {
      'X-Internal-Key': AI_INTERNAL_KEY
    }
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new AppError(`AI Ambient Scribe failed: ${errText}`, res.status);
  }
  return res.json();
};

const parseDialogue = async (payload) => {
  return requestAiService('/api/v1/voice/parse-dialogue', {
    method: 'POST',
    body: payload
  });
};

module.exports = {
  healthCheck,
  solveRoster,
  transcribeAudio,
  enrollVoiceprint,
  ambientScribe,
  parseDialogue
};
