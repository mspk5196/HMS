const db = require('../../config/db');

const getConsultationByAppointment = async (appointmentId) => {
  const [rows] = await db.execute(
    `SELECT c.*, e.full_name as doctor_name 
     FROM consultations c 
     LEFT JOIN employees e ON c.doctor_id = e.id 
     WHERE c.appointment_id = ?`,
    [appointmentId]
  );
  const consultation = rows[0] || null;

  if (consultation) {
    const [prescriptions] = await db.execute(
      `SELECT p.id as prescription_id 
       FROM prescriptions p 
       WHERE p.consultation_id = ?`,
      [consultation.id]
    );
    
    if (prescriptions.length > 0) {
      const prescriptionId = prescriptions[0].prescription_id;
      const [items] = await db.execute(
        `SELECT pi.*, m.name as medicine_name, m.generic_name 
         FROM prescription_items pi
         JOIN medicines m ON m.id = pi.medicine_id
         WHERE pi.prescription_id = ?`,
        [prescriptionId]
      );
      consultation.prescription_items = items;
    } else {
      consultation.prescription_items = [];
    }
  }

  return consultation;
};

const createConsultation = async (data, connection = db) => {
  const { appointment_id, doctor_id, diagnosis, complaints, doctor_notes, follow_up_date } = data;
  const [result] = await connection.execute(
    `INSERT INTO consultations (appointment_id, doctor_id, diagnosis, complaints, doctor_notes, follow_up_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [appointment_id, doctor_id, diagnosis ?? null, complaints ?? null, doctor_notes ?? null, follow_up_date ?? null]
  );
  return result.insertId;
};

const createPrescription = async (consultationId, connection = db) => {
  const [result] = await connection.execute(
    `INSERT INTO prescriptions (consultation_id) VALUES (?)`,
    [consultationId]
  );
  return result.insertId;
};

const createPrescriptionItems = async (prescriptionId, items, connection = db) => {
  if (!items || items.length === 0) return;

  const values = [];
  const placeholders = [];
  
  for (const item of items) {
    placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?)');
    values.push(
      prescriptionId,
      item.medicine_id,
      item.dose_morning ?? 0,
      item.dose_afternoon ?? 0,
      item.dose_night ?? 0,
      item.duration_days ?? 1,
      item.food_instruction ?? 'anytime',
      item.notes ?? null
    );
  }

  await connection.execute(
    `INSERT INTO prescription_items 
     (prescription_id, medicine_id, dose_morning, dose_afternoon, dose_night, duration_days, food_instruction, notes)
     VALUES ${placeholders.join(', ')}`,
    values
  );
};

const updateAppointmentStatus = async (appointmentId, status, connection = db) => {
  await connection.execute(
    `UPDATE appointments SET status = ? WHERE id = ?`,
    [status, appointmentId]
  );
};

module.exports = {
  getConsultationByAppointment,
  createConsultation,
  createPrescription,
  createPrescriptionItems,
  updateAppointmentStatus
};
