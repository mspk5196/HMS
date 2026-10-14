-- ==============================================================================
-- CLEANUP SCRIPT: Remove Future Date Attendance Records & Absent Statuses
-- ==============================================================================
-- Run this script on your Server Database to clear all records that were
-- mistakenly marked as 'absent' or generated for future dates.
--
-- After running this:
-- 1. All future dates (> CURDATE()) will have NO status (empty/unrecorded '·').
-- 2. No future days will be counted as absent or loss of pay.
-- ==============================================================================

-- 1. Check existing future attendance summary records before deleting
SELECT attendance_date, status, COUNT(*) AS count
FROM attendance_daily_summary
WHERE attendance_date > CURDATE()
GROUP BY attendance_date, status
ORDER BY attendance_date ASC;

-- 2. Delete all future date attendance daily summary records
DELETE FROM attendance_daily_summary
WHERE attendance_date > CURDATE();

-- 3. Delete any accidental fines generated for future dates
DELETE FROM fines
WHERE fine_date > CURDATE();

-- 4. Delete any manual attendance logs for future dates (if any)
DELETE FROM attendance_manual_logs
WHERE attendance_date > CURDATE();

-- 5. Verify cleanup (should return 0 rows)
SELECT COUNT(*) AS remaining_future_records
FROM attendance_daily_summary
WHERE attendance_date > CURDATE();
