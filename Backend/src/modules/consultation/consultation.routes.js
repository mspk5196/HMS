const router = require('express').Router();
const ctrl = require('./consultation.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');

router.use(verifyToken);

// Doctor Consultation endpoints
router.get('/appointments/:appointmentId/consultation', requirePermissions(['consultation.view']), ctrl.getConsultation);
router.post('/appointments/:appointmentId/consultation', requirePermissions(['consultation.modify']), ctrl.saveConsultation);

module.exports = router;
