/**
 * salary.service.js
 * Business logic for Salary & Payroll.
 *
 * Key entry point: calculatePayrollForRun(runId)
 *   - Iterates every active employee
 *   - Reads their attendance summary for the pay period
 *   - Applies the salary structure formula (monthly/daily/shift)
 *   - Adds night-shift component (from shift_rate_history)
 *   - Deducts LOP, buffer excess, fines, PF, ESI
 *   - Writes a payroll_items row per employee
 */

const db = require('../../config/db');
const q = require('./salary.queries');
const { AppError } = require('../../utils/errors');

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Compute per-employee salary figures for a given pay period.
 *
 * @param {object} employee   - employees row (must include id, designation_id)
 * @param {object} ss         - salary_structures row
 * @param {object} summary    - aggregated attendance data for the period
 * @param {number} finesAmt   - total active fines assigned to this period
 * @returns {object} breakdown
 */
const computeSalary = async (employee, ss, summary, finesAmt) => {
  const {
    salary_type, gross_monthly, rate_per_day, rate_per_shift,
    base_salary, night_shift_extra_amount,
    pf_percent, esi_percent,
  } = ss;

  const {
    days_present = 0, days_absent = 0, days_half = 0,
    days_lop = 0, shifts_worked = 0, night_shifts_worked = 0,
    buffer_late_excess_minutes = 0, total_overtime_amount = 0,
    working_days_in_month = 26, // default; overridden below
  } = summary;

  let baseSalaryComponent = 0;
  let nightShiftComponent = 0;

  if (salary_type === 'monthly') {
    // Pro-rate by (days_present + days_half*0.5) / working_days_in_month
    const effectiveDays = days_present + days_half * 0.5;
    baseSalaryComponent = round2((gross_monthly / working_days_in_month) * effectiveDays);
  } else if (salary_type === 'per_day') {
    const effectiveDays = days_present + days_half * 0.5;
    baseSalaryComponent = round2(rate_per_day * effectiveDays);
  } else if (salary_type === 'per_shift') {
    baseSalaryComponent = round2(rate_per_shift * shifts_worked);
  }

  // Night-shift component: per night shift worked, use shift_rate_history rate
  nightShiftComponent = round2((night_shift_extra_amount ?? 0) * night_shifts_worked);

  const grossPay = round2(baseSalaryComponent + nightShiftComponent + total_overtime_amount);

  // LOP deduction
  const dayRate = salary_type === 'monthly'
    ? gross_monthly / working_days_in_month
    : (rate_per_day ?? 0);
  const lopAmount = round2(days_lop * dayRate);

  // Buffer excess late deduction (fractional LOP)
  const minutesPerDay = 480; // 8 hrs
  const bufferLateDed = round2((buffer_late_excess_minutes / minutesPerDay) * dayRate);

  // PF (on base, capped at statutory ceiling of ₹15,000 — configurable via payroll_config)
  const pfBase = Math.min(baseSalaryComponent, 15000);
  const pfEmployee = round2(pfBase * (pf_percent / 100));
  const pfEmployer = round2(pfBase * (pf_percent / 100));

  // ESI (on gross if gross <= ₹21,000)
  let esiEmployee = 0;
  let esiEmployer = 0;
  if (grossPay <= 21000) {
    esiEmployee = round2(grossPay * (esi_percent / 100));
    esiEmployer = round2(grossPay * (3.25 / 100)); // employer contribution
  }

  const netPay = round2(
    grossPay - lopAmount - bufferLateDed - pfEmployee - esiEmployee - finesAmt
  );

  return {
    base_salary_component: baseSalaryComponent,
    night_shift_component: nightShiftComponent,
    buffer_late_deduction: bufferLateDed,
    gross_pay: grossPay,
    lop_amount: lopAmount,
    overtime_amount: total_overtime_amount,
    pf_employee_amount: pfEmployee,
    pf_employer_amount: pfEmployer,
    esi_employee_amount: esiEmployee,
    esi_employer_amount: esiEmployer,
    fines_amount: finesAmt,
    net_pay: Math.max(0, netPay),
  };
};

/* ─────────────────────────────────────────────
   ATTENDANCE AGGREGATION FOR A PAY PERIOD
───────────────────────────────────────────── */

