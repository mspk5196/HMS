require('dotenv').config();
const db = require('../config/db');

async function run() {
  console.log('Running tenant multi-branch migration...');

  // 1. Create branches table
  await db.query(`
    CREATE TABLE IF NOT EXISTS branches (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      code VARCHAR(50) NOT NULL,
      address TEXT NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(100) NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_tenant_branch_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ branches table verified/created.');

  // 2. Seed default primary branch if empty
  const [existingBranches] = await db.query('SELECT id FROM branches LIMIT 1');
  if (existingBranches.length === 0) {
    await db.query(`
      INSERT INTO branches (id, name, code, address, is_active)
      VALUES (1, 'Main Hospital Facility', 'MAIN', 'Default Hospital Facility', TRUE)
    `);
    console.log('✅ Seeded default branch (id: 1, code: "MAIN").');
  }

  // 3. Helper to safely add column if missing
  const addColumnIfNotExists = async (table, column, definition) => {
    try {
      const [cols] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
      if (cols.length === 0) {
        await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        console.log(`✅ Added ${column} to ${table}`);
      }
    } catch (err) {
      console.warn(`Could not check/alter ${table}.${column}: ${err.message}`);
    }
  };

  await addColumnIfNotExists('employees', 'branch_id', 'INT UNSIGNED DEFAULT 1');
  await addColumnIfNotExists('attendance_raw_punches', 'branch_id', 'INT UNSIGNED DEFAULT 1');
  await addColumnIfNotExists('attendance_daily_summary', 'branch_id', 'INT UNSIGNED DEFAULT 1');
  await addColumnIfNotExists('biometric_devices', 'branch_id', 'INT UNSIGNED DEFAULT 1');
  await addColumnIfNotExists('roster_entries', 'branch_id', 'INT UNSIGNED DEFAULT 1');
  await addColumnIfNotExists('leave_requests', 'branch_id', 'INT UNSIGNED DEFAULT 1');
  await addColumnIfNotExists('payroll_runs', 'branch_id', 'INT UNSIGNED NULL');

  console.log('🎉 Branch migration successfully completed!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
