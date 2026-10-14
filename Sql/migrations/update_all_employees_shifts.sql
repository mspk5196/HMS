-- ============================================================================
-- NEHA HOSPITALS — COMPLETE SHIFT MASTER & EMPLOYEE SHIFT CATEGORY MIGRATION
-- Generated based on ESS format 012.xls & nehahospitals_server.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: CONFIGURE MASTER SHIFTS TABLE (Day Shift & Night Shift)
-- ----------------------------------------------------------------------------
UPDATE `shifts`
SET `name` = 'Day Shift',
    `start_time` = '08:30:00',
    `end_time` = '18:30:00',
    `grace_period_minutes` = 10,
    `buffer_minutes` = 30,
    `is_night_shift` = 0,
    `crosses_midnight` = 0,
    `biometric_in_start` = '07:30:00',
    `biometric_in_end` = '08:30:00',
    `biometric_out_start` = '18:30:00',
    `biometric_out_end` = '20:30:00'
WHERE `is_night_shift` = 0 OR `id` = 1;

UPDATE `shifts`
SET `name` = 'Night Shift',
    `start_time` = '20:00:00',
    `end_time` = '08:00:00',
    `grace_period_minutes` = 10,
    `buffer_minutes` = 30,
    `is_night_shift` = 1,
    `crosses_midnight` = 1,
    `biometric_in_start` = '17:30:00',
    `biometric_in_end` = '20:00:00',
    `biometric_out_start` = '08:00:00',
    `biometric_out_end` = '10:00:00'
WHERE `is_night_shift` = 1 OR `id` = 2;

-- ----------------------------------------------------------------------------
-- STEP 2: BULK INITIALIZE DEPARTMENTS TO BASELINE SHIFTS (BY ID AND NAME)
-- ----------------------------------------------------------------------------
-- 24x7 Clinical / Rotational Departments (Medical, Nursing, Nursing Training, Laboratory, Security, House Keeping) -> day_and_night (Duty Roster)
UPDATE `employees`
SET `shift_category` = 'day_and_night',
    `custom_shift_start` = NULL,
    `custom_shift_end` = NULL
WHERE `department_id` IN (1, 3, 4, 6, 8, 9)
   OR `department_id` IN (
     SELECT `id` FROM `departments` 
     WHERE `name` IN ('Medical', 'Nursing', 'Nursing Training', 'Laboratory', 'Lab', 'Security', 'House Keeping')
   );

-- Fixed Daytime Departments (Administration, Pharmacy, Radiology & Scan) -> day
UPDATE `employees`
SET `shift_category` = 'day',
    `custom_shift_start` = NULL,
    `custom_shift_end` = NULL
WHERE `department_id` IN (2, 5, 7)
   OR `department_id` IN (
     SELECT `id` FROM `departments` 
     WHERE `name` IN ('Administration', 'Pharmacy', 'Radiology & Scan', 'Radiology-scan', 'Radiology', 'Scan')
   );

-- Safety fallback: any remaining unclassified records set to 'day'
UPDATE `employees`
SET `shift_category` = 'day',
    `custom_shift_start` = NULL,
    `custom_shift_end` = NULL
WHERE `shift_category` IS NULL;

-- ----------------------------------------------------------------------------
-- STEP 3: PRECISE EMPLOYEE-WISE SHIFT & CUSTOM TIME CONFIGURATIONS
-- ----------------------------------------------------------------------------

-- Department: Medical (6 Roster Doctors)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '17'; -- Rotational Duty Roster (DAY 8.00AM-3.00PM 1.00PM-8.00PM (2.00PM-9.00PM)  NIGHT 8.00PM-8.00AM) (Dr.REVATHI)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '149'; -- Rotational Duty Roster (24x7 Roster) (Dr LAVANYA B)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '183'; -- Rotational Duty Roster (24x7 Roster) (Dr INDHUMATHI K)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '185'; -- Rotational Duty Roster (24x7 Roster) (Dr VIDHYASHREE)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '214'; -- Rotational Duty Roster (24x7 Roster) (Dr.ARULGANGA)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '223'; -- Rotational Duty Roster (24x7 Roster) (Dr ANUMITHASHREE P)

