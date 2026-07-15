const db = require('../../config/db');

/* ─── PATIENTS ─── */
const listPatients = async ({ search, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  let whereClause = '';
  const params = [];
  if (search) {
    whereClause = `WHERE (name LIKE ? OR mobile LIKE ? OR uhid LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const [rows] = await db.execute(
    `SELECT * FROM patients ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM patients ${whereClause}`, params);
  return { rows, total };
};

const getPatient = async (id) => {
  const [rows] = await db.execute(`SELECT * FROM patients WHERE id = ?`, [id]);
  return rows[0] ?? null;
};

const createPatient = async (data) => {
  const { uhid, name, age, gender, mobile, address, blood_group } = data;
  const [result] = await db.execute(
    `INSERT INTO patients (uhid, name, age, gender, mobile, address, blood_group)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uhid ?? null, name, age, gender, mobile, address ?? null, blood_group ?? null]
  );
  return result.insertId;
};

const updatePatient = async (id, data) => {
  const allowed = ['name', 'age', 'gender', 'mobile', 'address', 'blood_group'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(data[key]);
    }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE patients SET ${fields.join(', ')} WHERE id = ?`, vals);
};

/* ─── APPOINTMENTS ─── */
const listAppointments = async ({ patientId, doctorId, date, status, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (patientId) { filters.push('a.patient_id = ?'); params.push(patientId); }
  if (doctorId) { filters.push('a.doctor_id = ?'); params.push(doctorId); }
  if (date) { filters.push('a.appointment_date = ?'); params.push(date); }
  if (status) { filters.push('a.status = ?'); params.push(status); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.execute(
    `SELECT a.*, p.name AS patient_name, p.mobile, e.full_name AS doctor_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     LEFT JOIN employees e ON e.id = a.doctor_id
     ${where}
     ORDER BY a.appointment_date DESC, a.token_number ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM appointments a ${where}`, params);
  return { rows, total };
};

const createAppointment = async (data) => {
  const { patient_id, doctor_id, department_id, appointment_date, token_number, type, consult_fee, booked_by } = data;
  const [result] = await db.execute(
    `INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, token_number, type, consult_fee, booked_by, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
    [patient_id, doctor_id, department_id ?? null, appointment_date, token_number ?? null, type ?? 'consultation', consult_fee ?? 0, booked_by ?? null]
  );
  return result.insertId;
};

const updateAppointmentStatus = async (id, status) => {
  await db.execute(`UPDATE appointments SET status = ? WHERE id = ?`, [status, id]);
};

/* ─── ADMISSIONS ─── */
const listAdmissions = async ({ patientId, status, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (patientId) { filters.push('ad.patient_id = ?'); params.push(patientId); }
  if (status) { filters.push('ad.status = ?'); params.push(status); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.execute(
    `SELECT ad.*, p.name AS patient_name, p.mobile, e.full_name AS doctor_name
     FROM admissions ad
     JOIN patients p ON p.id = ad.patient_id
     LEFT JOIN employees e ON e.id = ad.admitting_doctor_id
     ${where}
     ORDER BY ad.admission_date DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM admissions ad ${where}`, params);
  return { rows, total };
};

const createAdmission = async (data) => {
  const { patient_id, admitting_doctor_id, admission_date, room_type, room_number, reason, status } = data;
  const [result] = await db.execute(
    `INSERT INTO admissions (patient_id, admitting_doctor_id, admission_date, room_type, room_number, reason, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [patient_id, admitting_doctor_id, admission_date, room_type ?? null, room_number ?? null, reason ?? null, status ?? 'admitted']
  );
  return result.insertId;
};

/* ─── DISCHARGES ─── */
const createDischarge = async (data) => {
  const { admission_id, discharge_date, discharge_type, notes, prepared_by } = data;
  const [result] = await db.execute(
    `INSERT INTO discharges (admission_id, discharge_date, discharge_type, notes, prepared_by)
     VALUES (?, ?, ?, ?, ?)`,
    [admission_id, discharge_date, discharge_type ?? 'routine', notes ?? null, prepared_by ?? null]
  );
  
  // Update admission status
  await db.execute(`UPDATE admissions SET status = 'discharged' WHERE id = ?`, [admission_id]);
  
  return result.insertId;
};

module.exports = {
  listPatients, getPatient, createPatient, updatePatient,
  listAppointments, createAppointment, updateAppointmentStatus,
  listAdmissions, createAdmission,
  createDischarge,
};
