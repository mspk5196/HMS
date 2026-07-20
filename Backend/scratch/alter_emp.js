const db = require('../src/config/db');

(async () => {
  try {
    console.log('Altering employees table to add salary columns...');
    await db.query(`
      ALTER TABLE employees 
      ADD COLUMN salary_type VARCHAR(30) NULL DEFAULT 'monthly',
      ADD COLUMN basic_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      ADD COLUMN per_day_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      ADD COLUMN per_night_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00
    `);
    console.log('✅ Successfully added salary columns!');
  } catch (err) {
    console.error('❌ Failed to alter table:', err.message);
  } finally {
    process.exit(0);
  }
})();
