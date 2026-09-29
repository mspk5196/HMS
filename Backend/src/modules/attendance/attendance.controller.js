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
  let { date, fromDate, toDate, employeeId, departmentId, search, status, page = 1, limit = 50 } = req.query;
  // Allow shorthand: ?date=YYYY-MM-DD  (single day)
  if (date && !fromDate) { fromDate = date; toDate = date; }
  if (!fromDate || !toDate) {
    return res.status(400).json(fail('date (or fromDate + toDate) is required'));
  }
  const result = await svc.listDailySummaries({
    fromDate, toDate,
    employeeId: employeeId ? Number(employeeId) : null,
    departmentId: departmentId ? Number(departmentId) : null,
    search: search || null,
    status: status || null,
    page: Number(page), limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/** GET /api/attendance/register?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD */
const getAttendanceRegister = asyncHandler(async (req, res) => {
  let { fromDate, toDate, month, year, departmentId, search, status } = req.query;
  
  if (month && year && (!fromDate || !toDate)) {
    const m = Number(month);
    const y = Number(year);
    const lastDay = new Date(y, m, 0).getDate();
    fromDate = `${y}-${String(m).padStart(2, '0')}-01`;
    toDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  if (!fromDate || !toDate) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    fromDate = `${y}-${String(m).padStart(2, '0')}-01`;
    toDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  const result = await svc.getAttendanceRegister({
    fromDate,
    toDate,
    departmentId: departmentId ? Number(departmentId) : null,
    search: search || null,
    status: status || null,
  });

  return res.json(success(result));
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

/** POST /api/attendance/process  { date?: 'YYYY-MM-DD', fromDate?: 'YYYY-MM-DD', toDate?: 'YYYY-MM-DD', month?: number, year?: number } */
const processDay = asyncHandler(async (req, res) => {
  let { date, fromDate, toDate, month, year } = req.body;

  if (month && year && (!fromDate || !toDate)) {
    const m = Number(month);
    const y = Number(year);
    const lastDay = new Date(y, m, 0).getDate();
    fromDate = `${y}-${String(m).padStart(2, '0')}-01`;
    toDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  if (fromDate && toDate) {
    const result = await svc.processAttendanceRange(fromDate, toDate);
    return res.json(
      success(
        result,
        `Processed ${result.processed} attendance records across ${result.datesProcessed} day(s) (${fromDate} to ${toDate})`
      )
    );
  }

  if (date) {
    const result = await svc.processDailyAttendance(date);
    return res.json(success(result, `Processed attendance for ${date}`));
  }

  return res.status(400).json(fail('Please provide date (YYYY-MM-DD), or fromDate + toDate, or month + year'));
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

/** GET /api/attendance/punches — list raw biometric punches */
const listRawPunches = asyncHandler(async (req, res) => {
  const { employeeId, employeeCode, departmentId, fromDate, toDate, search, page = 1, limit = 50 } = req.query;
  const result = await q.listRawPunches({
    employeeId: employeeId ? Number(employeeId) : null,
    employeeCode: employeeCode || null,
    departmentId: departmentId ? Number(departmentId) : null,
    fromDate: fromDate || null,
    toDate: toDate || null,
    search: search || null,
    page: Number(page),
    limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/** GET /api/attendance/punches/employee/:id — get full biometric timeline for employee */
const getEmployeeTimeline = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fromDate, toDate } = req.query;
  const from = fromDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = toDate || new Date().toISOString().slice(0, 10);
  const data = await q.getEmployeeBiometricTimeline(Number(id), from, to);
  if (!data) return res.status(404).json(fail('Employee not found'));
  return res.json(success(data));
});

/* ─────────────────────────────────────────────
   ADMIN MANUAL MARK
───────────────────────────────────────────── */

/**
 * POST /api/attendance/mark
 * Body: { employee_id, date, status, in_time, out_time, reason }
 */
const manualMark = asyncHandler(async (req, res) => {
  const { employee_id, date, status, in_time, out_time, reason } = req.body;
  if (!employee_id || !date || !status) {
    return res.status(400).json(fail('employee_id, date and status are required'));
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json(fail('Reason for manual attendance marking is mandatory'));
  }
  const markedBy = req.user?.id ?? null;
  await svc.markAttendanceManually(
    Number(employee_id),
    date,
    status,
    markedBy,
    in_time || null,
    out_time || null,
    String(reason).trim()
  );
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

/* ─────────────────────────────────────────────
   BIOMETRIC DEVICE CONTROLLERS
───────────────────────────────────────────── */
const esslSvc = require('./essl.service');
const q = require('./attendance.queries');

/** GET /api/attendance/devices — list all configured biometric devices */
const listDevices = asyncHandler(async (req, res) => {
  const devices = await q.listBiometricDevices();
  return res.json(success(devices));
});

/** POST /api/attendance/devices — add a new biometric device */
const createDevice = asyncHandler(async (req, res) => {
  const { name, ip_address, port, comm_key, device_type, location, auto_sync_enabled, sync_interval_mins } = req.body;
  if (!name || !ip_address) {
    return res.status(400).json(fail('Device name and IP address are required.'));
  }
  const id = await q.createBiometricDevice({
    name, ip_address, port: Number(port) || 4370,
    comm_key, device_type, location, auto_sync_enabled, sync_interval_mins,
  });
  return res.status(201).json(created({ id }, 'Biometric device added successfully'));
});

/** PUT /api/attendance/devices/:id — update device config */
const updateDevice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await q.updateBiometricDevice(Number(id), req.body);
  if (!updated) return res.status(404).json(fail('Device not found'));
  return res.json(success(null, 'Biometric device updated'));
});

/** DELETE /api/attendance/devices/:id — remove device */
const deleteDevice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await q.deleteBiometricDevice(Number(id));
  if (!deleted) return res.status(404).json(fail('Device not found'));
  return res.json(success(null, 'Biometric device deleted'));
});

/** POST /api/attendance/devices/:id/test — test live TCP/IP connection */
const testDevice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const device = await q.getBiometricDevice(Number(id));
  if (!device) return res.status(404).json(fail('Device not found'));

  const result = await esslSvc.testDeviceConnection({
    ip_address: device.ip_address,
    port: device.port || 4370,
  });

  if (result.online) {
    await q.updateDeviceSyncStatus(device.id, { status: 'online' });
  } else {
    await q.updateDeviceSyncStatus(device.id, { status: 'unreachable' });
  }

  return res.json(success(result));
});

/** POST /api/attendance/devices/:id/sync — download punches from device now */
const syncDevice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fromDate, toDate } = req.body || {};
  const result = await esslSvc.syncBiometricDevice(Number(id), svc, { fromDate, toDate });
  return res.json(
    success(
      result,
      `Synced ${result.newPunchesInserted} new punches from ${result.deviceName} (${result.existingPunchesPreserved || 0} existing records left unchanged).`
    )
  );
});

/** POST /api/attendance/devices/sync-all — sync all active devices */
const syncAllDevices = asyncHandler(async (req, res) => {
  const { fromDate, toDate, includeAll } = req.body || {};
  const results = await esslSvc.syncAllActiveDevices(svc, { fromDate, toDate, includeAll });
  const totalNew = Array.isArray(results) ? results.reduce((sum, r) => sum + (r.newPunchesInserted || 0), 0) : 0;
  const totalPreserved = Array.isArray(results) ? results.reduce((sum, r) => sum + (r.existingPunchesPreserved || 0), 0) : 0;
  return res.json(
    success(
      results,
      `Biometric sync complete! ${totalNew} new punches registered (${totalPreserved} existing records preserved).`
    )
  );
});

/** POST /api/attendance/devices/sync-historical — dedicated historical sync with date filtering */
const syncHistoricalPunches = asyncHandler(async (req, res) => {
  const { deviceId, fromDate, toDate } = req.body || {};
  if (deviceId && deviceId !== 'all') {
    const result = await esslSvc.syncBiometricDevice(Number(deviceId), svc, { fromDate, toDate });
    return res.json(
      success(
        result,
        `Historical sync complete: ${result.newPunchesInserted} new punches added, ${result.existingPunchesPreserved || 0} existing punches left untouched.`
      )
    );
  }

  const results = await esslSvc.syncAllActiveDevices(svc, { fromDate, toDate, includeAll: true });
  const totalNew = Array.isArray(results) ? results.reduce((sum, r) => sum + (r.newPunchesInserted || 0), 0) : 0;
  const totalPreserved = Array.isArray(results) ? results.reduce((sum, r) => sum + (r.existingPunchesPreserved || 0), 0) : 0;
  return res.json(
    success(
      results,
      `Historical sync complete across all devices: ${totalNew} new punches added (${totalPreserved} existing punches preserved).`
    )
  );
});

/** GET /api/attendance/enrolled-users — list enrolled staff from biometric machines */
const listEnrolledUsers = asyncHandler(async (req, res) => {
  const { unlinked, search, limit, offset } = req.query;
  const data = await q.listBiometricEnrolledUsers({
    unlinkedOnly: unlinked === 'true' || unlinked === '1',
    search: search || '',
    limit: Number(limit) || 100,
    offset: Number(offset) || 0,
  });
  return res.json(success(data));
});

/** POST /api/attendance/enrolled-users — store or push enrolled users into database */
const upsertEnrolledUsers = asyncHandler(async (req, res) => {
  const users = Array.isArray(req.body) ? req.body : (req.body.users || [req.body]);
  const result = await q.upsertBiometricEnrolledUsers(users);
  return res.status(201).json(success(result, `Saved ${result.upserted} enrolled biometric user(s) to database.`));
});

/** POST /api/attendance/devices/:id/sync-users — pull enrolled staff registrations from device into database */
const syncDeviceUsers = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await esslSvc.syncBiometricEnrolledUsers(Number(id));
  return res.json(success(result, `Synced ${result.totalEnrolledOnDevice} enrolled user(s) from ${result.deviceName}`));
});

