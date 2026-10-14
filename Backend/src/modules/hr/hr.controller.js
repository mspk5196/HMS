const fs = require('fs');
const path = require('path');
const svc = require('./hr.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created, paginated, fail } = require('../../utils/response');

const saveBase64Photo = (base64Str) => {
  if (!base64Str || typeof base64Str !== 'string' || !base64Str.startsWith('data:image/')) return null;
  const matches = base64Str.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
  if (!matches) return null;
  const ext = matches[1] === 'jpeg' ? '.jpg' : `.${matches[1]}`;
  const buffer = Buffer.from(matches[2], 'base64');
  const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
  const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, filename), buffer);
  return `/uploads/${filename}`;
};

const listDoctors = asyncHandler(async (req, res) => {
  return res.json(success(await svc.listDoctors()));
});

const listEmployees = asyncHandler(async (req, res) => {
  const { search, departmentId, shiftCategory, shift_category, status, page = 1, limit = 50 } = req.query;
  const result = await svc.listEmployees({
    search: search || null,
    departmentId: departmentId ? Number(departmentId) : null,
    shiftCategory: shiftCategory || shift_category || null,
    status: status !== undefined ? status : null,
    page: Number(page),
    limit: Number(limit)
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

const getEmployee = asyncHandler(async (req, res) => {
  const emp = await svc.getEmployee(Number(req.params.id));
  if (!emp) return res.status(404).json(fail('Employee not found'));
  return res.json(success(emp));
});

const createEmployee = asyncHandler(async (req, res) => {
  // Parse file uploads from multer (files are optional at creation time)
  const body = { ...req.body };
  if (req.files?.aadhar_doc?.[0]) body.aadhar_doc_path = `/uploads/${req.files.aadhar_doc[0].filename}`;
  if (req.files?.pan_doc?.[0])    body.pan_doc_path    = `/uploads/${req.files.pan_doc[0].filename}`;
  if (req.files?.photo?.[0]) {
    body.photo_path = `/uploads/${req.files.photo[0].filename}`;
  } else if (body.photo_base64) {
    const saved = saveBase64Photo(body.photo_base64);
    if (saved) body.photo_path = saved;
  }
  const id = await svc.createEmployee(body);
  return res.status(201).json(created({ id }, 'Employee created'));
});

const previewSettlement = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const lastWorkingDate = req.query.lastWorkingDate || req.query.last_working_date || new Date().toISOString().slice(0, 10);
  const result = await svc.previewEmployeeSettlement(id, lastWorkingDate);
  return res.json(success(result));
});

const deactivateEmployee = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const file = req.file || req.files?.exit_document?.[0] || req.files?.document?.[0] || null;
  const result = await svc.deactivateEmployee(id, req.body, file, req.user?.id ?? null);
  return res.json(success(result, 'Employee marked as inactive successfully'));
});

const reactivateEmployee = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const result = await svc.reactivateEmployee(id, req.body, req.user?.id ?? null);
  return res.json(success(result, 'Employee reactivated successfully'));
});

const updateEmployee = asyncHandler(async (req, res) => {
  // Parse file uploads from multer
  const body = { ...req.body };
  if (req.files?.aadhar_doc?.[0]) body.aadhar_doc_path = `/uploads/${req.files.aadhar_doc[0].filename}`;
  if (req.files?.pan_doc?.[0])    body.pan_doc_path    = `/uploads/${req.files.pan_doc[0].filename}`;
  if (req.files?.photo?.[0]) {
    body.photo_path = `/uploads/${req.files.photo[0].filename}`;
  } else if (body.photo_base64) {
    const saved = saveBase64Photo(body.photo_base64);
    if (saved) body.photo_path = saved;
  }
  await svc.updateEmployee(Number(req.params.id), body, req.user?.id ?? null);
  return res.json(success(null, 'Employee updated'));
});

const listDepartments = asyncHandler(async (req, res) => {
  return res.json(success(await svc.listDepartments()));
});

const listDesignations = asyncHandler(async (req, res) => {
  return res.json(success(await svc.listDesignations()));
});

const listRoles = asyncHandler(async (req, res) => {
  return res.json(success(await svc.listRoles()));
});

const listShifts = asyncHandler(async (req, res) => {
  return res.json(success(await svc.listShifts()));
});

const createShift = asyncHandler(async (req, res) => {
  const id = await svc.createShift(req.body);
  return res.status(201).json(created({ id }, 'Shift created'));
});

const updateShift = asyncHandler(async (req, res) => {
  await svc.updateShift(Number(req.params.id), req.body);
  return res.json(success(null, 'Shift updated'));
});

const updateShiftTimings = asyncHandler(async (req, res) => {
  const result = await svc.updateShiftTimings(req.body);
  return res.json(success(result, 'Shift timings updated successfully'));
});

const deleteShift = asyncHandler(async (req, res) => {
  await svc.deleteShift(Number(req.params.id));
  return res.json(success(null, 'Shift deleted'));
});

const createDepartment = asyncHandler(async (req, res) => {
  const id = await svc.createDepartment(req.body);
  return res.status(201).json(created({ id }, 'Department created'));
});

