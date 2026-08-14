const db = require('../../config/db');
const queries = require('./consultation.queries');

const getConsultation = async (appointmentId) => {
  return await queries.getConsultationByAppointment(appointmentId);
};

const getConsultationById = async (id) => {
  return await queries.getConsultationById(id);
};

const saveConsultation = async (data, doctorId) => {
  const { appointment_id, diagnosis, complaints, doctor_notes, follow_up_date, prescription_items } = data;
  
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
      diagnosis,
      complaints,
      doctor_notes,
      follow_up_date
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

module.exports = {
  getConsultation,
  getConsultationById,
  saveConsultation
};
