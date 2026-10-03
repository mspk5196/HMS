require('dotenv').config();
const db = require('../config/db');

async function run() {
  const [empCols] = await db.query('SHOW COLUMNS FROM employees');
  const empColNames = new Set(empCols.map(c => c.Field));

  if (!empColNames.has('inactive_reason')) {
    await db.query('ALTER TABLE employees ADD COLUMN inactive_reason TEXT NULL');
    console.log('Added inactive_reason');
  }
  if (!empColNames.has('inactive_date')) {
    await db.query('ALTER TABLE employees ADD COLUMN inactive_date DATE NULL');
    console.log('Added inactive_date');
  }
  if (!empColNames.has('inactive_by')) {
    await db.query('ALTER TABLE employees ADD COLUMN inactive_by BIGINT UNSIGNED NULL');
    console.log('Added inactive_by');
  }
  if (!empColNames.has('exit_document_path')) {
    await db.query('ALTER TABLE employees ADD COLUMN exit_document_path VARCHAR(500) NULL');
    console.log('Added exit_document_path');
  }

  const [pCols] = await db.query('SHOW COLUMNS FROM payroll_items');
  const pColNames = new Set(pCols.map(c => c.Field));

  if (!pColNames.has('is_settlement')) {
    await db.query('ALTER TABLE payroll_items ADD COLUMN is_settlement TINYINT(1) NOT NULL DEFAULT 0');
    console.log('Added is_settlement');
  }
  if (!pColNames.has('payment_status')) {
    await db.query("ALTER TABLE payroll_items ADD COLUMN payment_status ENUM('pending','paid') NOT NULL DEFAULT 'pending'");
    console.log('Added payment_status');
  }
  if (!pColNames.has('payment_date')) {
    await db.query('ALTER TABLE payroll_items ADD COLUMN payment_date DATE NULL');
    console.log('Added payment_date');
  }
  if (!pColNames.has('payment_reference')) {
    await db.query('ALTER TABLE payroll_items ADD COLUMN payment_reference VARCHAR(255) NULL');
    console.log('Added payment_reference');
  }
  if (!pColNames.has('settled_at')) {
    await db.query('ALTER TABLE payroll_items ADD COLUMN settled_at DATETIME NULL');
    console.log('Added settled_at');
  }
  if (!pColNames.has('settled_by')) {
    await db.query('ALTER TABLE payroll_items ADD COLUMN settled_by BIGINT UNSIGNED NULL');
    console.log('Added settled_by');
  }
  if (!pColNames.has('notes')) {
    await db.query('ALTER TABLE payroll_items ADD COLUMN notes TEXT NULL');
    console.log('Added notes');
  }

  console.log('Migration successfully completed!');
  process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
