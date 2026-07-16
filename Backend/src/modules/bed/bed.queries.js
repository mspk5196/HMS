const db = require('../../config/db');

const getWards = async () => {
  const [rows] = await db.execute(`SELECT * FROM wards ORDER BY name ASC`);
  return rows;
};

const getRooms = async (wardId) => {
  const [rows] = await db.execute(
    `SELECT r.*, rt.name as type_name, rt.daily_rate 
     FROM rooms r
     JOIN room_types rt ON r.room_type_id = rt.id
     WHERE r.ward_id = ?
     ORDER BY r.room_number ASC`,
    [wardId]
  );
  return rows;
};

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

const getAllBeds = async () => {
  const [rows] = await db.execute(
    `SELECT b.*, r.room_number, w.name as ward_name, rt.name as type_name
     FROM beds b
     JOIN rooms r ON r.id = b.room_id
     JOIN wards w ON w.id = r.ward_id
     JOIN room_types rt ON rt.id = r.room_type_id
     ORDER BY w.name, r.room_number, b.bed_label`
  );
  return rows;
};

const updateBedStatus = async (id, status) => {
  await db.execute(`UPDATE beds SET status = ? WHERE id = ?`, [status, id]);
};

module.exports = {
  getWards,
  getRooms,
  getBeds,
  getAllBeds,
  updateBedStatus
};