const getAttendanceAggregates = async (employeeId, month, year) => {
  const [rows] = await db.execute(
    `SELECT
       SUM(CASE WHEN status IN ('present','late_present') THEN 1 ELSE 0 END) AS days_present,
       SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END)                   AS days_absent,
       SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END)                 AS days_half,
       SUM(CASE WHEN status = 'lop' THEN 1 ELSE 0 END)                      AS days_lop,
       COUNT(*)                                                               AS total_records,
       SUM(COALESCE(late_minutes, 0))                                         AS total_late_minutes
     FROM attendance_daily_summary
     WHERE employee_id = ?
       AND MONTH(attendance_date) = ?
       AND YEAR(attendance_date) = ?`,
    [employeeId, month, year]
  );

  // Roster entries for this employee in the period — count worked shifts
  const [shiftRows] = await db.execute(
    `SELECT
       COUNT(*) AS shifts_worked,
       SUM(CASE WHEN s.is_night_shift = 1 THEN 1 ELSE 0 END) AS night_shifts_worked
     FROM roster_entries re
     JOIN shifts s ON s.id = re.shift_id
     JOIN attendance_daily_summary ads ON ads.employee_id = re.employee_id
       AND ads.attendance_date = re.roster_date
       AND ads.status IN ('present','late_present')
     WHERE re.employee_id = ?
       AND MONTH(re.roster_date) = ?
       AND YEAR(re.roster_date) = ?`,
    [employeeId, month, year]
  );

  // Overtime for the period
  const [otRows] = await db.execute(
    `SELECT COALESCE(SUM(amount), 0) AS total_overtime_amount
     FROM overtime_entries
     WHERE employee_id = ?
       AND MONTH(overtime_date) = ?
       AND YEAR(overtime_date) = ?`,
    [employeeId, month, year]
  );

  // Buffer excess: late minutes that fell outside the buffer
  const [bufRows] = await db.execute(
    `SELECT COALESCE(SUM(late_minutes), 0) AS total_late_minutes
     FROM attendance_daily_summary ads
     LEFT JOIN employee_attendance_buffers eab
       ON eab.employee_id = ads.employee_id
       AND eab.period_month = MONTH(ads.attendance_date)
       AND eab.period_year  = YEAR(ads.attendance_date)
     WHERE ads.employee_id = ?
       AND MONTH(ads.attendance_date) = ?
       AND YEAR(ads.attendance_date) = ?
       AND ads.late_minutes > 0`,
    [employeeId, month, year]
  );

  // Working days in the month (non-holiday, non-week-off calendar days)
  const [wdRows] = await db.execute(
    `SELECT COUNT(*) AS working_days
     FROM roster_entries re
     WHERE re.employee_id = ?
       AND MONTH(re.roster_date) = ?
       AND YEAR(re.roster_date) = ?
       AND re.is_week_off = 0
       AND re.is_holiday = 0`,
    [employeeId, month, year]
  );

  const agg = rows[0];
  const bufferRow = await db.execute(
    `SELECT buffer_allocated_minutes, buffer_used_minutes, buffer_remaining_minutes
     FROM employee_attendance_buffers
     WHERE employee_id = ? AND period_month = ? AND period_year = ?`,
    [employeeId, month, year]
  ).then(([r]) => r[0] ?? { buffer_allocated_minutes: 30, buffer_used_minutes: 0, buffer_remaining_minutes: 30 });

  const bufferExcessMinutes = Math.max(0,
    Number(agg.total_late_minutes ?? 0) - Number(bufferRow.buffer_used_minutes ?? 0)
  );

  return {
    days_present: Number(agg.days_present ?? 0),
    days_absent: Number(agg.days_absent ?? 0),
    days_half: Number(agg.days_half ?? 0),
    days_lop: Number(agg.days_lop ?? 0),
    shifts_worked: Number(shiftRows[0]?.shifts_worked ?? 0),
    night_shifts_worked: Number(shiftRows[0]?.night_shifts_worked ?? 0),
    total_overtime_amount: Number(otRows[0]?.total_overtime_amount ?? 0),
    buffer_late_excess_minutes: bufferExcessMinutes,
    working_days_in_month: Number(wdRows[0]?.working_days ?? 26),
  };
};

/* ─────────────────────────────────────────────
   MAIN PAYROLL CALCULATION
───────────────────────────────────────────── */

/**
 * Calculate (or recalculate) payroll for all active employees in a run.
 * Writes/overwrites payroll_items rows — safe to call multiple times on a draft.
 *
 * @param {number} runId
 */
