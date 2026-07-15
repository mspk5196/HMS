const q = require('./patient.queries');
const { AppError } = require('../../utils/errors');
const db = require('../../config/db');

const registerPatient = async (data) => {
  const name = data.full_name || data.name;
  const mobile = data.mobile_number || data.mobile;
  const age = data.age_years || data.age;
  const gender = data.gender;
  
  if (!name || !mobile || !age || !gender) {
    throw new AppError('name, mobile, age, gender are required', 400);
  }
  
  return q.createPatient({
    full_name: name,
    mobile_number: mobile,
    age_years: Number(age),
    gender,
    address: data.address || null,
    blood_group: data.blood_group || null,
    notes: data.notes || null
  });
};

const bookAppointment = async (data, bookedBy) => {
  if (!data.patient_id || !data.doctor_id || !data.appointment_date) {
    throw new AppError('patient_id, doctor_id, appointment_date are required', 400);
  }
  
  // Auto-generate token number for the doctor on that date
  const [rows] = await db.query(
    `SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token 
     FROM appointments 
     WHERE doctor_id = ? AND appointment_date = ?`,
    [data.doctor_id, data.appointment_date]
  );
  const token = rows[0].next_token;

  return q.createAppointment({ ...data, token_number: token, booked_by: bookedBy });
};

module.exports = {
  registerPatient,
  bookAppointment,
  // Pass-through
  listPatients: q.listPatients,
  getPatient: q.getPatient,
  updatePatient: q.updatePatient,
  listAppointments: q.listAppointments,
  updateAppointmentStatus: q.updateAppointmentStatus,
  listAdmissions: q.listAdmissions,
  createAdmission: q.createAdmission,
  createDischarge: q.createDischarge,
};
