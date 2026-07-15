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
router.get('/designations', ctrl.listDesignations);
router.get('/roles', ctrl.listRoles);

// Shifts
router.get('/shifts', ctrl.listShifts);
router.post('/shifts', requirePermissions(['manage_hr']), ctrl.createShift);
router.patch('/shifts/:id', requirePermissions(['manage_hr']), ctrl.updateShift);

module.exports = router;
