/**
 * attendance.controller.js
 * HTTP layer for the Attendance module.
 * All heavy logic lives in attendance.service.js.
 */

const svc = require('./attendance.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created, paginated, fail } = require('../../utils/response');

/* ─────────────────────────────────────────────
   DAILY SUMMARIES
───────────────────────────────────────────── */

/** GET /api/attendance?date=YYYY-MM-DD  OR  ?fromDate=&toDate= */
const listSummaries = asyncHandler(async (req, res) => {
  let { date, fromDate, toDate, employeeId, departmentId, page = 1, limit = 50 } = req.query;
  // Allow shorthand: ?date=YYYY-MM-DD  (single day)
  if (date && !fromDate) { fromDate = date; toDate = date; }
  if (!fromDate || !toDate) {
    return res.status(400).json(fail('date (or fromDate + toDate) is required'));
  }
  const result = await svc.listDailySummaries({
    fromDate, toDate,
    employeeId: employeeId ? Number(employeeId) : null,
    departmentId: departmentId ? Number(departmentId) : null,
    page: Number(page), limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/** GET /api/attendance/:employeeId/:date */
const getSummary = asyncHandler(async (req, res) => {
  const { employeeId, date } = req.params;
  const row = await svc.getDailySummary(Number(employeeId), date);
  if (!row) return res.status(404).json(fail('No attendance record found for this employee on this date'));
  return res.json(success(row));
});

/* ─────────────────────────────────────────────
   PROCESSING ENGINE
───────────────────────────────────────────── */

/** POST /api/attendance/process  { date: 'YYYY-MM-DD' } */
const processDay = asyncHandler(async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json(fail('date is required (YYYY-MM-DD)'));
  const result = await svc.processDailyAttendance(date);
  return res.json(success(result, `Processed attendance for ${date}`));
});

/* ─────────────────────────────────────────────
   PUNCH IMPORT (eTimeTracker)
───────────────────────────────────────────── */

/**
 * POST /api/attendance/punches/import
 * Body: { punches: [{ employee_code | employee_id, punch_time, device_id?, punch_type? }] }
 *
 * The device exports employee_code, so that is the primary identifier. Codes
 * matching no employee are still stored and returned in `unmatchedCodes`.
 */
const importPunches = asyncHandler(async (req, res) => {
  const { punches } = req.body;
  if (!Array.isArray(punches)) return res.status(400).json(fail('punches must be an array'));
  const result = await svc.importPunches(punches);
  const note = result.unmatchedCodes.length
    ? ` ${result.unmatchedCodes.length} code(s) matched no employee.`
    : '';
  return res.status(201).json(
    created(result, `${result.inserted} punch(es) imported, ${result.duplicatesIgnored} duplicate(s) ignored.${note}`)
  );
});

/** GET /api/attendance/punches/unmatched?fromDate=&toDate= */
const listUnmatchedPunches = asyncHandler(async (req, res) => {
  const { fromDate, toDate } = req.query;
  if (!fromDate || !toDate) return res.status(400).json(fail('fromDate and toDate are required'));
  return res.json(success(await svc.getUnmatchedPunches(fromDate, toDate)));
});

/* ─────────────────────────────────────────────
   ADMIN MANUAL MARK
───────────────────────────────────────────── */

/**
 * POST /api/attendance/mark
 * Body: { employee_id, date, status }
 */
const manualMark = asyncHandler(async (req, res) => {
  const { employee_id, date, status } = req.body;
  if (!employee_id || !date || !status) {
    return res.status(400).json(fail('employee_id, date and status are required'));
  }
  const markedBy = req.user?.id ?? null; // Set by auth middleware when ready
  await svc.markAttendanceManually(Number(employee_id), date, status, markedBy);
  return res.json(success(null, 'Attendance marked manually'));
});

/* ─────────────────────────────────────────────
   BIOMETRIC WINDOWS
───────────────────────────────────────────── */

/** GET /api/attendance/biometric-windows?page=&limit= */
const listBiometricWindows = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const result = await svc.listBiometricWindows(Number(page), Number(limit));
  return res.json(paginated(result.rows, result.total, page, limit));
});

/**
 * POST /api/attendance/biometric-windows
 * Body: { window_date, extended_start, extended_end, role_id?, reason? }
 */
const createBiometricWindow = asyncHandler(async (req, res) => {
  const id = await svc.createBiometricWindow(req.body, req.user?.id ?? null);
  return res.status(201).json(created({ id }, 'Biometric window created'));
});

/* ─────────────────────────────────────────────
   CORRECTION REQUESTS
───────────────────────────────────────────── */

/** GET /api/attendance/corrections?status=&employeeId=&page=&limit= */
const listCorrections = asyncHandler(async (req, res) => {
  const { status, employeeId, page = 1, limit = 30 } = req.query;
  const result = await svc.listCorrectionRequests({
    status: status || null,
    employeeId: employeeId ? Number(employeeId) : null,
    page: Number(page), limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/**
 * POST /api/attendance/corrections
 * Body: { employee_id, attendance_date, requested_in_time?, requested_out_time?, reason }
 */
const createCorrection = asyncHandler(async (req, res) => {
  const id = await svc.submitCorrectionRequest(req.body);
  return res.status(201).json(created({ id }, 'Correction request submitted'));
});

/**
 * PATCH /api/attendance/corrections/:id/review
 * Body: { status: 'approved'|'rejected' }
 */
const reviewCorrection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await svc.reviewCorrectionRequest(Number(id), req.body, req.user?.id ?? null);
  return res.json(success(null, 'Correction request reviewed'));
});

/* ─────────────────────────────────────────────
   BUFFER SUMMARY
───────────────────────────────────────────── */

/** GET /api/attendance/buffer?month=&year=&departmentId= */
const getBufferSummary = asyncHandler(async (req, res) => {
  const { month, year, departmentId } = req.query;
  if (!month || !year) return res.status(400).json(fail('month and year are required'));
  const rows = await svc.getBufferSummary(Number(month), Number(year), departmentId ? Number(departmentId) : null);
  return res.json(success(rows));
});

const manualPunch = asyncHandler(async (req, res) => {
  const { employee_id, date, check_in, check_out, overtime_minutes } = req.body;
  if (!employee_id || !date || !check_in) {
    return res.status(400).json(fail('employee_id, date and check_in are required'));
  }
  await svc.addManualPunch(Number(employee_id), date, check_in, check_out || null, Number(overtime_minutes) || 0);
  return res.json(success(null, 'Manual timing recorded and attendance calculated'));
});

/** GET /api/attendance/buffer/employee/:id?month=&year= */
const getEmployeeBuffer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { month, year } = req.query;
  const m = Number(month) || new Date().getMonth() + 1;
  const y = Number(year) || new Date().getFullYear();
  const buffer = await svc.getEmployeeBuffer(Number(id), m, y);
  return res.json(success(buffer));
});

module.exports = {
  listSummaries,
  getSummary,
  processDay,
  importPunches,
  listUnmatchedPunches,
  manualMark,
  listBiometricWindows,
  createBiometricWindow,
  listCorrections,
  createCorrection,
  reviewCorrection,
  getBufferSummary,
  manualPunch,
  getEmployeeBuffer,
};
