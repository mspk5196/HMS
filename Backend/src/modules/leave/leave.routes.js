const router = require('express').Router();
const ctrl = require('./leave.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');

router.use(verifyToken);

// Leave Types
router.get('/types', ctrl.listLeaveTypes);
router.post('/types', requirePermissions(['manage_leaves']), ctrl.createLeaveType);
router.patch('/types/:id', requirePermissions(['manage_leaves']), ctrl.updateLeaveType);

// Holidays
router.get('/holidays', ctrl.listHolidays);
router.post('/holidays', requirePermissions(['manage_hr']), ctrl.createHoliday);

// Balances
router.get('/balances', ctrl.getBalances);
router.post('/balances', requirePermissions(['manage_leaves']), ctrl.setBalance);

// Leave Requests
router.get('/requests', ctrl.listRequests);
router.post('/requests', ctrl.createRequest); // any employee can request
router.get('/requests/:id', ctrl.getRequest);
router.patch('/requests/:id/review', requirePermissions(['approve_leaves']), ctrl.reviewRequest);

// Week Off Policies
router.get('/week-offs', ctrl.listWeekOffs);
router.post('/week-offs', requirePermissions(['manage_hr']), ctrl.createWeekOff);

module.exports = router;
