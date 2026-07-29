const svc = require('./leave.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created, paginated, fail } = require('../../utils/response');

/* ─── LEAVE TYPES ─── */
const listLeaveTypes = asyncHandler(async (req, res) => {
  return res.json(success(await svc.listLeaveTypes()));
});

const createLeaveType = asyncHandler(async (req, res) => {
  const id = await svc.createLeaveType(req.body);
  return res.status(201).json(created({ id }, 'Leave type created'));
});

const updateLeaveType = asyncHandler(async (req, res) => {
  await svc.updateLeaveType(Number(req.params.id), req.body);
  return res.json(success(null, 'Leave type updated'));
});

/* ─── HOLIDAYS ─── */
const listHolidays = asyncHandler(async (req, res) => {
  const { year } = req.query;
  return res.json(success(await svc.listHolidays(year ? Number(year) : null)));
});

const createHoliday = asyncHandler(async (req, res) => {
  const id = await svc.createHoliday({ ...req.body, created_by: req.user?.id ?? null });
  return res.status(201).json(created({ id }, 'Holiday created'));
});

/* ─── LEAVE BALANCES ─── */
const getBalances = asyncHandler(async (req, res) => {
  const { employeeId, year } = req.query;
  if (!employeeId || !year) return res.status(400).json(fail('employeeId and year are required'));
  return res.json(success(await svc.getLeaveBalances(Number(employeeId), Number(year))));
});

/** POST /leave/balances — admin sets a year's quota (allocation only, never usage). */
const setBalance = asyncHandler(async (req, res) => {
  await svc.allocateLeaveBalance(req.body);
  return res.json(success(null, 'Leave balance allocated'));
});

/* ─── LEAVE REQUESTS ─── */
const listRequests = asyncHandler(async (req, res) => {
  const { employeeId, reportingPersonId, status, page = 1, limit = 50 } = req.query;
  const result = await svc.listLeaveRequests({
    employeeId: employeeId ? Number(employeeId) : null,
    reportingPersonId: reportingPersonId ? Number(reportingPersonId) : null,
    status: status || null,
    page: Number(page),
    limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

const getRequest = asyncHandler(async (req, res) => {
  const reqData = await svc.getLeaveRequest(Number(req.params.id));
  if (!reqData) return res.status(404).json(fail('Leave request not found'));
  return res.json(success(reqData));
});

const createRequest = asyncHandler(async (req, res) => {
  const id = await svc.applyForLeave(req.body);
  return res.status(201).json(created({ id }, 'Leave request submitted'));
});

/** PATCH /leave/requests/:id/review-reporting  Body: { status: 'approved'|'rejected' } */
const reviewReporting = asyncHandler(async (req, res) => {
  await svc.reviewByReportingPerson(Number(req.params.id), req.body);
  return res.json(success(null, 'Reviewed by reporting person'));
});

/** PATCH /leave/requests/:id/review-hr  Body: { status: 'approved'|'rejected' } */
const reviewHR = asyncHandler(async (req, res) => {
  const result = await svc.reviewByHR(Number(req.params.id), req.body, req.user?.id ?? null);
  return res.json(success(result, `Leave request ${result.result}`));
});

/** POST /leave/absences/unexplained  Body: { employee_id, date } */
const recordUnexplainedAbsence = asyncHandler(async (req, res) => {
  const { employee_id, date } = req.body;
  if (!employee_id || !date) return res.status(400).json(fail('employee_id and date are required'));
  const result = await svc.recordUnexplainedAbsence(Number(employee_id), date, req.user?.id ?? null);
  const msg = result.fineCreated
    ? `Marked LOP and imposed a fine of ₹${result.fineAmount} (${result.fineTypeName}).`
    : `Marked LOP. ${result.note || 'Leave balance still available — no fine.'}`;
  return res.json(success(result, msg));
});

/* ─── WEEK-OFF POLICIES ─── */
const listWeekOffs = asyncHandler(async (req, res) => {
  return res.json(success(await svc.listWeekOffPolicies()));
});

const setWeekOff = asyncHandler(async (req, res) => {
  await svc.upsertWeekOffPolicy(req.body);
  return res.status(201).json(created(null, 'Week-off policy saved'));
});

module.exports = {
  listLeaveTypes, createLeaveType, updateLeaveType,
  listHolidays, createHoliday,
  getBalances, setBalance,
  listRequests, getRequest, createRequest, reviewReporting, reviewHR,
  recordUnexplainedAbsence,
  listWeekOffs, setWeekOff,
};
