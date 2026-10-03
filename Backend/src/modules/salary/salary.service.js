/**
 * salary.service.js
 * Business logic for Salary & Payroll.
 *
 * Confirmed rules:
 *   - Salary is MONTHLY FIXED only. There is no per-day or per-shift basis.
 *   - The per-day rate is monthly salary ÷ calendar days in that month
 *     (30/31/28), matching the client's own worked example:
 *     ₹25,000 ÷ 30 = ₹833, and ₹25,000 − 2 × ₹833 = ₹23,334 for 2 LOP days.
 *   - Start from the FULL monthly salary and subtract LOP. Do not also pro-rate
 *     by days present — that deducts every absence twice.
 *   - An extra full day worked is paid; hourly overtime is logged, not paid.
 *   - All PF/ESI percentages and ceilings come from payroll_config.
 */

const db = require('../../config/db');
const q = require('./salary.queries');
const { AppError } = require('../../utils/errors');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Calendar days in a month — the divisor for the day rate. */
const daysInMonth = (month, year) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/* ─────────────────────────────────────────────
   ATTENDANCE AGGREGATION
───────────────────────────────────────────── */

/**
 * Aggregate one employee's month.
 *
 * Counts `present` and `late_present` — the previous version also counted
 * `half_day`, which the status enum does not permit, and matched `late_present`
 * before that value existed, so days_present was always understated.
 */