-- Department: Administration (12 Employees)
UPDATE `employees` SET `shift_category` = 'day', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '2'; -- Standard Office Day Shift (9.00-6.00) (DIVYA S)
UPDATE `employees` SET `shift_category` = 'general', `custom_shift_start` = '08:15:00', `custom_shift_end` = '17:15:00' WHERE `employee_code` = '3'; -- Custom timing: 08:15 AM - 05:15 PM (MAHESHWARI P)
UPDATE `employees` SET `shift_category` = 'general', `custom_shift_start` = '09:30:00', `custom_shift_end` = '18:30:00' WHERE `employee_code` = '4'; -- Custom timing: 09:30 AM - 06:30 PM (SENTHILKUMAR S)
UPDATE `employees` SET `shift_category` = 'day', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '5'; -- Standard Office Day Shift (8.30-6.30) (KANDASAMY C)
UPDATE `employees` SET `shift_category` = 'general', `custom_shift_start` = '09:30:00', `custom_shift_end` = '19:30:00' WHERE `employee_code` = '6'; -- Custom timing: 09:30 AM - 07:30 PM (INDHUMATHI R)
UPDATE `employees` SET `shift_category` = 'general', `custom_shift_start` = '10:00:00', `custom_shift_end` = '19:00:00' WHERE `employee_code` = '7'; -- Custom timing: 10:00 AM - 07:00 PM (SONAPRIYA G N)
UPDATE `employees` SET `shift_category` = 'day', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '8'; -- Standard Office Day Shift (9.00-7.00) (MUTHU PRIYA M)
UPDATE `employees` SET `shift_category` = 'day', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '79'; -- Standard Office Day Shift (9.00-7.00) (SWATHI P)
UPDATE `employees` SET `shift_category` = 'general', `custom_shift_start` = '10:00:00', `custom_shift_end` = '19:00:00' WHERE `employee_code` = '81'; -- Custom timing: 10:00 AM - 07:00 PM (VIJAYA KUMAR A)
UPDATE `employees` SET `shift_category` = 'night', `custom_shift_start` = '18:30:00', `custom_shift_end` = '08:30:00' WHERE `employee_code` = '200'; -- Permanent Night Duty: 06:30 PM - 08:30 AM (MARASAMY)
UPDATE `employees` SET `shift_category` = 'general', `custom_shift_start` = '11:00:00', `custom_shift_end` = '21:00:00' WHERE `employee_code` = '202'; -- Custom timing: 11:00 AM - 09:00 PM (THENMOZHI K)
UPDATE `employees` SET `shift_category` = 'day', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '226'; -- Standard Office Day Shift (9.00-7.00) (RAVI S)

-- Department: Laboratory (Laboratory staff on 24x7 Rotational Roster)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '14'; -- Rotational Duty Roster (8.30-6.30) (SWETHA M)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '187'; -- Rotational Duty Roster (8.30-6.30) (MAHALAKSHMI G)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '189'; -- Rotational Duty Roster (8.30-6.30) (SRILAKSHMI P)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '212'; -- Rotational Duty Roster (8.30-6.30) (DHARANI S)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '220'; -- Rotational Duty Roster (8.30-6.30) (SUBASHINI S)

-- Department: Nursing (38 Employees)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '19'; -- Rotational Duty Roster (8.30-6.30) (ANILA P)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '20'; -- Rotational Duty Roster (8.30-6.30) (MEENA M R)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '21'; -- Rotational Duty Roster (9.00-6.30) (SANGEETHA.V.M)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '24'; -- Rotational Duty Roster (9.00-6.00) (GOMATHI P)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '30'; -- Rotational Duty Roster (9.00-6.00) (GOWSALYA S)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '33'; -- Rotational Duty Roster (9.00-6.00) (THILAGAVATHI S)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '39'; -- Rotational Duty Roster (8.30-6.30) (KAVERI K)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '40'; -- Rotational Duty Roster (8.30-6.30) (POORNI R)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '44'; -- Rotational Duty Roster (8.30-6.30) (SUMITHRA M)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '48'; -- Rotational Duty Roster (8.30-6.30) (ANITHA N)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '49'; -- Rotational Duty Roster (8.30-6.30) (AKSHARA R)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '52'; -- Rotational Duty Roster (8.30-6.30) (NEETHU KRISHNA R)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '56'; -- Rotational Duty Roster (8.30-6.30) (SREELAKSHMI S)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '73'; -- Rotational Duty Roster (8.30-6.30) (SATHYA E)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '91'; -- Rotational Duty Roster (9.00-6.00) (NAKESHWARI M)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '107'; -- Rotational Duty Roster (8.30-6.30) (PRIYADHARSHINI.B)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '123'; -- Rotational Duty Roster (8.30-6.30) (KANCHANA A)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '138'; -- Rotational Duty Roster (8.30-6.30) (AMSAL S)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '159'; -- Rotational Duty Roster (8.30-6.30) (NITHYA DEVI S)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '161'; -- Rotational Duty Roster (8.30-6.30) (RATHIKA R)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '165'; -- Rotational Duty Roster (8.30-6.30) (NISHA S)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '167'; -- Rotational Duty Roster (9.00-7.00) (SUSEELA I)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '168'; -- Rotational Duty Roster (9.00-7.00) (SUGANYA V)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '175'; -- Rotational Duty Roster (9.00-7.45) (MENAKA M)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '176'; -- Rotational Duty Roster (8.30-6.30) (SARITHA R)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '177'; -- Rotational Duty Roster (8.30-6.30) (MAYIL R)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '179'; -- Rotational Duty Roster (8.30-6.30) (KAVIPRIYA G)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '182'; -- Rotational Duty Roster (8.30-6.30) (MANJULA P)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '190'; -- Rotational Duty Roster (8.30-6.30) (GAYATHRI S)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '192'; -- Rotational Duty Roster (8.30-6.30) (MARAGATHAM M)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '198'; -- Rotational Duty Roster (9.00-700) (HARIPRIYA P)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '204'; -- Rotational Duty Roster (8.30-6.30) (PRADEEPA S)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '206'; -- Rotational Duty Roster (9.00-6.00 FRIDAY (2.00PM TO 2.00PM)) (GRACY S      FRIDAY (2.00PM TO 2.00PM))
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '207'; -- Rotational Duty Roster (8.30-6.30) (SHAFNA A)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '208'; -- Rotational Duty Roster (8.30-6.30) (JENIFER M)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '213'; -- Rotational Duty Roster (8.30-6.30) (GOWSIKA V V)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '218'; -- Rotational Duty Roster (8.30-6.30) (PRIYA S)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '227'; -- Rotational Duty Roster (8.30-6.30) (AISWARYA M)

