-- ============================================================================
-- NEHA HOSPITALS MANAGEMENT SYSTEM - DATABASE MIGRATION PATCH
-- Date: 2026-10-13
-- Description:
--   1. Create `employee_photos` table for standardized employee portrait photos
--      (normalized 1:1 relation to avoid MySQL InnoDB 8126-byte row size limit).
--   2. Create `doctor_voiceprints` table for Ambient AI Scribe doctor acoustic
--      voice enrollment and speaker verification.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. Table: employee_photos
-- Stores employee profile photos (uploaded or webcam captured in standard 1:1 size)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `employee_photos` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` BIGINT UNSIGNED NOT NULL,
  `photo_path` VARCHAR(500) NOT NULL COMMENT 'Relative or absolute URL path to employee photo',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_employee_photo` (`employee_id`),
  CONSTRAINT `fk_emp_photo_employee`
    FOREIGN KEY (`employee_id`)
    REFERENCES `employees` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Standardized employee photographs for badges, profile, and Excel exports';

-- ----------------------------------------------------------------------------
-- 2. Table: doctor_voiceprints
-- Stores doctor voice embeddings for Ambient AI Scribe consultation diarization
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `doctor_voiceprints` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `doctor_id` BIGINT UNSIGNED NOT NULL,
  `embedding_vector` JSON NOT NULL COMMENT 'Serialized speaker embedding vector array',
  `audio_duration_seconds` DECIMAL(5, 2) DEFAULT NULL COMMENT 'Duration of enrolled acoustic sample in seconds',
  `sample_rate` INT DEFAULT NULL COMMENT 'Audio sample rate in Hz (e.g., 16000)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_doctor_voiceprint` (`doctor_id`),
  CONSTRAINT `fk_doc_vp_doctor`
    FOREIGN KEY (`doctor_id`)
    REFERENCES `employees` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Doctor acoustic voiceprint profiles for AI speech isolation';

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- Verification Queries:
-- SELECT * FROM employee_photos LIMIT 10;
-- SELECT * FROM doctor_voiceprints LIMIT 10;
-- ============================================================================
