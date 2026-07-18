const db = require('./src/config/db');
const svc = require('./src/modules/attendance/attendance.service');

async function run() {
  await db.query("UPDATE attendance_raw_punches SET is_processed=0 WHERE DATE(punch_time)='2026-07-18'");
  await svc.processDailyAttendance('2026-07-18');
  console.log('Done');
  process.exit(0);
}
run().catch(console.error);
