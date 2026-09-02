-- ==============================================================================
-- Neha Hospital Management System — Complete Reset / Truncate Script
-- ==============================================================================
-- Purpose: Truncates all transactional, patient, clinical, pharmacy, attendance,
--          payroll, activity logs, departments, staff roles, and shifts.
--          Preserves RBAC core permissions, system configs, and Admin account.
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
TRUNCATE TABLE `doctor_fee_rates`;

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
-- 3. HR, ATTENDANCE, LEAVE, PAYROLL, DEPARTMENTS & SHIFTS
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

-- Truncate Departments, Roles/Designations, Shifts & Policies
TRUNCATE TABLE `week_off_policies`;
TRUNCATE TABLE `role_leave_policies`;
TRUNCATE TABLE `staff_roles`;
TRUNCATE TABLE `designations`;
TRUNCATE TABLE `departments`;
TRUNCATE TABLE `shifts`;

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
-- Summary of Preserved Master Configuration Tables:
--  - modules, actions, permissions, module_actions, approval_workflows
--  - roles, role_permissions, system_config
--  - leave_types, fine_types, payroll_config, salary_structures
--  - buildings, floors, wards, room_types, rooms, beds
--  - medicine_categories, medicine_form_factors, biometric_devices
--  - users (Administrator id=1 preserved)
-- ==============================================================================
