/**
 * salary.routes.js
 *
 * Base path: /api/salary   (mounted in app.js)
 *
 * Salary Structures
 * GET    /structures                     List all salary structures
 * POST   /structures                     Create a salary structure
 * PATCH  /structures/:id                 Update a salary structure
 *
 * Night-Shift Rates
 * GET    /night-shift-rates/:shiftId     Rate history for a shift
 * POST   /night-shift-rates              Add a new rate (closes current active)
 *
 * Payroll Runs
 * GET    /payroll-runs                   List runs (paginated)
 * GET    /payroll-runs/:id               Get a single run
 * POST   /payroll-runs                   Create a draft run
 * POST   /payroll-runs/:id/calculate     Run the salary engine
 * POST   /payroll-runs/:id/lock          Lock (HR confirm)
 * GET    /payroll-runs/:id/items         Per-employee salary breakdown
 *
 * Fines
 * GET    /fines                          List fines (filtered)
 * POST   /fines                          Create a fine
 * PATCH  /fines/:id/waive               Waive a fine
 * PATCH  /fines/:id/cancel              Cancel a fine
 *
 * Overtime
 * GET    /overtime                       List overtime entries
 * POST   /overtime                       Create overtime entry
 */

const router = require('express').Router();
const ctrl = require('./salary.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');
const { gate } = require('../../middleware/approvalGate');

router.use(verifyToken);
const canViewPayroll = requirePermissions(['payroll.view']);
const canViewFine = requirePermissions(['fine.view']);

// Salary Structures
router.get('/structures', canViewPayroll, ctrl.listStructures);
router.post('/structures', gate('payroll.create', ctrl.createStructure));
router.post('/structures/revision', gate('payroll.edit', ctrl.addRevision));
router.patch('/structures/:id', gate('payroll.edit', ctrl.updateStructure));

// What payroll will actually use for an employee in a period
router.get('/effective/:employeeId', canViewPayroll, ctrl.getEffectiveSalary);

// Payroll constants (PF/ESI percentages and ceilings)
router.get('/config', canViewPayroll, ctrl.getConfig);
router.patch('/config', gate('payroll.edit', ctrl.updateConfig));

// Night-shift rates
router.get('/night-shift-rates/:shiftId', canViewPayroll, ctrl.listNightShiftRates);
router.post('/night-shift-rates', gate('payroll.edit', ctrl.addNightShiftRate));

// Payroll runs
router.get('/payroll-runs', canViewPayroll, ctrl.listRuns);
router.get('/payroll-runs/:id', canViewPayroll, ctrl.getRun);
router.post('/payroll-runs', gate('payroll.create', ctrl.createRun));
router.post('/payroll-runs/generate', gate('payroll.generate_payroll', ctrl.generatePayroll));
router.post('/payroll-runs/:id/calculate', gate('payroll.edit', ctrl.calculateRun));
router.post('/payroll-runs/:id/lock', gate('payroll.approve_payroll', ctrl.lockRun));
router.get('/payroll-runs/:id/items', canViewPayroll, ctrl.listItems);
router.patch('/payroll-runs/:id/items/:itemId', gate('payroll.edit', ctrl.updatePayrollItemDeduction));
router.get('/payroll-runs/:id/calculation-summary', canViewPayroll, ctrl.getCalculationSummary);
router.get('/payroll-runs/:id/export', canViewPayroll, ctrl.exportPayrollRun);
router.get('/payroll-runs/:id/payslip/:employeeId', canViewPayroll, ctrl.getPayslip);

// Fine Types
router.get('/fine-types', canViewFine, ctrl.listFineTypes);
router.post('/fine-types', gate('fine.create', ctrl.createFineType));
router.patch('/fine-types/:id', gate('fine.edit', ctrl.updateFineType));

// Fines
router.get('/fines', canViewFine, ctrl.listFines);
router.post('/fines', gate('fine.create', ctrl.createFine));
router.patch('/fines/:id/waive', gate('fine.waive_fine', ctrl.waiveFine));
router.patch('/fines/:id/cancel', gate('fine.delete', ctrl.cancelFine));

// Overtime
router.get('/overtime', canViewPayroll, ctrl.listOvertime);
router.post('/overtime', gate('payroll.edit', ctrl.createOvertime));

module.exports = router;
