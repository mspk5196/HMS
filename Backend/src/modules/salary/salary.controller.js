/**
 * salary.controller.js
 * HTTP layer for Salary & Payroll.
 */

const svc = require('./salary.service');
const q = require('./salary.queries');
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
 * POST /api/salary/payroll-runs/generate
 * Body: { period_month, period_year }
 * Creates or retrieves draft run, calculates payroll, and returns the result.
 */
const generatePayroll = asyncHandler(async (req, res) => {
  const month = Number(req.body.period_month ?? req.body.pay_month);
  const year = Number(req.body.period_year ?? req.body.pay_year);
  if (!month || !year) {
    return res.status(400).json(fail('period_month and period_year are required'));
  }

  let run = await q.findPayrollRunByPeriod(month, year);
  if (!run) {
    const d = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const runId = await q.createPayrollRun({
      period_month: month,
      period_year: year,
      salary_date_type: 'last_day_of_month',
      salary_date: d,
    });
    run = await q.getPayrollRun(runId);
  }

  const calcResult = await svc.calculatePayrollForRun(run.id);
  const items = await svc.getPayrollItems(run.id, 1, 500);
  return res.json(success({
    run,
    calcResult,
    items: items.rows || [],
    total: items.total || 0,
  }, `Payroll generated for ${month}/${year}: ${calcResult.calculated} payslips calculated.`));
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

/** PATCH /api/salary/payroll-runs/:id/items/:itemId — adjust or waive deduction before locking */
const updatePayrollItemDeduction = asyncHandler(async (req, res) => {
  const { id: runId, itemId } = req.params;
  const result = await svc.updatePayrollItemDeduction(Number(runId), Number(itemId), req.body, req.user?.id);
  return res.json(success(result, 'Payroll deduction adjusted successfully'));
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

/* ─── PAYROLL CALCULATION SUMMARY & EXCEL EXPORT ─── */

const XLSX = require('xlsx');

/**
 * GET /api/salary/payroll-runs/:id/calculation-summary
 * Returns comprehensive breakdown and EPFO/ESI challan summary for the run.
 */
const getCalculationSummary = asyncHandler(async (req, res) => {
  const runId = Number(req.params.id);
  const run = await svc.getPayrollRun(runId);
  if (!run) return res.status(404).json(fail('Payroll run not found'));

  const cfg = await svc.getPayrollConfig();
  const { rows: items } = await q.getPayrollItems(runId, 1, 10000);

  let totalStaff = items.length;
  let totalFixedSalary = 0;
  let totalEarnedBasic = 0;
  let totalEarnedHra = 0;
  let totalGross = 0;
  let totalEarnedGross = 0;
  let totalLopAmt = 0;
  let totalFines = 0;
  let totalNet = 0;

  let pfEnrolledCount = 0;
  let totalPfWages = 0;
  let totalPfEmployee = 0;
  let totalPfEmployerEps = 0;
  let totalPfEmployerEpf = 0;
  let totalPfEmployer = 0;

  let esiCoveredCount = 0;
  let totalEsiWages = 0;
  let totalEsiEmployee = 0;
  let totalEsiEmployer = 0;

  for (const it of items) {
    const fixed = Number(it.base_salary_component || 0);
    const earnedBasic = Number(it.earned_basic || 0);
    const earnedHra = Number(it.earned_hra || 0);
    const gross = Number(it.gross_pay || 0);
    const lop = Number(it.lop_amount || 0);
    const earnedGross = Math.max(0, gross - lop);
    const fines = Number(it.fines_amount || 0);
    const net = Number(it.net_pay || 0);

    const pfWage = Number(it.pf_wage || 0);
    const pfEmp = Number(it.pf_employee_amount || 0);
    const pfEps = Number(it.pf_employer_eps_amount || 0);
    const pfEpf = Number(it.pf_employer_epf_amount || 0);
    const pfEmplr = Number(it.pf_employer_amount || (pfEps + pfEpf));

    const esiWage = Number(it.esi_wage || 0);
    const esiEmp = Number(it.esi_employee_amount || 0);
    const esiEmplr = Number(it.esi_employer_amount || 0);

    totalFixedSalary += fixed;
    totalEarnedBasic += earnedBasic;
    totalEarnedHra += earnedHra;
    totalGross += gross;
    totalEarnedGross += earnedGross;
    totalLopAmt += lop;
    totalFines += fines;
    totalNet += net;

    if (pfWage > 0 || pfEmp > 0) {
      pfEnrolledCount++;
      totalPfWages += pfWage;
      totalPfEmployee += pfEmp;
      totalPfEmployerEps += pfEps;
      totalPfEmployerEpf += pfEpf;
      totalPfEmployer += pfEmplr;
    }

    if (esiWage > 0 || esiEmp > 0) {
      esiCoveredCount++;
      totalEsiWages += esiWage;
      totalEsiEmployee += esiEmp;
      totalEsiEmployer += esiEmplr;
    }
  }

  // EPFO statutory challan calculation
  const ac01 = Math.round(totalPfEmployerEpf + totalPfEmployee); // EPF Share (Employer 3.67% + Employee 12%)
  const ac02 = Math.round(totalPfWages * 0.005); // Admin charges 0.5%
  const ac10 = Math.round(totalPfEmployerEps); // EPS share (8.33%)
  const ac21 = Math.round(totalPfWages * 0.005); // EDLI charges 0.5%
  const totalEpfoChallan = ac01 + ac02 + ac10 + ac21;

  const totalEsiChallan = totalEsiEmployee + totalEsiEmployer;

  return res.json(success({
    run,
    config: cfg,
    items,
    summary: {
      totalStaff,
      totalFixedSalary,
      totalEarnedBasic,
      totalEarnedHra,
      totalGross,
      totalEarnedGross,
      totalLopAmt,
      totalFines,
      totalNet,
      pf: {
        enrolledCount: pfEnrolledCount,
        totalPfWages,
        totalPfEmployee,
        totalPfEmployerEps,
        totalPfEmployerEpf,
        totalPfEmployer,
        ac01,
        ac02,
        ac10,
        ac21,
        totalEpfoChallan,
      },
      esi: {
        coveredCount: esiCoveredCount,
        totalEsiWages,
        totalEsiEmployee,
        totalEsiEmployer,
        totalEsiChallan,
      },
    },
  }));
});

/**
 * GET /api/salary/payroll-runs/:id/export
 * Streams a multi-sheet .xlsx file:
 *  Sheet 1: SALARY STATEMENT (matching 06 STAFF ATTENDANCE  JUNE-2026.xlsx)
 *  Sheet 2: EPF & ESI CALCULATION (matching EPF & ESI CALCULATION.xlsx)
 */
const exportPayrollRun = asyncHandler(async (req, res) => {
  const runId = Number(req.params.id);
  const run = await svc.getPayrollRun(runId);
  if (!run) return res.status(404).json(fail('Payroll run not found'));

  const includeOvertime = req.query.include_overtime !== 'false' && req.query.includeOvertime !== 'false';
  const pfFilter = req.query.pf_filter || req.query.pfFilter || 'all'; // 'all' | 'pf_only' | 'non_pf'
  const paymentMode = req.query.payment_mode || req.query.paymentMode || 'all'; // 'all' | 'account' | 'cash'

  const { rows } = await q.getPayrollItems(runId, 1, 10000);

  // Filter employees according to user selections
  const filteredRows = rows.filter((r) => {
    // 1. PF Filter
    const isPf = Boolean(Number(r.pf_enrolled) === 1 || Number(r.pf_wage) > 0 || Number(r.pf_employee_amount) > 0);
    if (pfFilter === 'pf_only' && !isPf) return false;
    if (pfFilter === 'non_pf' && isPf) return false;

    // 2. Payment Mode Filter
    const mode = (r.payment_mode || 'account').toLowerCase();
    if (paymentMode === 'account' && mode !== 'account') return false;
    if (paymentMode === 'cash' && mode !== 'cash') return false;

    return true;
  });

  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
  const monthName = MONTH_NAMES[(run.period_month || 1) - 1];
  const periodLabel = `${monthName} ${run.period_year}`;
  const daysInMo = svc.daysInMonth(run.period_month, run.period_year);

  // ───────────────────────────────────────────────
  // Sheet 1: SALARY STATEMENT
  // ───────────────────────────────────────────────
  const salaryRows = [
    [`SALARY STATEMENT FOR THE MONTH OF ${periodLabel.toUpperCase()}`],
    [
      `Filters Applied: ${includeOvertime ? 'With Overtime' : 'Overtime Excluded'} | PF: ${pfFilter.toUpperCase()} | Payment Mode: ${paymentMode.toUpperCase()} | Total Staff: ${filteredRows.length}`
    ],
    [
      'S.No', 'E.ID', 'PF UAN No.', 'E.S.I. No.', 'NAME OF THE STAFF', 'DEPT', 'PAY MODE',
      'BANK A/c No.', 'IFSC Code', 'BASIC+DA (70%)', 'HRA (30%)', 'TOTAL FIXED SALARY',
      'MONTH DAYS', 'WKD DAYS', 'LOP DAYS', 'LOP AMT',
      'EARNED BASIC', 'EARNED HRA', 'EARNED SALARY', 'OT DAYS', 'OT AMT',
      'GROSS SALARY', 'ADV / FINES', 'SALARY FOR PF', 'SALARY FOR ESI',
      'PF DED (12%)', 'ESI DED (0.75%)', 'TTL DED', 'NET SALARY'
    ]
  ];

  filteredRows.forEach((r, idx) => {
    const fixed = Number(r.base_salary_component || 0);
    const fixedBasic = Math.round(fixed * 0.7);
    const fixedHra = fixed - fixedBasic;
    const earnedBasic = Number(r.earned_basic || 0);
    const earnedHra = Number(r.earned_hra || 0);
    const earnedSalary = earnedBasic + earnedHra;
    const wkdDays = Number(r.days_present || 0);
    const lopDays = Number(r.days_lop || 0);
    const lopAmt = Number(r.lop_amount || 0);
    const otAmt = includeOvertime ? Number(r.overtime_amount || 0) : 0;
    const nightAmt = Number(r.night_shift_component || 0);
    const weekOffAmt = Number(r.unused_week_off_amount || 0);

    const earnedGross = includeOvertime
      ? Math.max(0, Number(r.gross_pay || 0) - lopAmt)
      : Math.max(0, earnedSalary + nightAmt + weekOffAmt);

    const fines = Number(r.fines_amount || 0);
    const pfWage = Number(r.pf_wage || 0);
    const esiWage = Number(r.esi_wage || 0);
    const pfDed = Number(r.pf_employee_amount || 0);
    const esiDed = Number(r.esi_employee_amount || 0);
    const ttlDed = pfDed + esiDed + fines;
    const netSalary = Math.max(0, earnedGross - ttlDed);

    const mode = (r.payment_mode || 'account').toLowerCase();
    const modeLabel = mode === 'cash' ? 'Cash' : 'Bank Account';
    const bankAc = mode === 'cash' ? (r.bank_account_no || 'CASH') : (r.bank_account_no || '');

    salaryRows.push([
      idx + 1,
      r.employee_code || '',
      r.uan_number || '',
      r.esi_number || (fixed > 21000 ? 'OUT OF COVER' : ''),
      r.full_name || '',
      r.department_name || '',
      modeLabel,
      bankAc,
      r.bank_ifsc || '',
      fixedBasic,
      fixedHra,
      fixed,
      daysInMo,
      wkdDays,
      lopDays,
      lopAmt,
      earnedBasic,
      earnedHra,
      earnedSalary,
      0,
      otAmt,
      earnedGross,
      fines,
      pfWage,
      esiWage,
      pfDed,
      esiDed,
      ttlDed,
      netSalary
    ]);
  });

  // ───────────────────────────────────────────────
  // Sheet 2: EPF & ESI CALCULATION
  // ───────────────────────────────────────────────
  const calcRows = [
    [`ESI CEILING LIMIT - 21000`, ``, `${periodLabel.toUpperCase()}`, `PF CEILING LIMIT - 15000`],
    [
      'S.No', 'NAME', 'GROSS 100%', 'EMPLOYER 3.25%', 'EMPLOYEE 0.75%', 'TOTAL ESI 4.5%',
      '', 'NAME', 'GROSS 70%', 'EMPLOYEE 12% EPF', 'EMPLOYER 8.33% EPS', 'EMPLOYER 3.67% EPF', 'TOTAL EMPLOYER 12%'
    ]
  ];

  let totalEsiGross = 0;
  let totalEsiEmplr = 0;
  let totalEsiEmp = 0;
  let totalPfGross = 0;
  let totalPfEmp = 0;
  let totalPfEps = 0;
  let totalPfEpf = 0;

  filteredRows.forEach((r, idx) => {
    const esiWage = Number(r.esi_wage || 0);
    const esiEmp = Number(r.esi_employee_amount || 0);
    const esiEmplr = Number(r.esi_employer_amount || 0);
    const esiTotal = esiEmp + esiEmplr;

    const pfWage = Number(r.pf_wage || 0);
    const pfEmp = Number(r.pf_employee_amount || 0);
    const pfEps = Number(r.pf_employer_eps_amount || 0);
    const pfEpf = Number(r.pf_employer_epf_amount || 0);
    const pfEmplrTotal = pfEps + pfEpf;

    totalEsiGross += esiWage;
    totalEsiEmplr += esiEmplr;
    totalEsiEmp += esiEmp;
    totalPfGross += pfWage;
    totalPfEmp += pfEmp;
    totalPfEps += pfEps;
    totalPfEpf += pfEpf;

    calcRows.push([
      idx + 1,
      r.full_name || '',
      esiWage,
      esiEmplr,
      esiEmp,
      esiTotal,
      '',
      r.full_name || '',
      pfWage,
      pfEmp,
      pfEps,
      pfEpf,
      pfEmplrTotal
    ]);
  });

  // Totals
  calcRows.push([]);
  calcRows.push([
    'TOTAL', '', totalEsiGross, totalEsiEmplr, totalEsiEmp, totalEsiEmplr + totalEsiEmp,
    '', 'TOTAL', totalPfGross, totalPfEmp, totalPfEps, totalPfEpf, totalPfEps + totalPfEpf
  ]);
  calcRows.push([]);
  calcRows.push(['', '', '', '', '', '', '', 'EPFO CHALLAN SUMMARY', 'AMOUNT (₹)']);
  calcRows.push(['', '', '', '', '', '', '', 'A/C 01 (Employer EPF 3.67% + Employee 12%)', totalPfEpf + totalPfEmp]);
  calcRows.push(['', '', '', '', '', '', '', 'A/C 02 (Administration Charges 0.5%)', Math.round(totalPfGross * 0.005)]);
  calcRows.push(['', '', '', '', '', '', '', 'A/C 10 (Employer EPS Pension 8.33%)', totalPfEps]);
  calcRows.push(['', '', '', '', '', '', '', 'A/C 21 (EDLI Insurance 0.5%)', Math.round(totalPfGross * 0.005)]);
  calcRows.push(['', '', '', '', '', '', '', 'GRAND TOTAL EPFO CHALLAN', (totalPfEpf + totalPfEmp) + Math.round(totalPfGross * 0.005) + totalPfEps + Math.round(totalPfGross * 0.005)]);
  calcRows.push(['', '', '', '', '', '', '', 'TOTAL ESI CHALLAN (Employee 0.75% + Employer 3.25%)', totalEsiEmp + totalEsiEmplr]);

  const wb = XLSX.utils.book_new();

  const wsSalary = XLSX.utils.aoa_to_sheet(salaryRows);
  const colWidthsSalary = salaryRows[2].map((_, ci) =>
    Math.max(10, Math.max(...salaryRows.slice(2).map((row) => String(row[ci] ?? '').length)) + 2)
  );
  wsSalary['!cols'] = colWidthsSalary.map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsSalary, 'SALARY STATEMENT');

  const wsCalc = XLSX.utils.aoa_to_sheet(calcRows);
  const colWidthsCalc = calcRows[1].map((_, ci) =>
    Math.max(12, Math.max(...calcRows.slice(1, filteredRows.length + 2).map((row) => String(row[ci] ?? '').length)) + 2)
  );
  wsCalc['!cols'] = colWidthsCalc.map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsCalc, 'EPF & ESI CALCULATION');

  let suffix = '';
  if (pfFilter === 'pf_only') suffix += '_PFOnly';
  else if (pfFilter === 'non_pf') suffix += '_NonPF';
  if (paymentMode === 'account') suffix += '_BankTransfer';
  else if (paymentMode === 'cash') suffix += '_Cash';
  if (!includeOvertime) suffix += '_NoOT';

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `Payroll_${periodLabel.replace(' ', '_')}_Run${runId}${suffix}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

module.exports = {
  listStructures, createStructure, updateStructure, getEffectiveSalary, addRevision,
  getConfig, updateConfig,
  listNightShiftRates, addNightShiftRate,
  listRuns, getRun, createRun, calculateRun, generatePayroll, lockRun, getPayslip,
  listItems, updatePayrollItemDeduction, getCalculationSummary, exportPayrollRun,
  listFineTypes, createFineType, updateFineType,
  listFines, createFine, waiveFine, cancelFine,
  listOvertime, createOvertime,
};
