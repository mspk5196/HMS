const router = require('express').Router();
const ctrl = require('./hr.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');
const { gate } = require('../../middleware/approvalGate');
const { employeeDocUpload, exitDocUpload } = require('../../middleware/upload');

router.use(verifyToken);
const canViewEmployees = requirePermissions(['hr_employee.view']);
const canViewDepartments = requirePermissions(['hr_department.view']);
const canViewShifts = requirePermissions(['hr_shift.view', 'hr_employee.view', 'hr_employee.create', 'hr_roster.view']);
const canViewRoster = requirePermissions(['hr_roster.view']);

// Employees — NOTE: static routes MUST precede /employees/:id
router.get('/employees/remapping-logs', canViewEmployees, ctrl.listRemappingLogs);
router.get('/employees/salary-logs', canViewEmployees, ctrl.listSalaryLogs);
router.post('/employees/bulk-import', gate('hr_employee.create', ctrl.bulkImportEmployees));
// Doctor lookup — used by doctor pickers across appointment/admission booking;
// deliberately ungated beyond login, same as the old open /employees list was.
router.get('/employees/doctors', ctrl.listDoctors);
router.post('/employees/remap', gate('hr_employee.remap', ctrl.remapEmployee));
router.get('/employees', canViewEmployees, ctrl.listEmployees);
router.get('/employees/:id/settlement-preview', canViewEmployees, ctrl.previewSettlement);
router.post('/employees/:id/deactivate', exitDocUpload, gate('hr_employee.edit', ctrl.deactivateEmployee));
router.post('/employees/:id/reactivate', gate('hr_employee.edit', ctrl.reactivateEmployee));
router.get('/employees/:id', canViewEmployees, ctrl.getEmployee);
router.post('/employees', employeeDocUpload, gate('hr_employee.create', ctrl.createEmployee));
router.patch('/employees/:id/salary', gate('hr_employee.set_salary', ctrl.updateEmployeeSalary));
router.patch('/employees/:id', employeeDocUpload, gate('hr_employee.edit', ctrl.updateEmployee));

// Shift Overrides (per-employee timing override for single day or multi-day range)
router.get('/employees/:id/shift-overrides', canViewEmployees, ctrl.getShiftOverrides);
router.post('/employees/:id/shift-overrides', requirePermissions(['hr_employee.edit']), ctrl.upsertShiftOverride);
router.delete('/employees/:id/shift-overrides/:date', requirePermissions(['hr_employee.edit']), ctrl.deleteShiftOverride);
router.delete('/employees/:id/shift-overrides', requirePermissions(['hr_employee.edit']), ctrl.deleteShiftOverridesRange);

// Shift Revisions & Shift Change Logs
router.patch('/employees/:id/shift', gate('hr_employee.edit', ctrl.updateEmployeeShift));
router.get('/employees/:id/shift-logs', canViewEmployees, ctrl.listEmployeeShiftLogs);
router.get('/shift-logs', canViewEmployees, ctrl.listEmployeeShiftLogs);

// Employee Activity & Payout Logs
router.get('/employees/:id/audit-logs', canViewEmployees, ctrl.listEmployeeAuditLogs);
router.get('/employees/:id/payout-logs', canViewEmployees, ctrl.listEmployeePayoutLogs);


// Departments
router.get('/departments', canViewDepartments, ctrl.listDepartments);
router.post('/departments', gate('hr_department.create', ctrl.createDepartment));
router.patch('/departments/:id', gate('hr_department.edit', ctrl.updateDepartment));
router.delete('/departments/:id', gate('hr_department.delete', ctrl.deleteDepartment));

// Designations (Master)
router.get('/designations', canViewDepartments, ctrl.listDesignations);
router.post('/designations', gate('hr_department.create', ctrl.createDesignation));

// Roles (Authorization Roles)
router.get('/roles', canViewDepartments, ctrl.listRoles);
router.post('/roles', gate('hr_department.create', ctrl.createRole));

// Staff Roles (Department-Specific with Salary)
router.get('/staff-roles', canViewDepartments, ctrl.listStaffRoles);
router.get('/staff-roles/:id', canViewDepartments, ctrl.getStaffRole);
router.post('/staff-roles', gate('hr_department.create', ctrl.createStaffRole));
router.patch('/staff-roles/:id', gate('hr_department.edit', ctrl.updateStaffRole));
router.delete('/staff-roles/:id', gate('hr_department.delete', ctrl.deleteStaffRole));

// Shifts
router.get('/shifts', canViewShifts, ctrl.listShifts);
router.patch('/shifts/timings', gate('hr_shift.edit', ctrl.updateShiftTimings));
router.post('/shifts', gate('hr_shift.create', ctrl.createShift));
router.patch('/shifts/:id', gate('hr_shift.edit', ctrl.updateShift));
router.delete('/shifts/:id', gate('hr_shift.delete', ctrl.deleteShift));

// Roster — static segments must precede any parameterised ones
router.get('/roster/ai/health', canViewRoster, require('./roster.ai.controller').getAiHealth);
router.get('/roster/ai/templates', canViewRoster, require('./roster.ai.controller').listTemplates);
router.post('/roster/ai/templates', requirePermissions(['hr_roster.save_day', 'hr_roster.bulk_save']), require('./roster.ai.controller').createTemplate);
router.patch('/roster/ai/templates/:id', requirePermissions(['hr_roster.save_day', 'hr_roster.bulk_save']), require('./roster.ai.controller').updateTemplate);
router.delete('/roster/ai/templates/:id', requirePermissions(['hr_roster.save_day', 'hr_roster.bulk_save']), require('./roster.ai.controller').deleteTemplate);
router.post('/roster/ai/generate', requirePermissions(['hr_roster.save_day', 'hr_roster.bulk_save']), require('./roster.ai.controller').generateRoster);
router.post('/roster/ai/approve', gate('hr_roster.bulk_save', require('./roster.ai.controller').approveRoster));

router.get('/roster/week', canViewRoster, ctrl.getRosterWeek);
router.get('/roster/employees', canViewRoster, ctrl.getEmployeesForRoster);
router.get('/roster/transfers', canViewRoster, ctrl.listDutyTransfers);
router.get('/roster/transfer-duty/eligible-replacements', canViewRoster, ctrl.getEligibleReplacements);
router.post('/roster/transfer-duty', requirePermissions(['hr_roster.swap_shift', 'hr_roster.save_day']), ctrl.transferDutyShift);
router.get('/roster', canViewRoster, ctrl.getRoster);
router.post('/roster/day', requirePermissions(['hr_roster.save_day']), ctrl.saveRosterDay);
router.post('/roster/bulk', gate('hr_roster.bulk_save', ctrl.bulkSaveRoster));
router.post('/roster/swap', requirePermissions(['hr_roster.swap_shift']), ctrl.swapRosterShifts);

// Non-Roster Week-Off Management (Day, Night, General)
router.get('/week-offs/non-roster-employees', canViewRoster, ctrl.listNonRosterEmployees);
router.get('/week-offs/employee/:employeeId', canViewRoster, ctrl.getEmployeeWeekOffCalendar);
router.post('/week-offs/employee/:employeeId', requirePermissions(['hr_roster.set_week_off']), ctrl.setEmployeeWeekOffDate);
router.post('/week-offs/group', requirePermissions(['hr_roster.set_week_off']), ctrl.setGroupWeekOffs);

module.exports = router;

