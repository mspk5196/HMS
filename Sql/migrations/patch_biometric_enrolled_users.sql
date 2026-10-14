-- ==============================================================================
-- Migration Patch: Add biometric_enrolled_users table
-- Stores staff registrations (fingerprint, face, RFID card, PIN) from biometric
-- terminals and Windows enrollment systems directly into the Neha Hospital database.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS `biometric_enrolled_users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `enroll_code` varchar(50) NOT NULL,
  `name` varchar(150) NULL DEFAULT NULL,
  `device_id` varchar(100) NULL DEFAULT NULL,
  `card_number` varchar(50) NULL DEFAULT NULL,
  `privilege` varchar(20) NOT NULL DEFAULT 'user',
  `has_fingerprint` tinyint(1) NOT NULL DEFAULT 0,
  `has_face` tinyint(1) NOT NULL DEFAULT 0,
  `has_password` tinyint(1) NOT NULL DEFAULT 0,
  `template_count` int unsigned NOT NULL DEFAULT 0,
  `registered_at` datetime NULL DEFAULT NULL,
  `is_linked` tinyint(1) NOT NULL DEFAULT 0,
  `linked_employee_id` bigint unsigned NULL DEFAULT NULL,
  `raw_details` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_enroll_code` (`enroll_code`),
  KEY `idx_is_linked` (`is_linked`),
  KEY `idx_linked_employee_id` (`linked_employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Pre-populate and link with existing employees
INSERT INTO `biometric_enrolled_users` (`enroll_code`, `name`, `device_id`, `has_fingerprint`, `has_face`, `is_linked`, `linked_employee_id`, `registered_at`)
SELECT 
  e.employee_code,
  e.full_name,
  'Existing Staff Registry',
  1,
  1,
  1,
  e.id,
  e.created_at
FROM `employees` e
WHERE e.employee_code IS NOT NULL AND e.employee_code != ''
ON DUPLICATE KEY UPDATE 
  `name` = VALUES(`name`),
  `is_linked` = 1,
  `linked_employee_id` = VALUES(`linked_employee_id`);