-- Department: Nursing Training (6 Employees)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '144'; -- Rotational Duty Roster (8.30-6.30) (MEKHA O S)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '145'; -- Rotational Duty Roster (8.30-6.30) (AKHILA K C)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '146'; -- Rotational Duty Roster (8.30-6.30) (SANGEETHA P S)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '173'; -- Rotational Duty Roster (9.30-7.00) (GOPIKA A)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '194'; -- Rotational Duty Roster (8.30-6.30) (ARDRA K C)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '197'; -- Rotational Duty Roster (8.30-6.30) (ABHINAYA P)

-- Department: Pharmacy (4 Employees)
UPDATE `employees` SET `shift_category` = 'general', `custom_shift_start` = '10:00:00', `custom_shift_end` = '19:00:00' WHERE `employee_code` = '57'; -- Custom timing: 10:00 AM - 07:00 PM (BALASUBRAMANIAM M)
UPDATE `employees` SET `shift_category` = 'day', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '58'; -- Fixed Day Shift (9.00-6.00) (DIVYASREE A)
UPDATE `employees` SET `shift_category` = 'day', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '59'; -- Fixed Day Shift (9.00-6.00) (ELAKKIYA G)
UPDATE `employees` SET `shift_category` = 'day', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '215'; -- Fixed Day Shift (8.30-6.30) (GOMATHI P P)

-- Department: Radiology & Scan (4 Employees)
UPDATE `employees` SET `shift_category` = 'day', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '27'; -- Fixed Day Shift (8.30-6.30) (BHUVANESWARI.C)
UPDATE `employees` SET `shift_category` = 'day', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '61'; -- Fixed Day Shift (9.00-6.00) (MOHANAMBAL K)
UPDATE `employees` SET `shift_category` = 'day', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '62'; -- Fixed Day Shift (9.00-6.00) (LATHA T)
UPDATE `employees` SET `shift_category` = 'general', `custom_shift_start` = '10:00:00', `custom_shift_end` = '19:00:00' WHERE `employee_code` = '76'; -- Custom timing: 10:00 AM - 07:00 PM (SIVANITHYA A)

-- Department: Security (2 Employees)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '64'; -- Rotational Duty Roster (8.00-6.00) (PALANIMUTHU M)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '65'; -- Rotational Duty Roster (6.00-8.00) (RAJENDRAN M)

-- Department: House Keeping (11 Employees)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '66'; -- Rotational Duty Roster (8.00-6.30) (LAWANYA.P)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '67'; -- Rotational Duty Roster (7.00-7.00) (ARATIKISU)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '71'; -- Rotational Duty Roster (7.00-7.00) (UNI MURA)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '102'; -- Rotational Duty Roster (7.00-7.00) (GEETHA)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '119'; -- Rotational Duty Roster (8.00AM-6.00PM 7.00PM-7.00AM) (RANGAMMAL.G)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '210'; -- Rotational Duty Roster (7.00-7.00) (SAVITHA)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '211'; -- Rotational Duty Roster (7.00-7.00) (SARITHA)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '217'; -- Rotational Duty Roster (7.00-7.00) (RUPA R)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '221'; -- Rotational Duty Roster (7.00-7.00) (SUNITA ORANG)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '228'; -- Rotational Duty Roster (7.00-7.00) (BHUMIJ ROBINA MANGAL)
UPDATE `employees` SET `shift_category` = 'day_and_night', `custom_shift_start` = NULL, `custom_shift_end` = NULL WHERE `employee_code` = '229'; -- Rotational Duty Roster (7.00-7.00) (SANJIT TIRKEY)

-- ----------------------------------------------------------------------------
-- STEP 4: VERIFY COMPLETE SHIFT DISTRIBUTION ACROSS ALL EMPLOYEES
-- ----------------------------------------------------------------------------
SELECT `shift_category`, COUNT(*) AS total_employees 
FROM `employees` 
GROUP BY `shift_category`;
