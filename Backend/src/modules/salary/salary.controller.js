/**
 * salary.controller.js
 * HTTP layer for Salary & Payroll.
 */

const svc = require('./salary.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created, paginated, fail } = require('../../utils/response');

/* ─── SALARY STRUCTURES ─── */

const listStructures = asyncHandler(async (req, res) => {
  const rows = await svc.listSalaryStructures();
  return res.json(success(rows));
});

const createStructure = asyncHandler(async (req, res) => {
  const id = await svc.createSalaryStructure(req.body);
  return res.status(201).json(created({ id }, 'Salary structure created'));
});

const updateStructure = asyncHandler(async (req, res) => {
  await svc.updateSalaryStructure(Number(req.params.id), req.body);
  return res.json(success(null, 'Salary structure updated'));
});

/* ─── NIGHT-SHIFT RATES ─── */

/** GET /api/salary/night-shift-rates/:shiftId */
const listNightShiftRates = asyncHandler(async (req, res) => {
  const rows = await svc.listNightShiftRates(Number(req.params.shiftId));
  return res.json(success(rows));
});

/**
 * POST /api/salary/night-shift-rates
 * Body: { shift_id, night_rate_amount, effective_from, reason? }
 */
const addNightShiftRate = asyncHandler(async (req, res) => {
  const id = await svc.addNightShiftRate(req.body, req.user?.id ?? null);
  return res.status(201).json(created({ id }, 'Night-shift rate added'));
});

/* ─── PAYROLL RUNS ─── */

/** GET /api/salary/payroll-runs?page=&limit= */
const listRuns = asyncHandler(async (req, res) => {
  const { page = 1, limit = 12 } = req.query;
  const result = await svc.listPayrollRuns(Number(page), Number(limit));
  return res.json(paginated(result.rows, result.total, page, limit));
});

/** GET /api/salary/payroll-runs/:id */
const getRun = asyncHandler(async (req, res) => {
  const run = await svc.getPayrollRun(Number(req.params.id));
  if (!run) return res.status(404).json(fail('Payroll run not found'));
  return res.json(success(run));
});

/**
 * POST /api/salary/payroll-runs
 * Body: { pay_month, pay_year, salary_date_type?, salary_date? }
 */
const createRun = asyncHandler(async (req, res) => {
  const { pay_month, pay_year, salary_date_type, salary_date } = req.body;
  if (!pay_month || !pay_year) {
    return res.status(400).json(fail('pay_month and pay_year are required'));
  }

  // Compute salary_date if not provided
  let computedDate = salary_date;
  const type = salary_date_type ?? 'last_day_of_month';
  if (!computedDate) {
    if (type === 'last_day_of_month') {
      const lastDay = new Date(pay_year, pay_month, 0); // 0th = last day of prev month
      computedDate = lastDay.toISOString().split('T')[0];
    } else {
      // first_of_next_month
      const firstNext = new Date(pay_year, pay_month, 1);
      computedDate = firstNext.toISOString().split('T')[0];
    }
  }

  const id = await svc.createPayrollRun({
    pay_month, pay_year, salary_date_type: type,
    salary_date: computedDate, created_by: req.user?.id ?? null,
  });
  return res.status(201).json(created({ id }, 'Payroll run created'));
});

/**
 * POST /api/salary/payroll-runs/:id/calculate
 * Runs the salary engine for all employees in this run.
 */
const calculateRun = asyncHandler(async (req, res) => {
  const result = await svc.calculatePayrollForRun(Number(req.params.id));
  return res.json(success(result, `Calculated salary for ${result.calculated} employees`));
});

/**
 * POST /api/salary/payroll-runs/:id/lock
 * HR confirms and locks the run.
 */
const lockRun = asyncHandler(async (req, res) => {
  await svc.lockPayrollRun(Number(req.params.id), req.user?.id ?? null);
  return res.json(success(null, 'Payroll run locked and confirmed'));
});

/* ─── PAYROLL ITEMS (salary breakdown per employee) ─── */

/** GET /api/salary/payroll-runs/:id/items?page=&limit= */
const listItems = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const result = await svc.getPayrollItems(Number(req.params.id), Number(page), Number(limit));
  return res.json(paginated(result.rows, result.total, page, limit));
});

/* ─── FINES ─── */

/** GET /api/salary/fines?employeeId=&status=&month=&year=&page=&limit= */
const listFines = asyncHandler(async (req, res) => {
  const { employeeId, status, month, year, page = 1, limit = 30 } = req.query;
  const result = await svc.listFines({
    employeeId: employeeId ? Number(employeeId) : null,
    status: status || null,
    month: month ? Number(month) : null,
    year: year ? Number(year) : null,
    page: Number(page), limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/**
 * POST /api/salary/fines
 * Body: { employee_id, fine_type_id, amount, fine_date, reason?, assigned_month?, assigned_year? }
 */
const createFine = asyncHandler(async (req, res) => {
  const id = await svc.createFine(req.body, req.user?.id ?? null);
  return res.status(201).json(created({ id }, 'Fine created'));
});

/** PATCH /api/salary/fines/:id/waive  Body: { reason } */
const waiveFine = asyncHandler(async (req, res) => {
  await svc.waiveFine(Number(req.params.id), req.user?.id ?? null, req.body.reason);
  return res.json(success(null, 'Fine waived'));
});

/** PATCH /api/salary/fines/:id/cancel  Body: { reason } */
const cancelFine = asyncHandler(async (req, res) => {
  await svc.cancelFine(Number(req.params.id), req.user?.id ?? null, req.body.reason);
  return res.json(success(null, 'Fine cancelled'));
});

/* ─── OVERTIME ─── */

/** GET /api/salary/overtime?employeeId=&runId=&page=&limit= */
const listOvertime = asyncHandler(async (req, res) => {
  const { employeeId, runId, page = 1, limit = 50 } = req.query;
  const result = await svc.listOvertimeEntries({
    employeeId: employeeId ? Number(employeeId) : null,
    runId: runId ? Number(runId) : null,
    page: Number(page), limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/** POST /api/salary/overtime  Body: { employee_id, overtime_date, extra_hours, rate_per_hour, reason?, approved_by? } */
const createOvertime = asyncHandler(async (req, res) => {
  const id = await svc.createOvertimeEntry(req.body);
  return res.status(201).json(created({ id }, 'Overtime entry created'));
});

module.exports = {
  listStructures, createStructure, updateStructure,
  listNightShiftRates, addNightShiftRate,
  listRuns, getRun, createRun, calculateRun, lockRun,
  listItems,
  listFines, createFine, waiveFine, cancelFine,
  listOvertime, createOvertime,
};
