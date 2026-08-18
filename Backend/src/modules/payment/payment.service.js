/**
 * payment.service.js
 * Business logic for the unified payment collection module.
 */
const q = require('./payment.queries');
const { AppError } = require('../../utils/errors');

const listDoctorFeeRates = async () => q.listDoctorFeeRates();

const getAllDoctors = async () => q.getAllDoctors();

const upsertDoctorFeeRate = async (doctorId, opdFee, ipdDailyFee) => {
  if (!doctorId) throw new AppError('doctorId is required', 400);
  if (opdFee < 0 || ipdDailyFee < 0) throw new AppError('Fee values must be non-negative', 400);
  await q.upsertDoctorFeeRate(Number(doctorId), Number(opdFee) || 0, Number(ipdDailyFee) || 0);
};

const getDoctorFeeRate = async (doctorId) => {
  const rate = await q.getDoctorFeeRate(Number(doctorId));
  return rate ?? { doctor_id: doctorId, opd_fee: 0, ipd_daily_fee: 0 };
};

const listPendingPayments = async ({ search } = {}) => {
  const [opd, ipd, pharmacy] = await Promise.all([
    q.listPendingOPD({ search }),
    q.listPendingIPD({ search }),
    q.listPendingPharmacy({ search }),
  ]);
  return { opd, ipd, pharmacy };
};

const collectOPDPayment = async ({ appointmentId, amount, paymentMode, notes, receivedBy }) => {
  if (!appointmentId) throw new AppError('appointmentId is required', 400);
  if (!amount || Number(amount) <= 0) throw new AppError('amount must be a positive number', 400);
  return q.recordOPDPayment({ appointmentId: Number(appointmentId), amount: Number(amount), paymentMode, notes, receivedBy });
};

const collectIPDPayment = async ({ admissionId, amount, paymentMode, notes, receivedBy }) => {
  if (!admissionId) throw new AppError('admissionId is required', 400);
  if (!amount || Number(amount) <= 0) throw new AppError('amount must be a positive number', 400);
  return q.recordIPDPayment({ admissionId: Number(admissionId), amount: Number(amount), paymentMode, notes, receivedBy });
};

const collectPharmacyPayment = async ({ pharmacyBillId, amount, paymentMode, notes, receivedBy }) => {
  if (!pharmacyBillId) throw new AppError('pharmacyBillId is required', 400);
  if (!amount || Number(amount) <= 0) throw new AppError('amount must be a positive number', 400);
  return q.recordPharmacyPayment({ pharmacyBillId: Number(pharmacyBillId), amount: Number(amount), paymentMode, notes, receivedBy });
};

const listReceiptsByPatient = async (patientId) => {
  if (!patientId) throw new AppError('patientId is required', 400);
  return q.listReceiptsByPatient(Number(patientId));
};

module.exports = {
  listDoctorFeeRates,
  getAllDoctors,
  upsertDoctorFeeRate,
  getDoctorFeeRate,
  listPendingPayments,
  collectOPDPayment,
  collectIPDPayment,
  collectPharmacyPayment,
  listReceiptsByPatient,
};
