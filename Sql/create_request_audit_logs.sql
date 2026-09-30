-- ─── HTTP REQUEST AUDIT LOGS TABLE ───────────────────────────────────────────
-- Captures metadata for every HTTP request (endpoint, user, IP, device, status, duration).
-- Strictly omits request headers and request/response body data.

CREATE TABLE IF NOT EXISTS `request_audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NULL,
  `username` VARCHAR(100) NULL,
  `role_name` VARCHAR(100) NULL,
  `method` VARCHAR(10) NOT NULL,
  `endpoint` VARCHAR(500) NOT NULL,
  `ip_address` VARCHAR(64) NOT NULL,
  `device_info` VARCHAR(255) NULL,
  `user_agent` VARCHAR(500) NULL,
  `status_code` SMALLINT NOT NULL,
  `response_time_ms` INT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_req_audit_created` (`created_at`),
  KEY `idx_req_audit_user` (`user_id`),
  KEY `idx_req_audit_ip` (`ip_address`),
  KEY `idx_req_audit_status` (`status_code`),
  KEY `idx_req_audit_method` (`method`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
