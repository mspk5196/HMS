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
    `INSERT INTO system_config (config_key, config_value, updated_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()`,
    [key, String(value ?? '')]
  );
};

const getHospitalProfile = async () => {
  const [rows] = await db.execute(
    `SELECT config_key, config_value FROM system_config
     WHERE config_key LIKE 'HOSPITAL_%'
        OR config_key IN ('SALARY_DATE_TYPE', 'SALARY_DISBURSEMENT_DAY', 'SALARY_CALCULATION_CYCLE', 'DEFAULT_BUFFER_MINUTES', 'FUTURE_BOOKING_ENABLED', 'TOKEN_SCOPE')`
  );
  const profile = {};
  rows.forEach((r) => {
    profile[r.config_key] = r.config_value;
  });
  return profile;
};

const updateHospitalProfile = async (profileMap) => {
  if (!profileMap || typeof profileMap !== 'object') return;
  for (const [key, value] of Object.entries(profileMap)) {
    if (key.startsWith('HOSPITAL_') || ['SALARY_DATE_TYPE', 'SALARY_DISBURSEMENT_DAY', 'SALARY_CALCULATION_CYCLE', 'DEFAULT_BUFFER_MINUTES', 'FUTURE_BOOKING_ENABLED', 'TOKEN_SCOPE'].includes(key)) {
      await updateConfig(key, value);
    }
  }
};

module.exports = { listConfig, getConfig, updateConfig, getHospitalProfile, updateHospitalProfile };
