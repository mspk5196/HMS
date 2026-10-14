-- =============================================================================
-- Migration Patch: Visiting Doctors Registry, Per-Visit Fee Overrides & Clinical Vitals
-- Target Server  : MySQL 8.0+ (nehahospitals)
-- Generated Date : 2026-10-02
-- Description   : Adds visiting_doctors table, nullable doctor references, fee
--                 overrides, consultation vitals, consultation addenda, and RBAC seeds.
-- =============================================================================

USE `nehahospitals`;

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. Table: visiting_doctors (Master for External / Specialist Visiting Doctors)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `visiting_doctors` (
  `id`             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name`      VARCHAR(150)    CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `qualification`  VARCHAR(100)    CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `specialization` VARCHAR(100)    CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `mobile`         VARCHAR(20)     CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `notes`          TEXT            CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `is_active`      TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_visiting_doctors_name` (`full_name` ASC) USING BTREE,
  INDEX `ix_visiting_doctors_active` (`is_active` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = COMPACT;

-- Ensure visiting_doctors.id is BIGINT UNSIGNED if table already existed with INT
ALTER TABLE `visiting_doctors`
  MODIFY COLUMN `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT;

-- -----------------------------------------------------------------------------
-- 2. Table: appointments (Support visiting doctors & per-visit fee override)
-- -----------------------------------------------------------------------------
-- Make employee doctor_id nullable (allows booking visiting doctors without staff employee record)
ALTER TABLE `appointments`
  MODIFY COLUMN `doctor_id` BIGINT UNSIGNED NULL DEFAULT NULL;

-- Add visiting_doctor_id and doctor_fee_override columns
ALTER TABLE `appointments`
  ADD COLUMN `visiting_doctor_id`  BIGINT UNSIGNED NULL DEFAULT NULL AFTER `doctor_id`,
  ADD COLUMN `doctor_fee_override` DECIMAL(10, 2)  NULL DEFAULT NULL AFTER `doctor_fee`;

-- Ensure visiting_doctor_id is BIGINT UNSIGNED
ALTER TABLE `appointments`
  MODIFY COLUMN `visiting_doctor_id` BIGINT UNSIGNED NULL DEFAULT NULL;

-- Add foreign key constraint for visiting_doctor_id
ALTER TABLE `appointments`
  ADD CONSTRAINT `fk_appointments_visiting_doctor` FOREIGN KEY (`visiting_doctor_id`) REFERENCES `visiting_doctors` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- -----------------------------------------------------------------------------
-- 3. Table: admissions (Support visiting doctors & admission fee override)
-- -----------------------------------------------------------------------------
-- Make employee admitting_doctor_id nullable
ALTER TABLE `admissions`
  MODIFY COLUMN `admitting_doctor_id` BIGINT UNSIGNED NULL DEFAULT NULL;

-- Add visiting_doctor_id and doctor_fee_override columns
ALTER TABLE `admissions`
  ADD COLUMN `visiting_doctor_id`  BIGINT UNSIGNED NULL DEFAULT NULL AFTER `admitting_doctor_id`,
  ADD COLUMN `doctor_fee_override` DECIMAL(10, 2)  NULL DEFAULT NULL AFTER `notes`;

-- Ensure visiting_doctor_id is BIGINT UNSIGNED
ALTER TABLE `admissions`
  MODIFY COLUMN `visiting_doctor_id` BIGINT UNSIGNED NULL DEFAULT NULL;

-- Add foreign key constraint for visiting_doctor_id
ALTER TABLE `admissions`
  ADD CONSTRAINT `fk_admissions_visiting_doctor` FOREIGN KEY (`visiting_doctor_id`) REFERENCES `visiting_doctors` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- -----------------------------------------------------------------------------
-- 4. Table: consultations (Vitals & Clinical Triage Recording)
-- -----------------------------------------------------------------------------
ALTER TABLE `consultations`
  ADD COLUMN `bp_systolic`  SMALLINT UNSIGNED NULL DEFAULT NULL AFTER `doctor_notes`,
  ADD COLUMN `bp_diastolic` SMALLINT UNSIGNED NULL DEFAULT NULL AFTER `bp_systolic`,
  ADD COLUMN `temperature`   DECIMAL(4, 1)    NULL DEFAULT NULL AFTER `bp_diastolic`,
  ADD COLUMN `pulse`         SMALLINT UNSIGNED NULL DEFAULT NULL AFTER `temperature`,
  ADD COLUMN `spo2`          TINYINT UNSIGNED  NULL DEFAULT NULL AFTER `pulse`,
  ADD COLUMN `weight`        DECIMAL(5, 2)    NULL DEFAULT NULL AFTER `spo2`,
  ADD COLUMN `height`        DECIMAL(5, 2)    NULL DEFAULT NULL AFTER `weight`,
  ADD COLUMN `blood_sugar`   SMALLINT UNSIGNED NULL DEFAULT NULL AFTER `height`;

-- -----------------------------------------------------------------------------
-- 5. Table: consultation_addenda (Audit-compliant consultation notes / amendments)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `consultation_addenda` (
  `id`              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `consultation_id` BIGINT UNSIGNED NOT NULL,
  `added_by`        BIGINT UNSIGNED NULL DEFAULT NULL,
  `note`            TEXT            CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `created_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_consultation_addenda_consultation` (`consultation_id` ASC) USING BTREE,
  INDEX `fk_consultation_addenda_user` (`added_by` ASC) USING BTREE,
  CONSTRAINT `fk_consultation_addenda_consultation` FOREIGN KEY (`consultation_id`) REFERENCES `consultations` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_consultation_addenda_user` FOREIGN KEY (`added_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = COMPACT;

-- -----------------------------------------------------------------------------
-- 6. Table: attendance_daily_summary (Include shift_not_configured in status ENUM)
-- -----------------------------------------------------------------------------
ALTER TABLE `attendance_daily_summary`
  MODIFY COLUMN `status` ENUM(
    'present',
    'late_present',
    'absent',
    'on_leave',
    'half_day_leave',
    'half_day_lop',
    'lop',
    'week_off',
    'holiday',
    'shift_not_configured'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'absent';

-- -----------------------------------------------------------------------------
-- 7. RBAC: Modules, Actions, and Permissions Seed Data
-- -----------------------------------------------------------------------------

-- 6.1 Sync Modules
INSERT INTO `modules` (`code`, `name`, `display_order`)
VALUES ('visiting_doctor', 'Visiting / External Doctors', 13)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `display_order` = VALUES(`display_order`);

-- 6.2 Sync Special Actions
INSERT INTO `actions` (`code`, `name`, `is_special`)
VALUES
  ('override_fee', 'Override Doctor Fee on Booking', 1),
  ('convert_to_ipd', 'Convert OPD to IPD Admission', 1),
  ('record_vitals', 'Record Patient Vitals', 0),
  ('addendum', 'Add Consultation Addendum', 1),
  ('print_rx', 'Print Prescription', 0),
  ('print_summary', 'Print Discharge Summary', 0)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `is_special` = VALUES(`is_special`);

-- 7.3 Sync Permissions (Atomic subqueries, session-independent)
INSERT INTO `permissions` (`module_id`, `action_id`, `code`, `description`)
SELECT m.`id`, a.`id`, 'visiting_doctor.view', 'View — Visiting / External Doctors'
FROM `modules` m, `actions` a WHERE m.`code` = 'visiting_doctor' AND a.`code` = 'view'
ON DUPLICATE KEY UPDATE `module_id` = VALUES(`module_id`), `action_id` = VALUES(`action_id`), `description` = VALUES(`description`);

INSERT INTO `permissions` (`module_id`, `action_id`, `code`, `description`)
SELECT m.`id`, a.`id`, 'visiting_doctor.create', 'Create — Visiting / External Doctors'
FROM `modules` m, `actions` a WHERE m.`code` = 'visiting_doctor' AND a.`code` = 'create'
ON DUPLICATE KEY UPDATE `module_id` = VALUES(`module_id`), `action_id` = VALUES(`action_id`), `description` = VALUES(`description`);

INSERT INTO `permissions` (`module_id`, `action_id`, `code`, `description`)
SELECT m.`id`, a.`id`, 'visiting_doctor.edit', 'Edit — Visiting / External Doctors'
FROM `modules` m, `actions` a WHERE m.`code` = 'visiting_doctor' AND a.`code` = 'edit'
ON DUPLICATE KEY UPDATE `module_id` = VALUES(`module_id`), `action_id` = VALUES(`action_id`), `description` = VALUES(`description`);

INSERT INTO `permissions` (`module_id`, `action_id`, `code`, `description`)
SELECT m.`id`, a.`id`, 'visiting_doctor.delete', 'Delete — Visiting / External Doctors'
FROM `modules` m, `actions` a WHERE m.`code` = 'visiting_doctor' AND a.`code` = 'delete'
ON DUPLICATE KEY UPDATE `module_id` = VALUES(`module_id`), `action_id` = VALUES(`action_id`), `description` = VALUES(`description`);

INSERT INTO `permissions` (`module_id`, `action_id`, `code`, `description`)
SELECT m.`id`, a.`id`, 'appointment.override_fee', 'Override Doctor Fee on Booking — Appointments'
FROM `modules` m, `actions` a WHERE m.`code` = 'appointment' AND a.`code` = 'override_fee'
ON DUPLICATE KEY UPDATE `module_id` = VALUES(`module_id`), `action_id` = VALUES(`action_id`), `description` = VALUES(`description`);

INSERT INTO `permissions` (`module_id`, `action_id`, `code`, `description`)
SELECT m.`id`, a.`id`, 'appointment.convert_to_ipd', 'Convert OPD to IPD Admission — Appointments'
FROM `modules` m, `actions` a WHERE m.`code` = 'appointment' AND a.`code` = 'convert_to_ipd'
ON DUPLICATE KEY UPDATE `module_id` = VALUES(`module_id`), `action_id` = VALUES(`action_id`), `description` = VALUES(`description`);

INSERT INTO `permissions` (`module_id`, `action_id`, `code`, `description`)
SELECT m.`id`, a.`id`, 'consultation.record_vitals', 'Record Patient Vitals — Consultations & Rx'
FROM `modules` m, `actions` a WHERE m.`code` = 'consultation' AND a.`code` = 'record_vitals'
ON DUPLICATE KEY UPDATE `module_id` = VALUES(`module_id`), `action_id` = VALUES(`action_id`), `description` = VALUES(`description`);

INSERT INTO `permissions` (`module_id`, `action_id`, `code`, `description`)
SELECT m.`id`, a.`id`, 'consultation.addendum', 'Add Consultation Addendum — Consultations & Rx'
FROM `modules` m, `actions` a WHERE m.`code` = 'consultation' AND a.`code` = 'addendum'
ON DUPLICATE KEY UPDATE `module_id` = VALUES(`module_id`), `action_id` = VALUES(`action_id`), `description` = VALUES(`description`);

INSERT INTO `permissions` (`module_id`, `action_id`, `code`, `description`)
SELECT m.`id`, a.`id`, 'consultation.print_rx', 'Print Prescription — Consultations & Rx'
FROM `modules` m, `actions` a WHERE m.`code` = 'consultation' AND a.`code` = 'print_rx'
ON DUPLICATE KEY UPDATE `module_id` = VALUES(`module_id`), `action_id` = VALUES(`action_id`), `description` = VALUES(`description`);

INSERT INTO `permissions` (`module_id`, `action_id`, `code`, `description`)
SELECT m.`id`, a.`id`, 'admission.override_fee', 'Override Doctor Fee on Admission — Admissions & Beds'
FROM `modules` m, `actions` a WHERE m.`code` = 'admission' AND a.`code` = 'override_fee'
ON DUPLICATE KEY UPDATE `module_id` = VALUES(`module_id`), `action_id` = VALUES(`action_id`), `description` = VALUES(`description`);

INSERT INTO `permissions` (`module_id`, `action_id`, `code`, `description`)
SELECT m.`id`, a.`id`, 'discharge.print_summary', 'Print Discharge Summary — Discharge & Billing'
FROM `modules` m, `actions` a WHERE m.`code` = 'discharge' AND a.`code` = 'print_summary'
ON DUPLICATE KEY UPDATE `module_id` = VALUES(`module_id`), `action_id` = VALUES(`action_id`), `description` = VALUES(`description`);

-- 7.4 Grant all newly created permissions to Role 1 (Administrator)
INSERT INTO `role_permissions` (`role_id`, `permission_id`, `skip_approval`)
SELECT 1, p.`id`, 1
FROM `permissions` p
WHERE p.`code` IN (
  'visiting_doctor.view',
  'visiting_doctor.create',
  'visiting_doctor.edit',
  'visiting_doctor.delete',
  'appointment.override_fee',
  'appointment.convert_to_ipd',
  'consultation.record_vitals',
  'consultation.addendum',
  'consultation.print_rx',
  'admission.override_fee',
  'discharge.print_summary'
)
ON DUPLICATE KEY UPDATE `skip_approval` = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- Migration Complete!
-- =============================================================================
