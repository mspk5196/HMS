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

    console.log("Starting role-shift migration...");

    const shiftCols = [
      { name: 'shift_name', type: 'VARCHAR(100) NULL' },
      { name: 'shift_start_time', type: 'TIME NULL' },
      { name: 'shift_end_time', type: 'TIME NULL' },
      { name: 'biometric_in_start', type: 'TIME NULL' },
      { name: 'biometric_in_end', type: 'TIME NULL' },
      { name: 'biometric_out_start', type: 'TIME NULL' },
      { name: 'biometric_out_end', type: 'TIME NULL' },
      { name: 'is_night_shift', type: 'TINYINT(1) NOT NULL DEFAULT 0' },
      { name: 'grace_period_minutes', type: 'INT NOT NULL DEFAULT 0' }
    ];

    for (const col of shiftCols) {
      const hasCol = await checkColumnExists('staff_roles', col.name);
      if (!hasCol) {
        console.log(`Adding '${col.name}' column to 'staff_roles' table...`);
        await db.query(`
          ALTER TABLE staff_roles 
          ADD COLUMN ${col.name} ${col.type}
        `);
        console.log(`'${col.name}' column added successfully.`);
      } else {
        console.log(`'staff_roles.${col.name}' column already exists.`);
      }
    }

    console.log("Role-shift columns migration completed successfully! ✅");
  } catch (err) {
    console.error("Migration failed! ❌", err);
  } finally {
    process.exit(0);
  }
})();
