const router = require('express').Router();
const ctrl = require('./leave.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');
const { gate } = require('../../middleware/approvalGate');

router.use(verifyToken);
const canView = requirePermissions(['leave.view']);

// Leave Types
router.get('/types', canView, ctrl.listLeaveTypes);
router.post('/types', gate('leave.create', ctrl.createLeaveType));
router.patch('/types/:id', gate('leave.edit', ctrl.updateLeaveType));
router.delete('/types/:id', gate('leave.delete', ctrl.deleteLeaveType));

// Holidays
router.get('/holidays', canView, ctrl.listHolidays);
router.post('/holidays', gate('leave.create_holiday', ctrl.createHoliday));

// Balances
router.get('/balances', canView, ctrl.getBalances);
router.post('/balances', gate('leave.set_balance', ctrl.setBalance));

// Leave Requests — two-step approval: reporting person, then HR.
// These ARE the approval actions for a leave request — they are not
// themselves wrapped in the generic approval engine.
router.get('/requests', canView, ctrl.listRequests);
router.post('/requests', ctrl.createRequest); // any employee can request
router.get('/requests/:id', canView, ctrl.getRequest);
router.patch('/requests/:id/review-reporting', requirePermissions(['leave.review_reporting']), ctrl.reviewReporting);
router.patch('/requests/:id/review-hr', requirePermissions(['leave.review_hr']), ctrl.reviewHR);

// Unexplained absences — outcome 3: LOP + Fine Engine trigger
router.post('/absences/unexplained', requirePermissions(['leave.record_absence']), ctrl.recordUnexplainedAbsence);

// Week Off Policies
router.get('/week-offs', canView, ctrl.listWeekOffs);
router.post('/week-offs', requirePermissions(['hr_roster.set_week_off']), ctrl.setWeekOff);

module.exports = router;
