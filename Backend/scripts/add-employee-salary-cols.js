const db = require('../src/config/db');

(async () => {
  try {
    const dbName = process.env.DB_NAME;

    const checkColumnExists = async (table, column) => {
      const [rows] = await db.query(`
        SELECT COUNT(*) AS count 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
      `, [dbName, table, column]);
      return rows[0].count > 0;
    };

    console.log("Starting employee salary columns migration...");

    const cols = [
      { name: 'salary_type', type: "VARCHAR(30) NOT NULL DEFAULT 'monthly'" },
      { name: 'basic_salary', type: 'DECIMAL(10,2) NOT NULL DEFAULT 0.00' },
      { name: 'per_day_salary', type: 'DECIMAL(10,2) NOT NULL DEFAULT 0.00' },
      { name: 'per_night_salary', type: 'DECIMAL(10,2) NOT NULL DEFAULT 0.00' }
    ];

    for (const col of cols) {
      const hasCol = await checkColumnExists('employees', col.name);
      if (!hasCol) {
        console.log(`Adding '${col.name}' column to 'employees' table...`);
        await db.query(`ALTER TABLE employees ADD COLUMN ${col.name} ${col.type}`);
        console.log(`'${col.name}' column added successfully.`);
      } else {
        console.log(`'employees.${col.name}' column already exists.`);
      }
    }

    console.log("Employee salary columns migration completed successfully! ✅");
  } catch (err) {
    console.error("Migration failed! ❌", err);
  } finally {
    process.exit(0);
  }
})();
