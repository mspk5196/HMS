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

// Leave Requests — two-step approval: reporting person, then HR
router.get('/requests', ctrl.listRequests);
router.post('/requests', ctrl.createRequest); // any employee can request
router.get('/requests/:id', ctrl.getRequest);
router.patch('/requests/:id/review-reporting', requirePermissions(['approve_leaves']), ctrl.reviewReporting);
router.patch('/requests/:id/review-hr', requirePermissions(['approve_leaves']), ctrl.reviewHR);

// Unexplained absences — outcome 3: LOP + Fine Engine trigger
router.post('/absences/unexplained', requirePermissions(['manage_leaves']), ctrl.recordUnexplainedAbsence);

// Week Off Policies
router.get('/week-offs', ctrl.listWeekOffs);
router.post('/week-offs', requirePermissions(['manage_hr']), ctrl.setWeekOff);

module.exports = router;
