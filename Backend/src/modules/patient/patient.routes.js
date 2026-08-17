const router = require('express').Router();
const ctrl = require('./patient.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');
const { gate } = require('../../middleware/approvalGate');

router.use(verifyToken);

// Patients — static segments before /:id
router.get('/patients/by-mobile/:mobile', requirePermissions(['patient.view']), ctrl.findByMobile);
router.get('/patients', requirePermissions(['patient.view']), ctrl.listPatients);
router.get('/patients/:id', requirePermissions(['patient.view']), ctrl.getPatient);
router.get('/patients/:id/history', requirePermissions(['patient.view']), ctrl.getPatientHistory);
router.post('/patients', gate('patient.create', ctrl.createPatient));
router.patch('/patients/:id', gate('patient.edit', ctrl.updatePatient));

// Appointments
router.get('/appointments', requirePermissions(['appointment.view']), ctrl.listAppointments);
router.get('/appointments/:id', requirePermissions(['appointment.view']), ctrl.getAppointment);
router.post('/appointments', gate('appointment.create', ctrl.createAppointment));
router.patch('/appointments/:id/status', gate('appointment.edit', ctrl.updateAppointmentStatus));
router.post('/appointments/:id/close', gate('appointment.close_visit', ctrl.closeWalkInVisit));

// Admissions & Beds
router.get('/admissions', requirePermissions(['admission.view']), ctrl.listAdmissions);
router.get('/admissions/:id', requirePermissions(['admission.view']), ctrl.getAdmission);
router.get('/admissions/:id/discharge-preview', requirePermissions(['discharge.view']), ctrl.previewDischarge);
router.get('/admissions/:id/discharge', requirePermissions(['discharge.view']), ctrl.getDischarge);
router.get('/admissions/:id/timeline', requirePermissions(['admission.view']), ctrl.getAdmissionTimeline);
router.get('/admissions/:id/notes', requirePermissions(['admission.view']), ctrl.listAdmissionNotes);
router.post('/admissions/:id/notes', gate('admission.add_note', ctrl.createAdmissionNote));
router.post('/admissions', gate('admission.create', ctrl.createAdmission));
router.post('/admissions/:id/beds', gate('admission.assign_bed', ctrl.assignBed));
router.delete('/admissions/:id/beds/:bedId', gate('admission.release_bed', ctrl.releaseBed));

// Discharges
router.post('/discharges', gate('discharge.discharge_patient', ctrl.createDischarge));
router.post('/discharges/:admissionId/payment', gate('discharge.record_payment', ctrl.recordDischargePayment));

module.exports = router;
