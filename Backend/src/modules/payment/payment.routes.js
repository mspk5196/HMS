const router = require('express').Router();
const ctrl = require('./payment.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');
const { gate } = require('../../middleware/approvalGate');

router.use(verifyToken);
const canView = requirePermissions(['payment.view']);

// Doctor fee rate configuration
router.get('/doctors', canView, ctrl.listDoctors);
router.get('/fee-rates', canView, ctrl.listFeeRates);
router.get('/fee-rates/:doctorId', canView, ctrl.getFeeRate);
router.post('/fee-rates', gate('payment.set_fee_rate', ctrl.upsertFeeRate));

// Collect Payment page
router.get('/pending', canView, ctrl.listPending);
router.post('/collect/opd', gate('payment.collect_opd', ctrl.collectOPD));
router.post('/collect/ipd', gate('payment.collect_ipd', ctrl.collectIPD));
router.post('/collect/pharmacy', gate('payment.collect_pharmacy', ctrl.collectPharmacy));

// Receipts
router.get('/receipts/patient/:patientId', canView, ctrl.listReceiptsByPatient);

module.exports = router;
