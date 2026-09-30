/**
 * leave.service.js
 * Business logic for the Leave Engine.
 *
 * Confirmed rules:
 *  - Approval is two-step: the employee's reporting person first, then HR final.
 *  - Half-day leave is explicitly out of scope — never surfaced or accepted.
 *  - Three absence outcomes:
 *      1. Applied + balance available  → paid leave.
 *      2. Applied + balance exhausted  → LOP, no fine (the process was followed).
 *      3. Not applied + balance exhausted → LOP AND a Fine Engine trigger.
 *    Outcomes 1–2 are decided at HR's final sign-off on a request (below).
 *    Outcome 3 has no request to approve — see recordUnexplainedAbsence.
 */

const q = require('./leave.queries');
const attendanceQ = require('../attendance/attendance.queries');
const salaryQ = require('../salary/salary.queries');
const salarySvc = require('../salary/salary.service');
const db = require('../../config/db');
const { AppError } = require('../../utils/errors');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Every calendar date from `from` to `to`, inclusive, as YYYY-MM-DD strings. */
const dateRange = (from, to) => {
  const out = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
};

/* ─────────────────────────────────────────────
   LEAVE TYPES
───────────────────────────────────────────── */

const createLeaveType = async (data) => {
  if (!data.name) throw new AppError('name is required', 400);
  return q.createLeaveType(data);
};

const updateLeaveType = async (id, data) => {
  const type = await q.getLeaveType(id);
  if (!type) throw new AppError('Leave type not found', 404);
  await q.updateLeaveType(id, data);
};

const deleteLeaveType = async (id) => {
  const type = await q.getLeaveType(id);
  if (!type) throw new AppError('Leave type not found', 404);
  const normalized = (type.name || '').toLowerCase().trim();
  const SYSTEM_TYPES = ['casual leave', 'cl', 'privilege leave', 'pl', 'loss of pay', 'lop', 'sick leave', 'sl'];
  if (SYSTEM_TYPES.includes(normalized) || Number(id) <= 4) {
    throw new AppError(`Cannot delete system default leave type "${type.name}". It is required by attendance and payroll processing.`, 400);
  }
  await q.deleteLeaveType(id);
};

/* ─────────────────────────────────────────────
   LEAVE APPLICATION
───────────────────────────────────────────── */

const applyForLeave = async (data) => {
  const { employee_id, leave_type_id, from_date, to_date, duration_type = 'full_day', reason } = data;
  if (!employee_id || !leave_type_id || !from_date) {
    throw new AppError('employee_id, leave_type_id, and from_date are required', 400);
  }
  const isHalfDay = duration_type === 'first_half' || duration_type === 'second_half';
  const finalToDate = isHalfDay ? from_date : (to_date || from_date);

  if (finalToDate < from_date) {
    throw new AppError('to_date cannot be before from_date', 400);
  }

  const leaveType = await q.getLeaveType(leave_type_id);
  if (!leaveType) throw new AppError('Leave type not found', 404);
  if (!leaveType.is_active) throw new AppError('This leave type is no longer active', 400);

  if (isHalfDay && !leaveType.is_half_day_allowed) {
    throw new AppError(`Half-day leave is not permitted for "${leaveType.name}".`, 400);
  }

  const [[emp]] = await db.execute(
    `SELECT id, reporting_person_id FROM employees WHERE id = ?`, [employee_id]
  );
  if (!emp) throw new AppError('Employee not found', 404);

  // Check overlapping requests
  const overlapDates = dateRange(from_date, finalToDate);
  for (const d of overlapDates) {
    const existing = await q.findRequestCoveringDate(employee_id, d);
    if (existing) {
      if (!existing.is_half_day || !isHalfDay || existing.duration_type === duration_type) {
        throw new AppError(`This employee already has a leave request covering ${d} (request #${existing.id})`, 409);
      }
    }
  }

  const daysCount = isHalfDay ? 0.5 : overlapDates.length;

  return q.createLeaveRequest({
    employee_id,
    leave_type_id,
    from_date,
    to_date: finalToDate,
    duration_type,
    days_count: daysCount,
    is_half_day: isHalfDay ? 1 : 0,
    reason,
    reporting_person_id: emp.reporting_person_id || null,
  });
};

