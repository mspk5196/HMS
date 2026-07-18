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

    console.log("Starting privilege leave column migration...");

    const hasCol = await checkColumnExists('staff_roles', 'privilege_leave_count');
    if (!hasCol) {
      console.log("Adding 'privilege_leave_count' column to 'staff_roles' table...");
      await db.query(`ALTER TABLE staff_roles ADD COLUMN privilege_leave_count INT NOT NULL DEFAULT 0`);
      console.log("'privilege_leave_count' column added successfully.");
    } else {
      console.log("'staff_roles.privilege_leave_count' column already exists.");
    }

    console.log("Privilege leave column migration completed successfully! ✅");
  } catch (err) {
    console.error("Migration failed! ❌", err);
  } finally {
    process.exit(0);
  }
})();
