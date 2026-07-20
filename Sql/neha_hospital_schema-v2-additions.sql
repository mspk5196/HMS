/*
 ============================================================================
 NEHA HOSPITAL MANAGEMENT SYSTEM — SCHEMA v2 ADDITIONS
 Engine: MySQL 8.0+  |  Charset: utf8mb4

 Run this file AFTER neha_hospital_schema-v1.sql on the same database.
 All statements are additive (new tables + ALTER TABLE for new columns only).
 No existing columns are removed or renamed.

 Changes reflect answers confirmed on 2026-07-15:
   - Barcode-scanner pharmacy integration  → barcode col + medicine_batches
   - eSSL eTimeTracker biometric sync      → attendance_biometric_windows
   - Night-shift rate: versioned flat amt  → shift_rate_history table
   - Fine assigned to payroll period now   → assigned_month/year + status cols
   - Payroll confirmation + breakdown view → payroll_runs + payroll_items cols
   - Token resets daily per hospital       → confirmed (existing unique key ok)
   - Cash-only payment mode now            → ENUM col ready for future modes
   - Single branch now, multi later        → note at end of file
 ============================================================================
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

/* ============================================================================
   SECTION A ADDITIONS — Shared Foundation
   ============================================================================ */

/*
 Hospital-wide key-value config (hospital name, GSTIN, logo path, feature
 toggles). Non-payroll settings live here; payroll-specific rates stay in
 payroll_config.
*/
CREATE TABLE system_config (
    config_key   VARCHAR(100) PRIMARY KEY,
    config_value TEXT         NOT NULL,
    description  VARCHAR(255) NULL,
    updated_by   BIGINT UNSIGNED NULL,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sys_config_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO system_config (config_key, config_value, description) VALUES
    ('HOSPITAL_NAME',          'Neha Hospitals',         'Display name on bills, payslips, reports'),
    ('HOSPITAL_ADDRESS',       '',                        'Full address for letterhead'),
    ('HOSPITAL_PHONE',         '',                        'Primary contact number'),
    ('HOSPITAL_GSTIN',         '',                        'GST Identification Number'),
    ('HOSPITAL_LOGO_PATH',     '',                        'Relative server path to logo image'),
    ('TOKEN_SCOPE',            'hospital',                'Token counter scope: hospital | department'),
    ('SALARY_DATE_TYPE',       'last_day_of_month',       'last_day_of_month | first_of_next_month'),
    ('DEFAULT_BUFFER_MINUTES', '30',                      'Default monthly late-arrival buffer (minutes) for all roles'),
    ('FUTURE_BOOKING_ENABLED', '0',                       '1 = future-date appointment booking enabled in UI');

/*
 Admin-managed public / hospital holiday list.
 The roster planner reads this to mark holidays in roster_entries.
*/
CREATE TABLE holidays (
    id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    holiday_date DATE         NOT NULL,
    name         VARCHAR(100) NOT NULL,
    is_optional  TINYINT(1)   NOT NULL DEFAULT 0,
    created_by   BIGINT UNSIGNED NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_holidays_date (holiday_date),
    CONSTRAINT fk_holidays_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/* ============================================================================
   SECTION B ADDITIONS — HR & Employee
   ============================================================================ */

/*
 Employee document store (Aadhaar, PAN, offer letter, photo, etc.).
 doc_type is a free varchar so admin can define any document category.
*/
CREATE TABLE employee_documents (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employee_id BIGINT UNSIGNED NOT NULL,
    doc_type    VARCHAR(100)  NOT NULL,
    file_path   VARCHAR(500)  NOT NULL,
    uploaded_by BIGINT UNSIGNED NULL,
    uploaded_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_emp_docs_employee (employee_id),
    CONSTRAINT fk_emp_docs_employee    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_emp_docs_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Role-level default leave entitlements.
 When HR onboards a new employee, the application pre-fills leave_balances
 from this table (overriding the global leave_types.quota_days).
 HR can still adjust the allocation per individual employee afterwards.
 This is the schema hook for "different leave rules per role".
*/
CREATE TABLE role_leave_policies (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id       BIGINT UNSIGNED NOT NULL,
    leave_type_id BIGINT UNSIGNED NOT NULL,
    quota_days    DECIMAL(5,2)    NOT NULL DEFAULT 0,
    UNIQUE KEY uq_role_leave_policy (role_id, leave_type_id),
    CONSTRAINT fk_rlp_role       FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
    CONSTRAINT fk_rlp_leave_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/* ============================================================================
   SECTION B ADDITIONS — Shift & Roster
   ============================================================================ */

/*
 Night-shift flat rate history.

 Rate is a fixed ₹ amount added per night shift worked. Admin can change it
 anytime; this table records the full audit trail with effective_from /
 effective_to dates, so the payroll engine picks the correct rate even when
 recalculating historical months.

 Workflow to update the rate:
   1. UPDATE shift_rate_history SET effective_to = CURDATE() - INTERVAL 1 DAY
      WHERE shift_id = X AND effective_to IS NULL;
   2. INSERT new row with effective_from = desired start date, effective_to = NULL.
*/
CREATE TABLE shift_rate_history (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    shift_id          BIGINT UNSIGNED NOT NULL,
    night_rate_amount DECIMAL(10,2)   NOT NULL,
    effective_from    DATE            NOT NULL,
    effective_to      DATE            NULL,        /* NULL = currently active */
    reason            VARCHAR(255)    NULL,
    changed_by        BIGINT UNSIGNED NULL,
    created_at        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_shift_rate_shift (shift_id, effective_from),
    CONSTRAINT fk_shift_rate_shift      FOREIGN KEY (shift_id)   REFERENCES shifts(id) ON DELETE CASCADE,
    CONSTRAINT fk_shift_rate_changed_by FOREIGN KEY (changed_by) REFERENCES users(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Per-employee, per-month week-off quota override.
 Overrides the designation-level week_off_policies for one person.
*/
CREATE TABLE employee_week_off_overrides (
    id                BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    employee_id       BIGINT UNSIGNED  NOT NULL,
    period_month      TINYINT UNSIGNED NOT NULL,
    period_year       SMALLINT UNSIGNED NOT NULL,
    week_offs_allowed SMALLINT UNSIGNED NOT NULL,
    set_by            BIGINT UNSIGNED  NULL,
    created_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_emp_weekoff_override (employee_id, period_year, period_month),
    CONSTRAINT fk_weekoff_override_emp    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_weekoff_override_set_by FOREIGN KEY (set_by)      REFERENCES users(id)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* Add preferred day-of-week hint to designation-level week-off policy.
   0 = Sunday, 1 = Monday, … 6 = Saturday; NULL = roster planner decides. */
ALTER TABLE week_off_policies
    ADD COLUMN preferred_day_of_week TINYINT NULL AFTER week_offs_per_month;

ALTER TABLE week_off_policies
    ADD COLUMN notes VARCHAR(255) NULL AFTER preferred_day_of_week;

/*
 Salary structure additions.
   base_salary              — explicit base component (separate from gross) for payslip display.
   night_shift_extra_amount — baseline override stored here; actual amount used in calculation
                              always comes from shift_rate_history for the pay period.
*/
ALTER TABLE salary_structures
    ADD COLUMN base_salary DECIMAL(10,2) NULL AFTER rate_per_shift;

ALTER TABLE salary_structures
    ADD COLUMN night_shift_extra_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER base_salary;


/* ============================================================================
   SECTION B ADDITIONS — Attendance Engine
   ============================================================================ */

/*
 Admin-configurable extended biometric acceptance window per date, optionally
 scoped to a specific role (role_id IS NULL = applies to all roles).

 Integration note for eSSL eTimeTracker:
   eTimeTracker can export attendance logs as a CSV / MDB file, or the eSSL
   SDK may offer a direct API endpoint. The service at
   src/services/biometricSync.js will import those records into
   attendance_raw_punches. This table controls WHICH punches are accepted
   during the nightly attendance processing run.
*/
CREATE TABLE attendance_biometric_windows (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    window_date    DATE            NOT NULL,
    role_id        BIGINT UNSIGNED NULL,
    extended_start TIME            NOT NULL,
    extended_end   TIME            NOT NULL,
    reason         VARCHAR(255)    NULL,
    created_by     BIGINT UNSIGNED NULL,
    created_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_biometric_window_date (window_date),
    CONSTRAINT fk_bio_window_role       FOREIGN KEY (role_id)    REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_bio_window_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Monthly rolling late-arrival buffer pool per employee.
 Default allocation = system_config.DEFAULT_BUFFER_MINUTES (30 min).
 Admin can set a different allocation per employee directly in this table.
 Once buffer_used_minutes >= buffer_allocated_minutes, further late minutes
 feed LOP / fine calculations.
*/
CREATE TABLE employee_attendance_buffers (
    id                       BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    employee_id              BIGINT UNSIGNED  NOT NULL,
    period_month             TINYINT UNSIGNED NOT NULL,
    period_year              SMALLINT UNSIGNED NOT NULL,
    buffer_allocated_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    buffer_used_minutes      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    buffer_remaining_minutes SMALLINT UNSIGNED GENERATED ALWAYS AS
                             (GREATEST(0, buffer_allocated_minutes - buffer_used_minutes)) STORED,
    UNIQUE KEY uq_buffer_emp_period (employee_id, period_year, period_month),
    CONSTRAINT fk_buffer_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* Immutable audit log: one row per late-arrival deduction from the buffer */
CREATE TABLE buffer_deductions (
    id                     BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    employee_id            BIGINT UNSIGNED  NOT NULL,
    attendance_date        DATE             NOT NULL,
    late_minutes_deducted  SMALLINT UNSIGNED NOT NULL,
    buffer_remaining_after SMALLINT UNSIGNED NOT NULL,
    attendance_summary_id  BIGINT UNSIGNED  NOT NULL,
    created_at             TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_buf_ded_emp (employee_id, attendance_date),
    CONSTRAINT fk_buf_ded_employee   FOREIGN KEY (employee_id)           REFERENCES employees(id)               ON DELETE CASCADE,
    CONSTRAINT fk_buf_ded_attendance FOREIGN KEY (attendance_summary_id) REFERENCES attendance_daily_summary(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* Attendance daily summary: manual-mark support and biometric window flag.
   Split into individual ALTERs: TiDB does not allow AFTER to reference a
   column being added in the same ALTER TABLE statement. */
ALTER TABLE attendance_daily_summary ADD COLUMN is_manually_marked        TINYINT(1)      NOT NULL DEFAULT 0 AFTER is_missed_punch;
ALTER TABLE attendance_daily_summary ADD COLUMN manually_marked_by        BIGINT UNSIGNED NULL               AFTER is_manually_marked;
ALTER TABLE attendance_daily_summary ADD COLUMN manually_marked_at        TIMESTAMP       NULL               AFTER manually_marked_by;
ALTER TABLE attendance_daily_summary ADD COLUMN biometric_window_extended TINYINT(1)      NOT NULL DEFAULT 0 AFTER manually_marked_at;
ALTER TABLE attendance_daily_summary ADD CONSTRAINT fk_ads_manually_by FOREIGN KEY (manually_marked_by) REFERENCES users(id) ON DELETE SET NULL;


/* ============================================================================
   SECTION B ADDITIONS — Leave Engine
   ============================================================================ */

ALTER TABLE leave_types ADD COLUMN is_lop_applicable      TINYINT(1)   NOT NULL DEFAULT 1 AFTER is_active;
ALTER TABLE leave_types ADD COLUMN can_carry_forward      TINYINT(1)   NOT NULL DEFAULT 0 AFTER is_lop_applicable;
ALTER TABLE leave_types ADD COLUMN max_carry_forward_days DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER can_carry_forward;


/* ============================================================================
   SECTION B ADDITIONS — Fine Engine
   ============================================================================ */

ALTER TABLE fine_types ADD COLUMN calculation_basis ENUM('flat','per_day','percent_of_day_salary') NOT NULL DEFAULT 'flat' AFTER trigger_rule;
ALTER TABLE fine_types ADD COLUMN description       TEXT NULL AFTER calculation_basis;

/*
 Fine enhancements:
   assigned_month / assigned_year — tags the fine to a specific payroll period
     at the moment it is created; the payroll draft for that period immediately
     reflects it in the fines_amount breakdown.
   status lifecycle:
     active   → fine is live and will be deducted.
     waived   → authorised waiver (waive_fine permission required).
     cancelled → admin cancellation with mandatory reason.
     deducted → payroll run confirmed; fine is billed.
*/
ALTER TABLE fines ADD COLUMN assigned_month TINYINT UNSIGNED  NULL AFTER is_auto_generated;
ALTER TABLE fines ADD COLUMN assigned_year  SMALLINT UNSIGNED NULL AFTER assigned_month;
ALTER TABLE fines ADD COLUMN status         ENUM('active','waived','cancelled','deducted') NOT NULL DEFAULT 'active' AFTER assigned_year;
ALTER TABLE fines ADD COLUMN waived_by      BIGINT UNSIGNED   NULL AFTER status;
ALTER TABLE fines ADD COLUMN waived_at      TIMESTAMP         NULL AFTER waived_by;
ALTER TABLE fines ADD COLUMN waiver_reason  VARCHAR(255)      NULL AFTER waived_at;
ALTER TABLE fines ADD CONSTRAINT fk_fines_waived_by FOREIGN KEY (waived_by) REFERENCES users(id) ON DELETE SET NULL;


/* ============================================================================
   SECTION B ADDITIONS — Payroll Engine
   ============================================================================ */

/*
 Payroll run additions:
   salary_date_type — snapshot of the config at run-creation time so that
     changing the system config never retroactively affects past runs.
   salary_date      — computed by the application (last day of month, or 1st of next).
   confirmed_by / confirmed_at — HR explicitly confirms after reviewing salary
     breakdowns. Only after confirmation does status move to 'locked'.
*/
ALTER TABLE payroll_runs ADD COLUMN salary_date_type ENUM('last_day_of_month','first_of_next_month') NOT NULL DEFAULT 'last_day_of_month' AFTER status;
ALTER TABLE payroll_runs ADD COLUMN salary_date      DATE            NULL AFTER salary_date_type;
ALTER TABLE payroll_runs ADD COLUMN confirmed_by     BIGINT UNSIGNED NULL AFTER locked_at;
ALTER TABLE payroll_runs ADD COLUMN confirmed_at     TIMESTAMP       NULL AFTER confirmed_by;
ALTER TABLE payroll_runs ADD CONSTRAINT fk_payroll_runs_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL;

/*
 Payroll item breakdown additions (displayed on the salary-review screen and PDF payslip).
 Existing: gross_pay, lop_amount, overtime_amount, pf_*_amount, esi_*_amount, fines_amount, net_pay.
 New:
   base_salary_component — the fixed/per-day/per-shift earned component before additions/deductions.
   night_shift_component — flat rate earned for night shifts this period (from shift_rate_history).
   buffer_late_deduction — salary value of late minutes that exceeded the monthly buffer,
                           treated as fractional LOP and shown separately on the payslip.
*/
ALTER TABLE payroll_items ADD COLUMN base_salary_component DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER shifts_worked;
ALTER TABLE payroll_items ADD COLUMN night_shift_component DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER base_salary_component;
ALTER TABLE payroll_items ADD COLUMN buffer_late_deduction DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER night_shift_component;


/* ============================================================================
   SECTION C ADDITIONS — Patient & Appointment
   ============================================================================ */

ALTER TABLE appointments ADD COLUMN visit_type         ENUM('walk_in','future_booking') NOT NULL DEFAULT 'walk_in' AFTER is_future_booking;
ALTER TABLE appointments ADD COLUMN receptionist_notes VARCHAR(500) NULL                                           AFTER visit_type;
ALTER TABLE appointments ADD COLUMN closed_at          TIMESTAMP    NULL                                           AFTER receptionist_notes;
ALTER TABLE appointments ADD COLUMN closed_by          BIGINT UNSIGNED NULL                                        AFTER closed_at;
ALTER TABLE appointments ADD CONSTRAINT fk_appointments_closed_by FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE admissions ADD COLUMN notes        TEXT            NULL AFTER status;
ALTER TABLE admissions ADD COLUMN converted_by BIGINT UNSIGNED NULL AFTER notes;
ALTER TABLE admissions ADD CONSTRAINT fk_admissions_converted_by FOREIGN KEY (converted_by) REFERENCES users(id) ON DELETE SET NULL;

/*
 Discharge additions:
   discharge_condition  — clinical outcome at discharge.
   room/pharmacy/other  — cost breakdown for the discharge summary PDF.
   balance_due          — any unpaid amount.
   payment_mode         — cash only now; ENUM ready for future modes.
   discharge_notes      — final clinical notes.
*/
ALTER TABLE discharges ADD COLUMN discharge_condition ENUM('recovered','referred','lama','expired','other') NULL AFTER doctor_advice;
ALTER TABLE discharges ADD COLUMN room_charges        DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER discharge_condition;
ALTER TABLE discharges ADD COLUMN pharmacy_charges    DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER room_charges;
ALTER TABLE discharges ADD COLUMN other_charges       DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER pharmacy_charges;
ALTER TABLE discharges ADD COLUMN balance_due         DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER amount_paid;
ALTER TABLE discharges ADD COLUMN payment_mode        ENUM('cash','upi','card','insurance','credit') NOT NULL DEFAULT 'cash' AFTER balance_due;
ALTER TABLE discharges ADD COLUMN discharge_notes     TEXT          NULL                                         AFTER payment_mode;


/* ============================================================================
   SECTION C ADDITIONS — Pharmacy
   ============================================================================ */

/*
 Medicine master additions:
   barcode      — code read from the barcode scanner (currently used by Corpus).
                  The HMS pharmacy billing page accepts scanner input, queries
                  this column, and auto-fills the medicine row in the bill form.
   reorder_level — triggers low-stock alerts in the admin dashboard.
   manufacturer, hsn_code, gst_percent — GST invoice compliance fields.
*/
ALTER TABLE medicines ADD COLUMN manufacturer  VARCHAR(150) NULL                AFTER description;
ALTER TABLE medicines ADD COLUMN hsn_code      VARCHAR(20)  NULL                AFTER manufacturer;
ALTER TABLE medicines ADD COLUMN gst_percent   DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER hsn_code;
ALTER TABLE medicines ADD COLUMN reorder_level INT          NOT NULL DEFAULT 0 AFTER gst_percent;
ALTER TABLE medicines ADD COLUMN barcode       VARCHAR(100) NULL                AFTER reorder_level;
ALTER TABLE medicines ADD KEY ix_medicines_barcode (barcode);

/*
 Medicine batch tracking.
 Each incoming stock receipt = one batch row.
 Billing deducts from the batch with the earliest expiry_date (FIFO).
 medicines.stock_qty = SUM(batch qty) — kept in sync by the application layer.
*/
CREATE TABLE medicine_batches (
    id             BIGINT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    medicine_id    BIGINT UNSIGNED  NOT NULL,
    batch_number   VARCHAR(50)      NOT NULL,
    expiry_date    DATE             NOT NULL,
    qty_in_stock   INT              NOT NULL DEFAULT 0,
    purchase_price DECIMAL(10,2)   NOT NULL DEFAULT 0,
    selling_price  DECIMAL(10,2)   NOT NULL DEFAULT 0,
    received_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_med_batches_medicine (medicine_id),
    KEY ix_med_batches_expiry   (expiry_date),
    CONSTRAINT fk_med_batches_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*
 Pharmacy bill additions:
   discount_amount / tax_amount / net_amount — itemised totals for the bill PDF.
   payment_mode   — 'cash' only currently; ENUM ready for UPI/card/insurance.
   payment_status — pending | paid | partial (useful for credit/insurance cases).
*/
ALTER TABLE pharmacy_bills ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0  AFTER total_amount;
ALTER TABLE pharmacy_bills ADD COLUMN tax_amount      DECIMAL(10,2) NOT NULL DEFAULT 0  AFTER discount_amount;
ALTER TABLE pharmacy_bills ADD COLUMN net_amount      DECIMAL(10,2) NOT NULL DEFAULT 0  AFTER tax_amount;
ALTER TABLE pharmacy_bills ADD COLUMN payment_mode    ENUM('cash','upi','card','insurance','credit') NOT NULL DEFAULT 'cash' AFTER net_amount;
ALTER TABLE pharmacy_bills ADD COLUMN payment_status  ENUM('pending','paid','partial') NOT NULL DEFAULT 'pending' AFTER payment_mode;

/*
 Pharmacy bill item additions:
   batch_id         — which batch the stock was drawn from (FIFO; NULL = pre-batch data).
   discount_percent — item-level discount percentage.
*/
ALTER TABLE pharmacy_bill_items ADD COLUMN batch_id         BIGINT UNSIGNED NULL                AFTER medicine_id;
ALTER TABLE pharmacy_bill_items ADD COLUMN discount_percent DECIMAL(5,2)    NOT NULL DEFAULT 0 AFTER batch_id;
ALTER TABLE pharmacy_bill_items ADD CONSTRAINT fk_bill_items_batch FOREIGN KEY (batch_id) REFERENCES medicine_batches(id) ON DELETE SET NULL;


SET FOREIGN_KEY_CHECKS = 1;

/*
 ============================================================================
 MULTI-BRANCH READINESS NOTE
 ============================================================================
 Schema is intentionally single-branch for now. When multi-branch is needed,
 add a `branches` table and nullable `branch_id` FK columns to:
   employees, appointments, admissions, pharmacy_bills, payroll_runs.
 All token numbers, roster entries, and attendance windows are already
 implicitly branch-scoped through employees, so the migration will be
 additive and non-breaking.
 ============================================================================
*/
