const q = require('./leave.queries');
const { AppError } = require('../../utils/errors');

const calculateLeaveDays = (fromDate, toDate, isHalfDay) => {
  if (isHalfDay) return 0.5;
  const start = new Date(fromDate);
  const end = new Date(toDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  
  let count = 0;
  let temp = new Date(start);
  temp.setHours(0,0,0,0);
  const endCompare = new Date(end);
  endCompare.setHours(0,0,0,0);

  while (temp <= endCompare) {
    if (temp.getDay() !== 0) { // 0 is Sunday
      count++;
    }
    temp.setDate(temp.getDate() + 1);
  }
  return count;
};

/**
 * createLeaveRequest
 *
 * Handles smart leave splitting:
 *  1. Take from the primary leave type (casual/privilege) up to available balance
 *  2. Overflow → privilege leave (if any remaining)
 *  3. Remaining overflow → Loss of Pay
 *
 * Each portion is saved as a SEPARATE leave_requests row with casual_days /
 * privilege_days / lop_days filled, so payroll can accurately calculate deductions.
 *
 * Expected data shape:
 *  {
 *    employee_id, leave_type_id (primary), start_date, end_date, total_days,
 *    reason, status,
 *    // Pre-computed split from frontend:
 *    splits: [
 *      { leave_type_id, total_days, casual_days, privilege_days, lop_days }
 *    ]
 *  }
 */
const createLeaveRequest = async (data) => {
  if (!data.employee_id || !data.leave_type_id || !data.start_date || !data.end_date || !data.total_days) {
    throw new AppError('employee_id, leave_type_id, start_date, end_date, total_days are required', 400);
  }

  const status = data.status || 'approved';
  const splits = data.splits && data.splits.length > 0 ? data.splits : null;

  // If splits are provided (smart allocation), insert one record per split portion
  if (splits) {
    const insertedIds = [];
    for (const split of splits) {
      if (!split.total_days || split.total_days <= 0) continue;

      const insertId = await q.createLeaveRequest({
        employee_id: data.employee_id,
        leave_type_id: split.leave_type_id,
        start_date: data.start_date,
        end_date: data.end_date,
        reason: data.reason || 'Directly applied',
        status,
        casual_days: split.casual_days || 0,
        privilege_days: split.privilege_days || 0,
        lop_days: split.lop_days || 0,
      });
      insertedIds.push(insertId);

      // Update leave balance for paid leave portions only
      if (status === 'approved' && (split.casual_days > 0 || split.privilege_days > 0)) {
        const year = new Date(data.start_date).getFullYear();
        const balances = await q.getLeaveBalances(data.employee_id, year);
        let bal = balances.find(b => b.leave_type_id === split.leave_type_id);
        if (!bal) bal = { allocated_days: 0, used_days: 0 };
        const paidDays = (split.casual_days || 0) + (split.privilege_days || 0);
        await q.upsertLeaveBalance({
          employee_id: data.employee_id,
          leave_type_id: split.leave_type_id,
          year,
          allocated_days: bal.allocated_days,
          used_days: Number(bal.used_days) + paidDays
        });
      }
    }
    return insertedIds;
  }

  // Fallback: legacy single-record insert (no splits provided)
  const insertId = await q.createLeaveRequest({
    ...data,
    casual_days: data.casual_days || 0,
    privilege_days: data.privilege_days || 0,
    lop_days: data.lop_days || 0,
    status
  });

  if (status === 'approved') {
    const year = new Date(data.start_date).getFullYear();
    const balances = await q.getLeaveBalances(data.employee_id, year);
    let bal = balances.find(b => b.leave_type_id === data.leave_type_id);
    if (!bal) bal = { allocated_days: 0, used_days: 0 };
    const calculatedDays = calculateLeaveDays(data.start_date, data.end_date, false);
    await q.upsertLeaveBalance({
      employee_id: data.employee_id,
      leave_type_id: data.leave_type_id,
      year,
      allocated_days: bal.allocated_days,
      used_days: Number(bal.used_days) + calculatedDays
    });
  }

  return insertId;
};


const reviewLeaveRequest = async (id, decision, reviewerId) => {
  const req = await q.getLeaveRequest(id);
  if (!req) throw new AppError('Leave request not found', 404);
  if (req.status !== 'pending') throw new AppError('Only pending requests can be reviewed', 400);

  const allowedStatuses = ['approved', 'rejected'];
  if (!allowedStatuses.includes(decision.status)) {
    throw new AppError('status must be approved or rejected', 400);
  }

  await q.updateLeaveRequestStatus(id, decision.status, {
    approved_by: reviewerId,
    rejection_reason: decision.rejection_reason
  });

  // If approved, update the balance
  if (decision.status === 'approved') {
    const year = new Date(req.from_date).getFullYear();
    const balances = await q.getLeaveBalances(req.employee_id, year);
    let bal = balances.find(b => b.leave_type_id === req.leave_type_id);
    if (!bal) {
      // If no balance record exists, create one with 0 allocation just to track usage
      bal = { allocated_days: 0, used_days: 0 };
    }
    
    const totalDays = calculateLeaveDays(req.from_date, req.to_date, req.is_half_day);

    await q.upsertLeaveBalance({
      employee_id: req.employee_id,
      leave_type_id: req.leave_type_id,
      year: year,
      allocated_days: bal.allocated_days,
      used_days: Number(bal.used_days) + totalDays
    });
  }
};

module.exports = {
  createLeaveRequest, reviewLeaveRequest,
  // Pass-through
  listLeaveTypes: q.listLeaveTypes,
  createLeaveType: q.createLeaveType,
  updateLeaveType: q.updateLeaveType,
  listHolidays: q.listHolidays,
  createHoliday: q.createHoliday,
  getLeaveBalances: q.getLeaveBalances,
  upsertLeaveBalance: q.upsertLeaveBalance,
  listLeaveRequests: q.listLeaveRequests,
  getLeaveRequest: q.getLeaveRequest,
  listWeekOffPolicies: q.listWeekOffPolicies,
  createWeekOffPolicy: q.createWeekOffPolicy,
};
