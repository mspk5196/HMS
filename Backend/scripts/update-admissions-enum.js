const db = require('../src/config/db');

async function updateAdmissionsEnum() {
  try {
    await db.query("ALTER TABLE admissions MODIFY COLUMN status ENUM('admitted','payment_pending','discharged') NOT NULL DEFAULT 'admitted'");
    console.log("✅ Successfully updated admissions status enum");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to update admissions status enum:", err);
    process.exit(1);
  }
}

updateAdmissionsEnum();
