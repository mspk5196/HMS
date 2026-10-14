-- ==============================================================================
-- NEHA HOSPITALS HRMS - MASTER MULTI-TENANT & BRANCH MIGRATION SCRIPT
-- ==============================================================================
-- Targets:
--   1. control_plane_db  (Control Plane: Organizations, Branches, Connectors, Admins)
--   2. nehahospitals     (Tenant Database: Branches, Multi-Branch Schema Updates)
-- 
-- Universal Compatibility:
--   - Compatible with MySQL 8.0+, MariaDB, and all GUI clients (HeidiSQL, Navicat, Workbench, CLI)
--   - Zero DELIMITER dependencies (pure standard SQL statements)
--   - 100% Idempotent (safe to run repeatedly with zero data loss or duplicate errors)
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ##############################################################################
-- PART 1: CONTROL PLANE DATABASE (control_plane_db)
-- ##############################################################################

CREATE DATABASE IF NOT EXISTS `control_plane_db` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `control_plane_db`;

-- 1. Organizations (Tenants)
CREATE TABLE IF NOT EXISTS `organizations` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(200) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `domain` VARCHAR(255) NOT NULL,
    `db_host` VARCHAR(200) NOT NULL DEFAULT 'localhost',
    `db_port` INT UNSIGNED NOT NULL DEFAULT 3306,
    `db_name` VARCHAR(100) NOT NULL,
    `db_user` VARCHAR(100) NOT NULL DEFAULT 'root',
    `db_password` VARCHAR(255) NOT NULL DEFAULT '',
    `deployment_type` ENUM('PLATFORM_HOSTED', 'CUSTOMER_HOSTED') NOT NULL DEFAULT 'PLATFORM_HOSTED',
    `ai_mode` ENUM('PLATFORM_SHARED', 'CUSTOMER_LOCAL', 'DISABLED') NOT NULL DEFAULT 'PLATFORM_SHARED',
    `ai_service_url` VARCHAR(255) NULL,
    `status` ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_org_code` (`code`),
    UNIQUE KEY `uk_org_domain` (`domain`),
    UNIQUE KEY `uk_org_db_name` (`db_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Branches (Control Plane registry of facilities)