const getAttendanceAggregates = async (employeeId, month, year, upToDate = null) => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const calDays = daysInMonth(month, year);
  const endLimit = `${year}-${String(month).padStart(2, '0')}-${String(calDays).padStart(2, '0')}`;
  const endDate = (upToDate && upToDate < endLimit) ? upToDate : endLimit;

  const [[summary]] = await db.execute(
    `SELECT
       COALESCE(SUM(status IN ('present','late_present')), 0) AS days_present,
       COALESCE(SUM(status = 'on_leave'), 0)                  AS days_paid_leave,
       COALESCE(SUM(status = 'half_day_leave'), 0)           AS days_half_day_leave,
       COALESCE(SUM(status = 'half_day_lop'), 0)             AS days_half_day_lop,
       COALESCE(SUM(status = 'lop'), 0)                       AS days_lop,
       COALESCE(SUM(status = 'absent'), 0)                    AS days_unexcused_absent,
       COALESCE(SUM(status = 'week_off'), 0)                  AS days_week_off,
       COALESCE(SUM(late_minutes), 0)                         AS total_late_minutes
     FROM attendance_daily_summary
     WHERE employee_id = ? AND attendance_date >= ? AND attendance_date <= ?`,
    [employeeId, startDate, endDate]
  );

  // Shifts actually worked, split by night, from attendance joined with employee & roster & effective shift history.
  const [[shiftRow]] = await db.execute(
    `SELECT
       COALESCE(COUNT(*), 0) AS shifts_worked,
       COALESCE(SUM(
         CASE
           WHEN re.is_night_shift = 1 THEN 1
           WHEN s.is_night_shift = 1 THEN 1
           WHEN COALESCE(
             (SELECT sl.new_shift_category FROM employee_shift_logs sl
              WHERE sl.employee_id = ads.employee_id AND sl.effective_from <= ads.attendance_date
              ORDER BY sl.effective_from DESC, sl.id DESC LIMIT 1),
             (SELECT sl2.previous_shift_category FROM employee_shift_logs sl2
              WHERE sl2.employee_id = ads.employee_id AND sl2.effective_from > ads.attendance_date
              ORDER BY sl2.effective_from ASC, sl2.id ASC LIMIT 1),
             e.shift_category
           ) = 'night' THEN 1
           WHEN re.custom_start_time >= '18:00:00' OR re.custom_start_time < '06:00:00' THEN 1
           ELSE 0
         END
       ), 0) AS night_shifts_worked
     FROM attendance_daily_summary ads
     JOIN employees e ON e.id = ads.employee_id
     LEFT JOIN shifts s ON s.id = ads.shift_id
     LEFT JOIN roster_entries re
       ON re.employee_id = ads.employee_id
      AND re.roster_date = ads.attendance_date
     WHERE ads.employee_id = ?
       AND ads.attendance_date >= ?
       AND ads.attendance_date <= ?
       AND ads.status IN ('present','late_present')`,
    [employeeId, startDate, endDate]
  );

  // Week-offs the employee was entitled to but worked instead — paid as an extra day
  const [[weekOffRow]] = await db.execute(
    `SELECT COALESCE(sr.weekly_off_count, 0) AS entitled,
            (SELECT COUNT(*) FROM roster_entries re
              WHERE re.employee_id = e.id AND re.is_week_off = 1
                AND re.roster_date >= ? AND re.roster_date <= ?) AS taken,
            (SELECT COUNT(*) FROM roster_entries re
              WHERE re.employee_id = e.id
                AND re.roster_date >= ? AND re.roster_date <= ?) AS rostered_days
     FROM employees e
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     WHERE e.id = ?`,
    [startDate, endDate, startDate, endDate, employeeId]
  );

  // Lateness beyond buffer
  const [[bufferRow]] = await db.execute(
    `SELECT buffer_allocated_minutes AS allocated, buffer_used_minutes AS used
     FROM employee_attendance_buffers
     WHERE employee_id = ? AND period_month = ? AND period_year = ?`,
    [employeeId, month, year]
  );

  const totalLate = Number(summary.total_late_minutes ?? 0);
  const absorbed = Number(bufferRow?.used ?? 0);
  const bufferExcessMinutes = Math.max(0, totalLate - absorbed);

  const entitled = Number(weekOffRow?.entitled ?? 0);
  const taken = Number(weekOffRow?.taken ?? 0);
  const rosteredDays = Number(weekOffRow?.rostered_days ?? 0);

  // Reconciled effective LOP: full LOP + unexcused absence + half-day LOP (0.5)
  const fullLopDays = Number(summary.days_lop ?? 0) + Number(summary.days_unexcused_absent ?? 0);
  const halfDayLop = Number(summary.days_half_day_lop ?? 0) * 0.5;
  const effectiveLopDays = round2(fullLopDays + halfDayLop);

  // Reconciled effective Paid Leave: full paid leave + half-day leave (0.5)
  const effectivePaidLeaveDays = round2(
    Number(summary.days_paid_leave ?? 0) + (Number(summary.days_half_day_leave ?? 0) * 0.5)
  );

  return {
    days_present: Number(summary.days_present ?? 0),
    days_paid_leave: effectivePaidLeaveDays,
    days_half_day_leave: Number(summary.days_half_day_leave ?? 0),
    days_half_day_lop: Number(summary.days_half_day_lop ?? 0),
    days_lop: effectiveLopDays,
    days_unexcused_absent: Number(summary.days_unexcused_absent ?? 0),
    shifts_worked: Number(shiftRow?.shifts_worked ?? 0),
    night_shifts_worked: Number(shiftRow?.night_shifts_worked ?? 0),
    unused_week_offs: rosteredDays > 0 ? Math.max(0, entitled - taken) : 0,
    rostered_days: rosteredDays,
    total_late_minutes: totalLate,
    buffer_excess_minutes: bufferExcessMinutes,
  };
};

/* ─────────────────────────────────────────────
   SALARY COMPUTATION
───────────────────────────────────────────── */

/**
 * Compute one payslip.
 * Supports pro-rata calculation for inactive/exit employees via activeDays parameter.
 *
 * @param {object} salary    resolved by q.getEffectiveSalary
 * @param {object} agg       from getAttendanceAggregates
 * @param {object} cfg       payroll_config as a number map
 * @param {number} finesAmt  active fines for the period
 * @param {number} extraDays paid extra days worked (entry_type='extra_day')
 * @param {number} activeDays total active working days in exit month (pro-rata divisor numerator)
 */
