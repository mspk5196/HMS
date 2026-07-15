const db = require('../../config/db');

/* ─── PATIENTS ─── */
const listPatients = async ({ search, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  let whereClause = '';
  const params = [];
  if (search) {
    whereClause = `WHERE (full_name LIKE ? OR mobile_number LIKE ? OR id = ?)`;
    const s = `%${search}%`;
    const numId = parseInt(search, 10) || 0;
    params.push(s, s, numId);
  }

  const [rows] = await db.query(
    `SELECT * FROM patients ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM patients ${whereClause}`, params);
  return { rows, total };
};

const getPatient = async (id) => {
  const [rows] = await db.query(`SELECT * FROM patients WHERE id = ?`, [id]);
  return rows[0] ?? null;
};

const createPatient = async (data) => {
  const { full_name, age_years, gender, mobile_number, address, blood_group, notes } = data;
  const [result] = await db.query(
    `INSERT INTO patients (full_name, age_years, gender, mobile_number, address, blood_group, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [full_name, age_years, gender, mobile_number, address ?? null, blood_group ?? null, notes ?? null]
  );
  return result.insertId;
};

const updatePatient = async (id, data) => {
  const allowed = ['full_name', 'age_years', 'gender', 'mobile_number', 'address', 'blood_group', 'notes'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    let val = data[key];
    if (val === undefined) {
      if (key === 'full_name') val = data.name;
      else if (key === 'mobile_number') val = data.mobile;
      else if (key === 'age_years') val = data.age;
    }
    if (val !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(val);
    }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.query(`UPDATE patients SET ${fields.join(', ')} WHERE id = ?`, vals);
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
  const [rows] = await db.query(
    `SELECT a.*, p.full_name AS patient_name, p.mobile_number AS mobile, e.full_name AS doctor_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     LEFT JOIN employees e ON e.id = a.doctor_id
     ${where}
     ORDER BY a.appointment_date DESC, a.token_number ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM appointments a ${where}`, params);
  return { rows, total };
};

const createAppointment = async (data) => {
  const { patient_id, doctor_id, department_id, appointment_date, token_number, type, consult_fee, booked_by } = data;
  const [result] = await db.query(
    `INSERT INTO appointments (patient_id, doctor_id, department_id, appointment_date, token_number, type, consult_fee, booked_by, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
    [patient_id, doctor_id, department_id ?? null, appointment_date, token_number ?? null, type ?? 'consultation', consult_fee ?? 0, booked_by ?? null]
  );
  return result.insertId;
};

const updateAppointmentStatus = async (id, status) => {
  await db.query(`UPDATE appointments SET status = ? WHERE id = ?`, [status, id]);
};

/* ─── ADMISSIONS ─── */
const listAdmissions = async ({ patientId, status, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (patientId) { filters.push('ad.patient_id = ?'); params.push(patientId); }
  if (status) { filters.push('ad.status = ?'); params.push(status); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT ad.*, p.full_name AS patient_name, p.mobile_number AS mobile, e.full_name AS doctor_name, b.bed_label, r.room_number
     FROM admissions ad
     JOIN patients p ON p.id = ad.patient_id
     LEFT JOIN employees e ON e.id = ad.admitting_doctor_id
     LEFT JOIN admission_beds ab ON ab.admission_id = ad.id
     LEFT JOIN beds b ON b.id = ab.bed_id
     LEFT JOIN rooms r ON r.id = b.room_id
     ${where}
     ORDER BY ad.admission_datetime DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM admissions ad ${where}`, params);
  return { rows, total };
};

const createAdmission = async (data) => {
  const { patient_id, appointment_id, admitting_doctor_id, admission_datetime, notes, created_by, bed_id } = data;
  const connection = await db.getConnection();
  await connection.beginTransaction();
  try {
    const [result] = await connection.execute(
      `INSERT INTO admissions (patient_id, appointment_id, admitting_doctor_id, admission_datetime, notes, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, 'admitted')`,
      [patient_id, appointment_id ?? null, admitting_doctor_id, admission_datetime ?? new Date(), notes ?? null, created_by ?? null]
    );
    const admissionId = result.insertId;

    if (bed_id) {
      await connection.execute(
        `INSERT INTO admission_beds (admission_id, bed_id, allocated_from) VALUES (?, ?, NOW())`,
        [admissionId, bed_id]
      );
      await connection.execute(
        `UPDATE beds SET status = 'occupied' WHERE id = ?`,
        [bed_id]
      );
    }
    
    await connection.commit();
    return admissionId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/* ─── DISCHARGES ─── */
const createDischarge = async (data) => {
  const { admission_id, discharge_datetime, diagnosis_summary, treatment_summary, doctor_advice, discharge_condition, room_charges, pharmacy_charges, other_charges, follow_up_date, final_bill_amount, amount_paid, payment_mode, discharge_notes, discharged_by } = data;
  
  const [result] = await db.execute(
    `INSERT INTO discharges (admission_id, discharge_datetime, diagnosis_summary, treatment_summary, doctor_advice, discharge_condition, room_charges, pharmacy_charges, other_charges, follow_up_date, final_bill_amount, amount_paid, balance_due, payment_mode, discharge_notes, discharged_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [admission_id, discharge_datetime ?? new Date(), diagnosis_summary ?? null, treatment_summary ?? null, doctor_advice ?? null, discharge_condition ?? 'recovered', room_charges ?? 0, pharmacy_charges ?? 0, other_charges ?? 0, follow_up_date ?? null, final_bill_amount ?? 0, amount_paid ?? 0, (final_bill_amount ?? 0) - (amount_paid ?? 0), payment_mode ?? 'cash', discharge_notes ?? null, discharged_by ?? null]
  );
  
  // Update admission status
  await db.execute(`UPDATE admissions SET status = 'discharged' WHERE id = ?`, [admission_id]);
  
  // Update bed status to 'available' if bed was occupied
  const [beds] = await db.execute(`SELECT bed_id FROM admission_beds WHERE admission_id = ?`, [admission_id]);
  if (beds.length > 0) {
     await db.execute(`UPDATE beds SET status = 'available' WHERE id = ?`, [beds[0].bed_id]);
     await db.execute(`UPDATE admission_beds SET allocated_to = NOW() WHERE admission_id = ? AND allocated_to IS NULL`, [admission_id]);
  }
  
  return result.insertId;
};

module.exports = {
  listPatients, getPatient, createPatient, updatePatient,
  listAppointments, createAppointment, updateAppointmentStatus,
  listAdmissions, createAdmission,
  createDischarge,
};
