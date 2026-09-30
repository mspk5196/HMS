-- ============================================================================================
-- SQL Script: Synchronize Roles with Department Staff Roles & Map Users
-- ============================================================================================

-- 1. Free conflicting role names and clear unlinked legacy staff_role associations
UPDATE roles
SET name = CONCAT(name, ' (Legacy ', id, ')'), staff_role_id = NULL
WHERE id NOT IN (90200, 90201, 150200, 150201, 90203, 150203, 150204, 150205, 150206, 1);

-- 2. Update 9 active department roles to match staff_roles
UPDATE roles SET name = 'Doctor / Consultant', staff_role_id = 1, priority = 2 WHERE id = 90200;
UPDATE roles SET name = 'Admin Officer', staff_role_id = 2, priority = 3 WHERE id = 90201;
UPDATE roles SET name = 'Staff Nurse', staff_role_id = 3, priority = 4 WHERE id = 150200;
UPDATE roles SET name = 'Nurse Trainee', staff_role_id = 4, priority = 5 WHERE id = 150201;
UPDATE roles SET name = 'Pharmacist', staff_role_id = 5, priority = 6 WHERE id = 90203;
UPDATE roles SET name = 'Lab Technician', staff_role_id = 6, priority = 7 WHERE id = 150203;
UPDATE roles SET name = 'Radiographer / Scan Tech', staff_role_id = 7, priority = 8 WHERE id = 150204;
UPDATE roles SET name = 'Security Guard', staff_role_id = 8, priority = 9 WHERE id = 150205;
UPDATE roles SET name = 'Housekeeping Staff', staff_role_id = 9, priority = 10 WHERE id = 150206;

-- 3. Update all staff logins to map directly to their employee's designation role
UPDATE users u
JOIN employees e ON e.id = u.employee_id
JOIN roles r ON r.staff_role_id = e.designation_id
SET u.role_id = r.id
WHERE u.username != 'admin';

-- 4. Ensure admin account remains Administrator (Role ID 1)
UPDATE users SET role_id = 1 WHERE username = 'admin' OR id = 1;