const computeSalary = ({ salary, agg, cfg, finesAmt, extraDays = 0, overtimeAmount = 0, month, year, nightRate, activeDays = null }) => {
  const monthly = Number(salary.fixed_salary) || 0;
  const calDays = daysInMonth(month, year);
  const dayRate = round2(monthly / calDays);

  const effectiveActiveDays = activeDays !== null && activeDays !== undefined
    ? Math.min(calDays, Math.max(1, Number(activeDays)))
    : calDays;

  // Dynamic Basic + DA (default 70%) and HRA (default 30%) from payroll_config
  const basicPercent = (cfg.BASIC_PERCENT ?? 70) / 100;
  const hraPercent = (cfg.HRA_PERCENT ?? 30) / 100;

  const basicDa = Number(salary.basic_da_amount) > 0 && Number(salary.hra_amount) > 0
    ? Number(salary.basic_da_amount)
    : Math.round(monthly * basicPercent);
  const hra = Number(salary.hra_amount) > 0
    ? Number(salary.hra_amount)
    : (monthly - basicDa);

  const workedDays = Math.max(0, effectiveActiveDays - Number(agg.days_lop || 0));
  const earnedBasic = Math.round((basicDa / calDays) * workedDays);
  const earnedHra = Math.round((hra / calDays) * workedDays);
  const earnedSalary = earnedBasic + earnedHra;

  const nightAllowance = nightRate ?? (Number(salary.night_shift_extra_amount) || 0);
  const nightComponent = round2(nightAllowance * agg.night_shifts_worked);
  const extraDayPay = overtimeAmount > 0 ? round2(overtimeAmount) : round2(dayRate * extraDays);
  const unusedWeekOffPay = round2(dayRate * agg.unused_week_offs);

  // Pro-rata gross based on active days in month worked, plus extra components
  const grossPay = round2((monthly / calDays) * effectiveActiveDays + nightComponent + extraDayPay + unusedWeekOffPay);
  const lopAmount = round2(dayRate * Number(agg.days_lop || 0));
  const earnedGross = Math.max(0, round2(earnedSalary + nightComponent + extraDayPay + unusedWeekOffPay));

  // Late attendance deductions are strictly manually assigned via the Late Attendance Fines module
  const bufferLateDeduction = 0;

  // --- PF CALCULATION (Dynamic from payroll_config) ---
  // PF on Earned Basic+DA (70%), capped at statutory ceiling (15,000)
  const pfCeiling = cfg.PF_WAGE_CEILING ?? 15000;
  const pfWage = salary.pf_applicable ? Math.min(earnedBasic, pfCeiling) : 0;
  const pfEmployee = salary.pf_applicable
    ? Math.round(pfWage * ((cfg.PF_EMPLOYEE_PERCENT ?? 12) / 100))
    : 0;
  // Employer's share splits into EPF (3.67%) + EPS (8.33% pension)
  const pfEmployerEps = salary.pf_applicable
    ? Math.round(pfWage * ((cfg.PF_EMPLOYER_EPS_PERCENT ?? 8.33) / 100))
    : 0;
  const pfEmployerEpf = salary.pf_applicable
    ? Math.max(0, pfEmployee - pfEmployerEps)
    : 0;
  const pfEmployer = pfEmployerEps + pfEmployerEpf;

  // --- ESI CALCULATION (Dynamic from payroll_config) ---
  // ESI applies only if enrolled AND fixed monthly gross salary <= ceiling (21,000)
  const esiCeiling = cfg.ESI_GROSS_CEILING ?? 21000;
  const esiApplies = Boolean(salary.esi_applicable) && monthly <= esiCeiling;
  const esiWage = esiApplies ? earnedGross : 0;
  // ESI uses statutory ROUNDUP (Math.ceil to next integer rupee)
  const esiEmployee = esiWage > 0
    ? Math.ceil(esiWage * ((cfg.ESI_EMPLOYEE_PERCENT ?? 0.75) / 100))
    : 0;
  const esiEmployer = esiWage > 0
    ? Math.ceil(esiWage * ((cfg.ESI_EMPLOYER_PERCENT ?? 3.25) / 100))
    : 0;

  // Net Pay: Earned Gross minus Deductions
  const netPay = Math.max(
    0,
    round2(earnedGross - bufferLateDeduction - finesAmt - pfEmployee - esiEmployee)
  );

  return {
    day_rate: dayRate,
    active_days: effectiveActiveDays,
    worked_days: workedDays,
    base_salary_component: monthly,
    basic_da_amount: basicDa,
    hra_amount: hra,
    earned_basic: earnedBasic,
    earned_hra: earnedHra,
    night_shift_component: nightComponent,
    overtime_amount: extraDayPay,
    unused_week_off_amount: unusedWeekOffPay,
    gross_pay: grossPay,
    earned_gross: earnedGross,
    lop_amount: lopAmount,
    buffer_late_deduction: bufferLateDeduction,
    fines_amount: finesAmt,
    pf_wage: pfWage,
    pf_employee_amount: pfEmployee,
    pf_employer_amount: pfEmployer,
    pf_employer_eps_amount: pfEmployerEps,
    pf_employer_epf_amount: pfEmployerEpf,
    esi_wage: esiWage,
    esi_employee_amount: esiEmployee,
    esi_employer_amount: esiEmployer,
    net_pay: netPay,
  };
};

