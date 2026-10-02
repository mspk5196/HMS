const router = require('express').Router();
const ctrl = require('./consultation.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');
const { gate } = require('../../middleware/approvalGate');

router.use(verifyToken);

// Doctor Consultation endpoints
router.get('/appointments/:appointmentId/consultation', requirePermissions(['consultation.view']), ctrl.getConsultation);
router.post('/appointments/:appointmentId/consultation', gate('consultation.create', ctrl.saveConsultation));
router.get('/consultations/:id', requirePermissions(['consultation.view']), ctrl.getConsultationById);
router.get('/consultations/:id/addenda', requirePermissions(['consultation.view']), ctrl.listAddenda);
router.post('/consultations/:id/addenda', gate('consultation.addendum', ctrl.addAddendum));

module.exports = router;
