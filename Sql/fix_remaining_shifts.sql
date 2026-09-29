-- ============================================================================
-- NEHA HOSPITALS — FIX REMAINING / UNASSIGNED EMPLOYEE SHIFTS
-- Target: Laboratory (11 unassigned), Radiology & Scan, and any NULL shifts
-- ============================================================================

-- 1. Update Laboratory Department (24x7 Rotational Roster -> day_and_night)
UPDATE `employees`
SET `shift_category` = 'day_and_night',
    `custom_shift_start` = NULL,
    `custom_shift_end` = NULL
WHERE `department_id` = 6 
   OR `department_id` IN (SELECT `id` FROM `departments` WHERE `name` IN ('Laboratory', 'Lab'));

-- 2. Update Radiology & Scan Department (Fixed Daytime -> day)
UPDATE `employees`
SET `shift_category` = 'day',
    `custom_shift_start` = NULL,
    `custom_shift_end` = NULL
WHERE `department_id` = 7
   OR `department_id` IN (SELECT `id` FROM `departments` WHERE `name` IN ('Radiology & Scan', 'Radiology-scan', 'Radiology', 'Scan'));

-- 3. Set Specific Custom Shift for Radiology staff (Emp Code: 76 -> General Shift: 10:00 AM - 07:00 PM)
UPDATE `employees` 
SET `shift_category` = 'general', 
    `custom_shift_start` = '10:00:00', 
    `custom_shift_end` = '19:00:00' 
WHERE `employee_code` = '76';

-- 4. Safety Fallback: Assign any remaining NULL shifts to 'day'
UPDATE `employees`
SET `shift_category` = 'day',
    `custom_shift_start` = NULL,
    `custom_shift_end` = NULL
WHERE `shift_category` IS NULL;

-- 5. Verification Query:
SELECT `shift_category`, COUNT(*) AS total_employees 
FROM `employees` 
GROUP BY `shift_category`;
