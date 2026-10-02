const db = require('../../config/db');
const queries = require('./consultation.queries');

const getConsultation = async (appointmentId) => {
  return await queries.getConsultationByAppointment(appointmentId);
};

const getConsultationById = async (id) => {
  return await queries.getConsultationById(id);
};

const saveConsultation = async (data, doctorId) => {
  const {
    appointment_id, diagnosis, complaints, doctor_notes, follow_up_date, prescription_items,
    bp_systolic, bp_diastolic, temperature, pulse, spo2, weight, height, blood_sugar,
  } = data;
  
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Check if consultation already exists
    const existing = await queries.getConsultationByAppointment(appointment_id);
    if (existing) {
      throw new Error('Consultation already exists for this appointment');
    }

    // Create consultation
    const consultationData = {
      appointment_id,
      doctor_id: doctorId,
      diagnosis, complaints, doctor_notes, follow_up_date,
      bp_systolic, bp_diastolic, temperature, pulse, spo2, weight, height, blood_sugar,
    };
    
    const consultationId = await queries.createConsultation(consultationData, connection);

    // Create prescription if items exist
    if (prescription_items && prescription_items.length > 0) {
      const prescriptionId = await queries.createPrescription(consultationId, connection);
      await queries.createPrescriptionItems(prescriptionId, prescription_items, connection);
    }

    // Update appointment status
    await queries.updateAppointmentStatus(appointment_id, 'completed', connection);

    await connection.commit();
    return { success: true, consultation_id: consultationId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getAddenda = async (consultationId) => {
  return queries.getAddenda(consultationId);
};

const addAddendum = async (consultationId, employeeId, note) => {
  if (!note?.trim()) throw new Error('Addendum note cannot be empty.');
  const consultation = await queries.getConsultationById(consultationId);
  if (!consultation) throw new Error('Consultation not found.');
  const id = await queries.createAddendum(consultationId, employeeId, note.trim());
  const addenda = await queries.getAddenda(consultationId);
  return addenda.find((a) => a.id === id) || { id };
};

module.exports = {
  getConsultation,
  getConsultationById,
  saveConsultation,
  getAddenda,
  addAddendum,
};
