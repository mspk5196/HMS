-- ─── PATCH: REFORMED LEAVE CATEGORIES, BALANCES, AND REQUEST MODEL ────────────

-- 1. Purge legacy test leave types
DELETE FROM `leave_types` WHERE `id` = 30001;

-- 2. Deactivate Weekly Off from leave_types (as it is a roster schedule attribute)
UPDATE `leave_types`
SET `is_active` = 0, `name` = 'Weekly Off (Legacy)'
WHERE `id` = 5;

-- 3. Standardize Hospital Leave Categories
UPDATE `leave_types` SET
  `name` = 'Casual Leave (CL)',
  `quota_days` = 12.00,
  `quota_period` = 'yearly',
  `is_half_day_allowed` = 1,
  `is_active` = 1,
  `is_lop_applicable` = 0,
  `can_carry_forward` = 0,
  `max_carry_forward_days` = 0.00
WHERE `id` = 1;

UPDATE `leave_types` SET
  `name` = 'Privilege / Earned Leave (PL)',
  `quota_days` = 15.00,
  `quota_period` = 'yearly',
  `is_half_day_allowed` = 0,
  `is_active` = 1,
  `is_lop_applicable` = 0,
  `can_carry_forward` = 1,
  `max_carry_forward_days` = 30.00
WHERE `id` = 2;

UPDATE `leave_types` SET
  `name` = 'Loss of Pay (LOP)',
  `quota_days` = 0.00,
  `quota_period` = 'yearly',
  `is_half_day_allowed` = 1,
  `is_active` = 1,
  `is_lop_applicable` = 1,
  `can_carry_forward` = 0,
  `max_carry_forward_days` = 0.00
WHERE `id` = 3;

UPDATE `leave_types` SET
  `name` = 'Sick Leave (SL)',
  `quota_days` = 12.00,
  `quota_period` = 'yearly',
  `is_half_day_allowed` = 1,
  `is_active` = 1,
  `is_lop_applicable` = 0,
  `can_carry_forward` = 1,
  `max_carry_forward_days` = 15.00
WHERE `id` = 4;

-- Insert additional essential hospital categories
INSERT INTO `leave_types` (`id`, `name`, `quota_days`, `quota_period`, `is_half_day_allowed`, `is_active`, `is_lop_applicable`, `can_carry_forward`, `max_carry_forward_days`)
VALUES
  (6, 'Compensatory Off (Comp-Off)', 0.00, 'yearly', 1, 1, 0, 0, 0.00),
  (7, 'Maternity Leave (ML)', 182.00, 'yearly', 0, 1, 0, 0, 0.00),
  (8, 'Paternity Leave (PL)', 5.00, 'yearly', 0, 1, 0, 0, 0.00),
  (9, 'Bereavement Leave', 3.00, 'yearly', 0, 1, 0, 0, 0.00)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `quota_days` = VALUES(`quota_days`),
  `quota_period` = VALUES(`quota_period`),
  `is_half_day_allowed` = VALUES(`is_half_day_allowed`),
  `is_active` = VALUES(`is_active`);

-- 4. Enhance leave_requests with duration_type and days_count
-- Note: MySQL syntax does not support 'ADD COLUMN IF NOT EXISTS'. We dynamically check columns.
SET @exist_duration := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'duration_type'
);

SET @sql_duration := IF(
  @exist_duration = 0,
  "ALTER TABLE \`leave_requests\` ADD COLUMN \`duration_type\` ENUM('full_day', 'first_half', 'second_half') NOT NULL DEFAULT 'full_day' AFTER \`to_date\`",
  "SELECT 'Column duration_type already exists' AS _info"
);

PREPARE stmt_duration FROM @sql_duration;
EXECUTE stmt_duration;
DEALLOCATE PREPARE stmt_duration;

SET @exist_days := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'days_count'
);

SET @sql_days := IF(
  @exist_days = 0,
  "ALTER TABLE \`leave_requests\` ADD COLUMN \`days_count\` DECIMAL(3,1) NOT NULL DEFAULT 1.0 AFTER \`duration_type\`",
  "SELECT 'Column days_count already exists' AS _info"
);

PREPARE stmt_days FROM @sql_days;
EXECUTE stmt_days;
DEALLOCATE PREPARE stmt_days;

-- 5. Update attendance_daily_summary status ENUM to support half-day leaves and LOP
ALTER TABLE `attendance_daily_summary`
  MODIFY COLUMN `status` ENUM('present','late_present','absent','on_leave','half_day_leave','half_day_lop','lop','week_off','holiday') NOT NULL DEFAULT 'absent';


-- 6. Create comp_off_ledger
CREATE TABLE IF NOT EXISTS `comp_off_ledger` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` BIGINT UNSIGNED NOT NULL,
  `earned_date` DATE NOT NULL,
  `days_credited` DECIMAL(3,1) NOT NULL DEFAULT 1.0,
  `days_consumed` DECIMAL(3,1) NOT NULL DEFAULT 0.0,
  `expiry_date` DATE NOT NULL,
  `reason` VARCHAR(255) NULL,
  `status` ENUM('active', 'consumed', 'expired') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_compoff_emp` (`employee_id`),
  KEY `idx_compoff_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Populate default leave_balances for all active employees for 2026
-- Standard: 12 CL, 12 SL, 15 PL per year
INSERT INTO `leave_balances` (`employee_id`, `leave_type_id`, `year`, `allocated_days`, `used_days`)
SELECT
  e.id AS employee_id,
  lt.id AS leave_type_id,
  2026 AS year,
  lt.quota_days AS allocated_days,
  0.00 AS used_days
FROM `employees` e
CROSS JOIN `leave_types` lt
WHERE e.status = 'active'
  AND lt.is_active = 1
  AND lt.id IN (1, 2, 4) -- CL, PL, SL
ON DUPLICATE KEY UPDATE
  `allocated_days` = VALUES(`allocated_days`);
