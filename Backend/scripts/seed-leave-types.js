const db = require('../src/config/db');

(async () => {
  try {
    const [rows] = await db.query('SELECT COUNT(*) AS count FROM leave_types');
    if (rows[0].count === 0) {
      console.log('Seeding leave types...');
      await db.query(`
        INSERT INTO leave_types (name, quota_days, quota_period, is_lop_applicable) 
        VALUES 
          ('Casual Leave', 1.5, 'monthly', 0), 
          ('Privilege Leave', 2.0, 'monthly', 0), 
          ('Loss of Pay', 0.0, 'monthly', 1)
      `);
      console.log('Seeding complete. ✅');
    } else {
      console.log('Leave types already seeded.');
    }
  } catch (err) {
    console.error('Seeding failed: ❌', err);
  } finally {
    process.exit(0);
  }
})();
