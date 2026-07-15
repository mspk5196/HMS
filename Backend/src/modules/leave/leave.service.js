const q = require('./leave.queries');
const { AppError } = require('../../utils/errors');

const createLeaveRequest = async (data) => {
  if (!data.employee_id || !data.leave_type_id || !data.start_date || !data.end_date || !data.total_days || !data.reason) {
    throw new AppError('employee_id, leave_type_id, start_date, end_date, total_days, reason are required', 400);
  }
  
  // Here we could add logic to check if they have enough balance
  const balances = await q.getLeaveBalances(data.employee_id, new Date(data.start_date).getFullYear());
  const balance = balances.find(b => b.leave_type_id === data.leave_type_id);
  
  // Example check (if we strictly enforce balances)
  // if (!balance || (balance.allocated_days + balance.carried_forward_days - balance.used_days) < data.total_days) {
  //   throw new AppError('Insufficient leave balance', 400);
  // }

  return q.createLeaveRequest(data);
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
    const year = new Date(req.start_date).getFullYear();
    const balances = await q.getLeaveBalances(req.employee_id, year);
    let bal = balances.find(b => b.leave_type_id === req.leave_type_id);
    if (!bal) {
      // If no balance record exists, create one with 0 allocation just to track usage
      bal = { allocated_days: 0, carried_forward_days: 0, used_days: 0 };
    }
    
    await q.upsertLeaveBalance({
      employee_id: req.employee_id,
      leave_type_id: req.leave_type_id,
      year: year,
      allocated_days: bal.allocated_days,
      carried_forward_days: bal.carried_forward_days,
      used_days: Number(bal.used_days) + Number(req.total_days)
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
