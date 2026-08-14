const svc = require('./patient.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created, paginated, fail } = require('../../utils/response');

/* ─── PATIENTS ─── */
const listPatients = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  const result = await svc.listPatients({ search: search || null, page: Number(page), limit: Number(limit) });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/** GET /patients/by-mobile/:mobile — every patient (family) sharing this number. */
const findByMobile = asyncHandler(async (req, res) => {
  const rows = await svc.findByMobile(req.params.mobile);
  return res.json(success(rows));
});

const getPatient = asyncHandler(async (req, res) => {
  const patient = await svc.getPatient(Number(req.params.id));
  if (!patient) return res.status(404).json(fail('Patient not found'));
  return res.json(success(patient));
});

const createPatient = asyncHandler(async (req, res) => {
  const id = await svc.registerPatient(req.body);
  return res.status(201).json(created({ id }, 'Patient registered'));
});

const updatePatient = asyncHandler(async (req, res) => {
  await svc.updatePatient(Number(req.params.id), req.body);
  return res.json(success(null, 'Patient updated'));
});

/** GET /patients/:id/history — full history independent of any single visit. */
const getPatientHistory = asyncHandler(async (req, res) => {
  const data = await svc.getPatientHistory(Number(req.params.id));
  return res.json(success(data));
});

/* ─── APPOINTMENTS ─── */
const listAppointments = asyncHandler(async (req, res) => {
  const { patientId, doctorId, date, status, page = 1, limit = 50 } = req.query;
  const result = await svc.listAppointments({
    patientId: patientId ? Number(patientId) : null,
    doctorId: doctorId ? Number(doctorId) : null,
    date: date || null,
    status: status || null,
    page: Number(page), limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

const getAppointment = asyncHandler(async (req, res) => {
  const appt = await svc.getAppointment(Number(req.params.id));
  if (!appt) return res.status(404).json(fail('Appointment not found'));
  return res.json(success(appt));
});

const createAppointment = asyncHandler(async (req, res) => {
  const id = await svc.bookAppointment(req.body, req.user?.id ?? null);
  return res.status(201).json(created({ id }, 'Appointment booked'));
});

const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json(fail('Status is required'));
  await svc.updateAppointmentStatus(Number(req.params.id), status, req.user?.id ?? null);
  return res.json(success(null, 'Appointment status updated'));
});

/** POST /appointments/:id/close  Body: { doctor_fee } — marks visit as payment_pending. */
const closeWalkInVisit = asyncHandler(async (req, res) => {
  await svc.closeWalkInVisit(Number(req.params.id), req.body.doctor_fee ?? 0, req.user?.id ?? null);
  return res.json(success(null, 'Visit marked as payment pending'));
});

/* ─── ADMISSIONS ─── */
const listAdmissions = asyncHandler(async (req, res) => {
  const { patientId, status, page = 1, limit = 50 } = req.query;
  const result = await svc.listAdmissions({
    patientId: patientId ? Number(patientId) : null,
    status: status || null,
    page: Number(page), limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

const getAdmission = asyncHandler(async (req, res) => {
  const admission = await svc.getAdmission(Number(req.params.id));
  if (!admission) return res.status(404).json(fail('Admission not found'));
  return res.json(success(admission));
});

const createAdmission = asyncHandler(async (req, res) => {
  const id = await svc.createAdmission({ ...req.body, created_by: req.user?.id ?? null });
  return res.status(201).json(created({ id }, 'Patient admitted'));
});

/** POST /admissions/:id/beds  Body: { bed_id } */
const assignBed = asyncHandler(async (req, res) => {
  const { bed_id } = req.body;
  if (!bed_id) return res.status(400).json(fail('bed_id is required'));
  await svc.assignBed(Number(req.params.id), Number(bed_id));
  return res.json(success(null, 'Bed assigned'));
});

/** DELETE /admissions/:id/beds/:bedId */
const releaseBed = asyncHandler(async (req, res) => {
  await svc.releaseBedFromAdmission(Number(req.params.id), Number(req.params.bedId));
  return res.json(success(null, 'Bed released'));
});

/** GET /admissions/:id/timeline — full stay: beds, day-wise notes, medicines, charges, discharge. */
const getAdmissionTimeline = asyncHandler(async (req, res) => {
  const data = await svc.getAdmissionTimeline(Number(req.params.id));
  return res.json(success(data));
});

/** GET /admissions/:id/notes */
const listAdmissionNotes = asyncHandler(async (req, res) => {
  const notes = await svc.listAdmissionDailyNotes(Number(req.params.id));
  return res.json(success(notes));
});

/** POST /admissions/:id/notes  Body: { note_date, doctor_id, bp, pulse, temperature, spo2, advice } */
const createAdmissionNote = asyncHandler(async (req, res) => {
  const id = await svc.addAdmissionDailyNote(Number(req.params.id), req.body, req.user?.id ?? null);
  return res.status(201).json(created({ id }, 'Daily note added'));
});

/* ─── DISCHARGES ─── */

/** GET /admissions/:id/discharge-preview */
const previewDischarge = asyncHandler(async (req, res) => {
  const data = await svc.previewDischargeCharges(Number(req.params.id));
  return res.json(success(data));
});

const createDischarge = asyncHandler(async (req, res) => {
  const result = await svc.createDischarge({ ...req.body, discharged_by: req.user?.id ?? null });
  return res.status(201).json(created({ id: result.dischargeId, final_bill_amount: result.final_bill_amount }, 'Discharge saved — awaiting payment'));
});

/** GET /admissions/:id/discharge — the discharge record for an admission, if any. */
const getDischarge = asyncHandler(async (req, res) => {
  const discharge = await svc.getDischargeByAdmission(Number(req.params.id));
  if (!discharge) return res.status(404).json(fail('No discharge record for this admission'));
  return res.json(success(discharge));
});

/** POST /discharges/:admissionId/payment  Body: { amount } */
const recordDischargePayment = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  if (!amount) return res.status(400).json(fail('amount is required'));
  const result = await svc.recordDischargePayment(Number(req.params.admissionId), amount);
  return res.json(success(result, result.released > 0 ? 'Payment recorded — beds released' : 'Payment recorded'));
});

module.exports = {
  listPatients, findByMobile, getPatient, createPatient, updatePatient, getPatientHistory,
  listAppointments, getAppointment, createAppointment, updateAppointmentStatus, closeWalkInVisit,
  listAdmissions, getAdmission, createAdmission, assignBed, releaseBed,
  getAdmissionTimeline, listAdmissionNotes, createAdmissionNote,
  previewDischarge, createDischarge, getDischarge, recordDischargePayment,
};
