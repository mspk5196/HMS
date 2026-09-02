-- ==============================================================================
-- Neha Hospital Management System — Database Reset / Truncate Script
-- ==============================================================================
-- Purpose: Truncates all transactional, patient, clinical, pharmacy, attendance,
--          payroll, and activity logs while preserving essential master data,
--          configurations, RBAC permissions, and system setup required for
--          the application to run cleanly.
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PATIENT, CLINICAL & VISIT TRANSACTIONS
-- ─────────────────────────────────────────────────────────────────────────────
TRUNCATE TABLE `admission_daily_notes`;
TRUNCATE TABLE `admission_beds`;
TRUNCATE TABLE `discharges`;
TRUNCATE TABLE `admissions`;
TRUNCATE TABLE `prescription_items`;
TRUNCATE TABLE `prescriptions`;
TRUNCATE TABLE `consultations`;
TRUNCATE TABLE `appointment_payments`;
TRUNCATE TABLE `appointments`;
TRUNCATE TABLE `patients`;
TRUNCATE TABLE `payment_receipt_items`;
TRUNCATE TABLE `payment_receipts`;

-- Reset all hospital beds to available
UPDATE `beds` SET `status` = 'available' WHERE `status` != 'available';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PHARMACY TRANSACTIONS & INVENTORY
-- ─────────────────────────────────────────────────────────────────────────────
TRUNCATE TABLE `pharmacy_bill_items`;
TRUNCATE TABLE `pharmacy_bills`;
TRUNCATE TABLE `goods_receipt_items`;
TRUNCATE TABLE `goods_receipts`;
TRUNCATE TABLE `purchase_order_items`;
TRUNCATE TABLE `purchase_orders`;
TRUNCATE TABLE `stock_movements`;
TRUNCATE TABLE `medicine_batches`;
TRUNCATE TABLE `medicines`;
TRUNCATE TABLE `pharmacy_suppliers`;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. HR, ATTENDANCE, LEAVE & PAYROLL ACTIVITY
-- ─────────────────────────────────────────────────────────────────────────────
TRUNCATE TABLE `attendance_raw_punches`;
TRUNCATE TABLE `attendance_daily_summary`;
TRUNCATE TABLE `attendance_correction_requests`;
TRUNCATE TABLE `attendance_biometric_windows`;
TRUNCATE TABLE `buffer_deductions`;
TRUNCATE TABLE `employee_attendance_buffers`;
TRUNCATE TABLE `employee_week_off_overrides`;
TRUNCATE TABLE `overtime_entries`;
TRUNCATE TABLE `roster_entries`;
TRUNCATE TABLE `shift_rate_history`;
TRUNCATE TABLE `leave_requests`;
TRUNCATE TABLE `leave_balances`;
TRUNCATE TABLE `holidays`;
TRUNCATE TABLE `fines`;
TRUNCATE TABLE `payroll_items`;
TRUNCATE TABLE `payroll_runs`;
TRUNCATE TABLE `employee_documents`;
TRUNCATE TABLE `employee_salary_logs`;
TRUNCATE TABLE `employee_role_remapping_logs`;
TRUNCATE TABLE `employees`;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. LOGS, WORKFLOWS & USER ACCOUNTS (PRESERVE ADMIN)
-- ─────────────────────────────────────────────────────────────────────────────
TRUNCATE TABLE `audit_logs`;
TRUNCATE TABLE `pending_approvals`;
TRUNCATE TABLE `user_permission_overrides`;

-- Remove test/created user accounts while preserving primary Administrator (ID: 1)
DELETE FROM `users` WHERE `id` > 1;
UPDATE `users` SET `employee_id` = NULL WHERE `id` = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- Summary of Preserved Master Configuration Tables (NOT Truncated):
--  - modules, actions, permissions, module_actions, approval_workflows
--  - roles, role_permissions, system_config
--  - departments, staff_roles, designations, shifts
--  - leave_types, fine_types, payroll_config, salary_structures
--  - role_leave_policies, week_off_policies
--  - buildings, floors, wards, room_types, rooms, beds
--  - medicine_categories, medicine_form_factors
--  - biometric_devices, doctor_fee_rates
--  - users (Administrator id=1 preserved)
-- ==============================================================================
