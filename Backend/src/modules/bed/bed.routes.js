const router = require('express').Router();
const ctrl = require('./bed.controller');
const { verifyToken, requirePermissions } = require('../../middleware/auth');
const { gate } = require('../../middleware/approvalGate');

router.use(verifyToken);
const canView = requirePermissions(['facility.view']);

// Buildings
router.get('/buildings', canView, ctrl.listBuildings);
router.post('/buildings', gate('facility.building_create', ctrl.createBuilding));
router.delete('/buildings/:id', gate('facility.building_delete', ctrl.deleteBuilding));

// Floors
router.get('/floors', canView, ctrl.listFloors);
router.post('/floors', gate('facility.floor_create', ctrl.createFloor));
router.delete('/floors/:id', gate('facility.floor_delete', ctrl.deleteFloor));

// Wards
router.get('/wards', canView, ctrl.listWards);
router.post('/wards', gate('facility.ward_create', ctrl.createWard));
router.delete('/wards/:id', gate('facility.ward_delete', ctrl.deleteWard));

// Room Types
router.get('/room-types', canView, ctrl.listRoomTypes);
router.post('/room-types', gate('facility.room_type_create', ctrl.createRoomType));
router.patch('/room-types/:id', gate('facility.room_type_edit', ctrl.updateRoomType));

// Rooms — static list before the ward-scoped param route
router.get('/rooms', canView, ctrl.listAllRooms);
router.get('/wards/:wardId/rooms', canView, ctrl.getRooms);
router.post('/rooms', gate('facility.room_create', ctrl.createRoom));
router.delete('/rooms/:id', gate('facility.room_delete', ctrl.deleteRoom));

// Beds
router.get('/beds', canView, ctrl.getAllBeds); // all beds with ward/room info
router.get('/rooms/:roomId/beds', canView, ctrl.getBeds);
router.post('/beds', gate('facility.bed_create', ctrl.createBed));
router.delete('/beds/:id', gate('facility.bed_delete', ctrl.deleteBed));
router.patch('/beds/:id/status', gate('facility.bed_status', ctrl.updateBedStatus));

module.exports = router;
