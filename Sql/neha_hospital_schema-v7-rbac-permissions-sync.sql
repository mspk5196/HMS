-- ==============================================================================
-- Neha Hospital ERP — RBAC Modules & Permissions Sync (v7)
-- ==============================================================================

-- 1. Ensure all system modules are registered
INSERT INTO `modules` (`id`, `code`, `name`, `display_order`) VALUES
  (1, 'hr_employee', 'Employees', 1),
  (2, 'hr_department', 'Departments & Roles', 2),
  (3, 'hr_shift', 'Shifts', 3),
  (4, 'hr_roster', 'Shift Roster', 4),
  (5, 'attendance', 'Attendance', 5),
  (6, 'biometric', 'Biometric Logs', 6),
  (7, 'leave', 'Leave Management', 7),
  (8, 'fine', 'Fine Engine', 8),
  (9, 'payroll', 'Payroll', 9),
  (10, 'patient', 'Patients', 10),
  (11, 'appointment', 'Appointments', 11),
  (12, 'consultation', 'Consultations & Rx', 12),
  (13, 'admission', 'Admissions & Beds', 13),
  (14, 'discharge', 'Discharge & Billing', 14),
  (15, 'facility', 'Beds & Rooms Setup', 15),
  (16, 'payment', 'Payments & Fee Rates', 16),
  (17, 'pharmacy', 'Pharmacy (Stock & Dispense)', 17),
  (18, 'users', 'Users & Authentication', 18)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `display_order` = VALUES(`display_order`);

-- 2. Ensure standard & special actions are registered
INSERT INTO `actions` (`code`, `name`, `is_special`) VALUES
  ('view', 'View', 0),
  ('create', 'Create', 0),
  ('edit', 'Edit', 0),
  ('delete', 'Delete', 0),
  ('remap', 'Remap Employee', 1),
  ('set_salary', 'Set Salary', 1),
  ('bulk_import', 'Bulk Import Staff', 1),
  ('save_day', 'Save Roster Day', 1),
  ('bulk_save', 'Bulk Save Roster', 1),
  ('swap_shift', 'Swap Shift', 1),
  ('set_week_off', 'Set Week Off', 1),
  ('recalculate', 'Recalculate Attendance', 1),
  ('import_punches', 'Import Attendance Punches', 1),
  ('sync_device', 'Sync Punches from Device', 1),
  ('set_balance', 'Set Leave Balance', 1),
  ('review_reporting', 'Review — Reporting Manager', 1),
  ('review_hr', 'Review — HR', 1),
  ('record_absence', 'Record Unexplained Absence', 1),
  ('create_holiday', 'Create Holiday', 1),
  ('waive_fine', 'Waive Fine', 1),
  ('generate_payroll', 'Generate Monthly Payroll', 1),
  ('approve_payroll', 'Approve Payroll Run', 1),
  ('close_visit', 'Close Visit', 1),
  ('assign_bed', 'Assign Bed', 1),
  ('release_bed', 'Release Bed', 1),
  ('add_note', 'Add Daily Note', 1),
  ('discharge_patient', 'Discharge Patient', 1),
  ('record_payment', 'Record Payment', 1),
  ('building_create', 'Add Building', 1),
  ('building_delete', 'Delete Building', 1),
  ('floor_create', 'Add Floor', 1),
  ('floor_delete', 'Delete Floor', 1),
  ('ward_create', 'Add Ward', 1),
  ('ward_delete', 'Delete Ward', 1),
  ('room_type_create', 'Add Room Type', 1),
  ('room_type_edit', 'Edit Room Type', 1),
  ('room_create', 'Add Room', 1),
  ('room_delete', 'Delete Room', 1),
  ('bed_create', 'Add Bed', 1),
  ('bed_delete', 'Delete Bed', 1),
  ('bed_status', 'Change Bed Status', 1),
  ('set_fee_rate', 'Set Fee Rate', 1),
  ('collect_opd', 'Collect OPD Payment', 1),
  ('collect_ipd', 'Collect IPD Payment', 1),
  ('dispense_medicine', 'Dispense Medicine', 1),
  ('create_purchase_order', 'Create Purchase Order', 1),
  ('receive_goods_grn', 'Receive GRN Goods', 1),
  ('reset_password', 'Reset User Password', 1)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `is_special` = VALUES(`is_special`);

-- 3. Ensure all module.action permissions exist in permissions table
INSERT INTO `permissions` (`module_id`, `action_id`, `code`, `description`)
SELECT m.id, a.id, CONCAT(m.code, '.', a.code), CONCAT(a.name, ' — ', m.name)
FROM `modules` m
JOIN `actions` a ON a.code IN ('view', 'create', 'edit', 'delete')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- Special permissions
INSERT INTO `permissions` (`module_id`, `action_id`, `code`, `description`)
SELECT m.id, a.id, CONCAT(m.code, '.', a.code), CONCAT(a.name, ' — ', m.name)
FROM `modules` m
JOIN `actions` a ON (
  (m.code = 'hr_employee' AND a.code IN ('remap', 'set_salary', 'bulk_import')) OR
  (m.code = 'hr_roster' AND a.code IN ('save_day', 'bulk_save', 'swap_shift', 'set_week_off')) OR
  (m.code = 'attendance' AND a.code IN ('recalculate', 'import_punches')) OR
  (m.code = 'biometric' AND a.code IN ('sync_device')) OR
  (m.code = 'leave' AND a.code IN ('set_balance', 'review_reporting', 'review_hr', 'record_absence', 'create_holiday')) OR
  (m.code = 'fine' AND a.code IN ('waive_fine')) OR
  (m.code = 'payroll' AND a.code IN ('generate_payroll', 'approve_payroll')) OR
  (m.code = 'appointment' AND a.code IN ('close_visit')) OR
  (m.code = 'admission' AND a.code IN ('assign_bed', 'release_bed', 'add_note')) OR
  (m.code = 'discharge' AND a.code IN ('discharge_patient', 'record_payment')) OR
  (m.code = 'facility' AND a.code IN ('building_create', 'building_delete', 'floor_create', 'floor_delete', 'ward_create', 'ward_delete', 'room_type_create', 'room_type_edit', 'room_create', 'room_delete', 'bed_create', 'bed_delete', 'bed_status')) OR
  (m.code = 'payment' AND a.code IN ('set_fee_rate', 'collect_opd', 'collect_ipd')) OR
  (m.code = 'pharmacy' AND a.code IN ('dispense_medicine', 'create_purchase_order', 'receive_goods_grn')) OR
  (m.code = 'users' AND a.code IN ('reset_password'))
)
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);
