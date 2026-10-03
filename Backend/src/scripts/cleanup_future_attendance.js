/**
 * cleanup_future_attendance.js
 * Script to remove future date attendance summaries, absent records, and fines.
 * Connects to whatever database is specified in .env (or server environment).
 */
const db = require('../config/db');

async function runCleanup() {
  console.log('=== CLEANING UP FUTURE DATE ATTENDANCE RECORDS ===');
  
  try {
    // 1. Get current date on DB
    const [todayRows] = await db.query('SELECT CURDATE() as cur_date, NOW() as now_time');
    const curDate = todayRows[0].cur_date;
    console.log(`Database Current Date: ${curDate}`);

    // 2. Check future records count
    const [beforeRows] = await db.query(
      'SELECT attendance_date, status, COUNT(*) AS count FROM attendance_daily_summary WHERE attendance_date > CURDATE() GROUP BY attendance_date, status ORDER BY attendance_date ASC'
    );
    
    if (beforeRows.length === 0) {
      console.log('✅ No future attendance records found in attendance_daily_summary.');
    } else {
      console.log('Found future attendance records to remove:');
      console.table(beforeRows);
    }

    // 3. Delete future daily summaries
    const [delSummary] = await db.query('DELETE FROM attendance_daily_summary WHERE attendance_date > CURDATE()');
    console.log(`🗑️ Deleted ${delSummary.affectedRows} future records from attendance_daily_summary.`);

    // 4. Delete future fines (if any)
    try {
      const [delFines] = await db.query('DELETE FROM fines WHERE fine_date > CURDATE()');
      console.log(`🗑️ Deleted ${delFines.affectedRows} future fine records.`);
    } catch (err) {
      // Table might not exist or no fines
    }

    // 5. Delete future manual logs (if any)
    try {
      const [delManual] = await db.query('DELETE FROM attendance_manual_logs WHERE attendance_date > CURDATE()');
      console.log(`🗑️ Deleted ${delManual.affectedRows} future manual logs.`);
    } catch (err) {
      // Ignore if table not present
    }

    // 6. Verify final status
    const [afterRows] = await db.query('SELECT COUNT(*) AS count FROM attendance_daily_summary WHERE attendance_date > CURDATE()');
    console.log(`\nVerification: ${afterRows[0].count} future records remaining.`);
    console.log('✅ Cleanup completed successfully! Future dates will now show NO status (empty/unrecorded).');

  } catch (err) {
    console.error('❌ Error during cleanup:', err.message);
  } finally {
    process.exit(0);
  }
}

runCleanup();
