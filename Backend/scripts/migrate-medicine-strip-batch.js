const db = require('../src/config/db');

async function migrate() {
  try {
    console.log('Migrating database for medicine strip ratio and unique batch names...');

    // 1. Column tablets_per_strip
    const [cols] = await db.query("SHOW COLUMNS FROM medicines LIKE 'tablets_per_strip'");
    if (cols.length === 0) {
      console.log("Adding 'tablets_per_strip' column to 'medicines' table...");
      await db.query("ALTER TABLE medicines ADD COLUMN tablets_per_strip INT NOT NULL DEFAULT 1 AFTER unit");
      console.log("Column 'tablets_per_strip' added successfully.");
    } else {
      console.log("Column 'tablets_per_strip' already exists.");
    }

    // 2. Fix existing duplicate batch numbers for the same medicine if any
    const [dups] = await db.query(`
      SELECT medicine_id, batch_number, COUNT(*) as cnt 
      FROM medicine_batches 
      GROUP BY medicine_id, batch_number 
      HAVING cnt > 1
    `);

    for (const dup of dups) {
      console.log(`Fixing duplicate batch '${dup.batch_number}' for medicine_id ${dup.medicine_id}...`);
      const [rows] = await db.query(
        'SELECT id FROM medicine_batches WHERE medicine_id = ? AND batch_number = ? ORDER BY id ASC',
        [dup.medicine_id, dup.batch_number]
      );
      // Skip the first row, update subsequent rows
      for (let i = 1; i < rows.length; i++) {
        const newBatchNum = `${dup.batch_number}-DUP-${rows[i].id}`;
        await db.query('UPDATE medicine_batches SET batch_number = ? WHERE id = ?', [newBatchNum, rows[i].id]);
        console.log(`Updated duplicate batch id ${rows[i].id} to '${newBatchNum}'`);
      }
    }

    // 3. Add UNIQUE constraint
    const [idxs] = await db.query("SHOW INDEX FROM medicine_batches WHERE Key_name = 'uq_medicine_batch'");
    if (idxs.length === 0) {
      console.log("Adding unique key 'uq_medicine_batch' to 'medicine_batches'...");
      await db.query("ALTER TABLE medicine_batches ADD UNIQUE KEY uq_medicine_batch (medicine_id, batch_number)");
      console.log("Unique key 'uq_medicine_batch' added successfully.");
    } else {
      console.log("Unique key 'uq_medicine_batch' already exists.");
    }

    console.log('✅ Migration clean and complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
