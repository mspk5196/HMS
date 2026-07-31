const q = require('./bed.queries');
const { AppError } = require('../../utils/errors');

/* ─── BUILDINGS / FLOORS / WARDS ─── */

const createBuilding = async (name) => {
  if (!name?.trim()) throw new AppError('name is required', 400);
  return q.createBuilding(name.trim());
};

const createFloor = async (buildingId, name) => {
  if (!buildingId || !name?.trim()) throw new AppError('building_id and name are required', 400);
  return q.createFloor(buildingId, name.trim());
};

const createWard = async (floorId, name) => {
  if (!floorId || !name?.trim()) throw new AppError('floor_id and name are required', 400);
  return q.createWard(floorId, name.trim());
};

/* ─── ROOM TYPES / ROOMS ─── */

const createRoomType = async (data) => {
  if (!data.name?.trim()) throw new AppError('name is required', 400);
  return q.createRoomType(data.name.trim(), data.daily_rate);
};

const createRoom = async (data) => {
  if (!data.ward_id || !data.room_type_id || !data.room_number) {
    throw new AppError('ward_id, room_type_id and room_number are required', 400);
  }
  return q.createRoom(data.ward_id, data.room_type_id, data.room_number);
};

const deleteRoom = async (id) => {
  const beds = await q.getBeds(id);
  const active = beds.filter((b) => b.status === 'occupied' || b.status === 'pending_clearance');
  if (active.length) {
    throw new AppError(`Cannot delete this room: ${active.length} bed(s) are occupied or awaiting clearance.`, 400);
  }
  await q.deleteRoom(id);
};

/* ─── BEDS ─── */

const createBed = async (data) => {
  if (!data.room_id || !data.bed_label?.trim()) {
    throw new AppError('room_id and bed_label are required', 400);
  }
  return q.createBed(data.room_id, data.bed_label.trim());
};

const deleteBed = async (id) => {
  const bed = await q.getBed(id);
  if (!bed) throw new AppError('Bed not found', 404);
  if (bed.status === 'occupied' || bed.status === 'pending_clearance') {
    throw new AppError(`Cannot delete this bed: status is ${bed.status}.`, 400);
  }
  await q.deleteBed(id);
};

/**
 * Manual status changes are limited to the available <-> maintenance toggle.
 * 'occupied' is set by admitting a patient and 'pending_clearance' by
 * discharging one — neither should be short-circuited from here, and
 * pending_clearance in particular must only clear once the bill is paid
 * (see patient.service.recordDischargePayment).
 */
const updateBedStatus = async (id, status) => {
  const allowed = ['available', 'maintenance'];
  if (!allowed.includes(status)) {
    throw new AppError(`Manual status changes are limited to: ${allowed.join(', ')}`, 400);
  }
  const bed = await q.getBed(id);
  if (!bed) throw new AppError('Bed not found', 404);
  if (bed.status === 'occupied' || bed.status === 'pending_clearance') {
    throw new AppError(`Cannot manually change status while the bed is ${bed.status}.`, 400);
  }
  await q.updateBedStatus(id, status);
};

module.exports = {
  createBuilding, createFloor, createWard,
  createRoomType, createRoom, deleteRoom,
  createBed, deleteBed, updateBedStatus,
  // Pass-through
  listBuildings: q.listBuildings,
  deleteBuilding: q.deleteBuilding,
  listFloors: q.listFloors,
  deleteFloor: q.deleteFloor,
  listWards: q.listWards,
  deleteWard: q.deleteWard,
  listRoomTypes: q.listRoomTypes,
  updateRoomType: q.updateRoomType,
  getRooms: q.getRooms,
  listAllRooms: q.listAllRooms,
  getBeds: q.getBeds,
  getAllBeds: q.getAllBeds,
  getBed: q.getBed,
};
