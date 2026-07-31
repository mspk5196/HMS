/**
 * bed.queries.js
 * Building → Floor → Ward → Room Type / Room → Bed — all admin-editable, per
 * the confirmed rule that none of this hierarchy is hardcoded.
 */

const db = require('../../config/db');

/* ─── BUILDINGS ─── */

const listBuildings = async () => {
  const [rows] = await db.execute(`SELECT * FROM buildings ORDER BY name`);
  return rows;
};

const createBuilding = async (name) => {
  const [result] = await db.execute(`INSERT INTO buildings (name) VALUES (?)`, [name]);
  return result.insertId;
};

const deleteBuilding = async (id) => {
  await db.execute(`DELETE FROM buildings WHERE id = ?`, [id]);
};

/* ─── FLOORS ─── */

const listFloors = async (buildingId) => {
  const filter = buildingId ? 'WHERE f.building_id = ?' : '';
  const params = buildingId ? [buildingId] : [];
  const [rows] = await db.execute(
    `SELECT f.*, b.name AS building_name FROM floors f
     JOIN buildings b ON b.id = f.building_id
     ${filter} ORDER BY b.name, f.name`,
    params
  );
  return rows;
};

const createFloor = async (buildingId, name) => {
  const [result] = await db.execute(`INSERT INTO floors (building_id, name) VALUES (?, ?)`, [buildingId, name]);
  return result.insertId;
};

const deleteFloor = async (id) => {
  await db.execute(`DELETE FROM floors WHERE id = ?`, [id]);
};

/* ─── WARDS ─── */

const listWards = async (floorId) => {
  const filter = floorId ? 'WHERE w.floor_id = ?' : '';
  const params = floorId ? [floorId] : [];
  const [rows] = await db.execute(
    `SELECT w.*, f.name AS floor_name, b.name AS building_name, b.id AS building_id
     FROM wards w
     JOIN floors f ON f.id = w.floor_id
     JOIN buildings b ON b.id = f.building_id
     ${filter} ORDER BY b.name, f.name, w.name`,
    params
  );
  return rows;
};

const createWard = async (floorId, name) => {
  const [result] = await db.execute(`INSERT INTO wards (floor_id, name) VALUES (?, ?)`, [floorId, name]);
  return result.insertId;
};

const deleteWard = async (id) => {
  await db.execute(`DELETE FROM wards WHERE id = ?`, [id]);
};

/* ─── ROOM TYPES ─── */

const listRoomTypes = async () => {
  const [rows] = await db.execute(`SELECT * FROM room_types ORDER BY name`);
  return rows;
};

const createRoomType = async (name, dailyRate) => {
  const [result] = await db.execute(
    `INSERT INTO room_types (name, daily_rate) VALUES (?, ?)`, [name, dailyRate ?? 0]
  );
  return result.insertId;
};

const updateRoomType = async (id, data) => {
  const fields = [];
  const vals = [];
  if (data.name !== undefined) { fields.push('name = ?'); vals.push(data.name); }
  if (data.daily_rate !== undefined) { fields.push('daily_rate = ?'); vals.push(data.daily_rate); }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE room_types SET ${fields.join(', ')} WHERE id = ?`, vals);
};

/* ─── ROOMS ─── */

const getRooms = async (wardId) => {
  const [rows] = await db.execute(
    `SELECT r.*, rt.name AS type_name, rt.daily_rate
     FROM rooms r
     JOIN room_types rt ON r.room_type_id = rt.id
     WHERE r.ward_id = ?
     ORDER BY r.room_number ASC`,
    [wardId]
  );
  return rows;
};

const listAllRooms = async () => {
  const [rows] = await db.execute(
    `SELECT r.*, rt.name AS type_name, rt.daily_rate, w.name AS ward_name,
            f.name AS floor_name, b.name AS building_name,
            (SELECT COUNT(*) FROM beds WHERE room_id = r.id) AS bed_count
     FROM rooms r
     JOIN room_types rt ON rt.id = r.room_type_id
     JOIN wards w ON w.id = r.ward_id
     JOIN floors f ON f.id = w.floor_id
     JOIN buildings b ON b.id = f.building_id
     ORDER BY b.name, f.name, w.name, r.room_number`
  );
  return rows;
};

const createRoom = async (wardId, roomTypeId, roomNumber) => {
  const [result] = await db.execute(
    `INSERT INTO rooms (ward_id, room_type_id, room_number) VALUES (?, ?, ?)`,
    [wardId, roomTypeId, roomNumber]
  );
  return result.insertId;
};

const deleteRoom = async (id) => {
  await db.execute(`DELETE FROM rooms WHERE id = ?`, [id]);
};

/* ─── BEDS ─── */

const getBeds = async (roomId, status) => {
  let query = `SELECT * FROM beds WHERE room_id = ?`;
  const params = [roomId];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY bed_label ASC`;
  const [rows] = await db.execute(query, params);
  return rows;
};

const getAllBeds = async (status) => {
  const filter = status ? 'WHERE b.status = ?' : '';
  const params = status ? [status] : [];
  const [rows] = await db.execute(
    `SELECT b.*, r.room_number, r.room_type_id, w.name AS ward_name, rt.name AS type_name, rt.daily_rate
     FROM beds b
     JOIN rooms r ON r.id = b.room_id
     JOIN wards w ON w.id = r.ward_id
     JOIN room_types rt ON rt.id = r.room_type_id
     ${filter}
     ORDER BY w.name, r.room_number, b.bed_label`,
    params
  );
  return rows;
};

const getBed = async (id) => {
  const [rows] = await db.execute(`SELECT * FROM beds WHERE id = ?`, [id]);
  return rows[0] ?? null;
};

const createBed = async (roomId, bedLabel) => {
  const [result] = await db.execute(
    `INSERT INTO beds (room_id, bed_label, status) VALUES (?, ?, 'available')`,
    [roomId, bedLabel]
  );
  return result.insertId;
};

const deleteBed = async (id) => {
  await db.execute(`DELETE FROM beds WHERE id = ?`, [id]);
};

const updateBedStatus = async (id, status) => {
  await db.execute(`UPDATE beds SET status = ? WHERE id = ?`, [status, id]);
};

module.exports = {
  listBuildings, createBuilding, deleteBuilding,
  listFloors, createFloor, deleteFloor,
  listWards, createWard, deleteWard,
  listRoomTypes, createRoomType, updateRoomType,
  getRooms, listAllRooms, createRoom, deleteRoom,
  getBeds, getAllBeds, getBed, createBed, deleteBed, updateBedStatus,
};
