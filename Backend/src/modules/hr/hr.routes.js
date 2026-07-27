const router = require('express').Router();
const ctrl = require('./hr.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');

router.use(verifyToken);

// Employees
router.get('/employees', ctrl.listEmployees);
router.get('/employees/:id', ctrl.getEmployee);
router.post('/employees', requirePermissions(['manage_hr']), ctrl.createEmployee);
router.patch('/employees/:id', requirePermissions(['manage_hr']), ctrl.updateEmployee);

// Departments
router.get('/departments', ctrl.listDepartments);
router.post('/departments', requirePermissions(['manage_hr']), ctrl.createDepartment);
router.patch('/departments/:id', requirePermissions(['manage_hr']), ctrl.updateDepartment);
router.delete('/departments/:id', requirePermissions(['manage_hr']), ctrl.deleteDepartment);

// Designations (Master)
router.get('/designations', ctrl.listDesignations);
router.post('/designations', requirePermissions(['manage_hr']), ctrl.createDesignation);

// Roles (Authorization Roles)
router.get('/roles', ctrl.listRoles);
router.post('/roles', requirePermissions(['manage_hr']), ctrl.createRole);

// Staff Roles (Department-Specific with Salary)
router.get('/staff-roles', ctrl.listStaffRoles);
router.get('/staff-roles/:id', ctrl.getStaffRole);
router.post('/staff-roles', requirePermissions(['manage_hr']), ctrl.createStaffRole);
router.patch('/staff-roles/:id', requirePermissions(['manage_hr']), ctrl.updateStaffRole);
router.delete('/staff-roles/:id', requirePermissions(['manage_hr']), ctrl.deleteStaffRole);

// Shifts
router.get('/shifts', ctrl.listShifts);
router.post('/shifts', requirePermissions(['manage_hr']), ctrl.createShift);
router.patch('/shifts/:id', requirePermissions(['manage_hr']), ctrl.updateShift);
router.delete('/shifts/:id', requirePermissions(['manage_hr']), ctrl.deleteShift);

// Roster — static segments must precede any parameterised ones
router.get('/roster/week', ctrl.getRosterWeek);
router.get('/roster/employees', ctrl.getEmployeesForRoster);
router.get('/roster', ctrl.getRoster);
router.post('/roster/day', requirePermissions(['manage_hr']), ctrl.saveRosterDay);
router.post('/roster/bulk', requirePermissions(['manage_hr']), ctrl.bulkSaveRoster);
router.post('/roster/swap', requirePermissions(['manage_hr']), ctrl.swapRosterShifts);

module.exports = router;
