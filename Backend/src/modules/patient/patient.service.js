/**
 * patient.service.js
 * Business logic for Patient Records, Appointment/Token, Admission & Bed
 * Management, and Discharge & Patient History.
 */

const q = require('./patient.queries');
const { AppError } = require('../../utils/errors');

/* ─────────────────────────────────────────────
   PATIENTS
───────────────────────────────────────────── */

const registerPatient = async (data) => {
  const name = data.full_name || data.name;
  const mobile = data.mobile_number || data.mobile;
  const age = data.age_years ?? data.age;
  const gender = data.gender;

  if (!name || !mobile || !gender) {
    throw new AppError('name, mobile and gender are required', 400);
  }
  if (age === undefined && !data.date_of_birth) {
    throw new AppError('Either age or date of birth is required', 400);
  }

  return q.createPatient({
    full_name: name,
    mobile_number: mobile,
    date_of_birth: data.date_of_birth || null,
    age_years: age !== undefined ? Number(age) : null,
    gender,
    address: data.address || null,
    blood_group: data.blood_group || null,
    notes: data.notes || null,
  });
};

const findByMobile = async (mobile) => {
  if (!mobile) throw new AppError('mobile is required', 400);
  return q.findPatientsByMobile(mobile);
};

/* ─────────────────────────────────────────────
   APPOINTMENTS / TOKEN
───────────────────────────────────────────── */

/**
 * Book today's (or a future) appointment and assign the next token.
 * Confirmed rule: the counter is per calendar day across the whole hospital
 * — not per doctor, not per department — so whoever books first gets the
 * lowest number. system_config.TOKEN_SCOPE documents this; a 'department'
 * scope isn't implementable yet since appointments carries no department_id.
 */
const bookAppointment = async (data, createdBy) => {
  if (!data.patient_id || !data.doctor_id || !data.appointment_date) {
    throw new AppError('patient_id, doctor_id, appointment_date are required', 400);
  }

  const isFuture = !!data.is_future_booking;
  const today = new Date().toISOString().slice(0, 10);
  if (!isFuture && data.appointment_date !== today) {
    throw new AppError('Future-dated booking is not enabled — pass is_future_booking to override', 400);
  }

  const token = await q.getNextTokenNumber(data.appointment_date);

  return q.createAppointment({
    patient_id: data.patient_id,
    doctor_id: data.doctor_id,
    appointment_date: data.appointment_date,
    token_number: token,
    is_future_booking: isFuture,
    visit_type: isFuture ? 'future_booking' : 'walk_in',
    receptionist_notes: data.receptionist_notes || null,
    created_by: createdBy,
  });
};

const updateAppointmentStatus = async (id, status, actingUserId) => {
  const allowed = ['waiting', 'in_consultation', 'completed', 'converted_to_admission', 'closed', 'cancelled'];
  if (!allowed.includes(status)) {
    throw new AppError(`status must be one of: ${allowed.join(', ')}`, 400);
  }
  const appt = await q.getAppointment(id);
  if (!appt) throw new AppError('Appointment not found', 404);
  await q.updateAppointmentStatus(id, status, actingUserId);
};

/** Walk-in visit, no admission: simple payment + close. */
const closeWalkInVisit = async (appointmentId, amountPaid, closedBy) => {
  const appt = await q.getAppointment(appointmentId);
  if (!appt) throw new AppError('Appointment not found', 404);
  if (['closed', 'cancelled'].includes(appt.status)) {
    throw new AppError(`This visit is already ${appt.status}`, 400);
  }
  await q.closeWalkInVisit(appointmentId, Number(amountPaid) || 0, closedBy);
};

/* ─────────────────────────────────────────────
   ADMISSIONS & BEDS
───────────────────────────────────────────── */

const createAdmission = async (data) => {
  if (!data.patient_id || !data.admitting_doctor_id) {
    throw new AppError('patient_id and admitting_doctor_id are required', 400);
  }
  return q.createAdmission(data);
};

const assignBed = async (admissionId, bedId) => {
  const admission = await q.getAdmission(admissionId);
  if (!admission) throw new AppError('Admission not found', 404);
  if (admission.status !== 'admitted') throw new AppError('This admission is already discharged', 400);
  await q.assignBed(admissionId, bedId);
};

