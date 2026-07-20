/*
 ============================================================================
 NEHA HOSPITAL MANAGEMENT SYSTEM — DATABASE SCHEMA
 Engine: MySQL 8.0+   |   Charset: utf8mb4

 Organised to match the agreed 12 modules, in two halves:
   SECTION A — Shared Foundation (used by every module)
   SECTION B — Staff & Salary Side   (Modules 2.1 - 2.6)
   SECTION C — Patient & Hospital Side (Modules 3.1 - 3.6)

 Design principles followed throughout:
   - "Dynamic masters": departments, designations, leave types, fine types,
     medicine categories, room types etc. are TABLES, not hardcoded ENUMs,
     so admins can add/rename/remove them without a code change.
   - Configurable payroll rules (PF/ESI %, ceilings, buffer minutes, etc.)
     live in `payroll_config`, not hardcoded in application code.
   - Raw biometric punches are kept forever, untouched, separate from the
     processed daily summary, for audit purposes.
 ============================================================================
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

/*
 ============================================================================
 SECTION A — SHARED FOUNDATION
 (login system with roles, and cross-cutting admin-editable lists)
 ============================================================================
*/

/*
 One row per department; used by both staff (HR) and patient-side (doctor
 specialisation grouping) screens.
*/
CREATE TABLE departments (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE designations (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_designations_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 RBAC: roles are admin-editable; permissions are a fixed vocabulary the
 application understands (screens/actions), roles are just named bundles.
*/
CREATE TABLE roles (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    description     VARCHAR(255) NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 ---------------------------------------------------------------------------
 Fine-grained permission catalog: MODULE x ACTION.

 Every one of the 12 modules gets the three core actions (view / modify /
 delete) automatically, PLUS whichever "special flow" actions make sense
 for that module (e.g. leave.approve_leave_hr, payroll.lock_payroll,
 discharge.discharge_patient). This is what lets an admin build a matrix
 screen: rows = modules, columns = actions, checkboxes = permissions.

 Permissions can be granted two ways, and both are supported below:
   1. Per ROLE, via role_permissions (applies to everyone with that role)
   2. Per STAFF MEMBER, via user_permission_overrides (applies to one
      specific person only, and can ALLOW something their role doesn't
      have, or DENY something their role would normally have)
 ---------------------------------------------------------------------------
*/

/*
 The 12 modules (kept as a table, not an ENUM, so a 13th module can be
 added later without touching this schema).
*/
CREATE TABLE modules (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(50)  NOT NULL,  /* e.g. 'leave', 'pharmacy' */
    name            VARCHAR(100) NOT NULL,  /* e.g. 'Leave Engine' */
    display_order   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    UNIQUE KEY uq_modules_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Every possible action across the system. is_special = 0 for the three core
 actions (view/modify/delete, valid on every module); is_special = 1 for a
 named workflow action that only makes sense on specific modules (see
 module_actions below).
*/
CREATE TABLE actions (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(50)  NOT NULL,  /* e.g. 'view', 'approve_leave_hr' */
    name            VARCHAR(100) NOT NULL,  /* e.g. 'Approve Leave (HR)' */
    is_special      TINYINT(1)   NOT NULL DEFAULT 0,
    UNIQUE KEY uq_actions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Which SPECIAL actions are valid on which modules (core view/modify/delete
 are implicitly valid everywhere, so they don't need rows here).
*/
CREATE TABLE module_actions (
    module_id       BIGINT UNSIGNED NOT NULL,
    action_id       BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (module_id, action_id),
    CONSTRAINT fk_module_actions_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
    CONSTRAINT fk_module_actions_action FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 The atomic, grantable unit: one (module, action) pair.
 e.g. (leave, modify) = "can edit leave records"
      (leave, approve_leave_hr) = "can give final HR approval on leave"
*/
CREATE TABLE permissions (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    module_id       BIGINT UNSIGNED NOT NULL,
    action_id       BIGINT UNSIGNED NOT NULL,
    code            VARCHAR(120) NOT NULL,  /* denormalised 'module.action' for easy lookup/logging */
    description     VARCHAR(255) NULL,
    UNIQUE KEY uq_permissions_module_action (module_id, action_id),
    UNIQUE KEY uq_permissions_code (code),
    CONSTRAINT fk_permissions_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
    CONSTRAINT fk_permissions_action FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Permissions granted to a ROLE (applies to every staff member with that role).
*/
CREATE TABLE role_permissions (
    role_id         BIGINT UNSIGNED NOT NULL,
    permission_id   BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 ---------------------------------------------------------------------------
 RBAC seed data — the 12 modules, the core + special actions, which special
 actions apply to which module, and the full permission catalog generated
 from that. This is real seed data (not just a suggestion), since the
 application's permission-matrix screen depends on this catalog existing.
 ---------------------------------------------------------------------------
*/

INSERT INTO modules (code, name, display_order) VALUES
    ('hr_employee',  'HR & Employee Management',          1),
    ('shift_roster', 'Shift & Roster Management',         2),
    ('attendance',   'Attendance Engine',                 3),
    ('leave',        'Leave Engine',                      4),
    ('fine',         'Fine Engine',                       5),
    ('payroll',      'Payroll Engine',                    6),
    ('patient',      'Patient Records',                   7),
    ('appointment',  'Appointment / Token',                8),
    ('consultation', 'Doctor Consultation & Prescription', 9),
    ('pharmacy',     'Pharmacy Module',                   10),
    ('admission',    'Admission & Bed Management',        11),
    ('discharge',    'Discharge & Patient History',       12);

/*
 Core actions: valid on every module (no module_actions row needed for these).
*/
INSERT INTO actions (code, name, is_special) VALUES
    ('view',   'View / Read',      0),
    ('modify', 'Create / Edit',    0),
    ('delete', 'Delete',           0);

/*
 Special, module-specific "flow" actions.
*/
INSERT INTO actions (code, name, is_special) VALUES
    ('approve_increment',      'Approve Salary Increment',        1),
    ('publish_roster',         'Publish Roster',                  1),
    ('approve_correction',     'Approve Attendance Correction',   1),
    ('approve_leave_reporting','Approve Leave (Reporting Person)',1),
    ('approve_leave_hr',       'Approve Leave (HR, Final)',       1),
    ('waive_fine',             'Waive / Cancel a Fine',           1),
    ('lock_payroll',           'Lock Payroll Run',                1),
    ('generate_payslip',       'Generate Payslip',                1),
    ('close_appointment',      'Close / Cancel Appointment',      1),
    ('convert_to_admission',   'Convert Appointment to Admission',1),
    ('assign_bed',             'Assign / Change Bed',             1),
    ('generate_bill',          'Generate Pharmacy Bill',          1),
    ('discharge_patient',      'Discharge Patient',               1);

/*
 Map each special action to the one module it belongs to.
*/
INSERT INTO module_actions (module_id, action_id)
SELECT m.id, a.id FROM modules m, actions a WHERE m.code = 'hr_employee'  AND a.code = 'approve_increment';
INSERT INTO module_actions (module_id, action_id)
SELECT m.id, a.id FROM modules m, actions a WHERE m.code = 'shift_roster' AND a.code = 'publish_roster';
INSERT INTO module_actions (module_id, action_id)
SELECT m.id, a.id FROM modules m, actions a WHERE m.code = 'attendance'   AND a.code = 'approve_correction';
INSERT INTO module_actions (module_id, action_id)
SELECT m.id, a.id FROM modules m, actions a WHERE m.code = 'leave'        AND a.code = 'approve_leave_reporting';
INSERT INTO module_actions (module_id, action_id)
SELECT m.id, a.id FROM modules m, actions a WHERE m.code = 'leave'        AND a.code = 'approve_leave_hr';
INSERT INTO module_actions (module_id, action_id)
SELECT m.id, a.id FROM modules m, actions a WHERE m.code = 'fine'         AND a.code = 'waive_fine';
INSERT INTO module_actions (module_id, action_id)
SELECT m.id, a.id FROM modules m, actions a WHERE m.code = 'payroll'      AND a.code = 'lock_payroll';
INSERT INTO module_actions (module_id, action_id)
SELECT m.id, a.id FROM modules m, actions a WHERE m.code = 'payroll'      AND a.code = 'generate_payslip';
INSERT INTO module_actions (module_id, action_id)
SELECT m.id, a.id FROM modules m, actions a WHERE m.code = 'appointment'  AND a.code = 'close_appointment';
INSERT INTO module_actions (module_id, action_id)
SELECT m.id, a.id FROM modules m, actions a WHERE m.code = 'admission'    AND a.code = 'convert_to_admission';
INSERT INTO module_actions (module_id, action_id)
SELECT m.id, a.id FROM modules m, actions a WHERE m.code = 'admission'    AND a.code = 'assign_bed';
INSERT INTO module_actions (module_id, action_id)
SELECT m.id, a.id FROM modules m, actions a WHERE m.code = 'pharmacy'     AND a.code = 'generate_bill';
INSERT INTO module_actions (module_id, action_id)
SELECT m.id, a.id FROM modules m, actions a WHERE m.code = 'discharge'    AND a.code = 'discharge_patient';

/*
 Generate the full permission catalog: every module x its 3 core actions...
*/
INSERT INTO permissions (module_id, action_id, code, description)
SELECT m.id, a.id, CONCAT(m.code, '.', a.code), CONCAT(a.name, ' — ', m.name)
FROM modules m
JOIN actions a ON a.is_special = 0;

/*
 ...plus every module x its own special actions (from module_actions).
*/
INSERT INTO permissions (module_id, action_id, code, description)
SELECT ma.module_id, ma.action_id, CONCAT(m.code, '.', a.code), CONCAT(a.name, ' — ', m.name)
FROM module_actions ma
JOIN modules m ON m.id = ma.module_id
JOIN actions a ON a.id = ma.action_id;

/*
 Example: an 'Administrator' role that gets every single permission, so
 there's always at least one usable login after this script runs. Every
 other role (Receptionist, Pharmacist, Doctor, Nurse, HR, ...) should be
 created and ticked off from the permission-matrix screen by an admin —
 that per-module, per-action matrix is exactly what modules/actions/
 permissions above is built to drive, instead of hardcoding role rules here.
*/
INSERT INTO roles (name, description) VALUES
    ('Administrator', 'Full access to every module and action');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'Administrator';

/*
 Example of a per-staff override (run this later, once real users exist —
 shown here only as a template, not executed):

   -- Give one specific receptionist (user_id = 7) the ability to waive
   -- fines, even though the Receptionist role normally can't:
   INSERT INTO user_permission_overrides (user_id, permission_id, effect, reason, granted_by)
   SELECT 7, p.id, 'allow', 'Covering for HR during leave', 1
   FROM permissions p WHERE p.code = 'fine.waive_fine';

   -- Take away bill generation from one specific pharmacist (user_id = 12)
   -- while their conduct is under review, without changing their role:
   INSERT INTO user_permission_overrides (user_id, permission_id, effect, reason, granted_by)
   SELECT 12, p.id, 'deny', 'Temporary restriction pending review', 1
   FROM permissions p WHERE p.code = 'pharmacy.generate_bill';
*/

/*
 One login per person. Most users are linked to an employee record; a user
 does not have to be an employee (e.g. a pure admin account), so employee_id
 is nullable.
*/
CREATE TABLE users (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id     BIGINT UNSIGNED NULL,
    username        VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NULL,
    phone           VARCHAR(20)  NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role_id         BIGINT UNSIGNED NOT NULL,
    is_active       TINYINT(1)   NOT NULL DEFAULT 1,
    last_login_at   TIMESTAMP    NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_username (username),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
    KEY ix_users_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Per-STAFF overrides, on top of whatever their role already grants.
 effect = 'allow' -> gives this one person a permission their role doesn't have
 effect = 'deny'  -> takes away a permission their role would normally have
 expires_at lets an override be temporary (e.g. a 1-month acting-HOD grant).
*/
CREATE TABLE user_permission_overrides (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED NOT NULL,
    permission_id   BIGINT UNSIGNED NOT NULL,
    effect          ENUM('allow','deny') NOT NULL,
    reason          VARCHAR(255) NULL,
    granted_by      BIGINT UNSIGNED NULL,
    expires_at      TIMESTAMP NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_user_permission_override (user_id, permission_id),
    CONSTRAINT fk_upo_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_upo_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_upo_granted_by FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Resolves, for every user, the final list of permissions they actually have
 once role grants and personal overrides are combined. Priority order:
   1. A personal DENY override always wins (even over a role grant).
   2. A personal ALLOW override grants it even if the role doesn't.
   3. Otherwise, fall back to whatever the role grants.
 The application should check against this view, not role_permissions
 directly, so it never has to re-implement this priority logic itself.
*/
CREATE OR REPLACE VIEW v_effective_permissions AS
WITH granted AS (
    SELECT u.id AS user_id, rp.permission_id
    FROM users u
    JOIN role_permissions rp ON rp.role_id = u.role_id
    UNION
    SELECT upo.user_id, upo.permission_id
    FROM user_permission_overrides upo
    WHERE upo.effect = 'allow' AND (upo.expires_at IS NULL OR upo.expires_at > CURRENT_TIMESTAMP)
),
denied AS (
    SELECT upo.user_id, upo.permission_id
    FROM user_permission_overrides upo
    WHERE upo.effect = 'deny' AND (upo.expires_at IS NULL OR upo.expires_at > CURRENT_TIMESTAMP)
)
SELECT
    g.user_id,
    p.id            AS permission_id,
    m.code          AS module_code,
    a.code          AS action_code,
    p.code          AS permission_code
FROM granted g
JOIN permissions p ON p.id = g.permission_id
JOIN modules m      ON m.id = p.module_id
JOIN actions a       ON a.id = p.action_id
LEFT JOIN denied d ON d.user_id = g.user_id AND d.permission_id = g.permission_id
WHERE d.user_id IS NULL;

/*
 Generic audit trail. entity_type/entity_id point at any row in any table
 (e.g. entity_type='salary_structures', entity_id=42) so one table covers
 every module instead of a separate log table per module.
*/
CREATE TABLE audit_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED NULL,
    entity_type     VARCHAR(100) NOT NULL,
    entity_id       BIGINT UNSIGNED NOT NULL,
    action          VARCHAR(50)  NOT NULL,  /* 'create' | 'update' | 'delete' | 'approve' | ... */
    old_value       JSON NULL,
    new_value       JSON NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_audit_entity (entity_type, entity_id),
    KEY ix_audit_user (user_id),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Configurable payroll/statutory rules — PF %, ESI %, ceilings, default
 attendance buffer, etc. Read by the Payroll Engine at calculation time
 instead of being hardcoded, so admins can adjust them as rules change.
*/
CREATE TABLE payroll_config (
    config_key      VARCHAR(100) PRIMARY KEY,  /* e.g. 'PF_EMPLOYEE_PERCENT' */
    config_value    VARCHAR(100) NOT NULL,
    description     VARCHAR(255) NULL,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Suggested seed rows (adjust from the admin settings screen, not by editing code):
 ('PF_EMPLOYEE_PERCENT','12'), ('PF_EMPLOYER_EPF_PERCENT','3.67'),
 ('PF_EMPLOYER_EPS_PERCENT','8.33'), ('PF_WAGE_CEILING','15000'),
 ('ESI_EMPLOYEE_PERCENT','0.75'), ('ESI_EMPLOYER_PERCENT','3.25'),
 ('ESI_WAGE_CEILING','21000'), ('DEFAULT_ATTENDANCE_BUFFER_MINUTES','10'),
 ('BASIC_DA_SPLIT_PERCENT','70'), ('HRA_SPLIT_PERCENT','30')
*/


/*
 ============================================================================
 SECTION B — STAFF & SALARY SIDE
 ============================================================================
*/

/*
 ---------------------------------------------------------------------------
 2.1  HR & EMPLOYEE MANAGEMENT
 ---------------------------------------------------------------------------
*/
CREATE TABLE employees (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_code       VARCHAR(30)  NOT NULL,  /* matches the eSSL biometric device's Emp Code */
    full_name           VARCHAR(150) NOT NULL,
    department_id       BIGINT UNSIGNED NOT NULL,
    designation_id      BIGINT UNSIGNED NOT NULL,
    reporting_person_id BIGINT UNSIGNED NULL,  /* self-referencing: who approves this employee's leave */
    date_of_joining     DATE NOT NULL,
    date_of_leaving     DATE NULL,
    gender              ENUM('male','female','other') NULL,
    date_of_birth       DATE NULL,
    phone               VARCHAR(20) NULL,
    address             VARCHAR(255) NULL,

/*
 Bank details, for payslip reference (bulk transfer file generation is out of scope for now)
*/
    bank_account_no     VARCHAR(40) NULL,
    bank_ifsc           VARCHAR(20) NULL,
    bank_name            VARCHAR(100) NULL,

/*
 PF / ESI enrolment status — nullable/pending until the employee is enrolled
*/
    uan_number          VARCHAR(30) NULL,
    pf_enrolled         TINYINT(1)  NOT NULL DEFAULT 0,
    esi_number           VARCHAR(30) NULL,
    esi_enrolled         TINYINT(1)  NOT NULL DEFAULT 0,

    status              ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_employees_code (employee_code),
    KEY ix_employees_department (department_id),
    KEY ix_employees_designation (designation_id),
    CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments(id),
    CONSTRAINT fk_employees_designation FOREIGN KEY (designation_id) REFERENCES designations(id),
    CONSTRAINT fk_employees_reporting_person FOREIGN KEY (reporting_person_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users
    ADD CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

/*
 Salary Structure history. Each row is one "version" of an employee's salary
 that applies from effective_from until superseded (effective_to). This is
 what makes salary increments work automatically: payroll always picks the
 row whose date range covers the month being processed.
*/
CREATE TABLE salary_structures (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id         BIGINT UNSIGNED NOT NULL,

    salary_basis        ENUM('monthly_fixed','per_day','per_shift') NOT NULL DEFAULT 'monthly_fixed',

/*
 Used when salary_basis = 'monthly_fixed'
*/
    fixed_salary         DECIMAL(10,2) NULL,
    basic_da_amount      DECIMAL(10,2) NULL,  /* fixed_salary split, feeds PF/ESI wage base */
    hra_amount            DECIMAL(10,2) NULL,

/*
 Used when salary_basis = 'per_day'
*/
    rate_per_day          DECIMAL(10,2) NULL,

/*
 Used when salary_basis = 'per_shift'
*/
    rate_per_shift         DECIMAL(10,2) NULL,

    pf_applicable          TINYINT(1) NOT NULL DEFAULT 1,
    esi_applicable          TINYINT(1) NOT NULL DEFAULT 1,

    effective_from          DATE NOT NULL,
    effective_to             DATE NULL,  /* NULL = currently active version */

    created_by               BIGINT UNSIGNED NULL,
    created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY ix_salary_structures_employee (employee_id, effective_from),
    CONSTRAINT fk_salary_structures_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_salary_structures_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/*
 ---------------------------------------------------------------------------
 2.2  SHIFT & ROSTER MANAGEMENT
 ---------------------------------------------------------------------------
*/
CREATE TABLE shifts (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,  /* e.g. 'Morning', 'Night' */
    start_time          TIME NOT NULL,
    end_time            TIME NOT NULL,
    crosses_midnight    TINYINT(1) NOT NULL DEFAULT 0,
    buffer_minutes      SMALLINT UNSIGNED NOT NULL DEFAULT 10,  /* grace period before "late" */
    is_night_shift      TINYINT(1) NOT NULL DEFAULT 0,
    is_active            TINYINT(1) NOT NULL DEFAULT 1,
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_shifts_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 How many week-offs a designation/role is entitled to per month, used as a
 default when generating a roster (the admin can still override per person).
*/
CREATE TABLE week_off_policies (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    designation_id      BIGINT UNSIGNED NOT NULL,
    week_offs_per_month SMALLINT UNSIGNED NOT NULL DEFAULT 4,
    CONSTRAINT fk_week_off_policies_designation FOREIGN KEY (designation_id) REFERENCES designations(id) ON DELETE CASCADE,
    UNIQUE KEY uq_week_off_policy_designation (designation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 One row per employee, per date: the planned roster. Attendance Engine
 compares actual punches against this to know which shift was expected.
*/
CREATE TABLE roster_entries (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id         BIGINT UNSIGNED NOT NULL,
    roster_date          DATE NOT NULL,
    shift_id              BIGINT UNSIGNED NULL,  /* NULL when is_week_off = 1 */
    is_week_off           TINYINT(1) NOT NULL DEFAULT 0,
    is_holiday             TINYINT(1) NOT NULL DEFAULT 0,
    is_manual_override      TINYINT(1) NOT NULL DEFAULT 0,
    notes                    VARCHAR(255) NULL,
    created_by                BIGINT UNSIGNED NULL,
    created_at                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_roster_employee_date (employee_id, roster_date),
    KEY ix_roster_date (roster_date),
    CONSTRAINT fk_roster_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_roster_shift FOREIGN KEY (shift_id) REFERENCES shifts(id),
    CONSTRAINT fk_roster_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/*
 ---------------------------------------------------------------------------
 2.3  ATTENDANCE ENGINE
 ---------------------------------------------------------------------------
*/

/*
 Untouched, append-only copy of every punch pulled from the eSSL biometric
 devices. Never updated or deleted — this is the audit trail.
*/
CREATE TABLE attendance_raw_punches (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_code        VARCHAR(30) NOT NULL,  /* raw code as read from the device */
    device_id             VARCHAR(50) NULL,  /* which biometric machine/building */
    punch_time             DATETIME NOT NULL,
    raw_payload              JSON NULL,  /* original device record, for troubleshooting */
    synced_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY ix_raw_punches_employee_time (employee_code, punch_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Processed, one row per employee per day. This is what the Leave, Fine and
 Payroll engines actually read from.
*/
CREATE TABLE attendance_daily_summary (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id          BIGINT UNSIGNED NOT NULL,
    attendance_date       DATE NOT NULL,
    shift_id                BIGINT UNSIGNED NULL,
    first_in_time            DATETIME NULL,
    last_out_time             DATETIME NULL,
    worked_minutes             INT NULL,
    break_minutes               INT NULL,
    late_minutes                 INT NOT NULL DEFAULT 0,
    early_leave_minutes            INT NOT NULL DEFAULT 0,
    status                          ENUM('present','absent','on_leave','lop','week_off','holiday') NOT NULL,
    is_missed_punch                  TINYINT(1) NOT NULL DEFAULT 0,
    recalculated_at                   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_attendance_employee_date (employee_id, attendance_date),
    KEY ix_attendance_date (attendance_date),
    CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_attendance_shift FOREIGN KEY (shift_id) REFERENCES shifts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Staff-raised correction requests for a missed/wrong punch, needing approval.
*/
CREATE TABLE attendance_correction_requests (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id          BIGINT UNSIGNED NOT NULL,
    attendance_date       DATE NOT NULL,
    requested_in_time      DATETIME NULL,
    requested_out_time      DATETIME NULL,
    reason                   VARCHAR(255) NOT NULL,
    status                     ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    reviewed_by                BIGINT UNSIGNED NULL,
    reviewed_at                  TIMESTAMP NULL,
    created_at                    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_correction_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_correction_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/*
 ---------------------------------------------------------------------------
 2.4  LEAVE ENGINE
 ---------------------------------------------------------------------------
*/

/*
 Admin-editable leave types (Casual, Sick, Earned, Comp Off, Half Day, ...)
*/
CREATE TABLE leave_types (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                 VARCHAR(100) NOT NULL,
    quota_days             DECIMAL(5,2) NOT NULL DEFAULT 0,  /* e.g. 12 */
    quota_period            ENUM('monthly','yearly') NOT NULL DEFAULT 'yearly',
    is_half_day_allowed       TINYINT(1) NOT NULL DEFAULT 0,
    is_active                  TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uq_leave_types_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Running balance per employee, per leave type, per year (allocation reset
 point). Recomputed whenever a request is approved.
*/
CREATE TABLE leave_balances (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id          BIGINT UNSIGNED NOT NULL,
    leave_type_id          BIGINT UNSIGNED NOT NULL,
    year                     SMALLINT NOT NULL,
    allocated_days             DECIMAL(5,2) NOT NULL DEFAULT 0,
    used_days                    DECIMAL(5,2) NOT NULL DEFAULT 0,
    balance_days                  DECIMAL(5,2) GENERATED ALWAYS AS (allocated_days - used_days) STORED,

    UNIQUE KEY uq_leave_balance (employee_id, leave_type_id, year),
    CONSTRAINT fk_leave_balance_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_leave_balance_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE leave_requests (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id          BIGINT UNSIGNED NOT NULL,
    leave_type_id          BIGINT UNSIGNED NOT NULL,
    from_date                DATE NOT NULL,
    to_date                   DATE NOT NULL,
    is_half_day                 TINYINT(1) NOT NULL DEFAULT 0,
    reason                        VARCHAR(255) NULL,

/*
 two-step approval: reporting person, then HR
*/
    reporting_person_status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    reporting_person_id              BIGINT UNSIGNED NULL,
    reporting_person_acted_at          TIMESTAMP NULL,

    hr_status                            ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    hr_user_id                             BIGINT UNSIGNED NULL,
    hr_acted_at                              TIMESTAMP NULL,

/*
 final outcome once fully processed
*/
    result                                     ENUM('pending','paid_leave','lop','rejected') NOT NULL DEFAULT 'pending',

    created_at                                   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                                     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY ix_leave_requests_employee (employee_id, from_date),
    CONSTRAINT fk_leave_requests_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_leave_requests_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
    CONSTRAINT fk_leave_requests_reporting_person FOREIGN KEY (reporting_person_id) REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_leave_requests_hr_user FOREIGN KEY (hr_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/*
 ---------------------------------------------------------------------------
 2.5  FINE ENGINE
 ---------------------------------------------------------------------------
*/

/*
 Admin-editable fine categories. trigger_rule lets the Fine Engine apply the
 automatic "unapproved absence + no leave left" rule without hardcoding it;
 other rows can simply be manual fine types (e.g. Uniform, ID Card).
*/
CREATE TABLE fine_types (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                 VARCHAR(100) NOT NULL,
    default_amount         DECIMAL(10,2) NOT NULL DEFAULT 0,
    trigger_rule              ENUM('unapproved_absence_no_leave','manual') NOT NULL DEFAULT 'manual',
    is_active                   TINYINT(1) NOT NULL DEFAULT 1,
    UNIQUE KEY uq_fine_types_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE fines (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id          BIGINT UNSIGNED NOT NULL,
    fine_type_id           BIGINT UNSIGNED NOT NULL,
    fine_date                DATE NOT NULL,
    amount                     DECIMAL(10,2) NOT NULL,
    reason                       VARCHAR(255) NULL,
    is_auto_generated              TINYINT(1) NOT NULL DEFAULT 0,  /* 1 = raised by the rule engine, 0 = manual */
    payroll_run_id                   BIGINT UNSIGNED NULL,  /* set once billed into a payroll run */
    created_by                         BIGINT UNSIGNED NULL,
    created_at                           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY ix_fines_employee (employee_id, fine_date),
    CONSTRAINT fk_fines_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_fines_type FOREIGN KEY (fine_type_id) REFERENCES fine_types(id),
    CONSTRAINT fk_fines_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/*
 ---------------------------------------------------------------------------
 2.6  PAYROLL ENGINE  (incl. Salary Structure, PF/ESI, Extra Duty/OT)
 ---------------------------------------------------------------------------
*/

/*
 Extra Duty / Overtime: supports both a whole extra day worked and hourly
 OT tied to a specific date, per the client's actual Excel sheet.
*/
CREATE TABLE overtime_entries (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id          BIGINT UNSIGNED NOT NULL,
    entry_date              DATE NOT NULL,
    entry_type                ENUM('extra_day','hourly') NOT NULL,
    hours                       DECIMAL(4,2) NULL,  /* used when entry_type = 'hourly' */
    computed_amount               DECIMAL(10,2) NOT NULL,
    notes                           VARCHAR(255) NULL,
    payroll_run_id                    BIGINT UNSIGNED NULL,
    created_by                          BIGINT UNSIGNED NULL,
    created_at                            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY ix_overtime_employee (employee_id, entry_date),
    CONSTRAINT fk_overtime_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_overtime_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 One row per month = one payroll run. Locking a run means payroll_items
 underneath it are final and should not be recalculated.
*/
CREATE TABLE payroll_runs (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    period_month          TINYINT UNSIGNED NOT NULL,  /* 1-12 */
    period_year             SMALLINT UNSIGNED NOT NULL,
    status                     ENUM('draft','locked','paid') NOT NULL DEFAULT 'draft',
    locked_by                    BIGINT UNSIGNED NULL,
    locked_at                      TIMESTAMP NULL,
    created_at                       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_payroll_run_period (period_year, period_month),
    CONSTRAINT fk_payroll_runs_locked_by FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 One row per employee per payroll run — the final payslip line.
*/
CREATE TABLE payroll_items (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payroll_run_id        BIGINT UNSIGNED NOT NULL,
    employee_id             BIGINT UNSIGNED NOT NULL,
    salary_structure_id       BIGINT UNSIGNED NOT NULL,  /* which salary version was used */

    days_present                DECIMAL(4,1) NOT NULL DEFAULT 0,
    days_paid_leave                DECIMAL(4,1) NOT NULL DEFAULT 0,
    days_lop                          DECIMAL(4,1) NOT NULL DEFAULT 0,
    shifts_worked                       DECIMAL(4,1) NOT NULL DEFAULT 0,  /* used for 'per_shift' basis */

    gross_pay                             DECIMAL(10,2) NOT NULL DEFAULT 0,
    lop_amount                              DECIMAL(10,2) NOT NULL DEFAULT 0,
    overtime_amount                           DECIMAL(10,2) NOT NULL DEFAULT 0,
    pf_employee_amount                          DECIMAL(10,2) NOT NULL DEFAULT 0,
    pf_employer_amount                            DECIMAL(10,2) NOT NULL DEFAULT 0,
    esi_employee_amount                             DECIMAL(10,2) NOT NULL DEFAULT 0,
    esi_employer_amount                               DECIMAL(10,2) NOT NULL DEFAULT 0,
    fines_amount                                        DECIMAL(10,2) NOT NULL DEFAULT 0,
    net_pay                                               DECIMAL(10,2) NOT NULL DEFAULT 0,

    generated_at                                            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_payroll_item (payroll_run_id, employee_id),
    CONSTRAINT fk_payroll_items_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
    CONSTRAINT fk_payroll_items_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_payroll_items_salary_structure FOREIGN KEY (salary_structure_id) REFERENCES salary_structures(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE fines
    ADD CONSTRAINT fk_fines_payroll_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE SET NULL;
ALTER TABLE overtime_entries
    ADD CONSTRAINT fk_overtime_payroll_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE SET NULL;


/*
 ============================================================================
 SECTION C — PATIENT & HOSPITAL SIDE
 ============================================================================
*/

/*
 ---------------------------------------------------------------------------
 3.1  PATIENT RECORDS
 ---------------------------------------------------------------------------
*/

/*
 Deliberately NOT unique on mobile_number: one number can belong to several
 patients (family members). Reception always searches by mobile_number and
 picks the right person by name + age.
*/
CREATE TABLE patients (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name             VARCHAR(150) NOT NULL,
    date_of_birth           DATE NULL,
    age_years                 SMALLINT UNSIGNED NULL,  /* captured directly if DOB unknown */
    gender                     ENUM('male','female','other') NOT NULL,
    mobile_number                VARCHAR(20) NOT NULL,
    address                        VARCHAR(255) NULL,
    blood_group                      VARCHAR(5) NULL,
    notes                               VARCHAR(255) NULL,
    created_at                           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY ix_patients_mobile (mobile_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/*
 ---------------------------------------------------------------------------
 3.2  APPOINTMENT / TOKEN MODULE
 ---------------------------------------------------------------------------
*/
CREATE TABLE appointments (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id            BIGINT UNSIGNED NOT NULL,
    doctor_id               BIGINT UNSIGNED NOT NULL,  /* references employees(id) */
    appointment_date          DATE NOT NULL,
    token_number                 INT UNSIGNED NOT NULL,  /* increases per day, per hospital (or per department if needed) */
    is_future_booking               TINYINT(1) NOT NULL DEFAULT 0,  /* supported by design, unused for now */
    status                            ENUM('waiting','in_consultation','completed','converted_to_admission','closed','cancelled') NOT NULL DEFAULT 'waiting',
    created_by                          BIGINT UNSIGNED NULL,
    created_at                            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_appointments_token (appointment_date, token_number),
    KEY ix_appointments_patient (patient_id),
    CONSTRAINT fk_appointments_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_appointments_doctor FOREIGN KEY (doctor_id) REFERENCES employees(id),
    CONSTRAINT fk_appointments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/*
 ---------------------------------------------------------------------------
 3.3  DOCTOR CONSULTATION & PRESCRIPTION
 ---------------------------------------------------------------------------
*/
CREATE TABLE consultations (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    appointment_id         BIGINT UNSIGNED NOT NULL,
    doctor_id                BIGINT UNSIGNED NOT NULL,
    diagnosis                  TEXT NULL,
    complaints                   TEXT NULL,
    doctor_notes                   TEXT NULL,
    follow_up_date                   DATE NULL,
    created_at                         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_consultation_appointment (appointment_id),
    CONSTRAINT fk_consultations_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    CONSTRAINT fk_consultations_doctor FOREIGN KEY (doctor_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE prescriptions (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    consultation_id        BIGINT UNSIGNED NOT NULL,
    created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_prescriptions_consultation FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Structured line items (not free text) so Pharmacy can auto-suggest stock.
*/
CREATE TABLE prescription_items (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    prescription_id        BIGINT UNSIGNED NOT NULL,
    medicine_id               BIGINT UNSIGNED NOT NULL,
    dose_morning                 TINYINT UNSIGNED NOT NULL DEFAULT 0,
    dose_afternoon                 TINYINT UNSIGNED NOT NULL DEFAULT 0,
    dose_night                       TINYINT UNSIGNED NOT NULL DEFAULT 0,
    duration_days                      SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    food_instruction                      ENUM('before_food','after_food','anytime') NOT NULL DEFAULT 'anytime',
    notes                                    VARCHAR(255) NULL,

    KEY ix_prescription_items_prescription (prescription_id),
    CONSTRAINT fk_prescription_items_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
    CONSTRAINT fk_prescription_items_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/*
 ---------------------------------------------------------------------------
 3.4  PHARMACY MODULE
 ---------------------------------------------------------------------------
*/
CREATE TABLE medicine_categories (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL,
    UNIQUE KEY uq_medicine_categories_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE medicines (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                  VARCHAR(150) NOT NULL,
    category_id             BIGINT UNSIGNED NOT NULL,
    description                TEXT NULL,
    unit                          VARCHAR(30) NULL,  /* e.g. 'tablet', 'bottle', 'strip' */
    stock_qty                       INT NOT NULL DEFAULT 0,
    price                              DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active                           TINYINT(1) NOT NULL DEFAULT 1,
    created_at                            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    KEY ix_medicines_category (category_id),
    CONSTRAINT fk_medicines_category FOREIGN KEY (category_id) REFERENCES medicine_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 A bill always belongs to a patient, and is linked to EITHER an appointment
 OR an admission (at least one of the two must be set) — supporting many
 bills against a single visit/stay, as required.
*/
CREATE TABLE pharmacy_bills (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id            BIGINT UNSIGNED NOT NULL,
    appointment_id           BIGINT UNSIGNED NULL,
    admission_id                BIGINT UNSIGNED NULL,
    bill_number                    VARCHAR(30) NOT NULL,
    bill_date                        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount                       DECIMAL(10,2) NOT NULL DEFAULT 0,
    generated_by                          BIGINT UNSIGNED NULL,  /* pharmacist (users.id) */

    UNIQUE KEY uq_pharmacy_bills_number (bill_number),
    KEY ix_pharmacy_bills_patient (patient_id),
    CONSTRAINT fk_pharmacy_bills_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_pharmacy_bills_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
    CONSTRAINT fk_pharmacy_bills_generated_by FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_pharmacy_bill_link CHECK (appointment_id IS NOT NULL OR admission_id IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pharmacy_bill_items (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pharmacy_bill_id       BIGINT UNSIGNED NOT NULL,
    medicine_id               BIGINT UNSIGNED NOT NULL,
    quantity                     INT UNSIGNED NOT NULL,
    unit_price                     DECIMAL(10,2) NOT NULL,
    subtotal                          DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

    KEY ix_bill_items_bill (pharmacy_bill_id),
    CONSTRAINT fk_bill_items_bill FOREIGN KEY (pharmacy_bill_id) REFERENCES pharmacy_bills(id) ON DELETE CASCADE,
    CONSTRAINT fk_bill_items_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/*
 ---------------------------------------------------------------------------
 3.5  ADMISSION & BED MANAGEMENT
 ---------------------------------------------------------------------------
*/
CREATE TABLE buildings (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL,
    UNIQUE KEY uq_buildings_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE floors (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    building_id            BIGINT UNSIGNED NOT NULL,
    name                      VARCHAR(100) NOT NULL,
    CONSTRAINT fk_floors_building FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wards (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    floor_id               BIGINT UNSIGNED NOT NULL,
    name                      VARCHAR(100) NOT NULL,  /* e.g. 'ICU', 'General Ward' */
    CONSTRAINT fk_wards_floor FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE room_types (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL,  /* e.g. 'General', 'Deluxe', 'ICU' */
    daily_rate               DECIMAL(10,2) NOT NULL DEFAULT 0,
    UNIQUE KEY uq_room_types_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rooms (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ward_id                BIGINT UNSIGNED NOT NULL,
    room_type_id              BIGINT UNSIGNED NOT NULL,
    room_number                  VARCHAR(30) NOT NULL,
    CONSTRAINT fk_rooms_ward FOREIGN KEY (ward_id) REFERENCES wards(id) ON DELETE CASCADE,
    CONSTRAINT fk_rooms_room_type FOREIGN KEY (room_type_id) REFERENCES room_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE beds (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    room_id                BIGINT UNSIGNED NOT NULL,
    bed_label                 VARCHAR(20) NOT NULL,  /* e.g. 'A', 'B' */
    status                       ENUM('available','occupied','maintenance') NOT NULL DEFAULT 'available',
    CONSTRAINT fk_beds_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    UNIQUE KEY uq_beds_room_label (room_id, bed_label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE admissions (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    patient_id            BIGINT UNSIGNED NOT NULL,
    appointment_id           BIGINT UNSIGNED NULL,  /* the appointment this was converted from, if any */
    admitting_doctor_id         BIGINT UNSIGNED NOT NULL,
    admission_datetime             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                            ENUM('admitted','discharged') NOT NULL DEFAULT 'admitted',
    created_by                          BIGINT UNSIGNED NULL,

    KEY ix_admissions_patient (patient_id),
    CONSTRAINT fk_admissions_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_admissions_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
    CONSTRAINT fk_admissions_doctor FOREIGN KEY (admitting_doctor_id) REFERENCES employees(id),
    CONSTRAINT fk_admissions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE pharmacy_bills
    ADD CONSTRAINT fk_pharmacy_bills_admission FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE SET NULL;

/*
 Link table: an admission can occupy more than one bed (e.g. the patient
 moves rooms partway through their stay), each with its own date range.
*/
CREATE TABLE admission_beds (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admission_id           BIGINT UNSIGNED NOT NULL,
    bed_id                    BIGINT UNSIGNED NOT NULL,
    occupied_from                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    occupied_to                     DATETIME NULL,  /* NULL = still occupying this bed */

    KEY ix_admission_beds_admission (admission_id),
    CONSTRAINT fk_admission_beds_admission FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_admission_beds_bed FOREIGN KEY (bed_id) REFERENCES beds(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/*
 ---------------------------------------------------------------------------
 3.6  DISCHARGE & PATIENT HISTORY
 ---------------------------------------------------------------------------
*/
CREATE TABLE discharges (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admission_id           BIGINT UNSIGNED NOT NULL,
    discharge_datetime         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    diagnosis_summary             TEXT NULL,
    treatment_summary                TEXT NULL,
    doctor_advice                       TEXT NULL,
    follow_up_date                        DATE NULL,
    final_bill_amount                        DECIMAL(10,2) NOT NULL DEFAULT 0,
    amount_paid                                 DECIMAL(10,2) NOT NULL DEFAULT 0,
    discharged_by                                  BIGINT UNSIGNED NULL,
    created_at                                       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_discharge_admission (admission_id),
    CONSTRAINT fk_discharges_admission FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_discharges_by FOREIGN KEY (discharged_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Closing a walk-in (not admitted) visit: payment + close, on the appointment
 itself, since there's no admission/discharge involved.
*/
CREATE TABLE appointment_payments (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    appointment_id         BIGINT UNSIGNED NOT NULL,
    amount_paid                DECIMAL(10,2) NOT NULL DEFAULT 0,
    paid_at                        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_by                      BIGINT UNSIGNED NULL,

    CONSTRAINT fk_appointment_payments_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    CONSTRAINT fk_appointment_payments_received_by FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 NOTE: "Patient History" (Module 3.6) is intentionally not a physical table.
 It is a query/view that joins patients -> appointments -> consultations ->
 prescriptions -> pharmacy_bills -> admissions -> discharges, ordered by
 date, so history is always live and never goes out of sync. Example below.
*/

CREATE OR REPLACE VIEW v_patient_history AS
SELECT
    p.id                AS patient_id,
    p.full_name          AS patient_name,
    a.id                  AS appointment_id,
    a.appointment_date      AS visit_date,
    a.token_number             AS token_number,
    d.full_name                  AS doctor_name,
    c.diagnosis                     AS diagnosis,
    ad.id                              AS admission_id,
    ad.admission_datetime                 AS admission_datetime,
    dis.discharge_datetime                   AS discharge_datetime,
    dis.final_bill_amount                       AS final_bill_amount
FROM patients p
JOIN appointments a       ON a.patient_id = p.id
LEFT JOIN employees d      ON d.id = a.doctor_id
LEFT JOIN consultations c   ON c.appointment_id = a.id
LEFT JOIN admissions ad      ON ad.appointment_id = a.id
LEFT JOIN discharges dis      ON dis.admission_id = ad.id
ORDER BY a.appointment_date DESC;

SET FOREIGN_KEY_CHECKS = 1;