/* ─────────────────────────────────────────────
   PAYROLL RUN
───────────────────────────────────────────── */

const createPayrollRun = async (data) => {
  const month = Number(data.period_month ?? data.pay_month);
  const year = Number(data.period_year ?? data.pay_year);
  if (!month || month < 1 || month > 12) throw new AppError('period_month must be 1-12', 400);
  if (!year) throw new AppError('period_year is required', 400);

  const existing = await q.findPayrollRunByPeriod(month, year);
  if (existing) {
    throw new AppError(`A payroll run for ${month}/${year} already exists (id ${existing.id}).`, 409);
  }
  return q.createPayrollRun({
    period_month: month,
    period_year: year,
    salary_date_type: data.salary_date_type,
    salary_date: data.salary_date,
  });
};

const findOrCreatePayrollRun = async (month, year, createdBy = null) => {
  let run = await q.findPayrollRunByPeriod(month, year);
  if (!run) {
    const runId = await q.createPayrollRun({
      period_month: month,
      period_year: year,
      salary_date_type: 'last_day_of_month',
    });
    run = await q.getPayrollRun(runId);
  }
  return run;
};

/**
 * Calculate (or recalculate) every payslip in a draft run.
 * Safe to re-run:
 *   - Active employees are computed for the full month.
 *   - Inactive employees whose date_of_leaving is in this month are computed pro-rata up to their last working date.
 *   - Any item that was ALREADY settled/paid mid-month is strictly PRESERVED and not overwritten!
 */