const releaseBedFromAdmission = async (admissionId, bedId) => {
  await q.releaseBedFromAdmission(admissionId, bedId);
};

/* ─────────────────────────────────────────────
   DISCHARGE
───────────────────────────────────────────── */

/** Preview the bill before actually discharging — lets the desk confirm figures with the patient. */
const previewDischargeCharges = async (admissionId) => {
  const admission = await q.getAdmission(admissionId);
  if (!admission) throw new AppError('Admission not found', 404);

  const room = await q.computeRoomCharges(admissionId);
  const pharmacy = await q.computePharmacyCharges(admissionId);
  return {
    room_charges: room.total,
    room_charge_breakdown: room.breakdown,
    pharmacy_charges: pharmacy,
  };
};

const createDischarge = async (data) => {
  if (!data.admission_id) throw new AppError('admission_id is required', 400);

  const admission = await q.getAdmission(data.admission_id);
  if (!admission) throw new AppError('Admission not found', 404);
  if (admission.status === 'discharged') throw new AppError('This patient is already discharged', 400);

  const existing = await q.getDischargeByAdmission(data.admission_id);
  if (existing) throw new AppError('A discharge record already exists for this admission', 409);

  // Charges are computed server-side from the real stay and real pharmacy
  // bills — the client may only add "other_charges" on top.
  const room = await q.computeRoomCharges(data.admission_id);
  const pharmacy = await q.computePharmacyCharges(data.admission_id);
  const otherCharges = Number(data.other_charges) || 0;
  const finalBillAmount = room.total + pharmacy + otherCharges;
  const amountPaid = Number(data.amount_paid) || 0;

  if (amountPaid > finalBillAmount) {
    throw new AppError('Amount paid cannot exceed the final bill amount', 400);
  }

  const dischargeId = await q.createDischarge({
    ...data,
    room_charges: room.total,
    pharmacy_charges: pharmacy,
    other_charges: otherCharges,
    final_bill_amount: finalBillAmount,
    amount_paid: amountPaid,
  });

  // A fully-paid discharge releases its beds immediately rather than sitting
  // in pending_clearance needlessly.
  await q.releaseBedsIfPaid(data.admission_id);

  return dischargeId;
};

/** Record a further payment against an existing discharge, releasing beds once settled. */
const recordDischargePayment = async (admissionId, amount) => {
  const discharge = await q.getDischargeByAdmission(admissionId);
  if (!discharge) throw new AppError('No discharge record for this admission', 404);
  const amt = Number(amount);
  if (!amt || amt <= 0) throw new AppError('amount must be a positive number', 400);
  if (amt > Number(discharge.balance_due)) {
    throw new AppError(`Amount exceeds the outstanding balance of ${discharge.balance_due}`, 400);
  }

  await q.recordDischargePayment(discharge.id, amt);
  const result = await q.releaseBedsIfPaid(admissionId);
  return { ...result };
};

/* ─────────────────────────────────────────────
   PATIENT HISTORY
───────────────────────────────────────────── */

const getPatientHistory = async (patientId) => {
  const patient = await q.getPatient(patientId);
  if (!patient) throw new AppError('Patient not found', 404);
  const history = await q.getPatientHistory(patientId);
  return { patient, ...history };
};

module.exports = {
  registerPatient,
  findByMobile,
  bookAppointment,
  updateAppointmentStatus,
  closeWalkInVisit,
  createAdmission,
  assignBed,
  releaseBedFromAdmission,
  previewDischargeCharges,
  createDischarge,
  recordDischargePayment,
  getPatientHistory,
  // Pass-through
  listPatients: q.listPatients,
  getPatient: q.getPatient,
  updatePatient: q.updatePatient,
  listAppointments: q.listAppointments,
  getAppointment: q.getAppointment,
  getAppointmentPayments: q.getAppointmentPayments,
  listAdmissions: q.listAdmissions,
  getAdmission: q.getAdmission,
  getDischargeByAdmission: q.getDischargeByAdmission,
};
