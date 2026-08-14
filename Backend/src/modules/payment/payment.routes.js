const router = require('express').Router();
const ctrl = require('./payment.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');

router.use(verifyToken);

// Doctor fee rate configuration
router.get('/doctors', ctrl.listDoctors);
router.get('/fee-rates', ctrl.listFeeRates);
router.get('/fee-rates/:doctorId', ctrl.getFeeRate);
router.post('/fee-rates', requirePermissions(['settings.modify']), ctrl.upsertFeeRate);

// Collect Payment page
router.get('/pending', ctrl.listPending);
router.post('/collect/opd', requirePermissions(['appointment.close_appointment']), ctrl.collectOPD);
router.post('/collect/ipd', requirePermissions(['discharge.modify']), ctrl.collectIPD);

// Receipts
router.get('/receipts/patient/:patientId', ctrl.listReceiptsByPatient);

module.exports = router;