const updateDepartment = asyncHandler(async (req, res) => {
  await svc.updateDepartment(Number(req.params.id), req.body);
  return res.json(success(null, 'Department updated'));
});

const deleteDepartment = asyncHandler(async (req, res) => {
  await svc.deleteDepartment(Number(req.params.id));
  return res.json(success(null, 'Department deleted'));
});

const createDesignation = asyncHandler(async (req, res) => {
  const id = await svc.createDesignation(req.body);
  return res.status(201).json(created({ id }, 'Designation created'));
});

const createRole = asyncHandler(async (req, res) => {
  const id = await svc.createRole(req.body);
  return res.status(201).json(created({ id }, 'Role created'));
});

// Staff Roles
const listStaffRoles = asyncHandler(async (req, res) => {
  const { departmentId } = req.query;
  const data = await svc.listStaffRoles(departmentId ? Number(departmentId) : null);
  return res.json(success(data));
});

const getStaffRole = asyncHandler(async (req, res) => {
  const role = await svc.getStaffRole(Number(req.params.id));
  if (!role) return res.status(404).json(fail('Staff role not found'));
  return res.json(success(role));
});

const createStaffRole = asyncHandler(async (req, res) => {
  const id = await svc.createStaffRole(req.body);
  return res.status(201).json(created({ id }, 'Staff role created'));
});

const updateStaffRole = asyncHandler(async (req, res) => {
  await svc.updateStaffRole(Number(req.params.id), req.body);
  return res.json(success(null, 'Staff role updated'));
});

const deleteStaffRole = asyncHandler(async (req, res) => {
  await svc.deleteStaffRole(Number(req.params.id));
  return res.json(success(null, 'Staff role deleted'));
});

const rosterSvc = require('./roster.service');

const getRoster = asyncHandler(async (req, res) => {
  const { month, year, departmentId, staffRoleId } = req.query;
  const data = await rosterSvc.getRoster(
    Number(month),
    Number(year),
    departmentId ? Number(departmentId) : null,
    staffRoleId  ? Number(staffRoleId)  : null
  );
  return res.json(success(data));
});

const getEmployeesForRoster = asyncHandler(async (req, res) => {
  const { departmentId, staffRoleId } = req.query;
  const data = await rosterSvc.getEmployeesForRoster(
    departmentId ? Number(departmentId) : null,
    staffRoleId  ? Number(staffRoleId)  : null
  );
  return res.json(success(data));
});

const getRosterWeek = asyncHandler(async (req, res) => {
  const { weekStart, departmentId, staffRoleId } = req.query;
  const data = await rosterSvc.getWeek({
    weekStart,
    departmentId: departmentId ? Number(departmentId) : null,
    staffRoleId: staffRoleId ? Number(staffRoleId) : null,
  });
  return res.json(success(data));
});

const saveRosterDay = asyncHandler(async (req, res) => {
  await rosterSvc.saveRosterDay(req.body, req.user?.id ?? null);
  return res.json(success(null, 'Roster updated'));
});

const bulkSaveRoster = asyncHandler(async (req, res) => {
  const { rows, weekStart } = req.body;
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json(fail('rows array is required'));
  }
  const result = await rosterSvc.bulkSaveRoster(rows, req.user?.id ?? null, weekStart);
  return res.json(success(result, `Saved ${result.saved} roster entries`));
});

const swapRosterShifts = asyncHandler(async (req, res) => {
  const data = await rosterSvc.swapShifts(req.body, req.user?.id ?? null);
  return res.json(success(data, 'Shifts swapped'));
});

/* ─── NON-ROSTER WEEK-OFFS ─── */

const listNonRosterEmployees = asyncHandler(async (req, res) => {
  const { departmentId, shiftCategory, month, year } = req.query;
  const data = await rosterSvc.listNonRosterEmployees(departmentId, shiftCategory, month, year);
  return res.json(success(data));
});

const getEmployeeWeekOffCalendar = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { month, year } = req.query;
  const data = await rosterSvc.getEmployeeWeekOffCalendar(employeeId, month, year);
  return res.json(success(data));
});

const setEmployeeWeekOffDate = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { date, is_week_off } = req.body;
  const data = await rosterSvc.setEmployeeWeekOffDate(employeeId, date, is_week_off, req.user?.id ?? null);
  return res.json(success(data, 'Week off updated'));
});

const setGroupWeekOffs = asyncHandler(async (req, res) => {
  const data = await rosterSvc.setGroupWeekOffs(req.body, req.user?.id ?? null);
  return res.json(success(data, `Applied week-offs to ${data.employee_count} employees`));
});

/* ─── DUTY TRANSFER / COVERAGE ─── */

const transferDutyShift = asyncHandler(async (req, res) => {
  const data = await rosterSvc.transferDuty(req.body, req.user?.id ?? null);
  return res.json(success(data, 'Duty successfully transferred to replacement staff'));
});

