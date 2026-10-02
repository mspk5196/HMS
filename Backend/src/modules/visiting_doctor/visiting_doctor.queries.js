const db = require('../../config/db');

/* ─────────────────────────────────────────────
   VISITING / EXTERNAL DOCTOR REGISTRY
───────────────────────────────────────────── */

const ensureTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS visiting_doctors (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      full_name     VARCHAR(200) NOT NULL,
      qualification VARCHAR(100) NULL,
      specialization VARCHAR(150) NULL,
      mobile        VARCHAR(20) NULL,
      notes         TEXT NULL,
      is_active     TINYINT(1) NOT NULL DEFAULT 1,
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

const listVisitingDoctors = async ({ search, activeOnly = true } = {}) => {
  let where = activeOnly ? 'WHERE is_active = 1' : 'WHERE 1=1';
  const params = [];
  if (search) {
    where += ' AND (full_name LIKE ? OR specialization LIKE ? OR mobile LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  const [rows] = await db.query(
    `SELECT * FROM visiting_doctors ${where} ORDER BY full_name`,
    params
  );
  return rows;
};

const getVisitingDoctor = async (id) => {
  const [rows] = await db.query('SELECT * FROM visiting_doctors WHERE id = ?', [id]);
  return rows[0] ?? null;
};

const createVisitingDoctor = async ({ full_name, qualification, specialization, mobile, notes }) => {
  const [result] = await db.query(
    `INSERT INTO visiting_doctors (full_name, qualification, specialization, mobile, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [full_name, qualification ?? null, specialization ?? null, mobile ?? null, notes ?? null]
  );
  return result.insertId;
};

const updateVisitingDoctor = async (id, { full_name, qualification, specialization, mobile, notes, is_active }) => {
  const fields = [];
  const params = [];
  if (full_name !== undefined) { fields.push('full_name = ?'); params.push(full_name); }
  if (qualification !== undefined) { fields.push('qualification = ?'); params.push(qualification); }
  if (specialization !== undefined) { fields.push('specialization = ?'); params.push(specialization); }
  if (mobile !== undefined) { fields.push('mobile = ?'); params.push(mobile); }
  if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
  if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (fields.length === 0) return;
  params.push(id);
  await db.query(`UPDATE visiting_doctors SET ${fields.join(', ')} WHERE id = ?`, params);
};

const deleteVisitingDoctor = async (id) => {
  // Soft delete — preserve history
  await db.query('UPDATE visiting_doctors SET is_active = 0 WHERE id = ?', [id]);
};

module.exports = {
  ensureTable,
  listVisitingDoctors,
  getVisitingDoctor,
  createVisitingDoctor,
  updateVisitingDoctor,
  deleteVisitingDoctor,
};
