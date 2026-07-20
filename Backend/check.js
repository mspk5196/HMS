const db = require('./src/config/db');
db.query("SELECT * FROM attendance_daily_summary WHERE attendance_date='2026-07-18'")
  .then(([r]) => console.log(r))
  .catch(console.error)
  .finally(() => process.exit(0));
