-- =============================================================================
-- Shift Revision Migration from Excel (Effective Date: 2026-10-01)
-- Generated on: 2026-10-03T14:36:11.506Z
-- =============================================================================

-- 1. Ensure employee_shift_logs table exists
CREATE TABLE IF NOT EXISTS employee_shift_logs (
  id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id             BIGINT UNSIGNED NOT NULL,
  previous_shift_category VARCHAR(50) NULL,
  new_shift_category      VARCHAR(50) NOT NULL,
  previous_shift_start    TIME NULL,
  new_shift_start         TIME NULL,
  previous_shift_end      TIME NULL,
  new_shift_end           TIME NULL,
  effective_from          DATE NOT NULL,
  reason                  TEXT NULL,
  changed_by              BIGINT UNSIGNED NULL,
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_emp_effective (employee_id, effective_from),
  CONSTRAINT fk_shift_logs_emp FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Ensure Employee 230 (NITHYASRI S) exists
INSERT INTO employees (employee_code, full_name, department_id, designation_id, shift_category, status, date_of_joining, created_at, updated_at)
SELECT '230', 'NITHYASRI S', 3, 3, 'day_and_night', 'active', '2026-09-24', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE employee_code = '230' OR id = 230);

-- 3. Shift updates & employee_shift_logs entries
-- [Emp ID: 197] ABHINAYA P -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 197;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (197, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 227] AISWARYA M -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 227;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (227, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 145] AKHILA K C -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 145;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (145, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 49] AKSHARA.R -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 49;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (49, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 138] AMSAL S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 138;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (138, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 19] ANILA.P -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 19;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (19, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 48] ANITHA.N -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 48;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (48, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 67] ARATIKISU -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 67;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (67, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 194] ARDRA K C -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 194;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (194, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 57] BALASUBRAMANIAM.M -> general (G)
UPDATE employees
SET shift_category = 'general',
    custom_shift_start = COALESCE(custom_shift_start, '09:00:00'),
    custom_shift_end = COALESCE(custom_shift_end, '17:00:00')
WHERE id = 57;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (57, 'general', 'general',
   '10:00:00', '10:00:00',
   '19:00:00', '19:00:00',
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 228] BHUMIJ ROBINA MANGAL -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 228;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (228, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 27] BHUVANESWARI,C -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 27;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (27, 'day', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 212] DHARANI S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 212;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (212, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 2] DIVYA.S -> general (G)
UPDATE employees
SET shift_category = 'general',
    custom_shift_start = COALESCE(custom_shift_start, '09:00:00'),
    custom_shift_end = COALESCE(custom_shift_end, '17:00:00')
WHERE id = 2;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (2, 'night', 'general',
   NULL, '09:00:00',
   NULL, '17:00:00',
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 58] DIVYASREE.A -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 58;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (58, 'day', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 214] Dr.ARULGANGA -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 214;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (214, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 183] Dr.INDHUMATHI K -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 183;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (183, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 149] Dr.LAWANYA.B -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 149;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (149, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 17] Dr.REVATHI -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 17;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (17, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 185] Dr.VIDHYASHREE -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 185;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (185, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 190] GAYATHRI S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 190;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (190, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 102] GEETHA -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 102;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (102, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 215] GOMATHI P P -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 215;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (215, 'day', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 24] GOMATHI.P -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 24;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (24, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 173] GOPIKA A -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 173;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (173, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 30] GOWSALYA.S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 30;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (30, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 213] GOWSIKA V V -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 213;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (213, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 206] GRACY S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 206;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (206, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 198] HARIPRIYA P -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 198;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (198, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 59] ILAKKIYA.G -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 59;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (59, 'day', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 6] INDHUMATHI.R -> general (G)
UPDATE employees
SET shift_category = 'general',
    custom_shift_start = COALESCE(custom_shift_start, '09:00:00'),
    custom_shift_end = COALESCE(custom_shift_end, '17:00:00')
WHERE id = 6;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (6, 'general', 'general',
   '09:30:00', '09:30:00',
   '19:30:00', '19:30:00',
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 208] JENIFER M -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 208;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (208, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 123] KANCHANA A -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 123;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (123, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 5] KANDASAMY.C -> general (G)
UPDATE employees
SET shift_category = 'general',
    custom_shift_start = COALESCE(custom_shift_start, '09:00:00'),
    custom_shift_end = COALESCE(custom_shift_end, '17:00:00')
WHERE id = 5;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (5, 'day', 'general',
   NULL, '09:00:00',
   NULL, '17:00:00',
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 39] KAVERI.K -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 39;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (39, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 179] KAVIPRIYA G -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 179;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (179, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 62] LATHA.T -> day (D)
UPDATE employees
SET shift_category = 'day',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 62;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (62, 'day', 'day',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 66] LAWANYA.P -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 66;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (66, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 187] MAHALAKSHMI G -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 187;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (187, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 3] MAHESHWARI.P -> general (G)
UPDATE employees
SET shift_category = 'general',
    custom_shift_start = COALESCE(custom_shift_start, '09:00:00'),
    custom_shift_end = COALESCE(custom_shift_end, '17:00:00')
WHERE id = 3;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (3, 'general', 'general',
   '08:15:00', '08:15:00',
   '17:15:00', '17:15:00',
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 182] MANJULA P -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 182;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (182, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 192] MARAGATHAM M -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 192;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (192, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 200] MARASAMY -> night (N)
UPDATE employees
SET shift_category = 'night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 200;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (200, 'night', 'night',
   '18:30:00', NULL,
   '08:30:00', NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 177] MAYIL R -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 177;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (177, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 20] MEENA.M.R -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 20;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (20, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 144] MEKHA O S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 144;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (144, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 175] MENAKA M -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 175;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (175, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 61] MOHANAMBAL.K -> day (D)
