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
const { verifyToken, requirePermissions } = require('../../middleware/auth');
const { gate } = require('../../middleware/approvalGate');

router.use(verifyToken);
const canView = requirePermissions(['attendance.view']);
const canViewBiometric = requirePermissions(['biometric.view', 'attendance.view']);
const canManageBuffer = requirePermissions(['attendance.manage_buffer', 'attendance.view']);
const canViewFine = requirePermissions(['fine.view']);

// Attendance register & matrix summary (daily / weekly / monthly)
router.get('/register', canView, ctrl.getAttendanceRegister);

// Daily summaries — the two-segment param route must come after the static
// multi-segment routes below, so it is registered last.
router.get('/', canView, ctrl.listSummaries);

// Processing engine
router.post('/process', gate('attendance.recalculate', ctrl.processDay));

// Punch import (eSSL / eTimeTracker)
router.post('/punches/import', gate('attendance.import_punches', ctrl.importPunches));
router.get('/punches/unmatched', canViewBiometric, ctrl.listUnmatchedPunches);
router.get('/punches', canViewBiometric, ctrl.listRawPunches);
router.get('/punches/employee/:id', canViewBiometric, ctrl.getEmployeeTimeline);

// Admin manual mark
router.post('/mark', gate('attendance.manual_mark', ctrl.manualMark));
router.post('/manual-punch', gate('attendance.manual_mark', ctrl.manualPunch));

// Biometric windows
router.get('/biometric-windows', canViewBiometric, ctrl.listBiometricWindows);
router.post('/biometric-windows', gate('biometric.manage_windows', ctrl.createBiometricWindow));

// Correction requests
router.get('/corrections', canView, ctrl.listCorrections);
router.post('/corrections', ctrl.createCorrection);
router.patch('/corrections/:id/review', gate('attendance.edit', ctrl.reviewCorrection));

// Biometric Devices & eSSL Live Sync
router.get('/devices', canViewBiometric, ctrl.listDevices);
router.post('/devices', gate('biometric.manage_devices', ctrl.createDevice));
router.post('/devices/sync-all', gate('biometric.sync_device', ctrl.syncAllDevices));
router.post('/devices/sync-historical', gate('biometric.sync_device', ctrl.syncHistoricalPunches));
router.post('/devices/sync-all-users', gate('biometric.sync_device', ctrl.syncAllDeviceUsers));
router.put('/devices/:id', gate('biometric.manage_devices', ctrl.updateDevice));
router.delete('/devices/:id', gate('biometric.manage_devices', ctrl.deleteDevice));
router.post('/devices/:id/test', canViewBiometric, ctrl.testDevice);
router.post('/devices/:id/sync', gate('biometric.sync_device', ctrl.syncDevice));
router.post('/devices/:id/sync-users', gate('biometric.sync_device', ctrl.syncDeviceUsers));
router.post('/devices/:id/fetch-users', gate('biometric.sync_device', ctrl.syncDeviceUsers));

// Biometric Enrolled Staff Registrations
router.get('/enrolled-users/next-code', canViewBiometric, ctrl.getNextEnrollCode);
router.get('/enrolled-users', canViewBiometric, ctrl.listEnrolledUsers);
router.post('/enrolled-users', gate('biometric.create', ctrl.upsertEnrolledUsers));
router.post('/enrolled-users/register', gate('biometric.create', ctrl.registerEnrolledUser));
router.post('/enrolled-users/auto-link', gate('biometric.create', ctrl.autoLinkUsers));
router.post('/enrolled-users/:id/link', gate('biometric.edit', ctrl.linkEnrolledUser));

// Buffer pool
router.get('/buffer', canManageBuffer, ctrl.getBufferSummary);
router.get('/buffer/employee/:id', canManageBuffer, ctrl.getEmployeeBuffer);

// Late Attendance Fines (manual buffer overage fines)
router.get('/late-fines/candidates', canViewFine, ctrl.getLateFineCandidates);
router.post('/late-fines/apply', gate('fine.apply_late_fines', ctrl.applyLateFines));
router.patch('/late-fines/:id/cancel', gate('fine.delete', ctrl.cancelLateFine));
router.patch('/late-fines/:id/waive', gate('fine.waive_fine', ctrl.waiveLateFine));

// Registered last so it cannot shadow any static route above.
router.get('/:employeeId/:date', canView, ctrl.getSummary);

module.exports = router;
