/**
 * attendance.routes.js
 *
 * Base path: /api/attendance   (mounted in app.js)
 *
 * GET    /                            List daily summaries (filtered)
 * GET    /:employeeId/:date           Get one employee's summary for a date
 * POST   /process                     Run attendance engine for a date
 * POST   /punches/import              Import eTimeTracker punch rows
 * POST   /mark                        Admin manual mark
 * GET    /biometric-windows           List all biometric window overrides
 * POST   /biometric-windows           Create a biometric window override
 * GET    /corrections                 List correction requests
 * POST   /corrections                 Submit a correction request
 * PATCH  /corrections/:id/review      Approve or reject a correction request
 * GET    /buffer                      Late-buffer summary for a month
 */

const router = require('express').Router();
const ctrl = require('./attendance.controller');

// Daily summaries
router.get('/', ctrl.listSummaries);
router.get('/:employeeId/:date', ctrl.getSummary);

// Processing engine
router.post('/process', ctrl.processDay);

// Punch import (eTimeTracker)
router.post('/punches/import', ctrl.importPunches);

// Admin manual mark
router.post('/mark', ctrl.manualMark);
router.post('/manual-punch', ctrl.manualPunch);

// Biometric windows
router.get('/biometric-windows', ctrl.listBiometricWindows);
router.post('/biometric-windows', ctrl.createBiometricWindow);

// Correction requests
router.get('/corrections', ctrl.listCorrections);
router.post('/corrections', ctrl.createCorrection);
router.patch('/corrections/:id/review', ctrl.reviewCorrection);

// Buffer summary
router.get('/buffer', ctrl.getBufferSummary);
router.get('/buffer/employee/:id', ctrl.getEmployeeBuffer);


module.exports = router;