/* ─────────────────────────────────────────────
   TWO-STEP APPROVAL
───────────────────────────────────────────── */

const reviewByReportingPerson = async (id, decision) => {
  if (!['approved', 'rejected'].includes(decision.status)) {
    throw new AppError('status must be approved or rejected', 400);
  }
  const req = await q.getLeaveRequest(id);
  if (!req) throw new AppError('Leave request not found', 404);
  if (req.reporting_person_status !== 'pending') {
    throw new AppError(`This request was already ${req.reporting_person_status} by the reporting person`, 400);
  }

  await q.setReportingPersonDecision(id, decision.status);

  // A rejection at this stage ends the request — HR does not need to act.
  if (decision.status === 'rejected') {
    await q.setHrDecision(id, { hr_status: 'rejected', result: 'rejected', hr_user_id: null });
  }
};

/**
 * HR's final sign-off.
 * Outcome decided based on live balance:
 *   - enough balance -> paid_leave, balance consumed
 *   - not enough -> lop, no fine
 */
const reviewByHR = async (id, decision, reviewerId, isSuperuser = false) => {
  if (!['approved', 'rejected'].includes(decision.status)) {
    throw new AppError('status must be approved or rejected', 400);
  }
  const req = await q.getLeaveRequest(id);
  if (!req) throw new AppError('Leave request not found', 404);

  // If request has a reporting person, require approval unless bypassed by admin or reporting person unassigned
  if (req.reporting_person_id && req.reporting_person_status !== 'approved' && !decision.bypass_reporting_person && !isSuperuser) {
    throw new AppError('The reporting person must approve this request before HR can act (or check Administrator bypass)', 400);
  }
  if (req.hr_status !== 'pending') {
    throw new AppError(`This request was already ${req.hr_status} by HR`, 400);
  }

  if (decision.status === 'rejected') {
    await q.setHrDecision(id, { hr_status: 'rejected', result: 'rejected', hr_user_id: reviewerId });
    return { result: 'rejected' };
  }

  const dates = dateRange(req.from_date, req.to_date);
  const totalDays = Number(req.days_count) || (req.duration_type !== 'full_day' ? 0.5 : dates.length);
  const year = new Date(`${req.from_date}T00:00:00Z`).getUTCFullYear();

  let available = 0;
  const isCompOff = Number(req.leave_type_id) === 6 || (req.leave_type_name || '').toLowerCase().includes('comp');
  if (isCompOff) {
    available = await q.getActiveCompOffBalance(req.employee_id);
  } else {
    const balance = await q.getLeaveBalance(req.employee_id, req.leave_type_id, year);
    available = Number(balance?.balance_days ?? 0);
  }

  let result;
  if (available >= totalDays) {
    result = 'paid_leave';
    if (isCompOff) {
      await q.consumeCompOffCredit(req.employee_id, totalDays);
    } else {
      const balance = await q.getLeaveBalance(req.employee_id, req.leave_type_id, year);
      await q.upsertLeaveBalance({
        employee_id: req.employee_id,
        leave_type_id: req.leave_type_id,
        year,
        allocated_days: balance?.allocated_days ?? 0,
        used_days: Number(balance?.used_days ?? 0) + totalDays,
      });
    }

    const attendanceStatus = totalDays === 0.5 ? 'half_day_leave' : 'on_leave';
    await attendanceQ.markLeaveDays(req.employee_id, dates, attendanceStatus);
  } else {
    // Applied properly, but not enough balance — LOP, no fine.
    result = 'lop';
    const attendanceStatus = totalDays === 0.5 ? 'half_day_lop' : 'lop';
    await attendanceQ.markLeaveDays(req.employee_id, dates, attendanceStatus);
  }

  await q.setHrDecision(id, { hr_status: 'approved', result, hr_user_id: reviewerId });
  return { result, totalDays, availableBalance: available };
};

