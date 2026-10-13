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

// Clinical Voice AI & Ambient Scribe endpoints
router.post('/voice/transcribe', upload.single('file'), ctrl.transcribeVoice);
router.post('/voice/ambient-scribe', upload.single('file'), ctrl.ambientScribeConsultation);
router.post('/voice/parse-dialogue', ctrl.parseConsultationDialogue);
router.post('/voice/doctor-voiceprint', upload.single('file'), ctrl.enrollDoctorVoiceprint);
router.get('/voice/doctor-voiceprint', ctrl.getDoctorVoiceprintStatus);
router.get('/voice/doctor-voiceprint/:doctorId', ctrl.getDoctorVoiceprintStatus);

module.exports = router;
