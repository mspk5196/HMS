/**
 * medicines.category_id was NOT NULL with medicine_categories starting empty —
 * a chicken-and-egg lockout (no categories to pick, but one was required to save
 * a medicine). Makes the column nullable and seeds a handful of starter categories.
 * Idempotent: safe to re-run.
 */
const db = require('../src/config/db');

const STARTER_CATEGORIES = [
  'Analgesics', 'Antibiotics', 'Antacids', 'Antihistamines',
  'Vitamins & Supplements', 'Antidiabetics', 'Cardiac', 'Other',
];

(async () => {
  try {
    const dbName = process.env.DB_NAME.replace(/'/g, '');

    const [[col]] = await db.query(
      `SELECT IS_NULLABLE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'medicines' AND COLUMN_NAME = 'category_id'`,
      [dbName]
    );
    if (col.IS_NULLABLE === 'NO') {
      await db.query(`ALTER TABLE medicines MODIFY COLUMN category_id BIGINT UNSIGNED NULL`);
      console.log('  medicines.category_id is now nullable.');
    } else {
      console.log('  medicines.category_id already nullable — skipping.');
    }

    for (const name of STARTER_CATEGORIES) {
      await db.query(`INSERT IGNORE INTO medicine_categories (name) VALUES (?)`, [name]);
    }
    const [[{ count }]] = await db.query(`SELECT COUNT(*) AS count FROM medicine_categories`);
    console.log(`  medicine_categories now has ${count} row(s).`);

    console.log('Done ✅');
  } catch (err) {
    console.error('Failed ❌', err);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
})();
