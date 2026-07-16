const router = require('express').Router();
const ctrl = require('./patient.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');

router.use(verifyToken);

// Patients
router.get('/patients', ctrl.listPatients);
router.get('/patients/:id', ctrl.getPatient);
router.post('/patients', ctrl.createPatient);
router.patch('/patients/:id', ctrl.updatePatient);

// Appointments
router.get('/appointments', ctrl.listAppointments);
router.post('/appointments', ctrl.createAppointment);
router.patch('/appointments/:id/status', ctrl.updateAppointmentStatus);

// Admissions
router.get('/admissions', ctrl.listAdmissions);
router.post('/admissions', ctrl.createAdmission);
router.post('/discharges', ctrl.createDischarge);

module.exports = router;