/* ─────────────────────────────────────────────
   OUTCOME 3 — UNEXPLAINED ABSENCE
───────────────────────────────────────────── */

/**
 * An absence with no leave application at all. If the employee's paid-leave
 * balance is exhausted, this is LOP plus a Fine Engine trigger — the only
 * scenario the client's rules attach a fine to. If balance is still
 * available, it's LOP with no fine (paid leave is never granted without an
 * application) and HR can still file a backdated request instead if the
 * situation warrants it.
 */
const recordUnexplainedAbsence = async (employeeId, date, markedBy) => {
  const existing = await q.findRequestCoveringDate(employeeId, date);
  if (existing) {
    throw new AppError(
      `This date already has a leave request (#${existing.id}) — review it instead of recording an unexplained absence.`,
      409
    );
  }

  const year = new Date(`${date}T00:00:00Z`).getUTCFullYear();
  const remaining = await q.getTotalRemainingBalance(employeeId, year);

  await attendanceQ.markLeaveDays(employeeId, [date], 'lop');

  if (remaining > 0) {
    return { status: 'lop', fineCreated: false, remainingBalance: remaining };
  }

  const fineType = await salaryQ.getFineTypeByTriggerRule('unapproved_absence_no_leave');
  if (!fineType) {
    return {
      status: 'lop', fineCreated: false, remainingBalance: remaining,
      note: 'No active fine type is configured for unapproved absences — set one up under Fine Types.',
    };
  }

  const month = Number(date.slice(5, 7));
  let amount = Number(fineType.default_amount);
  if (fineType.calculation_basis === 'percent_of_day_salary') {
    const salary = await salaryQ.getEffectiveSalary(employeeId, month, year);
    if (salary) {
      const dayRate = salary.fixed_salary / salarySvc.daysInMonth(month, year);
      amount = round2(dayRate * (Number(fineType.default_amount) / 100));
    }
  }

  const fineId = await salaryQ.createFine({
    employee_id: employeeId,
    fine_type_id: fineType.id,
    amount,
    fine_date: date,
    reason: 'Automatic: absent without a leave application, with no leave balance remaining',
    is_auto_generated: true,
    assigned_month: month,
    assigned_year: year,
    created_by: markedBy ?? null,
  });

  return { status: 'lop', fineCreated: true, fineId, fineAmount: amount, fineTypeName: fineType.name };
};

/* ─────────────────────────────────────────────
   BALANCES (admin allocation)
───────────────────────────────────────────── */

const allocateLeaveBalance = async (data) => {
  const { employee_id, leave_type_id, year, allocated_days } = data;
  if (!employee_id || !leave_type_id || !year || allocated_days === undefined) {
    throw new AppError('employee_id, leave_type_id, year and allocated_days are required', 400);
  }
  await q.allocateLeaveBalance(employee_id, leave_type_id, year, allocated_days);
};

const creditCompOff = async (data) => {
  const { employee_id, earned_date, days_credited = 1.0, reason, expiry_days = 90 } = data;
  if (!employee_id || !earned_date) {
    throw new AppError('employee_id and earned_date are required', 400);
  }
  return q.createCompOffCredit({
    employeeId: employee_id,
    earnedDate: earned_date,
    daysCredited: Number(days_credited),
    reason,
    expiryDays: Number(expiry_days),
  });
};

module.exports = {
  createLeaveType, updateLeaveType, deleteLeaveType,
  applyForLeave, reviewByReportingPerson, reviewByHR,
  recordUnexplainedAbsence,
  allocateLeaveBalance,
  creditCompOff,
  // Pass-through
  listLeaveTypes: q.listLeaveTypes,
  listHolidays: q.listHolidays,
  createHoliday: q.createHoliday,
  getLeaveBalances: q.getLeaveBalances,
  listAllLeaveBalances: q.listAllLeaveBalances,
  listLeaveRequests: q.listLeaveRequests,
  getLeaveRequest: q.getLeaveRequest,
  listWeekOffPolicies: q.listWeekOffPolicies,
  upsertWeekOffPolicy: q.upsertWeekOffPolicy,
};
