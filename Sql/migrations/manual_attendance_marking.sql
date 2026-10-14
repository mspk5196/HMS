-- ==============================================================================
-- Migration: Manual Attendance Marking & Audit Logs
-- ==============================================================================

-- 1. Safely add missing columns to attendance_daily_summary
DROP PROCEDURE IF EXISTS `AddManualAttendanceColumns`;

DELIMITER $$
CREATE PROCEDURE `AddManualAttendanceColumns`()
BEGIN
  -- Check and add is_manually_marked
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_daily_summary' AND COLUMN_NAME = 'is_manually_marked'
  ) THEN
    ALTER TABLE `attendance_daily_summary` ADD COLUMN `is_manually_marked` TINYINT(1) NOT NULL DEFAULT 0;
  END IF;

  -- Check and add manually_marked_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_daily_summary' AND COLUMN_NAME = 'manually_marked_by'
  ) THEN
    ALTER TABLE `attendance_daily_summary` ADD COLUMN `manually_marked_by` INT NULL;
  END IF;

  -- Check and add manually_marked_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_daily_summary' AND COLUMN_NAME = 'manually_marked_at'
  ) THEN
    ALTER TABLE `attendance_daily_summary` ADD COLUMN `manually_marked_at` DATETIME NULL;
  END IF;

  -- Check and add manual_marking_reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_daily_summary' AND COLUMN_NAME = 'manual_marking_reason'
  ) THEN
    ALTER TABLE `attendance_daily_summary` ADD COLUMN `manual_marking_reason` TEXT NULL;
  END IF;
END $$
DELIMITER ;

CALL `AddManualAttendanceColumns`();
DROP PROCEDURE `AddManualAttendanceColumns`;

-- 2. Create attendance_manual_logs table for audit trail
CREATE TABLE IF NOT EXISTS `attendance_manual_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `employee_id` INT NOT NULL,
  `attendance_date` DATE NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `first_in_time` DATETIME NULL,
  `last_out_time` DATETIME NULL,
  `reason` TEXT NOT NULL,
  `marked_by` INT NULL,
  `marked_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_manual_emp_date` (`employee_id`, `attendance_date`),
  INDEX `idx_manual_marked_by` (`marked_by`),
  INDEX `idx_manual_marked_at` (`marked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


