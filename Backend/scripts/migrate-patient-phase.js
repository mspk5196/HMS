/**
 * migrate-patient-phase.js
 *
 * Schema reconciliation for the Patient & Hospital phase.
 * Idempotent — safe to run repeatedly; a second run is a no-op.
 *
 * beds.status + 'pending_clearance'
 *   Confirmed rule: a bed must NOT flip back to "available" immediately on
 *   discharge — it should show pending clearance until the discharge bill is
 *   fully paid. The live enum only had ('available','occupied','maintenance').
 *
 * Run:  node scripts/migrate-patient-phase.js
 */

require('dotenv').config();
const db = require('../src/config/db');

const dbName = process.env.DB_NAME;

const getColumnType = async (table, column) => {
  const [rows] = await db.query(
    `SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column]
  );
  return rows[0]?.type ?? null;
};

const addPendingClearance = async () => {
  console.log("\n[1/1] beds.status — add 'pending_clearance'");
  const type = await getColumnType('beds', 'status');
  if (!type) {
    console.warn('   ⚠ beds.status not found — skipping');
    return;
  }
  if (type.includes("'pending_clearance'")) {
    console.log("   · 'pending_clearance' already present in the enum");
    return;
  }
  await db.query(
    `ALTER TABLE beds
       MODIFY COLUMN status
       ENUM('available','occupied','pending_clearance','maintenance')
       NOT NULL DEFAULT 'available'`
  );
  console.log("   ✚ 'pending_clearance' added to the status enum");
};

(async () => {
  let failed = false;
  try {
    console.log(`Patient phase migration → schema "${dbName}"`);
    await addPendingClearance();
    console.log('\n✅ Migration complete.');
  } catch (err) {
    failed = true;
    console.error('\n❌ Migration failed:', err.message);
    console.error(err);
  } finally {
    await db.end().catch(() => {});
    process.exit(failed ? 1 : 0);
  }
})();
