-- ==============================================================================
-- Neha Hospitals HRMS - Tenant Database Multi-Branch Migration
-- Adds branch support and branch_id columns to tenant database (nehahospitals)
-- ==============================================================================

USE nehahospitals;

-- 1. Create branches table in tenant database
CREATE TABLE IF NOT EXISTS branches (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    address TEXT NULL,
    phone VARCHAR(50) NULL,
    email VARCHAR(100) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_branch_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Seed default primary branch if not present
INSERT IGNORE INTO branches (id, name, code, address, is_active)
VALUES (1, 'Main Hospital Facility', 'MAIN', 'Default Hospital Facility', TRUE);

-- 3. Add branch_id column to core entities safely
-- First checks if table exists in information_schema.TABLES, then checks if column exists in information_schema.COLUMNS.
-- This ensures zero 1146 errors even if optional tables are not yet created.
DELIMITER $$

DROP PROCEDURE IF EXISTS AddBranchIdColumnSafe$$
CREATE PROCEDURE AddBranchIdColumnSafe(
    IN target_table VARCHAR(64),
    IN col_definition VARCHAR(255)
)
BEGIN
    DECLARE table_exists INT DEFAULT 0;
    DECLARE col_count INT DEFAULT 0;

    -- Step A: Check if table exists
    SELECT COUNT(*) INTO table_exists
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = target_table;

    -- Step B: If table exists, check if branch_id column exists
    IF table_exists > 0 THEN
        SELECT COUNT(*) INTO col_count 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = target_table 
          AND COLUMN_NAME = 'branch_id';
          
        -- Step C: Add column only if missing
        IF col_count = 0 THEN
            SET @sql_stmt = CONCAT('ALTER TABLE `', target_table, '` ADD COLUMN `branch_id` ', col_definition);
            PREPARE stmt FROM @sql_stmt;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
    END IF;
END$$

DELIMITER ;

-- Apply branch_id across core tables safely
CALL AddBranchIdColumnSafe('employees', 'INT UNSIGNED DEFAULT 1');
CALL AddBranchIdColumnSafe('attendance_raw_punches', 'INT UNSIGNED DEFAULT 1');
CALL AddBranchIdColumnSafe('attendance_daily_summary', 'INT UNSIGNED DEFAULT 1');
CALL AddBranchIdColumnSafe('biometric_devices', 'INT UNSIGNED DEFAULT 1');
CALL AddBranchIdColumnSafe('roster_entries', 'INT UNSIGNED DEFAULT 1');
CALL AddBranchIdColumnSafe('leave_requests', 'INT UNSIGNED DEFAULT 1');
CALL AddBranchIdColumnSafe('payroll_runs', 'INT UNSIGNED NULL');

DROP PROCEDURE IF EXISTS AddBranchIdColumnSafe;
