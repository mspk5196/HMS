const svc = require('./payment.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created } = require('../../utils/response');

/** GET /payment/doctors — all doctors with their fee rates */
const listDoctors = asyncHandler(async (req, res) => {
  const rows = await svc.getAllDoctors();
  return res.json(success(rows));
});

/** GET /payment/fee-rates — all configured doctor fee rates */
const listFeeRates = asyncHandler(async (req, res) => {
  const rows = await svc.listDoctorFeeRates();
  return res.json(success(rows));
});

/** GET /payment/fee-rates/:doctorId */
const getFeeRate = asyncHandler(async (req, res) => {
  const rate = await svc.getDoctorFeeRate(Number(req.params.doctorId));
  return res.json(success(rate));
});

/** POST /payment/fee-rates  Body: { doctor_id, opd_fee, ipd_daily_fee } */
const upsertFeeRate = asyncHandler(async (req, res) => {
  const { doctor_id, opd_fee, ipd_daily_fee } = req.body;
  await svc.upsertDoctorFeeRate(doctor_id, opd_fee ?? 0, ipd_daily_fee ?? 0);
  return res.json(success(null, 'Doctor fee rate saved'));
});

/** GET /payment/pending?search= */
const listPending = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const result = await svc.listPendingPayments({ search: search || null });
  return res.json(success(result));
});

/** POST /payment/collect/opd  Body: { appointment_id, amount, payment_mode, notes } */
const collectOPD = asyncHandler(async (req, res) => {
  const { appointment_id, amount, payment_mode, notes } = req.body;
  const result = await svc.collectOPDPayment({
    appointmentId: appointment_id,
    amount,
    paymentMode: payment_mode,
    notes,
    receivedBy: req.user?.id ?? null,
  });
  return res.json(success(result, `Payment recorded — Receipt ${result.receiptNumber}`));
});

/** POST /payment/collect/ipd  Body: { admission_id, amount, payment_mode, notes } */
const collectIPD = asyncHandler(async (req, res) => {
  const { admission_id, amount, payment_mode, notes } = req.body;
  const result = await svc.collectIPDPayment({
    admissionId: admission_id,
    amount,
    paymentMode: payment_mode,
    notes,
    receivedBy: req.user?.id ?? null,
  });
  return res.json(success(result, `Payment recorded — Receipt ${result.receiptNumber}`));
});

/** GET /payment/receipts/patient/:patientId */
const listReceiptsByPatient = asyncHandler(async (req, res) => {
  const rows = await svc.listReceiptsByPatient(Number(req.params.patientId));
  return res.json(success(rows));
});

module.exports = {
  listDoctors, listFeeRates, getFeeRate, upsertFeeRate,
  listPending, collectOPD, collectIPD, listReceiptsByPatient,
};
