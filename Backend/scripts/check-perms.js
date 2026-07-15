const db = require('../src/config/db');

(async () => {
  try {
    const [cols] = await db.execute(`SHOW COLUMNS FROM permissions`);
    console.log("Permissions table columns:", cols.map(c => c.Field));
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    process.exit(0);
  }
})();