UPDATE employees
SET shift_category = 'day',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 61;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (61, 'day', 'day',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 8] MUTHU PRIYA.M -> general (G)
UPDATE employees
SET shift_category = 'general',
    custom_shift_start = COALESCE(custom_shift_start, '09:00:00'),
    custom_shift_end = COALESCE(custom_shift_end, '17:00:00')
WHERE id = 8;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (8, 'day', 'general',
   NULL, '09:00:00',
   NULL, '17:00:00',
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 91] NAKESHWARI.M -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 91;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (91, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 52] NEETHU KRISHNA.R -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 52;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (52, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 165] NISHA S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 165;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (165, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 159] NITHYA DEVI S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 159;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (159, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 230] NITHYASRI S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 230;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (230, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 64] PALANIMUTHU.M -> general (G)
UPDATE employees
SET shift_category = 'general',
    custom_shift_start = COALESCE(custom_shift_start, '09:00:00'),
    custom_shift_end = COALESCE(custom_shift_end, '17:00:00')
WHERE id = 64;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (64, 'day_and_night', 'general',
   NULL, '09:00:00',
   NULL, '17:00:00',
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 40] POORNI.R -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 40;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (40, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 204] PRADEEPA S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 204;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (204, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 218] PRIYA S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 218;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (218, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 107] PRIYADHARSHINI.B -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 107;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (107, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 65] RAJENDRAN.M -> night (N)
UPDATE employees
SET shift_category = 'night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 65;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (65, 'day_and_night', 'night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 119] RANGAMMAL.G -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 119;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (119, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 161] RATHIKA R -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 161;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (161, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 226] RAVI S -> general (G)
UPDATE employees
SET shift_category = 'general',
    custom_shift_start = COALESCE(custom_shift_start, '09:00:00'),
    custom_shift_end = COALESCE(custom_shift_end, '17:00:00')
WHERE id = 226;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (226, 'day', 'general',
   NULL, '09:00:00',
   NULL, '17:00:00',
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 146] SANGEETHA P S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 146;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (146, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 21] SANGEETHA.V.M -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 21;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (21, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 229] SANJIT TIRKEY -> day (D)
UPDATE employees
SET shift_category = 'day',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 229;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (229, 'day_and_night', 'day',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 211] SARITHA -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 211;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (211, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 176] SARITHA R -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 176;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (176, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 73] SATHYA E -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 73;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (73, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 4] SENTHILKUMAR.S -> general (G)
UPDATE employees
SET shift_category = 'general',
    custom_shift_start = COALESCE(custom_shift_start, '09:00:00'),
    custom_shift_end = COALESCE(custom_shift_end, '17:00:00')
WHERE id = 4;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (4, 'general', 'general',
   '09:30:00', '09:30:00',
   '18:30:00', '18:30:00',
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 76] SIVANITHYA.A -> day (D)
UPDATE employees
SET shift_category = 'day',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 76;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (76, 'general', 'day',
   '10:00:00', NULL,
   '19:00:00', NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 7] SONAPRIYA.G.N -> general (G)
UPDATE employees
SET shift_category = 'general',
    custom_shift_start = COALESCE(custom_shift_start, '09:00:00'),
    custom_shift_end = COALESCE(custom_shift_end, '17:00:00')
WHERE id = 7;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (7, 'general', 'general',
   '10:00:00', '10:00:00',
   '19:00:00', '19:00:00',
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 56] SREELAKSHMI.S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 56;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (56, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 189] SRILAKASHMI P -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 189;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (189, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 220] SUBASHINI S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 220;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (220, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 168] SUGANYA V -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 168;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (168, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 44] SUMITHRA.A -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 44;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (44, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 167] SUSEELA I -> day (D)
UPDATE employees
SET shift_category = 'day',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 167;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (167, 'day_and_night', 'day',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 79] SWATHI.P -> general (G)
UPDATE employees
SET shift_category = 'general',
    custom_shift_start = COALESCE(custom_shift_start, '09:00:00'),
    custom_shift_end = COALESCE(custom_shift_end, '17:00:00')
WHERE id = 79;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (79, 'day', 'general',
   NULL, '09:00:00',
   NULL, '17:00:00',
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 14] SWETHA.M -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 14;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (14, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 202] THENMOZHI K -> general (G)
UPDATE employees
SET shift_category = 'general',
    custom_shift_start = COALESCE(custom_shift_start, '09:00:00'),
    custom_shift_end = COALESCE(custom_shift_end, '17:00:00')
WHERE id = 202;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (202, 'general', 'general',
   '11:00:00', '11:00:00',
   '21:00:00', '21:00:00',
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 33] THILAGAVATHI.S -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 33;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (33, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 71] UNI MURA -> day_and_night (D&N)
UPDATE employees
SET shift_category = 'day_and_night',
    custom_shift_start = NULL,
    custom_shift_end = NULL
WHERE id = 71;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (71, 'day_and_night', 'day_and_night',
   NULL, NULL,
   NULL, NULL,
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

-- [Emp ID: 81] VIJAYA KUMAR.A -> general (G)
UPDATE employees
SET shift_category = 'general',
    custom_shift_start = COALESCE(custom_shift_start, '09:00:00'),
    custom_shift_end = COALESCE(custom_shift_end, '17:00:00')
WHERE id = 81;

INSERT INTO employee_shift_logs
  (employee_id, previous_shift_category, new_shift_category,
   previous_shift_start, new_shift_start,
   previous_shift_end, new_shift_end,
   effective_from, reason, changed_by)
VALUES
  (81, 'general', 'general',
   '10:00:00', '10:00:00',
   '19:00:00', '19:00:00',
   '2026-10-01', 'Hospital Shift Revision effective from 01/10/2026', 1);