/** POST /api/attendance/devices/sync-all-users — sync enrolled users from all active devices */
const syncAllDeviceUsers = asyncHandler(async (req, res) => {
  const devices = await q.listBiometricDevices();
  const activeDevices = devices.filter((d) => d.auto_sync_enabled !== 0 && d.status !== 'unreachable');
  const targets = activeDevices.length > 0 ? activeDevices : devices;
  const results = [];
  let totalUsers = 0;

  for (const dev of targets) {
    try {
      const resDev = await esslSvc.syncBiometricEnrolledUsers(dev.id);
      results.push(resDev);
      totalUsers += (resDev.totalEnrolledOnDevice || 0);
    } catch (err) {
      results.push({ success: false, deviceId: dev.id, deviceName: dev.name, error: err.message });
    }
  }
  return res.json(success({ results, totalUsers }, `Synced enrolled users across ${targets.length} device(s).`));
});

/** POST /api/attendance/enrolled-users/auto-link — link enrolled biometric users with employee profiles */
const autoLinkUsers = asyncHandler(async (req, res) => {
  const linkedCount = await q.autoLinkEnrolledUsers();
  return res.json(success({ linkedCount }, `Linked ${linkedCount} biometric registration(s) to employee profiles.`));
});

/** GET /api/attendance/enrolled-users/next-code — suggest next available employee / biometric ID */
const getNextEnrollCode = asyncHandler(async (req, res) => {
  const nextCode = await q.getNextBiometricEnrollCode();
  return res.json(success({ nextCode }, `Next available employee code is ${nextCode}`));
});

