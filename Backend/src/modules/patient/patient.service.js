/**
 * patient.service.js
 * Business logic for Patient Records, Appointment/Token, Admission & Bed
 * Management, and Discharge & Patient History.
 */

const q = require('./patient.queries');
const paymentQueries = require('../payment/payment.queries');
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
  const allowed = ['waiting', 'in_consultation', 'completed', 'payment_pending', 'converted_to_admission', 'closed', 'cancelled'];
  if (!allowed.includes(status)) {
    throw new AppError(`status must be one of: ${allowed.join(', ')}`, 400);
  }
  const appt = await q.getAppointment(id);
  if (!appt) throw new AppError('Appointment not found', 404);
  await q.updateAppointmentStatus(id, status, actingUserId);
};

/** Save & Move to Payment: marks OPD visit as payment_pending with doctor_fee. */
const closeWalkInVisit = async (appointmentId, doctorFee, closedBy) => {
  const appt = await q.getAppointment(appointmentId);
  if (!appt) throw new AppError('Appointment not found', 404);
  if (['closed', 'cancelled'].includes(appt.status)) {
    throw new AppError(`This visit is already ${appt.status}`, 400);
  }
  if (appt.status === 'payment_pending') {
    throw new AppError('This visit is already pending payment', 400);
  }

  let finalFee = Number(doctorFee) || 0;
  if (!finalFee && appt.doctor_id) {
    const rate = await paymentQueries.getDoctorFeeRate(appt.doctor_id);
    if (rate && rate.opd_fee) {
      finalFee = Number(rate.opd_fee);
    }
  }

  await q.markAppointmentPaymentPending(appointmentId, finalFee);
};

/** Actually finalize (close) an appointment after payment. Used by payment module. */
const finalizeAppointmentClose = async (appointmentId, closedBy) => {
  await q.closeAppointment(appointmentId, closedBy);
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
  if (!['admitted', 'payment_pending'].includes(admission.status)) throw new AppError('This admission is already discharged', 400);
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

  // Charges are computed server-side from the real stay and real pharmacy
  // bills — the client may only add "other_charges" and "doctor_fee" on top.
  const room = await q.computeRoomCharges(data.admission_id);
  const pharmacy = await q.computePharmacyCharges(data.admission_id);
  const otherCharges = Number(data.other_charges) || 0;
  const doctorFee = Number(data.doctor_fee) || 0;
  const finalBillAmount = room.total + pharmacy + otherCharges + doctorFee;

  const dischargeId = await q.createDischarge({
    ...data,
    room_charges: room.total,
    pharmacy_charges: pharmacy,
    doctor_fee: doctorFee,
    other_charges: otherCharges,
    final_bill_amount: finalBillAmount,
  });

  return { dischargeId, final_bill_amount: finalBillAmount };
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
   ADMISSION DAILY NOTES & TIMELINE
───────────────────────────────────────────── */

const addAdmissionDailyNote = async (admissionId, data, createdBy) => {
  const admission = await q.getAdmission(admissionId);
  if (!admission) throw new AppError('Admission not found', 404);
  if (!data.note_date) throw new AppError('note_date is required', 400);

  return q.createAdmissionDailyNote({
    admission_id: admissionId,
    note_date: data.note_date,
    doctor_id: data.doctor_id || null,
    bp: data.bp || null,
    pulse: data.pulse ?? null,
    temperature: data.temperature ?? null,
    spo2: data.spo2 ?? null,
    advice: data.advice || null,
    created_by: createdBy,
  });
};

const getAdmissionTimeline = async (admissionId) => {
  const timeline = await q.getAdmissionTimeline(admissionId);
  if (!timeline) throw new AppError('Admission not found', 404);
  return timeline;
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
  finalizeAppointmentClose,
  createAdmission,
  assignBed,
  releaseBedFromAdmission,
  previewDischargeCharges,
  createDischarge,
  recordDischargePayment,
  addAdmissionDailyNote,
  getAdmissionTimeline,
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
  listAdmissionDailyNotes: q.listAdmissionDailyNotes,
};
