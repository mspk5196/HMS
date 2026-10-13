const service = require('./consultation.service');

const getConsultation = async (req, res, next) => {
  try {
    const data = await service.getConsultation(req.params.appointmentId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Consultation not found' });
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const getConsultationById = async (req, res, next) => {
  try {
    const data = await service.getConsultationById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Consultation not found' });
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const saveConsultation = async (req, res, next) => {
  try {
    // req.user comes from verifyToken middleware
    const doctorId = req.user.employee_id;
    if (!doctorId) {
      return res.status(403).json({ success: false, message: 'Only registered doctors can save consultations' });
    }
    
    // Merge appointment_id from URL params if missing in body
    const data = { ...req.body, appointment_id: req.params.appointmentId || req.body.appointment_id };
    
    const result = await service.saveConsultation(data, doctorId);
    res.status(201).json(result);
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

const listAddenda = async (req, res, next) => {
  try {
    const data = await service.getAddenda(req.params.id);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

const addAddendum = async (req, res, next) => {
  try {
    const employeeId = req.user?.employee_id;
    if (!employeeId) return res.status(403).json({ success: false, message: 'Only registered employees can add addenda.' });
    const data = await service.addAddendum(req.params.id, employeeId, req.body.note);
    res.status(201).json({ success: true, data });
  } catch (error) { next(error); }
};

const transcribeVoice = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Audio file is required' });
    }
    const { language, task, prompt } = req.body;
    const aiClient = require('../../services/aiClient');
    const data = await aiClient.transcribeAudio(req.file.buffer, req.file.originalname, { language, task, prompt });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const ambientScribeConsultation = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Audio file is required' });
    }
    const { consultationType, language, task, appointmentId, doctorId } = req.body;
    const db = require('../../config/db');

    let resolvedDoctorId = doctorId || req.user?.employee_id;
    let patientName = req.body.patientName || '';
    let patientAge = req.body.patientAge || null;
    let patientGender = req.body.patientGender || '';
    let doctorName = req.body.doctorName || '';

    if (appointmentId) {
      const [[appt]] = await db.query(
        `SELECT a.doctor_id, p.full_name AS patient_name, p.age_years, p.gender, e.full_name AS doctor_name
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         LEFT JOIN employees e ON e.id = a.doctor_id
         WHERE a.id = ?`,
        [appointmentId]
      );
      if (appt) {
        resolvedDoctorId = resolvedDoctorId || appt.doctor_id;
        patientName = patientName || appt.patient_name;
        patientAge = patientAge || appt.age_years;
        patientGender = patientGender || appt.gender;
        doctorName = doctorName || appt.doctor_name;
      }
    }

    let doctorVoiceprint = null;
    if (resolvedDoctorId) {
      const [[vp]] = await db.query(
        `SELECT embedding_vector FROM doctor_voiceprints WHERE doctor_id = ?`,
        [resolvedDoctorId]
      );
      if (vp && vp.embedding_vector) {
        doctorVoiceprint = typeof vp.embedding_vector === 'string'
          ? JSON.parse(vp.embedding_vector)
          : vp.embedding_vector;
      }
    }

    const aiClient = require('../../services/aiClient');
    const data = await aiClient.ambientScribe(req.file.buffer, req.file.originalname, {
      consultationType,
      language,
      task,
      doctorVoiceprint,
      doctorName,
      patientName,
      patientAge,
      patientGender
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const enrollDoctorVoiceprint = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Audio file is required for voice enrollment' });
    }
    const doctorId = req.body.doctorId || req.user?.employee_id || req.user?.id;
    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'Doctor ID is required' });
    }

    const aiClient = require('../../services/aiClient');
    const aiRes = await aiClient.enrollVoiceprint(req.file.buffer, req.file.originalname);

    const db = require('../../config/db');
    await db.query(
      `INSERT INTO doctor_voiceprints (doctor_id, embedding_vector, audio_duration_seconds, sample_rate)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         embedding_vector = VALUES(embedding_vector),
         audio_duration_seconds = VALUES(audio_duration_seconds),
         sample_rate = VALUES(sample_rate),
         updated_at = NOW()`,
      [
        doctorId,
        JSON.stringify(aiRes.embedding),
        aiRes.duration_seconds || null,
        aiRes.sample_rate || 16000
      ]
    );

    res.json({
      success: true,
      message: 'Doctor voiceprint enrolled successfully',
      data: {
        doctorId,
        durationSeconds: aiRes.duration_seconds,
        embeddingDimension: aiRes.embedding_dimension
      }
    });
  } catch (error) {
    next(error);
  }
};

const getDoctorVoiceprintStatus = async (req, res, next) => {
  try {
    const doctorId = req.params.doctorId || req.query.doctorId || req.user?.employee_id || req.user?.id;
    const db = require('../../config/db');
    const [[vp]] = await db.query(
      `SELECT id, doctor_id, audio_duration_seconds, created_at, updated_at
       FROM doctor_voiceprints WHERE doctor_id = ?`,
      [doctorId]
    );
    res.json({
      success: true,
      data: {
        enrolled: !!vp,
        voiceprint: vp || null
      }
    });
  } catch (error) {
    next(error);
  }
};

const parseConsultationDialogue = async (req, res, next) => {
  try {
    const aiClient = require('../../services/aiClient');
    const data = await aiClient.parseDialogue(req.body);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConsultation,
  getConsultationById,
  saveConsultation,
  listAddenda,
  addAddendum,
  transcribeVoice,
  ambientScribeConsultation,
  enrollDoctorVoiceprint,
  getDoctorVoiceprintStatus,
  parseConsultationDialogue
};