const calculatePayrollForRun = async (runId) => {
  const run = await q.getPayrollRun(runId);
  if (!run) throw new AppError('Payroll run not found', 404);
  if (run.status === 'locked') throw new AppError('Cannot recalculate a locked payroll run', 400);
  if (run.status === 'paid') throw new AppError('Cannot recalculate a paid payroll run', 400);

  const month = Number(run.period_month);
  const year = Number(run.period_year);
  const cfg = await q.getPayrollConfig();

  // Query all active employees, plus employees who became inactive in this month
  const [employees] = await db.execute(
    `SELECT id, full_name, employee_code, payment_mode, status, date_of_leaving, inactive_date
     FROM employees
     WHERE status = 'active'
        OR (status = 'inactive' AND (
             (date_of_leaving IS NOT NULL AND MONTH(date_of_leaving) = ? AND YEAR(date_of_leaving) = ?)
          OR (inactive_date IS NOT NULL AND MONTH(inactive_date) = ? AND YEAR(inactive_date) = ?)
        ))`,
    [month, year, month, year]
  );

  // Get existing items in this run to check if any are already paid/settled
  const [existingItems] = await db.execute(
    `SELECT * FROM payroll_items WHERE payroll_run_id = ?`,
    [runId]
  );
  const existingMap = new Map(existingItems.map((i) => [i.employee_id, i]));

  let calculated = 0;
  let preservedSettlements = 0;
  const skipped = [];

  for (const emp of employees) {
    const existing = existingMap.get(emp.id);

    // If this employee already has a paid or settled item, PRESERVE it so mid-month disbursements are never wiped!
    if (existing && (existing.payment_status === 'paid' || existing.is_settlement === 1)) {
      preservedSettlements++;
      calculated++;
      continue;
    }

    const salary = await q.getEffectiveSalary(emp.id, month, year);
    if (!salary) {
      skipped.push({ employee_id: emp.id, full_name: emp.full_name, reason: 'no salary configured' });
      continue;
    }

    const isInactive = emp.status === 'inactive';
    const lastWorkingDate = (isInactive && (emp.date_of_leaving || emp.inactive_date))
      ? String(emp.date_of_leaving || emp.inactive_date).slice(0, 10)
      : null;
    const activeDays = lastWorkingDate ? new Date(lastWorkingDate).getUTCDate() : null;

    const agg = await getAttendanceAggregates(emp.id, month, year, lastWorkingDate);
    const finesAmt = await q.getActiveFinesAmount(emp.id, month, year);
    const extraInfo = await q.countPaidExtraDays(emp.id, month, year, lastWorkingDate);
    const extraDays = typeof extraInfo === 'object' ? extraInfo.extra_days : Number(extraInfo || 0);
    const overtimeAmount = typeof extraInfo === 'object' ? extraInfo.total_amount : 0;

    const breakdown = computeSalary({
      salary, agg, cfg, finesAmt, extraDays, overtimeAmount, month, year, activeDays,
    });

    await q.upsertPayrollItem({
      payroll_run_id: runId,
      employee_id: emp.id,
      payment_mode: emp.payment_mode || 'account',
      salary_structure_id: salary.salary_structure_id,
      days_present: agg.days_present,
      days_paid_leave: agg.days_paid_leave,
      days_lop: agg.days_lop,
      shifts_worked: agg.shifts_worked,
      ...breakdown,
      is_settlement: isInactive ? 1 : 0,
      payment_status: 'pending',
    });
    calculated++;
  }

  await q.syncPayrollRunTotals(runId);

  return { runId, month, year, calculated, preservedSettlements, skipped };
};

/* ─────────────────────────────────────────────
   INDIVIDUAL SETTLEMENT & MID-MONTH PAYOUTS
───────────────────────────────────────────── */

/**
 * Preview pro-rata salary settlement for an employee up to their last working date.
 */
