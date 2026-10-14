require('dotenv').config();
const db = require('../config/db');

async function run() {
  console.log('--- Creating employee_photos Table ---');
  await db.query(`
    CREATE TABLE IF NOT EXISTS employee_photos (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      employee_id BIGINT UNSIGNED NOT NULL UNIQUE,
      photo_path VARCHAR(500) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_emp_photo_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ Successfully created / verified employee_photos table');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
