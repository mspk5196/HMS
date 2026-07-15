const db = require('../src/config/db');

(async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS employee_shifts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        employee_id BIGINT UNSIGNED NOT NULL,
        shift_date DATE NOT NULL,
        shift_id BIGINT UNSIGNED NULL,
        is_week_off TINYINT(1) NOT NULL DEFAULT 0,
        is_night_duty TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_emp_date (employee_id, shift_date),
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Created employee_shifts table successfully.");
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
