const db = require('../src/config/db');

async function migrate() {
  try {
    console.log('Running is_doctor role migration...');

    const [cols] = await db.query('SHOW COLUMNS FROM staff_roles');
    if (!cols.some((c) => c.Field === 'is_doctor')) {
      await db.query(
        `ALTER TABLE staff_roles ADD COLUMN is_doctor TINYINT(1) NOT NULL DEFAULT 0 AFTER name`
      );
      console.log('✅ Added staff_roles.is_doctor');
    } else {
      console.log('is_doctor already on staff_roles');
    }

    const [result] = await db.query(`
      UPDATE staff_roles
      SET is_doctor = 1
      WHERE LOWER(name) LIKE '%doctor%' OR LOWER(name) LIKE '%physician%'
         OR LOWER(name) LIKE '%surgeon%' OR LOWER(name) LIKE '%consultant%'
    `);
    console.log(`✅ Backfilled is_doctor on ${result.affectedRows} existing role(s)`);

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