const previewEmployeeSettlement = async (employeeId, lastWorkingDate) => {
  if (!employeeId) throw new AppError('employeeId is required', 400);
  const exitDate = lastWorkingDate ? String(lastWorkingDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const [yStr, mStr, dStr] = exitDate.split('-');
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const activeDays = parseInt(dStr, 10);
  const calDays = daysInMonth(month, year);

  const [empRows] = await db.execute(
    `SELECT e.*, d.name AS department_name, sr.name AS designation_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     WHERE e.id = ?`,
    [employeeId]
  );
  const emp = empRows[0];
  if (!emp) throw new AppError('Employee not found', 404);

  const salary = await q.getEffectiveSalary(employeeId, month, year);
  if (!salary) {
    throw new AppError('No salary configured for this employee.', 400);
  }

  const cfg = await q.getPayrollConfig();
  const agg = await getAttendanceAggregates(employeeId, month, year, exitDate);
  const finesAmt = await q.getActiveFinesAmount(employeeId, month, year);
  const extraInfo = await q.countPaidExtraDays(employeeId, month, year, exitDate);
  const extraDays = typeof extraInfo === 'object' ? extraInfo.extra_days : Number(extraInfo || 0);
  const overtimeAmount = typeof extraInfo === 'object' ? extraInfo.total_amount : 0;

  const breakdown = computeSalary({
    salary,
    agg,
    cfg,
    finesAmt,
    extraDays,
    overtimeAmount,
    month,
    year,
    activeDays,
  });

  return {
    employee: {
      id: emp.id,
      full_name: emp.full_name,
      employee_code: emp.employee_code,
      department_name: emp.department_name,
      designation_name: emp.designation_name,
      payment_mode: emp.payment_mode || 'account',
      bank_account_no: emp.bank_account_no,
      bank_name: emp.bank_name,
      bank_ifsc: emp.bank_ifsc,
      status: emp.status,
    },
    month,
    year,
    settlementMonth: month,
    settlementYear: year,
    lastWorkingDate: exitDate,
    calDays,
    totalCalendarDays: calDays,
    activeDays,
    activeWorkingDays: activeDays,
    dayRate: breakdown.day_rate,
    attendance: agg,
    finesAmount: finesAmt,
    salaryBreakdown: breakdown,
    breakdown: {
      ...breakdown,
      monthly_salary: breakdown.base_salary_component,
      earned_gross_pay: breakdown.gross_pay,
      earned_basic_da: breakdown.earned_basic,
      pf_employee: breakdown.pf_employee_amount,
      esi_employee: breakdown.esi_employee_amount,
      estimated_net_settlement: breakdown.net_pay,
    },
  };
};

/**
 * Process and record individual salary settlement for an employee, optionally marking it as paid immediately.
 */
const settleEmployeeSalary = async ({
  employeeId,
  lastWorkingDate,
  markAsPaid = false,
  paymentMode = null,
  paymentDate = null,
  paymentReference = null,
  notes = null,
  userId = null,
}) => {
  const preview = await previewEmployeeSettlement(employeeId, lastWorkingDate);
  const { month, year, salaryBreakdown, attendance, employee } = preview;

  const run = await findOrCreatePayrollRun(month, year, userId);
  const salary = await q.getEffectiveSalary(employeeId, month, year);

  const isPaid = Boolean(markAsPaid);
  const effectivePaymentMode = paymentMode || employee.payment_mode || 'account';
  const effectivePaymentDate = isPaid ? (paymentDate || lastWorkingDate) : null;

  await q.upsertPayrollItem({
    payroll_run_id: run.id,
    employee_id: employeeId,
    payment_mode: effectivePaymentMode,
    salary_structure_id: salary?.salary_structure_id || null,
    days_present: attendance.days_present,
    days_paid_leave: attendance.days_paid_leave,
    days_lop: attendance.days_lop,
    shifts_worked: attendance.shifts_worked,
    ...salaryBreakdown,
    is_settlement: 1,
    payment_status: isPaid ? 'paid' : 'pending',
    payment_date: effectivePaymentDate,
    payment_reference: paymentReference || null,
    settled_at: new Date(),
    settled_by: userId,
    notes: notes || `Final exit settlement up to ${lastWorkingDate}`,
  });

  if (isPaid) {
    await q.markFinesDeducted(employeeId, month, year);
  }

  await q.syncPayrollRunTotals(run.id);

  return {
    success: true,
    runId: run.id,
    month,
    year,
    lastWorkingDate,
    isPaid,
    paymentMode: effectivePaymentMode,
    paymentDate: effectivePaymentDate,
    paymentReference: paymentReference || null,
    settlement: salaryBreakdown,
  };
};

const lockPayrollRun = async (runId, lockedBy) => {
  const run = await q.getPayrollRun(runId);
  if (!run) throw new AppError('Payroll run not found', 404);
  if (run.status !== 'draft') throw new AppError(`This run is already ${run.status}`, 400);

  const [items] = await db.execute(
    `SELECT employee_id FROM payroll_items WHERE payroll_run_id = ?`, [runId]
  );
  if (!items.length) {
    throw new AppError('Nothing to lock — calculate the run first.', 400);
  }

  for (const item of items) {
    await q.markFinesDeducted(item.employee_id, run.period_month, run.period_year);
  }
  await q.lockPayrollRun(runId, lockedBy);
  return { runId, locked: items.length };
};

/** One employee's full payslip breakdown, for the payslip view. */
const getPayslip = async (runId, employeeId) => {
  const run = await q.getPayrollRun(runId);
  if (!run) throw new AppError('Payroll run not found', 404);

  const [rows] = await db.execute(
    `SELECT pi.*, e.full_name, e.employee_code, e.uan_number, e.esi_number,
            e.bank_account_no, e.bank_name, e.bank_ifsc,
            COALESCE(pi.payment_mode, e.payment_mode, 'account') AS payment_mode,
            e.date_of_joining AS joining_date, e.shift_category,
            d.name AS department_name, sr.name AS role_name
     FROM payroll_items pi
     JOIN employees e ON e.id = pi.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     WHERE pi.payroll_run_id = ? AND pi.employee_id = ?`,
    [runId, employeeId]
  );
  if (!rows.length) throw new AppError('No payslip for this employee in this run', 404);

  return {
    run: { id: run.id, period_month: run.period_month, period_year: run.period_year, status: run.status },
    item: rows[0],
    day_rate: round2(Number(rows[0].base_salary_component) / daysInMonth(run.period_month, run.period_year)),
  };
};

/* ─────────────────────────────────────────────
   OVERTIME
───────────────────────────────────────────── */

/**
 * Record overtime.
 *
 * entry_type='extra_day'  → paid at the day rate, added to gross.
 * entry_type='hourly'     → recorded only; computed_amount is always 0.
 */
const createOvertimeEntry = async (data, createdBy) => {
  const { employee_id, entry_date, entry_type, hours, notes } = data;
  if (!employee_id || !entry_date || !entry_type) {
    throw new AppError('employee_id, entry_date and entry_type are required', 400);
  }
  if (!['extra_day', 'hourly'].includes(entry_type)) {
    throw new AppError("entry_type must be 'extra_day' or 'hourly'", 400);
  }
  if (entry_type === 'hourly' && !hours) {
    throw new AppError('hours is required for hourly overtime', 400);
  }

  return q.createOvertimeEntry({
    employee_id,
    entry_date,
    entry_type,
    hours: entry_type === 'hourly' ? hours : null,
    // Extra days are valued at payroll time from that month's day rate, so the
    // stored amount stays 0 here. Hourly overtime is unpaid by policy.
    computed_amount: 0,
    notes,
    created_by: createdBy ?? null,
  });
};

/* ─────────────────────────────────────────────
   FINES
───────────────────────────────────────────── */

const createFine = async (data, createdBy) => {
  if (!data.employee_id || !data.fine_type_id || !data.amount || !data.fine_date) {
    throw new AppError('employee_id, fine_type_id, amount and fine_date are required', 400);
  }
  const d = new Date(data.fine_date);
  return q.createFine({
    ...data,
    created_by: createdBy,
    is_auto_generated: !!data.is_auto_generated,
    assigned_month: data.assigned_month ?? (d.getUTCMonth() + 1),
    assigned_year: data.assigned_year ?? d.getUTCFullYear(),
  });
};

const createFineType = async (data) => {
  if (!data.name) throw new AppError('name is required', 400);
  return q.createFineType(data);
};

const waiveFine = async (fineId, waivedBy, reason) => {
  if (!reason) throw new AppError('Waiver reason is required', 400);
  await q.updateFineStatus(fineId, 'waived', { waived_by: waivedBy, waiver_reason: reason });
};

const cancelFine = async (fineId, cancelledBy, reason) => {
  if (!reason) throw new AppError('Cancellation reason is required', 400);
  await q.updateFineStatus(fineId, 'cancelled', { waived_by: cancelledBy, waiver_reason: reason });
};

const addNightShiftRate = async (data, changedBy) => {
  if (!data.shift_id || !data.night_rate_amount || !data.effective_from) {
    throw new AppError('shift_id, night_rate_amount and effective_from are required', 400);
  }
  return q.addNightShiftRate({ ...data, changed_by: changedBy });
};

/**
 * Reduce, waive, or adjust deductions on a draft payroll item before finalizing.
 */
const updatePayrollItemDeduction = async (runId, itemId, { lop_amount, buffer_late_deduction, fines_amount, reason }, userId) => {
  const run = await q.getPayrollRun(runId);
  if (!run) throw new AppError('Payroll run not found', 404);
  if (run.status !== 'draft') {
    throw new AppError(`Cannot modify deductions on a ${run.status} payroll run. Only draft runs can be adjusted before locking.`, 400);
  }

  const item = await q.getPayrollItemById(itemId);
  if (!item || Number(item.payroll_run_id) !== Number(runId)) {
    throw new AppError('Payroll item not found in this run', 404);
  }

  const newLop = lop_amount !== undefined ? Math.max(0, Number(lop_amount)) : Number(item.lop_amount || 0);
  const newLate = buffer_late_deduction !== undefined ? Math.max(0, Number(buffer_late_deduction)) : Number(item.buffer_late_deduction || 0);
  const newFines = fines_amount !== undefined ? Math.max(0, Number(fines_amount)) : Number(item.fines_amount || 0);

  const gross = Number(item.gross_pay || 0);
  const pfEmp = Number(item.pf_employee_amount || 0);
  const esiEmp = Number(item.esi_employee_amount || 0);
  const ot = Number(item.overtime_amount || 0);

  const totalDeductions = newLop + newLate + pfEmp + esiEmp + newFines;
  const newNet = Math.max(0, Math.round((gross + ot - totalDeductions) * 100) / 100);

  await q.updatePayrollItemDeductions(itemId, {
    lop_amount: newLop,
    buffer_late_deduction: newLate,
    fines_amount: newFines,
    net_pay: newNet,
  });

  await q.syncPayrollRunTotals(runId);

  return {
    itemId,
    lop_amount: newLop,
    buffer_late_deduction: newLate,
    fines_amount: newFines,
    net_pay: newNet,
    reason: reason || 'Manual adjustment before finalization',
  };
};

module.exports = {
  computeSalary,
  getAttendanceAggregates,
  createPayrollRun,
  findOrCreatePayrollRun,
  calculatePayrollForRun,
  previewEmployeeSettlement,
  settleEmployeeSalary,
  markPayrollItemPaid: q.markPayrollItemPaid,
  lockPayrollRun,
  getPayslip,
  updatePayrollItemDeduction,
  createOvertimeEntry,
  createFine,
  createFineType,
  waiveFine,
  cancelFine,
  addNightShiftRate,
  daysInMonth,
  // Pass-through queries
  listSalaryStructures: q.listSalaryStructures,
  getSalaryStructure: q.getSalaryStructure,
  getEffectiveSalary: q.getEffectiveSalary,
  createSalaryStructure: q.createSalaryStructure,
  addSalaryRevision: q.addSalaryRevision,
  updateSalaryStructure: q.updateSalaryStructure,
  getPayrollConfig: q.getPayrollConfig,
  setPayrollConfig: q.setPayrollConfig,
  listNightShiftRates: q.listNightShiftRates,
  listPayrollRuns: q.listPayrollRuns,
  getPayrollRun: q.getPayrollRun,
  getPayrollItems: q.getPayrollItems,
  listFines: q.listFines,
  listFineTypes: q.listFineTypes,
  updateFineType: q.updateFineType,
  listOvertimeEntries: q.listOvertimeEntries,
};
