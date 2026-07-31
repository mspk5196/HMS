const router = require('express').Router();
const ctrl = require('./bed.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');

router.use(verifyToken);
const canModify = requirePermissions(['admission.modify']);

// Buildings
router.get('/buildings', ctrl.listBuildings);
router.post('/buildings', canModify, ctrl.createBuilding);
router.delete('/buildings/:id', canModify, ctrl.deleteBuilding);

// Floors
router.get('/floors', ctrl.listFloors);
router.post('/floors', canModify, ctrl.createFloor);
router.delete('/floors/:id', canModify, ctrl.deleteFloor);

// Wards
router.get('/wards', ctrl.listWards);
router.post('/wards', canModify, ctrl.createWard);
router.delete('/wards/:id', canModify, ctrl.deleteWard);

// Room Types
router.get('/room-types', ctrl.listRoomTypes);
router.post('/room-types', canModify, ctrl.createRoomType);
router.patch('/room-types/:id', canModify, ctrl.updateRoomType);

// Rooms — static list before the ward-scoped param route
router.get('/rooms', ctrl.listAllRooms);
router.get('/wards/:wardId/rooms', ctrl.getRooms);
router.post('/rooms', canModify, ctrl.createRoom);
router.delete('/rooms/:id', canModify, ctrl.deleteRoom);

// Beds
router.get('/beds', ctrl.getAllBeds); // all beds with ward/room info
router.get('/rooms/:roomId/beds', ctrl.getBeds);
router.post('/beds', canModify, ctrl.createBed);
router.delete('/beds/:id', canModify, ctrl.deleteBed);
router.patch('/beds/:id/status', canModify, ctrl.updateBedStatus);

module.exports = router;
