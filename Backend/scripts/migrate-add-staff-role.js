const db = require('../src/config/db');

async function migrate() {
  try {
    const [[existing]] = await db.query(`SELECT id FROM roles WHERE name = 'Staff'`);
    if (existing) {
      console.log('Staff role already exists.');
      process.exit(0);
    }

    const [[{ maxPriority }]] = await db.query(`SELECT COALESCE(MAX(priority), 0) AS maxPriority FROM roles`);
    await db.query(
      `INSERT INTO roles (name, description, priority, can_access_settings) VALUES (?, ?, ?, 0)`,
      ['Staff', 'Default baseline role for new logins — no permissions until configured', maxPriority + 1]
    );
    console.log('✅ Created baseline "Staff" role — new logins default here until an admin assigns a real role.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
