-- ==============================================================================
-- Migration Patch: Add biometric_devices table for local eSSL / ZKTeco integration
-- ==============================================================================

CREATE TABLE IF NOT EXISTS `biometric_devices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `device_type` enum('essl_standalone', 'essl_adms_push', 'zkteco') NOT NULL DEFAULT 'essl_standalone',
  `ip_address` varchar(50) NOT NULL,
  `port` int unsigned NOT NULL DEFAULT 4370,
  `comm_key` varchar(50) NULL DEFAULT '0',
  `serial_number` varchar(100) NULL DEFAULT NULL,
  `location` varchar(100) NULL DEFAULT 'Main Entrance',
  `status` enum('online', 'offline', 'unreachable') NOT NULL DEFAULT 'offline',
  `last_sync_at` datetime NULL DEFAULT NULL,
  `last_sync_count` int unsigned NOT NULL DEFAULT 0,
  `auto_sync_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `sync_interval_mins` int unsigned NOT NULL DEFAULT 15,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Default eSSL Biometric Device Seed (Sample Entry)
INSERT INTO `biometric_devices` (`id`, `name`, `device_type`, `ip_address`, `port`, `comm_key`, `location`, `status`, `auto_sync_enabled`)
VALUES (1, 'eSSL Main Entrance', 'essl_standalone', '192.168.1.201', 4370, '0', 'Main Entrance Reception', 'offline', 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