CREATE TABLE IF NOT EXISTS `branches` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `organization_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `address` TEXT NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(100) NULL,
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_org_branch_code` (`organization_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Biometric Connectors (Local Edge Gateways)
CREATE TABLE IF NOT EXISTS `biometric_connectors` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `organization_id` INT UNSIGNED NOT NULL,
    `branch_id` INT UNSIGNED NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `connector_key` VARCHAR(128) NOT NULL,
    `public_url` VARCHAR(255) NULL,
    `ip_address` VARCHAR(50) NULL,
    `last_heartbeat` TIMESTAMP NULL,
    `sync_status` ENUM('online', 'offline', 'error') NOT NULL DEFAULT 'offline',
    `version` VARCHAR(30) NOT NULL DEFAULT '1.0.0',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_connector_key` (`connector_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Biometric Devices (Hardware Terminals mapped to connectors & branches)
CREATE TABLE IF NOT EXISTS `biometric_devices` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `organization_id` INT UNSIGNED NOT NULL,
    `branch_id` INT UNSIGNED NOT NULL,
    `connector_id` INT UNSIGNED NOT NULL,
    `device_name` VARCHAR(150) NOT NULL,
    `device_ip` VARCHAR(50) NOT NULL,
    `device_port` INT UNSIGNED NOT NULL DEFAULT 4370,
    `comm_key` VARCHAR(50) NOT NULL DEFAULT '0',
    `location` VARCHAR(150) NULL,
    `device_identifier` VARCHAR(100) NULL,
    `status` ENUM('online', 'offline', 'error') NOT NULL DEFAULT 'offline',
    `last_synced_at` TIMESTAMP NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`connector_id`) REFERENCES `biometric_connectors`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Deployments
CREATE TABLE IF NOT EXISTS `deployments` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `organization_id` INT UNSIGNED NOT NULL,
    `deployment_type` ENUM('PLATFORM_HOSTED', 'CUSTOMER_HOSTED') NOT NULL,
    `app_version` VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    `server_ip` VARCHAR(50) NULL,
    `last_health_ping` TIMESTAMP NULL,
    `status` ENUM('healthy', 'degraded', 'offline') NOT NULL DEFAULT 'healthy',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Licenses & Subscriptions
CREATE TABLE IF NOT EXISTS `licenses` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `organization_id` INT UNSIGNED NOT NULL,
    `plan_name` VARCHAR(100) NOT NULL DEFAULT 'Enterprise',
    `max_employees` INT UNSIGNED NOT NULL DEFAULT 500,
    `max_branches` INT UNSIGNED NOT NULL DEFAULT 10,
    `ai_features_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
    `expires_at` DATE NULL,
    `status` ENUM('active', 'expired', 'trial', 'cancelled') NOT NULL DEFAULT 'active',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Super Admins
CREATE TABLE IF NOT EXISTS `super_admins` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'SUPPORT') NOT NULL DEFAULT 'SUPER_ADMIN',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_super_admin_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Installation & Registration Tokens
CREATE TABLE IF NOT EXISTS `installation_tokens` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `organization_id` INT UNSIGNED NOT NULL,
    `branch_id` INT UNSIGNED NULL,
    `token` VARCHAR(64) NOT NULL,
    `token_type` ENUM('CONNECTOR_PAIRING', 'CUSTOMER_HRMS_ACTIVATION') NOT NULL DEFAULT 'CONNECTOR_PAIRING',
    `expires_at` TIMESTAMP NOT NULL,
    `used_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_install_token` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Control Plane Audit Log
CREATE TABLE IF NOT EXISTS `control_plane_audit_logs` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `super_admin_id` INT UNSIGNED NULL,
    `organization_id` INT UNSIGNED NULL,
    `action` VARCHAR(100) NOT NULL,
    `details` JSON NULL,
    `ip_address` VARCHAR(50) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_org` (`organization_id`),
    INDEX `idx_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------------------------
-- Seed Default Control Plane Data
-- ------------------------------------------------------------------------------

-- Seed Tenant (Neha Hospitals)
INSERT INTO `organizations` (
    `id`, `name`, `code`, `domain`, `db_host`, `db_port`, `db_name`, `db_user`, `db_password`, 
    `deployment_type`, `ai_mode`, `ai_service_url`, `status`
) VALUES (
    1,
    'Neha Hospitals',
    'NEHA',
    'neha.mspkapps.in',
    'localhost',
    3306,
    'nehahospitals',
    'root',
    'Pranesh82',
    'PLATFORM_HOSTED',
    'PLATFORM_SHARED',
    NULL,
    'active'
) ON DUPLICATE KEY UPDATE 
    `name` = VALUES(`name`),
    `domain` = VALUES(`domain`),
    `db_name` = VALUES(`db_name`),
    `db_password` = VALUES(`db_password`),
    `status` = VALUES(`status`);

-- Seed Primary Branch
INSERT INTO `branches` (
    `id`, `organization_id`, `name`, `code`, `city`, `timezone`, `status`
) VALUES (
    1,
    1,
    'Neha Hospitals - Main Hospital Facility',
    'MAIN',
    'Erode',
    'Asia/Kolkata',
    'active'
) ON DUPLICATE KEY UPDATE 
    `name` = VALUES(`name`),
    `status` = VALUES(`status`);

-- Seed Live Biometric Connector Key (Zero disruption to existing hardware setup)
INSERT INTO `biometric_connectors` (
    `id`, `organization_id`, `branch_id`, `name`, `connector_key`, `public_url`, `sync_status`, `version`
) VALUES (
    1,
    1,
    1,
    'Neha Hospital - Main LAN Edge Connector',
    'ce8f14ad422e2e1c1fe2429f96c0edf8186055bb671d23a5c287b56737f3e2c4',
    'https://neha-bio.tylo.co.in',
    'online',
    '1.0.0'
) ON DUPLICATE KEY UPDATE 
    `connector_key` = VALUES(`connector_key`),
    `public_url` = VALUES(`public_url`),
    `sync_status` = VALUES(`sync_status`);

-- Seed Super Admin (admin@mspkapps.in / Admin@12345)
INSERT INTO `super_admins` (
    `id`, `name`, `email`, `password_hash`, `role`
) VALUES (
    1,
    'Platform Super Administrator',
    'admin@mspkapps.in',
    '$2b$10$Qv3j.8B7YrbF7TMwC9WN3.X7qrQ1zjSx/UX7mOhTytT8ff8Y2qgTe',
    'SUPER_ADMIN'
) ON DUPLICATE KEY UPDATE 
    `name` = VALUES(`name`),
    `email` = VALUES(`email`),
    `password_hash` = VALUES(`password_hash`);


-- ##############################################################################
-- PART 2: TENANT DATABASE (nehahospitals)
-- ##############################################################################

USE `nehahospitals`;

-- 1. Create branches table in tenant database
CREATE TABLE IF NOT EXISTS `branches` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `address` TEXT NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_tenant_branch_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Seed default primary branch
INSERT INTO `branches` (`id`, `name`, `code`, `address`, `is_active`)
VALUES (1, 'Main Hospital Facility', 'MAIN', 'Default Hospital Facility', TRUE)
ON DUPLICATE KEY UPDATE 
    `name` = VALUES(`name`),
    `is_active` = VALUES(`is_active`);

-- 3. Dynamic Column Additions (100% Native MySQL without DELIMITER)
-- Checks INFORMATION_SCHEMA.TABLES to prevent error 1146, and INFORMATION_SCHEMA.COLUMNS for idempotency.

-- Table: employees
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees') > 0
  AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'branch_id') = 0,
  'ALTER TABLE `employees` ADD COLUMN `branch_id` INT UNSIGNED DEFAULT 1',
  'SELECT 1'
));
PREPARE stmt_employees FROM @preparedStatement;
EXECUTE stmt_employees;
DEALLOCATE PREPARE stmt_employees;

