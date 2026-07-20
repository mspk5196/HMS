const svc = require('./patient.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created, paginated, fail } = require('../../utils/response');

/* ─── PATIENTS ─── */
const listPatients = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  const result = await svc.listPatients({ search: search || null, page: Number(page), limit: Number(limit) });
  return res.json(paginated(result.rows, result.total, page, limit));
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

/* ─── APPOINTMENTS ─── */
const listAppointments = asyncHandler(async (req, res) => {
  const { patientId, doctorId, date, status, page = 1, limit = 50 } = req.query;
  const result = await svc.listAppointments({
    patientId: patientId ? Number(patientId) : null,
    doctorId: doctorId ? Number(doctorId) : null,
    date: date || null,
    status: status || null,
    page: Number(page), limit: Number(limit)
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

const createAppointment = asyncHandler(async (req, res) => {
  const id = await svc.bookAppointment(req.body, req.user?.id ?? null);
  return res.status(201).json(created({ id }, 'Appointment booked'));
});

const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json(fail('Status is required'));
  await svc.updateAppointmentStatus(Number(req.params.id), status);
  return res.json(success(null, 'Appointment status updated'));
});

/* ─── ADMISSIONS & DISCHARGES ─── */
const listAdmissions = asyncHandler(async (req, res) => {
  const { patientId, status, page = 1, limit = 50 } = req.query;
  const result = await svc.listAdmissions({
    patientId: patientId ? Number(patientId) : null,
    status: status || null,
    page: Number(page), limit: Number(limit)
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

const createAdmission = asyncHandler(async (req, res) => {
  const id = await svc.createAdmission(req.body);
  return res.status(201).json(created({ id }, 'Patient admitted'));
});

const createDischarge = asyncHandler(async (req, res) => {
  const id = await svc.createDischarge({ ...req.body, prepared_by: req.user?.id ?? null });
  return res.status(201).json(created({ id }, 'Patient discharged'));
});

module.exports = {
  listPatients, getPatient, createPatient, updatePatient,
  listAppointments, createAppointment, updateAppointmentStatus,
  listAdmissions, createAdmission, createDischarge,
};
