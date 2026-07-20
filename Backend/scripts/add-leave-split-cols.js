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

    console.log("Starting leave split columns migration...");

    // Add casual_days column
    const hasCasualDays = await checkColumnExists('leave_requests', 'casual_days');
    if (!hasCasualDays) {
      console.log("Adding 'casual_days' column to 'leave_requests' table...");
      await db.query(`ALTER TABLE leave_requests ADD COLUMN casual_days DECIMAL(5,1) NOT NULL DEFAULT 0`);
      console.log("'casual_days' column added.");
    } else {
      console.log("'leave_requests.casual_days' already exists.");
    }

    // Add privilege_days column
    const hasPrivilegeDays = await checkColumnExists('leave_requests', 'privilege_days');
    if (!hasPrivilegeDays) {
      console.log("Adding 'privilege_days' column to 'leave_requests' table...");
      await db.query(`ALTER TABLE leave_requests ADD COLUMN privilege_days DECIMAL(5,1) NOT NULL DEFAULT 0`);
      console.log("'privilege_days' column added.");
    } else {
      console.log("'leave_requests.privilege_days' already exists.");
    }

    // Add lop_days column
    const hasLopDays = await checkColumnExists('leave_requests', 'lop_days');
    if (!hasLopDays) {
      console.log("Adding 'lop_days' column to 'leave_requests' table...");
      await db.query(`ALTER TABLE leave_requests ADD COLUMN lop_days DECIMAL(5,1) NOT NULL DEFAULT 0`);
      console.log("'lop_days' column added.");
    } else {
      console.log("'leave_requests.lop_days' already exists.");
    }

    console.log("Leave split columns migration completed successfully! ✅");
  } catch (err) {
    console.error("Migration failed! ❌", err);
  } finally {
    process.exit(0);
  }
})();
