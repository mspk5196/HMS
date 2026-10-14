const router = require('express').Router();
const ctrl = require('./consultation.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');
const { gate } = require('../../middleware/approvalGate');

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.use(verifyToken);

// Doctor Consultation endpoints
router.get('/appointments/:appointmentId/consultation', requirePermissions(['consultation.view']), ctrl.getConsultation);
router.post('/appointments/:appointmentId/consultation', gate('consultation.create', ctrl.saveConsultation));
router.get('/consultations/:id', requirePermissions(['consultation.view']), ctrl.getConsultationById);
router.get('/consultations/:id/addenda', requirePermissions(['consultation.view']), ctrl.listAddenda);
router.post('/consultations/:id/addenda', gate('consultation.addendum', ctrl.addAddendum));

const stashFileUploadForApproval = (req, res, next) => {
  if (req.file) {
    req.body = req.body || {};
    req.body.file_base64 = req.file.buffer.toString('base64');
    req.body.file_originalname = req.file.originalname;
  }
  next();
};

// Clinical Voice AI & Ambient Scribe endpoints
router.post('/voice/transcribe', requirePermissions(['ai_voice.transcribe', 'consultation.view']), upload.single('file'), ctrl.transcribeVoice);
router.post('/voice/ambient-scribe', requirePermissions(['ai_voice.ambient_scribe', 'consultation.view']), upload.single('file'), ctrl.ambientScribeConsultation);
router.post('/voice/parse-dialogue', requirePermissions(['ai_voice.ambient_scribe', 'consultation.view']), ctrl.parseConsultationDialogue);
router.post('/voice/doctor-voiceprint', upload.single('file'), stashFileUploadForApproval, gate('ai_voice.enroll_voiceprint', ctrl.enrollDoctorVoiceprint));
router.get('/voice/doctor-voiceprint', requirePermissions(['ai_voice.view', 'hr_employee.view']), ctrl.getDoctorVoiceprintStatus);
router.get('/voice/doctor-voiceprint/:doctorId', requirePermissions(['ai_voice.view', 'hr_employee.view']), ctrl.getDoctorVoiceprintStatus);

module.exports = router;
