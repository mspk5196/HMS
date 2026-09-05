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

// Salary Structures
router.get('/structures', ctrl.listStructures);
router.post('/structures', ctrl.createStructure);
router.post('/structures/revision', ctrl.addRevision);
router.patch('/structures/:id', ctrl.updateStructure);

// What payroll will actually use for an employee in a period
router.get('/effective/:employeeId', ctrl.getEffectiveSalary);

// Payroll constants (PF/ESI percentages and ceilings)
router.get('/config', ctrl.getConfig);
router.patch('/config', ctrl.updateConfig);

// Night-shift rates
router.get('/night-shift-rates/:shiftId', ctrl.listNightShiftRates);
router.post('/night-shift-rates', ctrl.addNightShiftRate);

// Payroll runs
router.get('/payroll-runs', ctrl.listRuns);
router.get('/payroll-runs/:id', ctrl.getRun);
router.post('/payroll-runs', ctrl.createRun);
router.post('/payroll-runs/generate', ctrl.generatePayroll);
router.post('/payroll-runs/:id/calculate', ctrl.calculateRun);
router.post('/payroll-runs/:id/lock', ctrl.lockRun);
router.get('/payroll-runs/:id/items', ctrl.listItems);
router.get('/payroll-runs/:id/calculation-summary', ctrl.getCalculationSummary);
router.get('/payroll-runs/:id/export', ctrl.exportPayrollRun);
router.get('/payroll-runs/:id/payslip/:employeeId', ctrl.getPayslip);

// Fine Types
router.get('/fine-types', ctrl.listFineTypes);
router.post('/fine-types', ctrl.createFineType);
router.patch('/fine-types/:id', ctrl.updateFineType);

// Fines
router.get('/fines', ctrl.listFines);
router.post('/fines', ctrl.createFine);
router.patch('/fines/:id/waive', ctrl.waiveFine);
router.patch('/fines/:id/cancel', ctrl.cancelFine);

// Overtime
router.get('/overtime', ctrl.listOvertime);
router.post('/overtime', ctrl.createOvertime);

module.exports = router;