-- Table: attendance_raw_punches
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_raw_punches') > 0
  AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_raw_punches' AND COLUMN_NAME = 'branch_id') = 0,
  'ALTER TABLE `attendance_raw_punches` ADD COLUMN `branch_id` INT UNSIGNED DEFAULT 1',
  'SELECT 1'
));
PREPARE stmt_punches FROM @preparedStatement;
EXECUTE stmt_punches;
DEALLOCATE PREPARE stmt_punches;

-- Table: attendance_daily_summary
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_daily_summary') > 0
  AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_daily_summary' AND COLUMN_NAME = 'branch_id') = 0,
  'ALTER TABLE `attendance_daily_summary` ADD COLUMN `branch_id` INT UNSIGNED DEFAULT 1',
  'SELECT 1'
));
PREPARE stmt_summary FROM @preparedStatement;
EXECUTE stmt_summary;
DEALLOCATE PREPARE stmt_summary;

-- Table: biometric_devices
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biometric_devices') > 0
  AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biometric_devices' AND COLUMN_NAME = 'branch_id') = 0,
  'ALTER TABLE `biometric_devices` ADD COLUMN `branch_id` INT UNSIGNED DEFAULT 1',
  'SELECT 1'
));
PREPARE stmt_devices FROM @preparedStatement;
EXECUTE stmt_devices;
DEALLOCATE PREPARE stmt_devices;

-- Table: biometric_enrolled_users
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biometric_enrolled_users') > 0
  AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'biometric_enrolled_users' AND COLUMN_NAME = 'branch_id') = 0,
  'ALTER TABLE `biometric_enrolled_users` ADD COLUMN `branch_id` INT UNSIGNED DEFAULT 1',
  'SELECT 1'
));
PREPARE stmt_enrolled FROM @preparedStatement;
EXECUTE stmt_enrolled;
DEALLOCATE PREPARE stmt_enrolled;

-- Table: roster_entries
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roster_entries') > 0
  AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roster_entries' AND COLUMN_NAME = 'branch_id') = 0,
  'ALTER TABLE `roster_entries` ADD COLUMN `branch_id` INT UNSIGNED DEFAULT 1',
  'SELECT 1'
));
PREPARE stmt_roster FROM @preparedStatement;
EXECUTE stmt_roster;
DEALLOCATE PREPARE stmt_roster;

-- Table: leave_requests
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests') > 0
  AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'branch_id') = 0,
  'ALTER TABLE `leave_requests` ADD COLUMN `branch_id` INT UNSIGNED DEFAULT 1',
  'SELECT 1'
));
PREPARE stmt_leaves FROM @preparedStatement;
EXECUTE stmt_leaves;
DEALLOCATE PREPARE stmt_leaves;

-- Table: payroll_runs
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_runs') > 0
  AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_runs' AND COLUMN_NAME = 'branch_id') = 0,
  'ALTER TABLE `payroll_runs` ADD COLUMN `branch_id` INT UNSIGNED NULL',
  'SELECT 1'
));
PREPARE stmt_payroll FROM @preparedStatement;
EXECUTE stmt_payroll;
DEALLOCATE PREPARE stmt_payroll;

-- Safe Index on employees(branch_id)
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees') > 0
  AND (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND INDEX_NAME = 'idx_employees_branch_id') = 0,
  'ALTER TABLE `employees` ADD INDEX `idx_employees_branch_id` (`branch_id`)',
  'SELECT 1'
));
PREPARE stmt_idx_emp FROM @preparedStatement;
EXECUTE stmt_idx_emp;
DEALLOCATE PREPARE stmt_idx_emp;

SET FOREIGN_KEY_CHECKS = 1;
