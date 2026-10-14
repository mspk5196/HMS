-- ============================================================================================
-- SQL Script: Fix Users Authentication, Role IDs, and Standardize Usernames
-- Standard format: <lowercase_name>-<emp_id> (no special characters or dots)
-- ============================================================================================

-- 1. Ensure admin has Administrator role
UPDATE users SET role_id = 1 WHERE username = 'admin' OR id = 1;

-- 2. Map Doctor designation to Doctor role
UPDATE users u
JOIN employees e ON e.id = u.employee_id
JOIN staff_roles sr ON sr.id = e.designation_id
SET u.role_id = 90200
WHERE (sr.is_doctor = 1 OR LOWER(sr.name) LIKE '%doctor%' OR LOWER(sr.name) LIKE '%consultant%')
  AND u.username != 'admin';

-- 3. Map Staff Nurse designation to Head Nurse / Nurse role
UPDATE users u
JOIN employees e ON e.id = u.employee_id
JOIN staff_roles sr ON sr.id = e.designation_id
SET u.role_id = 150200
WHERE LOWER(sr.name) LIKE '%staff nurse%' AND u.username != 'admin';

-- 4. Map Nurse Trainee designation to Nurse Trainee role
UPDATE users u
JOIN employees e ON e.id = u.employee_id
JOIN staff_roles sr ON sr.id = e.designation_id
SET u.role_id = 150201
WHERE LOWER(sr.name) LIKE '%nurse trainee%' AND u.username != 'admin';

-- 5. Map Pharmacist designation to Chief Pharmacist role
UPDATE users u
JOIN employees e ON e.id = u.employee_id
JOIN staff_roles sr ON sr.id = e.designation_id
SET u.role_id = 150203
WHERE LOWER(sr.name) LIKE '%pharmac%' AND u.username != 'admin';

-- 6. Map Admin Officer to Receptionist role
UPDATE users u
JOIN employees e ON e.id = u.employee_id
JOIN staff_roles sr ON sr.id = e.designation_id
SET u.role_id = 90201
WHERE (LOWER(sr.name) LIKE '%admin%' OR LOWER(sr.name) LIKE '%reception%') AND u.username != 'admin';

-- 7. Map Security Guard to Security Guard role
UPDATE users u
JOIN employees e ON e.id = u.employee_id
JOIN staff_roles sr ON sr.id = e.designation_id
SET u.role_id = 150225
WHERE LOWER(sr.name) LIKE '%security%' AND u.username != 'admin';

-- 8. Map Housekeeping to House Keeping role
UPDATE users u
JOIN employees e ON e.id = u.employee_id
JOIN staff_roles sr ON sr.id = e.designation_id
SET u.role_id = 150222
WHERE LOWER(sr.name) LIKE '%house%keeping%' AND u.username != 'admin';

-- 9. Any remaining users without a matching role default to Staff baseline role (120200)
UPDATE users SET role_id = 120200 WHERE (role_id IS NULL OR role_id NOT IN (SELECT id FROM roles)) AND username != 'admin';
