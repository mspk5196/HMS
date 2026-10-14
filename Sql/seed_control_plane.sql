-- ==============================================================================
-- Neha Hospitals HRMS - Seed Default Tenant & Connector in Control Plane
-- ==============================================================================

USE control_plane_db;

-- 1. Seed Neha Hospitals Tenant (pointing to the existing 'nehahospitals' MySQL database)
INSERT INTO organizations (
    id, name, code, domain, db_host, db_port, db_name, db_user, db_password, 
    deployment_type, ai_mode, ai_service_url, status
) VALUES (
    1,
    'Neha Hospitals',
    'NEHA',
    'neha.mspkapps.in',
    'localhost',
    3306,
    'nehahospitals',
    'root',
    '',
    'PLATFORM_HOSTED',
    'PLATFORM_SHARED',
    NULL,
    'active'
) ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    domain = VALUES(domain),
    db_name = VALUES(db_name),
    status = VALUES(status);

-- 2. Seed Default Main Hospital Branch
INSERT INTO branches (
    id, organization_id, name, code, city, timezone, status
) VALUES (
    1,
    1,
    'Neha Hospitals - Main Hospital Facility',
    'MAIN',
    'Erode',
    'Asia/Kolkata',
    'active'
) ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    status = VALUES(status);

-- 3. Seed Biometric Connector with existing live CONNECTOR_API_KEY (Ensures ZERO disruption)
INSERT INTO biometric_connectors (
    id, organization_id, branch_id, name, connector_key, public_url, sync_status, version
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
    connector_key = VALUES(connector_key),
    public_url = VALUES(public_url),
    sync_status = VALUES(sync_status);

-- 4. Seed Super Admin User (password: Admin@12345 bcrypt hash)
INSERT INTO super_admins (
    id, name, email, password_hash, role
) VALUES (
    1,
    'Platform Super Administrator',
    'admin@mspkapps.in',
    '$2b$10$Qv3j.8B7YrbF7TMwC9WN3.X7qrQ1zjSx/UX7mOhTytT8ff8Y2qgTe',
    'SUPER_ADMIN'
) ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    email = VALUES(email),
    password_hash = VALUES(password_hash);