const getEligibleReplacements = asyncHandler(async (req, res) => {
  const { dutyDate, departmentId, excludeEmployeeId } = req.query;
  const data = await rosterSvc.getEligibleReplacements(dutyDate, departmentId, excludeEmployeeId);
  return res.json(success(data));
});

const listDutyTransfers = asyncHandler(async (req, res) => {
  const { month, year, departmentId } = req.query;
  const data = await rosterSvc.listDutyTransfers(month, year, departmentId);
  return res.json(success(data));
});

/* ─── REMAPPING & SALARY LOGGING ─── */

const remapEmployee = asyncHandler(async (req, res) => {
  await svc.remapEmployee(req.body, req.user?.id ?? null);
  return res.json(success(null, 'Employee remapped successfully'));
});

const listRemappingLogs = asyncHandler(async (req, res) => {
  const { search, employeeId, page = 1, limit = 50 } = req.query;
  const result = await svc.listRemappingLogs({
    search: search || null,
    employeeId: employeeId ? Number(employeeId) : null,
    page: Number(page),
    limit: Number(limit)
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

const updateEmployeeSalary = asyncHandler(async (req, res) => {
  await svc.updateEmployeeSalary(Number(req.params.id), req.body, req.user?.id ?? null);
  return res.json(success(null, 'Employee salary updated successfully'));
});

const listSalaryLogs = asyncHandler(async (req, res) => {
  const { search, employeeId, page = 1, limit = 50 } = req.query;
  const result = await svc.listSalaryLogs({
    search: search || null,
    employeeId: employeeId ? Number(employeeId) : null,
    page: Number(page),
    limit: Number(limit)
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

const bulkImportEmployees = asyncHandler(async (req, res) => {
  const rows = Array.isArray(req.body) ? req.body : req.body?.employees || [];
  if (!rows.length) {
    return res.status(400).json(fail('No employee records provided for import.'));
  }
  const result = await svc.bulkImportEmployees(rows);
  const msg = `Bulk import complete: ${result.inserted} created, ${result.updated} updated${result.errors?.length ? `, ${result.errors.length} failed` : ''}.`;
  return res.status(200).json(success(result, msg));
});

/* ─── SHIFT OVERRIDES ─── */

const getShiftOverrides = asyncHandler(async (req, res) => {
  const data = await svc.listShiftOverrides(Number(req.params.id));
  return res.json(success(data));
});

const upsertShiftOverride = asyncHandler(async (req, res) => {
  const data = await svc.upsertShiftOverride(Number(req.params.id), req.body, req.user?.id ?? null);
  return res.json(success(data, 'Shift override saved'));
});

const deleteShiftOverride = asyncHandler(async (req, res) => {
  await svc.deleteShiftOverride(Number(req.params.id), req.params.date);
  return res.json(success(null, 'Shift override removed'));
});

const deleteShiftOverridesRange = asyncHandler(async (req, res) => {
  const { from_date, to_date, dates } = req.body;
  const result = await svc.deleteShiftOverridesRange(Number(req.params.id), { from_date, to_date, dates });
  return res.json(success(result, 'Shift overrides removed'));
});

const updateEmployeeShift = asyncHandler(async (req, res) => {
  const result = await svc.updateEmployeeShift(Number(req.params.id), req.body, req.user?.id ?? null);
  return res.json(success(result, 'Employee shift updated successfully'));
});

const listEmployeeShiftLogs = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { search, page = 1, limit = 50 } = req.query;
  const result = await svc.listEmployeeShiftLogs({
    employeeId: id ? Number(id) : null,
    search: search || null,
    page: Number(page),
    limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

const listEmployeeAuditLogs = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { changeType, page = 1, limit = 50 } = req.query;
  const result = await svc.listEmployeeAuditLogs({
    employeeId: Number(id),
    changeType: changeType || null,
    page: Number(page),
    limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

const listEmployeePayoutLogs = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const result = await svc.listEmployeePayoutLogs({
    employeeId: Number(id),
    page: Number(page),
    limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

module.exports = {
  listEmployees, listDoctors, getEmployee, createEmployee, updateEmployee, bulkImportEmployees,
  previewSettlement, deactivateEmployee, reactivateEmployee,
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  listDesignations, createDesignation,
  listRoles, createRole,
  listShifts, createShift, updateShift, updateShiftTimings, deleteShift,
  listStaffRoles, getStaffRole, createStaffRole, updateStaffRole, deleteStaffRole,
  getRoster, getRosterWeek, getEmployeesForRoster, saveRosterDay, bulkSaveRoster, swapRosterShifts,
  listNonRosterEmployees, getEmployeeWeekOffCalendar, setEmployeeWeekOffDate, setGroupWeekOffs,
  transferDutyShift, getEligibleReplacements, listDutyTransfers,
  remapEmployee, listRemappingLogs, updateEmployeeSalary, listSalaryLogs,
  getShiftOverrides, upsertShiftOverride, deleteShiftOverride, deleteShiftOverridesRange,
  updateEmployeeShift, listEmployeeShiftLogs,
  listEmployeeAuditLogs, listEmployeePayoutLogs,
};
