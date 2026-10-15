-- ==============================================================================
-- Neha Hospitals HRMS - Auth Security Enhancements & Login Audit Migration
-- Includes:
-- 1. First-time login mandatory password change (must_change_password)
-- 2. Google OAuth & Password Login toggles (google_login_enabled, password_login_enabled)
-- 3. Google identifier linking (google_id, google_email)
-- 4. Centralized User Login History Audit Table (user_login_history)
-- ==============================================================================

USE nehahospitals;

-- 1. Add Auth & Security Flags to 'users' table
SET @dbname = DATABASE();
SET @tablename = "users";

-- must_change_password
SET @columnname = "must_change_password";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- google_login_enabled
SET @columnname = "google_login_enabled";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE users ADD COLUMN google_login_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER must_change_password;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- password_login_enabled
SET @columnname = "password_login_enabled";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE users ADD COLUMN password_login_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER google_login_enabled;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- google_id
SET @columnname = "google_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL AFTER password_login_enabled;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- google_email
SET @columnname = "google_email";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE users ADD COLUMN google_email VARCHAR(255) NULL AFTER google_id;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Create User Login History Audit Table
CREATE TABLE IF NOT EXISTS user_login_history (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  username VARCHAR(100) NOT NULL,
  employee_name VARCHAR(150) NULL,
  login_method ENUM('PASSWORD', 'GOOGLE') NOT NULL DEFAULT 'PASSWORD',
  ip_address VARCHAR(50) NULL,
  user_agent VARCHAR(255) NULL,
  status ENUM('SUCCESS', 'FAILED') NOT NULL,
  failure_reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_hist_user (user_id),
  INDEX idx_login_hist_created (created_at),
  INDEX idx_login_hist_method (login_method),
  INDEX idx_login_hist_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
