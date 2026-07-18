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

    console.log("Starting attendance columns migration...");

    // 1. Add monthly_buffer_minutes to staff_roles (buffer pool per role)
    const hasBuffer = await checkColumnExists('staff_roles', 'monthly_buffer_minutes');
    if (!hasBuffer) {
      console.log("Adding 'monthly_buffer_minutes' to 'staff_roles'...");
      await db.query(`ALTER TABLE staff_roles ADD COLUMN monthly_buffer_minutes INT NOT NULL DEFAULT 30`);
      console.log("'monthly_buffer_minutes' added to staff_roles.");
    } else {
      console.log("'staff_roles.monthly_buffer_minutes' already exists.");
    }

    // 2. Add overtime_minutes to attendance_daily_summary
    const hasOT = await checkColumnExists('attendance_daily_summary', 'overtime_minutes');
    if (!hasOT) {
      console.log("Adding 'overtime_minutes' to 'attendance_daily_summary'...");
      await db.query(`ALTER TABLE attendance_daily_summary ADD COLUMN overtime_minutes INT NOT NULL DEFAULT 0`);
      console.log("'overtime_minutes' added to attendance_daily_summary.");
    } else {
      console.log("'attendance_daily_summary.overtime_minutes' already exists.");
    }

    console.log("Attendance columns migration completed successfully! ✅");
  } catch (err) {
    console.error("Migration failed! ❌", err);
  } finally {
    process.exit(0);
  }
})();
