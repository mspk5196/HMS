/**
 * salary.controller.js
 * HTTP layer for Salary & Payroll.
 */

const svc = require('./salary.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created, paginated, fail } = require('../../utils/response');

/* ─── SALARY STRUCTURES ─── */

const listStructures = asyncHandler(async (req, res) => {
  const { employeeId } = req.query;
  const rows = await svc.listSalaryStructures(employeeId ? Number(employeeId) : null);
  return res.json(success(rows));
});

/** GET /api/salary/effective/:employeeId?month=&year= — what payroll will use. */
const getEffectiveSalary = asyncHandler(async (req, res) => {
  const now = new Date();
  const month = Number(req.query.month) || now.getMonth() + 1;
  const year = Number(req.query.year) || now.getFullYear();
  const salary = await svc.getEffectiveSalary(Number(req.params.employeeId), month, year);
  if (!salary) return res.status(404).json(fail('No salary configured for this employee'));
  return res.json(success({ ...salary, month, year }));
});

/** POST /api/salary/structures/revision — an increment, preserving history. */
const addRevision = asyncHandler(async (req, res) => {
  const id = await svc.addSalaryRevision({ ...req.body, created_by: req.user?.id ?? null });
  return res.status(201).json(created({ id }, 'Salary revision recorded'));
});

/* ─── PAYROLL CONFIG ─── */

const getConfig = asyncHandler(async (req, res) =>
  res.json(success(await svc.getPayrollConfig())));

const updateConfig = asyncHandler(async (req, res) => {
  const entries = Object.entries(req.body ?? {});
  if (!entries.length) return res.status(400).json(fail('No config values supplied'));
  for (const [key, value] of entries) await svc.setPayrollConfig(key, value);
  return res.json(success(await svc.getPayrollConfig(), `${entries.length} config value(s) updated`));
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
  // Accept the older pay_month/pay_year spelling as well as the column names.
  const month = Number(req.body.period_month ?? req.body.pay_month);
  const year = Number(req.body.period_year ?? req.body.pay_year);
  const { salary_date_type, salary_date } = req.body;
  if (!month || !year) {
    return res.status(400).json(fail('period_month and period_year are required'));
  }

  const type = salary_date_type ?? 'last_day_of_month';
  let computedDate = salary_date;
  if (!computedDate) {
    // Build in UTC so the date does not shift by a day in a positive-offset zone.
    const d = type === 'last_day_of_month'
      ? new Date(Date.UTC(year, month, 0))
      : new Date(Date.UTC(year, month, 1));
    computedDate = d.toISOString().slice(0, 10);
  }

  const id = await svc.createPayrollRun({
    period_month: month, period_year: year,
    salary_date_type: type, salary_date: computedDate,
  });
  return res.status(201).json(created({ id }, 'Payroll run created'));
});

/**
 * POST /api/salary/payroll-runs/:id/calculate
 * Runs the salary engine for all employees in this run.
 */
const calculateRun = asyncHandler(async (req, res) => {
  const result = await svc.calculatePayrollForRun(Number(req.params.id));
  // Employees without a salary are reported, never silently dropped.
  const note = result.skipped.length
    ? ` ${result.skipped.length} skipped for want of a configured salary.`
    : '';
  return res.json(success(result, `Calculated ${result.calculated} payslip(s).${note}`));
});

/**
 * POST /api/salary/payroll-runs/:id/lock
 * HR confirms and locks the run. Irreversible: it also marks fines deducted.
 */
const lockRun = asyncHandler(async (req, res) => {
  const result = await svc.lockPayrollRun(Number(req.params.id), req.user?.id ?? null);
  return res.json(success(result, 'Payroll run locked and confirmed'));
});

/** GET /api/salary/payroll-runs/:id/payslip/:employeeId */
const getPayslip = asyncHandler(async (req, res) => {
  const data = await svc.getPayslip(Number(req.params.id), Number(req.params.employeeId));
  return res.json(success(data));
});

/* ─── PAYROLL ITEMS (salary breakdown per employee) ─── */

/** GET /api/salary/payroll-runs/:id/items?page=&limit= */
const listItems = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const result = await svc.getPayrollItems(Number(req.params.id), Number(page), Number(limit));
  return res.json(paginated(result.rows, result.total, page, limit));
});

/* ─── FINE TYPES ─── */

const listFineTypes = asyncHandler(async (req, res) => res.json(success(await svc.listFineTypes())));

const createFineType = asyncHandler(async (req, res) => {
  const id = await svc.createFineType(req.body);
  return res.status(201).json(created({ id }, 'Fine type created'));
});

const updateFineType = asyncHandler(async (req, res) => {
  await svc.updateFineType(Number(req.params.id), req.body);
  return res.json(success(null, 'Fine type updated'));
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

/** GET /api/salary/overtime?employeeId=&runId=&month=&year=&page=&limit= */
const listOvertime = asyncHandler(async (req, res) => {
  const { employeeId, runId, month, year, page = 1, limit = 50 } = req.query;
  const result = await svc.listOvertimeEntries({
    employeeId: employeeId ? Number(employeeId) : null,
    runId: runId ? Number(runId) : null,
    month: month ? Number(month) : null,
    year: year ? Number(year) : null,
    page: Number(page), limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/**
 * POST /api/salary/overtime
 * Body: { employee_id, entry_date, entry_type: 'extra_day'|'hourly', hours?, notes? }
 *
 * An extra full day is paid at that month's day rate. Hourly overtime is
 * recorded for the record only and never adds to salary.
 */
const createOvertime = asyncHandler(async (req, res) => {
  const id = await svc.createOvertimeEntry(req.body, req.user?.id ?? null);
  const paid = req.body.entry_type === 'extra_day';
  return res.status(201).json(
    created({ id }, paid ? 'Extra day recorded — payable at the day rate' : 'Overtime hours logged (unpaid)')
  );
});

module.exports = {
  listStructures, createStructure, updateStructure, getEffectiveSalary, addRevision,
  getConfig, updateConfig,
  listNightShiftRates, addNightShiftRate,
  listRuns, getRun, createRun, calculateRun, lockRun, getPayslip,
  listItems,
  listFineTypes, createFineType, updateFineType,
  listFines, createFine, waiveFine, cancelFine,
  listOvertime, createOvertime,
};
