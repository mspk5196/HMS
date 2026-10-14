-- ============================================================
-- Neha Hospitals — AI Features MySQL Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS `roster_rule_templates` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `department_id` BIGINT UNSIGNED NOT NULL,
  `staff_role_id` BIGINT UNSIGNED NULL,
  `name` VARCHAR(100) NOT NULL,
  `rules` JSON NOT NULL,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `ix_roster_rules_dept` (`department_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `roster_ai_generations` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `department_id` BIGINT UNSIGNED NOT NULL,
  `staff_role_id` BIGINT UNSIGNED NULL,
  `from_date` DATE NOT NULL,
  `to_date` DATE NOT NULL,
  `rule_snapshot` JSON NOT NULL,
  `proposed_roster` JSON NOT NULL,
  `violations` JSON NULL,
  `metrics` JSON NULL,
  `score` SMALLINT NULL,
  `status` ENUM('proposed', 'reviewed', 'approved', 'rejected') NOT NULL DEFAULT 'proposed',
  `reviewed_by` BIGINT UNSIGNED NULL,
  `approved_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `ix_roster_ai_dept` (`department_id`, `from_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ai_suggestions` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `module` VARCHAR(50) NOT NULL,
  `entity_type` VARCHAR(50) NULL,
  `entity_id` BIGINT UNSIGNED NULL,
  `suggestion` TEXT NOT NULL,
  `metadata` JSON NULL,
  `status` ENUM('pending', 'applied', 'dismissed') NOT NULL DEFAULT 'pending',
  `reviewed_by` BIGINT UNSIGNED NULL,
  `reviewed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `ix_ai_sug_module` (`module`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `clinical_voice_transcripts` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `doctor_id` BIGINT UNSIGNED NOT NULL,
  `patient_id` BIGINT UNSIGNED NULL,
  `encounter_type` VARCHAR(50) NOT NULL,
  `encounter_id` BIGINT UNSIGNED NULL,
  `raw_transcript` TEXT NOT NULL,
  `structured_data` JSON NULL,
  `audio_duration_secs` DECIMAL(6,2) NULL,
  `model_used` VARCHAR(50) NOT NULL DEFAULT 'faster-whisper-small-int8',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `ix_voice_doctor` (`doctor_id`),
  INDEX `ix_voice_patient` (`patient_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
