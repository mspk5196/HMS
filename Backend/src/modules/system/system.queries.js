const db = require('../../config/db');

const listConfig = async () => {
  const [rows] = await db.execute(`SELECT * FROM system_config ORDER BY config_key`);
  return rows;
};

const getConfig = async (key) => {
  const [rows] = await db.execute(`SELECT * FROM system_config WHERE config_key = ?`, [key]);
  return rows[0] ?? null;
};

const updateConfig = async (key, value) => {
  await db.execute(
    `UPDATE system_config SET config_value = ?, updated_at = NOW() WHERE config_key = ?`,
    [value, key]
  );
};

module.exports = { listConfig, getConfig, updateConfig };
