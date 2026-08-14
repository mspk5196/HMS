const router = require('express').Router();
const ctrl = require('./patient.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');

router.use(verifyToken);

// Patients — static segments before /:id
router.get('/patients/by-mobile/:mobile', ctrl.findByMobile);
router.get('/patients', ctrl.listPatients);
router.get('/patients/:id', ctrl.getPatient);
router.get('/patients/:id/history', ctrl.getPatientHistory);
router.post('/patients', requirePermissions(['patient.modify']), ctrl.createPatient);
router.patch('/patients/:id', requirePermissions(['patient.modify']), ctrl.updatePatient);

// Appointments
router.get('/appointments', ctrl.listAppointments);
router.get('/appointments/:id', ctrl.getAppointment);
router.post('/appointments', requirePermissions(['appointment.modify']), ctrl.createAppointment);
router.patch('/appointments/:id/status', requirePermissions(['appointment.modify']), ctrl.updateAppointmentStatus);
router.post('/appointments/:id/close', requirePermissions(['appointment.close_appointment']), ctrl.closeWalkInVisit);

// Admissions & Beds
router.get('/admissions', ctrl.listAdmissions);
router.get('/admissions/:id', ctrl.getAdmission);
router.get('/admissions/:id/discharge-preview', ctrl.previewDischarge);
router.get('/admissions/:id/discharge', ctrl.getDischarge);
router.get('/admissions/:id/timeline', ctrl.getAdmissionTimeline);
router.get('/admissions/:id/notes', ctrl.listAdmissionNotes);
router.post('/admissions/:id/notes', requirePermissions(['admission.modify']), ctrl.createAdmissionNote);
router.post('/admissions', requirePermissions(['admission.convert_to_admission']), ctrl.createAdmission);
router.post('/admissions/:id/beds', requirePermissions(['admission.assign_bed']), ctrl.assignBed);
router.delete('/admissions/:id/beds/:bedId', requirePermissions(['admission.assign_bed']), ctrl.releaseBed);

// Discharges
router.post('/discharges', requirePermissions(['discharge.discharge_patient']), ctrl.createDischarge);
router.post('/discharges/:admissionId/payment', requirePermissions(['discharge.modify']), ctrl.recordDischargePayment);

module.exports = router;
