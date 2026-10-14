-- ==============================================================================
-- Neha Hospitals HRMS - Control Plane Installation Tokens & Audit Logs Schema
-- ==============================================================================

USE control_plane_db;

-- 1. Installation & Registration Tokens
CREATE TABLE IF NOT EXISTS installation_tokens (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id INT UNSIGNED NOT NULL,
    branch_id INT UNSIGNED NULL,
    token VARCHAR(64) NOT NULL,
    token_type ENUM('CONNECTOR_PAIRING', 'CUSTOMER_HRMS_ACTIVATION') NOT NULL DEFAULT 'CONNECTOR_PAIRING',
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE KEY uk_install_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Control Plane Audit Log
CREATE TABLE IF NOT EXISTS control_plane_audit_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    super_admin_id INT UNSIGNED NULL,
    organization_id INT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    details JSON NULL,
    ip_address VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_org (organization_id),
    INDEX idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