/** POST /api/attendance/enrolled-users/register — register single new staff enrollment from Windows/Web */
const registerEnrolledUser = asyncHandler(async (req, res) => {
  const record = await q.registerSingleBiometricUser(req.body);
  return res.status(201).json(success(record, `Registered biometric profile for #${record.enroll_code} in database.`));
});

/** POST /api/attendance/enrolled-users/:id/link — manually map biometric enrollment to employee */
const linkEnrolledUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { employee_id } = req.body;
  const result = await q.linkBiometricUser(Number(id), employee_id ? Number(employee_id) : null);
  return res.json(success(result, result.message || 'Updated biometric employee mapping.'));
});

/* ─── LATE ATTENDANCE FINES ─── */

/** GET /api/attendance/late-fines/candidates?month=&year=&departmentId=&search=&filterMode= */
const getLateFineCandidates = asyncHandler(async (req, res) => {
  const now = new Date();
  const month = Number(req.query.month || now.getMonth() + 1);
  const year = Number(req.query.year || now.getFullYear());
  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
  const search = req.query.search || null;
  const filterMode = req.query.filterMode || 'exceeded'; // 'exceeded' | 'all_late'

  const result = await svc.getLateFineCandidates({
    month,
    year,
    departmentId,
    search,
    filterMode,
  });

  return res.json(success(result));
});

/** POST /api/attendance/late-fines/apply */
const applyLateFines = asyncHandler(async (req, res) => {
  const { month, year, fines, fine_date } = req.body;
  const createdBy = req.user?.id ?? null;

  if (!month || !year || !Array.isArray(fines) || fines.length === 0) {
    return res.status(400).json(fail('month, year, and a non-empty fines array are required'));
  }

  const result = await svc.applyLateFines({
    month,
    year,
    fines,
    fineDate: fine_date,
    createdBy,
  });

  return res.status(201).json(
    success(result, `Successfully applied fines to ${result.applied_count} employee(s) totalling ₹${result.total_amount}.`)
  );
});

/** PATCH /api/attendance/late-fines/:id/cancel */
const cancelLateFine = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const cancelledBy = req.user?.id ?? null;
  await svc.cancelLateFine(Number(id), { reason, cancelledBy });
  return res.json(success(null, 'Late attendance fine cancelled.'));
});

/** PATCH /api/attendance/late-fines/:id/waive */
const waiveLateFine = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const waivedBy = req.user?.id ?? null;
  await svc.waiveLateFine(Number(id), { reason, waivedBy });
  return res.json(success(null, 'Late attendance fine waived.'));
});

module.exports = {
  listSummaries,
  getAttendanceRegister,
  getSummary,
  processDay,
  importPunches,
  listUnmatchedPunches,
  listRawPunches,
  getEmployeeTimeline,
  manualMark,
  listBiometricWindows,
  createBiometricWindow,
  listCorrections,
  createCorrection,
  reviewCorrection,
  getBufferSummary,
  manualPunch,
  getEmployeeBuffer,
  listDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  testDevice,
  syncDevice,
  syncAllDevices,
  syncHistoricalPunches,
  listEnrolledUsers,
  upsertEnrolledUsers,
  syncDeviceUsers,
  syncAllDeviceUsers,
  autoLinkUsers,
  getNextEnrollCode,
  registerEnrolledUser,
  linkEnrolledUser,
  getLateFineCandidates,
  applyLateFines,
  cancelLateFine,
  waiveLateFine,
};

