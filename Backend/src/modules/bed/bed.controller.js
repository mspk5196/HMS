const svc = require('./bed.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created, fail } = require('../../utils/response');

/* ─── BUILDINGS ─── */
const listBuildings = asyncHandler(async (req, res) => res.json(success(await svc.listBuildings())));
const createBuilding = asyncHandler(async (req, res) => {
  const id = await svc.createBuilding(req.body.name);
  return res.status(201).json(created({ id }, 'Building created'));
});
const deleteBuilding = asyncHandler(async (req, res) => {
  await svc.deleteBuilding(Number(req.params.id));
  return res.json(success(null, 'Building deleted'));
});

/* ─── FLOORS ─── */
const listFloors = asyncHandler(async (req, res) => {
  const { buildingId } = req.query;
  return res.json(success(await svc.listFloors(buildingId ? Number(buildingId) : null)));
});
const createFloor = asyncHandler(async (req, res) => {
  const id = await svc.createFloor(req.body.building_id, req.body.name);
  return res.status(201).json(created({ id }, 'Floor created'));
});
const deleteFloor = asyncHandler(async (req, res) => {
  await svc.deleteFloor(Number(req.params.id));
  return res.json(success(null, 'Floor deleted'));
});

/* ─── WARDS ─── */
const listWards = asyncHandler(async (req, res) => {
  const { floorId } = req.query;
  return res.json(success(await svc.listWards(floorId ? Number(floorId) : null)));
});
const createWard = asyncHandler(async (req, res) => {
  const id = await svc.createWard(req.body.floor_id, req.body.name);
  return res.status(201).json(created({ id }, 'Ward created'));
});
const deleteWard = asyncHandler(async (req, res) => {
  await svc.deleteWard(Number(req.params.id));
  return res.json(success(null, 'Ward deleted'));
});

/* ─── ROOM TYPES ─── */
const listRoomTypes = asyncHandler(async (req, res) => res.json(success(await svc.listRoomTypes())));
const createRoomType = asyncHandler(async (req, res) => {
  const id = await svc.createRoomType(req.body);
  return res.status(201).json(created({ id }, 'Room type created'));
});
const updateRoomType = asyncHandler(async (req, res) => {
  await svc.updateRoomType(Number(req.params.id), req.body);
  return res.json(success(null, 'Room type updated'));
});

/* ─── ROOMS ─── */
const getRooms = asyncHandler(async (req, res) => res.json(success(await svc.getRooms(req.params.wardId))));
const listAllRooms = asyncHandler(async (req, res) => res.json(success(await svc.listAllRooms())));
const createRoom = asyncHandler(async (req, res) => {
  const id = await svc.createRoom(req.body);
  return res.status(201).json(created({ id }, 'Room created'));
});
const deleteRoom = asyncHandler(async (req, res) => {
  await svc.deleteRoom(Number(req.params.id));
  return res.json(success(null, 'Room deleted'));
});

/* ─── BEDS ─── */
const getBeds = asyncHandler(async (req, res) => {
  const { status } = req.query;
  return res.json(success(await svc.getBeds(req.params.roomId, status)));
});
const getAllBeds = asyncHandler(async (req, res) => {
  const { status } = req.query;
  return res.json(success(await svc.getAllBeds(status)));
});
const createBed = asyncHandler(async (req, res) => {
  const id = await svc.createBed(req.body);
  return res.status(201).json(created({ id }, 'Bed created'));
});
const deleteBed = asyncHandler(async (req, res) => {
  await svc.deleteBed(Number(req.params.id));
  return res.json(success(null, 'Bed deleted'));
});
const updateBedStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json(fail('status is required'));
  await svc.updateBedStatus(Number(req.params.id), status);
  return res.json(success(null, 'Bed status updated'));
});

module.exports = {
  listBuildings, createBuilding, deleteBuilding,
  listFloors, createFloor, deleteFloor,
  listWards, createWard, deleteWard,
  listRoomTypes, createRoomType, updateRoomType,
  getRooms, listAllRooms, createRoom, deleteRoom,
  getBeds, getAllBeds, createBed, deleteBed, updateBedStatus,
};
