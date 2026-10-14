-- ==============================================================================
-- Neha Hospitals HRMS - Central Control Plane Database Schema
-- Database: control_plane_db
-- Character Set: utf8mb4 / Collation: utf8mb4_unicode_ci
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS control_plane_db 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE control_plane_db;

-- 1. Organizations (Tenants)
CREATE TABLE IF NOT EXISTS organizations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL,                           -- e.g. 'NEHA', 'APOLLO'
    domain VARCHAR(255) NOT NULL,                        -- e.g. 'neha.mspkapps.in', 'neha.tylo.co.in'
    db_host VARCHAR(200) NOT NULL DEFAULT 'localhost',
    db_port INT UNSIGNED NOT NULL DEFAULT 3306,
    db_name VARCHAR(100) NOT NULL,                      -- e.g. 'nehahospitals', 'apollo_db'
    db_user VARCHAR(100) NOT NULL DEFAULT 'root',
    db_password VARCHAR(255) NOT NULL DEFAULT '',
    deployment_type ENUM('PLATFORM_HOSTED', 'CUSTOMER_HOSTED') NOT NULL DEFAULT 'PLATFORM_HOSTED',
    ai_mode ENUM('PLATFORM_SHARED', 'CUSTOMER_LOCAL', 'DISABLED') NOT NULL DEFAULT 'PLATFORM_SHARED',
    ai_service_url VARCHAR(255) NULL,                   -- Overrides default AI URL for customer-hosted local AI sidecars
    status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_org_code (code),
    UNIQUE KEY uk_org_domain (domain),
    UNIQUE KEY uk_org_db_name (db_name)
) ENGINE=InnoDB;

-- 2. Branches (Physical facilities per organization)
CREATE TABLE IF NOT EXISTS branches (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id INT UNSIGNED NOT NULL,
    name VARCHAR(200) NOT NULL,                         -- e.g. 'Main Hospital Facility', 'Erode Branch'
    code VARCHAR(50) NOT NULL,                          -- e.g. 'MAIN', 'ERD'
    city VARCHAR(100) NULL,
    state VARCHAR(100) NULL,
    address TEXT NULL,
    phone VARCHAR(50) NULL,
    email VARCHAR(100) NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE KEY uk_org_branch_code (organization_id, code)
) ENGINE=InnoDB;

-- 3. Biometric Connectors (Local Edge Gateways)
CREATE TABLE IF NOT EXISTS biometric_connectors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id INT UNSIGNED NOT NULL,
    branch_id INT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,                         -- e.g. 'Main Entrance Edge Gateway'
    connector_key VARCHAR(128) NOT NULL,                -- Secret key passed in x-api-key / X-Connector-Key
    public_url VARCHAR(255) NULL,                       -- e.g. 'https://neha-bio.tylo.co.in'
    ip_address VARCHAR(50) NULL,
    last_heartbeat TIMESTAMP NULL,
    sync_status ENUM('online', 'offline', 'error') NOT NULL DEFAULT 'offline',
    version VARCHAR(30) NOT NULL DEFAULT '1.0.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    UNIQUE KEY uk_connector_key (connector_key)
) ENGINE=InnoDB;

-- 4. Biometric Devices (Hardware Terminals mapped to connectors & branches)
CREATE TABLE IF NOT EXISTS biometric_devices (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id INT UNSIGNED NOT NULL,
    branch_id INT UNSIGNED NOT NULL,
    connector_id INT UNSIGNED NOT NULL,
    device_name VARCHAR(150) NOT NULL,
    device_ip VARCHAR(50) NOT NULL,
    device_port INT UNSIGNED NOT NULL DEFAULT 4370,
    comm_key VARCHAR(50) NOT NULL DEFAULT '0',
    location VARCHAR(150) NULL,
    device_identifier VARCHAR(100) NULL,
    status ENUM('online', 'offline', 'error') NOT NULL DEFAULT 'offline',
    last_synced_at TIMESTAMP NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (connector_id) REFERENCES biometric_connectors(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Deployments
CREATE TABLE IF NOT EXISTS deployments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id INT UNSIGNED NOT NULL,
    deployment_type ENUM('PLATFORM_HOSTED', 'CUSTOMER_HOSTED') NOT NULL,
    app_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    server_ip VARCHAR(50) NULL,
    last_health_ping TIMESTAMP NULL,
    status ENUM('healthy', 'degraded', 'offline') NOT NULL DEFAULT 'healthy',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Licenses & Subscriptions
CREATE TABLE IF NOT EXISTS licenses (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id INT UNSIGNED NOT NULL,
    plan_name VARCHAR(100) NOT NULL DEFAULT 'Enterprise',
    max_employees INT UNSIGNED NOT NULL DEFAULT 500,
    max_branches INT UNSIGNED NOT NULL DEFAULT 10,
    ai_features_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at DATE NULL,
    status ENUM('active', 'expired', 'trial', 'cancelled') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Super Admins (Control Plane Super Users)
CREATE TABLE IF NOT EXISTS super_admins (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('SUPER_ADMIN', 'SUPPORT') NOT NULL DEFAULT 'SUPER_ADMIN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_super_admin_email (email)
) ENGINE=InnoDB;
