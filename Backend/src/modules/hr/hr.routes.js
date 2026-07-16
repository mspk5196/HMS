const router = require('express').Router();
const ctrl = require('./hr.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');

router.use(verifyToken);

// Employees
router.get('/employees', ctrl.listEmployees);
router.get('/employees/:id', ctrl.getEmployee);
router.post('/employees', requirePermissions(['manage_hr']), ctrl.createEmployee);
router.patch('/employees/:id', requirePermissions(['manage_hr']), ctrl.updateEmployee);

// Master Data
router.get('/departments', ctrl.listDepartments);
router.post('/departments', requirePermissions(['manage_hr']), ctrl.createDepartment);
router.get('/designations', ctrl.listDesignations);
router.post('/designations', requirePermissions(['manage_hr']), ctrl.createDesignation);
router.get('/roles', ctrl.listRoles);
router.post('/roles', requirePermissions(['manage_hr']), ctrl.createRole);

// Shifts
router.get('/shifts', ctrl.listShifts);
router.post('/shifts', requirePermissions(['manage_hr']), ctrl.createShift);
router.patch('/shifts/:id', requirePermissions(['manage_hr']), ctrl.updateShift);

// Roster
router.get('/roster', ctrl.getRoster);
router.post('/roster/day', ctrl.saveRosterDay);

module.exports = router;
