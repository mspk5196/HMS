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
  const id = await svc.createHoliday(req.body);
  return res.status(201).json(created({ id }, 'Holiday created'));
});

/* ─── LEAVE BALANCES ─── */
const getBalances = asyncHandler(async (req, res) => {
  const { employeeId, year } = req.query;
  if (!employeeId || !year) return res.status(400).json(fail('employeeId and year are required'));
  return res.json(success(await svc.getLeaveBalances(Number(employeeId), Number(year))));
});

const setBalance = asyncHandler(async (req, res) => {
  await svc.upsertLeaveBalance(req.body);
  return res.json(success(null, 'Leave balance updated'));
});

/* ─── LEAVE REQUESTS ─── */
const listRequests = asyncHandler(async (req, res) => {
  const { employeeId, status, page = 1, limit = 50 } = req.query;
  const result = await svc.listLeaveRequests({
    employeeId: employeeId ? Number(employeeId) : null,
    status: status || null,
    page: Number(page),
    limit: Number(limit)
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

const getRequest = asyncHandler(async (req, res) => {
  const reqData = await svc.getLeaveRequest(Number(req.params.id));
  if (!reqData) return res.status(404).json(fail('Leave request not found'));
  return res.json(success(reqData));
});

const createRequest = asyncHandler(async (req, res) => {
  const id = await svc.createLeaveRequest(req.body);
  return res.status(201).json(created({ id }, 'Leave request submitted'));
});

const reviewRequest = asyncHandler(async (req, res) => {
  await svc.reviewLeaveRequest(Number(req.params.id), req.body, req.user?.id ?? null);
  return res.json(success(null, 'Leave request reviewed'));
});

/* ─── WEEK-OFF POLICIES ─── */
const listWeekOffs = asyncHandler(async (req, res) => {
  return res.json(success(await svc.listWeekOffPolicies()));
});

const createWeekOff = asyncHandler(async (req, res) => {
  const id = await svc.createWeekOffPolicy(req.body);
  return res.status(201).json(created({ id }, 'Week-off policy created'));
});

module.exports = {
  listLeaveTypes, createLeaveType, updateLeaveType,
  listHolidays, createHoliday,
  getBalances, setBalance,
  listRequests, getRequest, createRequest, reviewRequest,
  listWeekOffs, createWeekOff,
};
