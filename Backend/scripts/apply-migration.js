const db = require('../src/config/db');

(async () => {
  try {
    const dbName = process.env.DB_NAME;

    // Helper to check if a column exists in a table
    const checkColumnExists = async (table, column) => {
      const [rows] = await db.query(`
        SELECT COUNT(*) AS count 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
      `, [dbName, table, column]);
      return rows[0].count > 0;
    };

    console.log("Starting migration...");

    // 1. Alter departments table to add description if it doesn't exist
    const depHasDesc = await checkColumnExists('departments', 'description');
    if (!depHasDesc) {
      console.log("Adding 'description' column to 'departments' table...");
      await db.query(`
        ALTER TABLE departments 
        ADD COLUMN description VARCHAR(255) NULL AFTER name
      `);
      console.log("'description' column added successfully.");
    } else {
      console.log("'departments.description' column already exists.");
    }

    // 2. Create staff_roles table
    console.log("Creating 'staff_roles' table if not exists...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS staff_roles (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        department_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        basic_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        hra DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        da DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        lop_deduction DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        casual_leave_count INT NOT NULL DEFAULT 12,
        privilege_leave_count INT NOT NULL DEFAULT 0,
        weekly_off_count INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("'staff_roles' table checked/created.");

    // 3. Alter shifts table to add grace_period_minutes and biometric time range columns
    const shiftCols = [
      { name: 'grace_period_minutes', type: 'INT NOT NULL DEFAULT 0' },
      { name: 'biometric_in_start', type: 'TIME NULL' },
      { name: 'biometric_in_end', type: 'TIME NULL' },
      { name: 'biometric_out_start', type: 'TIME NULL' },
      { name: 'biometric_out_end', type: 'TIME NULL' }
    ];

    for (const col of shiftCols) {
      const hasCol = await checkColumnExists('shifts', col.name);
      if (!hasCol) {
        console.log(`Adding '${col.name}' column to 'shifts' table...`);
        await db.query(`
          ALTER TABLE shifts 
          ADD COLUMN ${col.name} ${col.type}
        `);
        console.log(`'${col.name}' column added successfully.`);
      } else {
        console.log(`'shifts.${col.name}' column already exists.`);
      }
    }

    console.log("Migration completed successfully! ✅");
  } catch (err) {
    console.error("Migration failed! ❌", err);
  } finally {
    process.exit(0);
  }
})();
