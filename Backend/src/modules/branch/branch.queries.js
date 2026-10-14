const db = require('../../config/db');

/**
 * Lists all active branches for the active tenant
 */
const listBranches = async () => {
  const [rows] = await db.query(
    `SELECT id, name, code, address, phone, email, is_active, created_at, updated_at
     FROM branches
     ORDER BY id ASC`
  );
  return rows;
};

/**
 * Gets a single branch by ID
 */
const getBranchById = async (id) => {
  const [rows] = await db.query(
    `SELECT id, name, code, address, phone, email, is_active, created_at, updated_at
     FROM branches
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Gets a branch by code
 */
const getBranchByCode = async (code) => {
  const [rows] = await db.query(
    `SELECT id, name, code, address, phone, email, is_active
     FROM branches
     WHERE code = ?
     LIMIT 1`,
    [code]
  );
  return rows[0] || null;
};

/**
 * Creates a new branch
 */
const createBranch = async ({ name, code, address, phone, email }) => {
  const [result] = await db.query(
    `INSERT INTO branches (name, code, address, phone, email, is_active)
     VALUES (?, ?, ?, ?, ?, TRUE)`,
    [name, code.toUpperCase().trim(), address || null, phone || null, email || null]
  );
  return { id: result.insertId, name, code, address, phone, email, is_active: true };
};

/**
 * Updates an existing branch
 */
const updateBranch = async (id, { name, code, address, phone, email, is_active }) => {
  const updates = [];
  const params = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (code !== undefined) { updates.push('code = ?'); params.push(code.toUpperCase().trim()); }
  if (address !== undefined) { updates.push('address = ?'); params.push(address); }
  if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
  if (email !== undefined) { updates.push('email = ?'); params.push(email); }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

  if (updates.length === 0) return await getBranchById(id);

  params.push(id);
  await db.query(`UPDATE branches SET ${updates.join(', ')} WHERE id = ?`, params);
  return await getBranchById(id);
};

/**
 * Deactivates or removes a branch
 */
const deleteBranch = async (id) => {
  const [result] = await db.query('UPDATE branches SET is_active = FALSE WHERE id = ?', [id]);
  return result.affectedRows > 0;
};

module.exports = {
  listBranches,
  getBranchById,
  getBranchByCode,
  createBranch,
  updateBranch,
  deleteBranch,
};
