const router = require('express').Router();
const ctrl = require('./bed.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');

router.use(verifyToken);

// Bed Management endpoints
router.get('/wards', ctrl.getWards);
router.get('/wards/:wardId/rooms', ctrl.getRooms);
router.get('/rooms/:roomId/beds', ctrl.getBeds);
router.get('/beds', ctrl.getAllBeds); // Returns all beds with ward/room info

module.exports = router;
