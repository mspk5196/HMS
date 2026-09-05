-- =============================================================================
-- Patch v9 — Employee Documents, Shift Category & Duty Roster Redesign
-- Run this against the `nehahospitals` database.
-- =============================================================================

USE `nehahospitals`;

-- ---------------------------------------------------------------------------
-- 1. Add new columns to `employees`
--    (idempotent via IF NOT EXISTS guard per column)
-- ---------------------------------------------------------------------------
ALTER TABLE `employees`
  ADD COLUMN IF NOT EXISTS `aadhar_number`      VARCHAR(20)  NULL AFTER `esi_enrolled`,
  ADD COLUMN IF NOT EXISTS `aadhar_doc_path`    VARCHAR(500) NULL AFTER `aadhar_number`,
  ADD COLUMN IF NOT EXISTS `pan_number`         VARCHAR(20)  NULL AFTER `aadhar_doc_path`,
  ADD COLUMN IF NOT EXISTS `pan_doc_path`       VARCHAR(500) NULL AFTER `pan_number`,
  ADD COLUMN IF NOT EXISTS `shift_category`     ENUM('day','night','day_and_night','general') NULL AFTER `pan_doc_path`,
  ADD COLUMN IF NOT EXISTS `custom_shift_start` TIME NULL AFTER `shift_category`,
  ADD COLUMN IF NOT EXISTS `custom_shift_end`   TIME NULL AFTER `custom_shift_start`,
  ADD COLUMN IF NOT EXISTS `custom_buffer_minutes` SMALLINT UNSIGNED NULL DEFAULT NULL AFTER `custom_shift_end`;

-- ---------------------------------------------------------------------------
-- 2. New table — per-employee per-day shift time override
--    (for Day / Night / General employees who have no duty roster grid)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `employee_shift_overrides` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id`   BIGINT UNSIGNED NOT NULL,
  `override_date` DATE            NOT NULL,
  `start_time`    TIME            NOT NULL,
  `end_time`      TIME            NOT NULL,
  `note`          VARCHAR(255)    NULL DEFAULT NULL,
  `created_by`    BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_emp_override_date` (`employee_id`, `override_date`),
  KEY `ix_emp_override_employee` (`employee_id`),
  CONSTRAINT `fk_emp_override_employee` FOREIGN KEY (`employee_id`)
    REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_emp_override_created_by` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ---------------------------------------------------------------------------
-- 3. Modify `roster_entries` — drop the shift catalog FK, add time-range cols
--    Clear existing data first (confirmed by user — only test data exists).
-- ---------------------------------------------------------------------------
DELETE FROM `roster_entries`;

-- Drop the shift FK if it still exists
ALTER TABLE `roster_entries`
  DROP FOREIGN KEY IF EXISTS `fk_roster_shift`;

-- Add time-range and buffer-minute columns if not already present
ALTER TABLE `roster_entries`
  ADD COLUMN IF NOT EXISTS `custom_start_time` TIME NULL AFTER `notes`,
  ADD COLUMN IF NOT EXISTS `custom_end_time`   TIME NULL AFTER `custom_start_time`,
  ADD COLUMN IF NOT EXISTS `buffer_minutes`    SMALLINT UNSIGNED NULL DEFAULT NULL AFTER `custom_end_time`;

-- shift_id is now purely informational / legacy; make it nullable with no FK
-- (the column already exists and is nullable per the original schema — no-op)

-- ---------------------------------------------------------------------------
-- 4. Update the `shifts` catalog entries to reflect the new category naming
--    (kept for legacy salary.service.js joins; no new shifts will be created)
-- ---------------------------------------------------------------------------
-- Keep existing shifts intact; they are only referenced by salary payroll queries
-- that look at is_night_shift flag. No changes needed here.

SELECT 'Patch v9 applied successfully.' AS result;