const calculatePayrollForRun = async (runId) => {
  const run = await q.getPayrollRun(runId);
  if (!run) throw new AppError('Payroll run not found', 404);
  if (run.status === 'locked') throw new AppError('Cannot recalculate a locked payroll run', 400);

  const { pay_month, pay_year } = run;

  // Fetch all active employees
  const [employees] = await db.execute(
    `SELECT e.*, u.id AS user_id FROM employees e
     LEFT JOIN users u ON u.employee_id = e.id
     WHERE e.is_active = 1`
  );

  let calculated = 0;
  for (const emp of employees) {
    const ss = await q.getEmployeeSalaryStructure(emp.id);
    if (!ss) continue; // No salary structure configured — skip

    const aggr = await getAttendanceAggregates(emp.id, pay_month, pay_year);
    const finesAmt = await q.getActiveFinesAmount(emp.id, pay_month, pay_year);
    const breakdown = await computeSalary(emp, ss, aggr, finesAmt);

    await q.upsertPayrollItem({
      payroll_run_id: runId,
      employee_id: emp.id,
      salary_structure_id: ss.id,
      days_present: aggr.days_present,
      days_absent: aggr.days_absent,
      days_half: aggr.days_half,
      days_lop: aggr.days_lop,
      shifts_worked: aggr.shifts_worked,
      ...breakdown,
    });
    calculated++;
  }

  return { runId, calculated, pay_month, pay_year };
};

/**
 * Lock the payroll run after HR review.
 * Marks all deducted fines and updates run status.
 */
const lockPayrollRun = async (runId, confirmedBy) => {
  const run = await q.getPayrollRun(runId);
  if (!run) throw new AppError('Payroll run not found', 404);
  if (run.status === 'locked') throw new AppError('Already locked', 400);

  // Mark fines as deducted for every employee in this run
  const [items] = await db.execute(
    `SELECT employee_id FROM payroll_items WHERE payroll_run_id = ?`, [runId]
  );
  for (const item of items) {
    await q.markFinesDeducted(item.employee_id, run.pay_month, run.pay_year);
  }

  await q.confirmPayrollRun(runId, confirmedBy);
};

/* ─────────────────────────────────────────────
   FINE MANAGEMENT
───────────────────────────────────────────── */

const createFine = async (data, imposedBy) => {
  if (!data.employee_id || !data.fine_type_id || !data.amount || !data.fine_date) {
    throw new AppError('employee_id, fine_type_id, amount and fine_date are required', 400);
  }
  const d = new Date(data.fine_date);
  return q.createFine({
    ...data,
    imposed_by: imposedBy,
    is_auto_generated: false,
    assigned_month: data.assigned_month ?? (d.getMonth() + 1),
    assigned_year: data.assigned_year ?? d.getFullYear(),
  });
};

const waiveFine = async (fineId, waivedBy, reason) => {
  if (!reason) throw new AppError('Waiver reason is required', 400);
  await q.updateFineStatus(fineId, 'waived', { waived_by: waivedBy, waiver_reason: reason });
};

const cancelFine = async (fineId, cancelledBy, reason) => {
  if (!reason) throw new AppError('Cancellation reason is required', 400);
  await q.updateFineStatus(fineId, 'cancelled', { waived_by: cancelledBy, waiver_reason: reason });
};

/* ─────────────────────────────────────────────
   NIGHT-SHIFT RATE MANAGEMENT
───────────────────────────────────────────── */

const addNightShiftRate = async (data, changedBy) => {
  if (!data.shift_id || !data.night_rate_amount || !data.effective_from) {
    throw new AppError('shift_id, night_rate_amount and effective_from are required', 400);
  }
  return q.addNightShiftRate({ ...data, changed_by: changedBy });
};

module.exports = {
  calculatePayrollForRun,
  lockPayrollRun,
  createFine,
  waiveFine,
  cancelFine,
  addNightShiftRate,
  // Pass-through queries
  listSalaryStructures: q.listSalaryStructures,
  getSalaryStructure: q.getSalaryStructure,
  createSalaryStructure: q.createSalaryStructure,
  updateSalaryStructure: q.updateSalaryStructure,
  listNightShiftRates: q.listNightShiftRates,
  listPayrollRuns: q.listPayrollRuns,
  getPayrollRun: q.getPayrollRun,
  createPayrollRun: q.createPayrollRun,
  getPayrollItems: q.getPayrollItems,
  listFines: q.listFines,
  listOvertimeEntries: q.listOvertimeEntries,
  createOvertimeEntry: q.createOvertimeEntry,
};
