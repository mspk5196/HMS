/*
 Navicat Premium Dump SQL

 Source Server         : TiDB Cloud
 Source Server Type    : MySQL
 Source Server Version : 80011 (8.0.11-TiDB-v8.5.3-serverless)
 Source Host           : gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000
 Source Schema         : nehahospitals

 Target Server Type    : MySQL
 Target Server Version : 80011 (8.0.11-TiDB-v8.5.3-serverless)
 File Encoding         : 65001

 Date: 29/07/2026 14:32:45
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for actions
-- ----------------------------
DROP TABLE IF EXISTS `actions`;
CREATE TABLE `actions`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `is_special` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_actions_code`(`code` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 200645 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of actions
-- ----------------------------
INSERT INTO `actions` VALUES (1, 'view', 'View / Read', 0);
INSERT INTO `actions` VALUES (2, 'modify', 'Create / Edit', 0);
INSERT INTO `actions` VALUES (3, 'delete', 'Delete', 0);
INSERT INTO `actions` VALUES (4, 'approve_increment', 'Approve Salary Increment', 1);
INSERT INTO `actions` VALUES (5, 'publish_roster', 'Publish Roster', 1);
INSERT INTO `actions` VALUES (6, 'approve_correction', 'Approve Attendance Correction', 1);
INSERT INTO `actions` VALUES (7, 'approve_leave_reporting', 'Approve Leave (Reporting Person)', 1);
INSERT INTO `actions` VALUES (8, 'approve_leave_hr', 'Approve Leave (HR, Final)', 1);
INSERT INTO `actions` VALUES (9, 'waive_fine', 'Waive / Cancel a Fine', 1);
INSERT INTO `actions` VALUES (10, 'lock_payroll', 'Lock Payroll Run', 1);
INSERT INTO `actions` VALUES (11, 'generate_payslip', 'Generate Payslip', 1);
INSERT INTO `actions` VALUES (12, 'close_appointment', 'Close / Cancel Appointment', 1);
INSERT INTO `actions` VALUES (13, 'convert_to_admission', 'Convert Appointment to Admission', 1);
INSERT INTO `actions` VALUES (14, 'assign_bed', 'Assign / Change Bed', 1);
INSERT INTO `actions` VALUES (15, 'generate_bill', 'Generate Pharmacy Bill', 1);
INSERT INTO `actions` VALUES (16, 'discharge_patient', 'Discharge Patient', 1);

-- ----------------------------
-- Table structure for admission_beds
-- ----------------------------
DROP TABLE IF EXISTS `admission_beds`;
CREATE TABLE `admission_beds`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `admission_id` bigint UNSIGNED NOT NULL,
  `bed_id` bigint UNSIGNED NOT NULL,
  `occupied_from` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `occupied_to` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_admission_beds_admission`(`admission_id` ASC) USING BTREE,
  INDEX `fk_admission_beds_bed`(`bed_id` ASC) USING BTREE,
  CONSTRAINT `fk_admission_beds_admission` FOREIGN KEY (`admission_id`) REFERENCES `admissions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_admission_beds_bed` FOREIGN KEY (`bed_id`) REFERENCES `beds` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of admission_beds
-- ----------------------------

-- ----------------------------
-- Table structure for admissions
-- ----------------------------
DROP TABLE IF EXISTS `admissions`;
CREATE TABLE `admissions`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `patient_id` bigint UNSIGNED NOT NULL,
  `appointment_id` bigint UNSIGNED NULL DEFAULT NULL,
  `admitting_doctor_id` bigint UNSIGNED NOT NULL,
  `admission_datetime` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('admitted','discharged') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'admitted',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `converted_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_by` bigint UNSIGNED NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_admissions_patient`(`patient_id` ASC) USING BTREE,
  INDEX `fk_admissions_appointment`(`appointment_id` ASC) USING BTREE,
  INDEX `fk_admissions_doctor`(`admitting_doctor_id` ASC) USING BTREE,
  INDEX `fk_admissions_created_by`(`created_by` ASC) USING BTREE,
  INDEX `fk_admissions_converted_by`(`converted_by` ASC) USING BTREE,
  CONSTRAINT `fk_admissions_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_admissions_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_admissions_doctor` FOREIGN KEY (`admitting_doctor_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_admissions_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_admissions_converted_by` FOREIGN KEY (`converted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of admissions
-- ----------------------------

-- ----------------------------
-- Table structure for appointment_payments
-- ----------------------------
DROP TABLE IF EXISTS `appointment_payments`;
CREATE TABLE `appointment_payments`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `appointment_id` bigint UNSIGNED NOT NULL,
  `amount_paid` decimal(10, 2) NOT NULL DEFAULT 0,
  `paid_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `received_by` bigint UNSIGNED NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `fk_appointment_payments_appointment`(`appointment_id` ASC) USING BTREE,
  INDEX `fk_appointment_payments_received_by`(`received_by` ASC) USING BTREE,
  CONSTRAINT `fk_appointment_payments_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_appointment_payments_received_by` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of appointment_payments
-- ----------------------------

-- ----------------------------
-- Table structure for appointments
-- ----------------------------
DROP TABLE IF EXISTS `appointments`;
CREATE TABLE `appointments`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `patient_id` bigint UNSIGNED NOT NULL,
  `doctor_id` bigint UNSIGNED NOT NULL,
  `appointment_date` date NOT NULL,
  `token_number` int UNSIGNED NOT NULL,
  `is_future_booking` tinyint(1) NOT NULL DEFAULT 0,
  `visit_type` enum('walk_in','future_booking') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'walk_in',
  `receptionist_notes` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `closed_by` bigint UNSIGNED NULL DEFAULT NULL,
  `status` enum('waiting','in_consultation','completed','converted_to_admission','closed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'waiting',
  `created_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_appointments_token`(`appointment_date` ASC, `token_number` ASC) USING BTREE,
  INDEX `ix_appointments_patient`(`patient_id` ASC) USING BTREE,
  INDEX `fk_appointments_doctor`(`doctor_id` ASC) USING BTREE,
  INDEX `fk_appointments_created_by`(`created_by` ASC) USING BTREE,
  INDEX `fk_appointments_closed_by`(`closed_by` ASC) USING BTREE,
  CONSTRAINT `fk_appointments_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_appointments_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_appointments_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_appointments_closed_by` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of appointments
-- ----------------------------

-- ----------------------------
-- Table structure for attendance_biometric_windows
-- ----------------------------
DROP TABLE IF EXISTS `attendance_biometric_windows`;
CREATE TABLE `attendance_biometric_windows`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `window_date` date NOT NULL,
  `role_id` bigint UNSIGNED NULL DEFAULT NULL,
  `extended_start` time NOT NULL,
  `extended_end` time NOT NULL,
  `reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `created_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_biometric_window_date`(`window_date` ASC) USING BTREE,
  INDEX `fk_bio_window_role`(`role_id` ASC) USING BTREE,
  INDEX `fk_bio_window_created_by`(`created_by` ASC) USING BTREE,
  CONSTRAINT `fk_bio_window_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_bio_window_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of attendance_biometric_windows
-- ----------------------------

-- ----------------------------
-- Table structure for attendance_correction_requests
-- ----------------------------
DROP TABLE IF EXISTS `attendance_correction_requests`;
CREATE TABLE `attendance_correction_requests`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `attendance_date` date NOT NULL,
  `requested_in_time` datetime NULL DEFAULT NULL,
  `requested_out_time` datetime NULL DEFAULT NULL,
  `reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending',
  `reviewed_by` bigint UNSIGNED NULL DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `fk_correction_employee`(`employee_id` ASC) USING BTREE,
  INDEX `fk_correction_reviewer`(`reviewed_by` ASC) USING BTREE,
  CONSTRAINT `fk_correction_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_correction_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of attendance_correction_requests
-- ----------------------------

-- ----------------------------
-- Table structure for attendance_daily_summary
-- ----------------------------
DROP TABLE IF EXISTS `attendance_daily_summary`;
CREATE TABLE `attendance_daily_summary`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `attendance_date` date NOT NULL,
  `shift_id` bigint UNSIGNED NULL DEFAULT NULL,
  `first_in_time` datetime NULL DEFAULT NULL,
  `last_out_time` datetime NULL DEFAULT NULL,
  `worked_minutes` int NULL DEFAULT NULL,
  `break_minutes` int NULL DEFAULT NULL,
  `late_minutes` int NOT NULL DEFAULT 0,
  `early_leave_minutes` int NOT NULL DEFAULT 0,
  `status` enum('present','late_present','absent','on_leave','lop','week_off','holiday') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `is_missed_punch` tinyint(1) NOT NULL DEFAULT 0,
  `is_manually_marked` tinyint(1) NOT NULL DEFAULT 0,
  `manually_marked_by` bigint UNSIGNED NULL DEFAULT NULL,
  `manually_marked_at` timestamp NULL DEFAULT NULL,
  `biometric_window_extended` tinyint(1) NOT NULL DEFAULT 0,
  `recalculated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `overtime_minutes` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_attendance_employee_date`(`employee_id` ASC, `attendance_date` ASC) USING BTREE,
  INDEX `ix_attendance_date`(`attendance_date` ASC) USING BTREE,
  INDEX `fk_attendance_shift`(`shift_id` ASC) USING BTREE,
  INDEX `fk_ads_manually_by`(`manually_marked_by` ASC) USING BTREE,
  CONSTRAINT `fk_attendance_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_attendance_shift` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_ads_manually_by` FOREIGN KEY (`manually_marked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of attendance_daily_summary
-- ----------------------------

-- ----------------------------
-- Table structure for attendance_raw_punches
-- ----------------------------
DROP TABLE IF EXISTS `attendance_raw_punches`;
CREATE TABLE `attendance_raw_punches`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `device_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `punch_time` datetime NOT NULL,
  `raw_payload` json NULL,
  `synced_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `employee_id` bigint UNSIGNED NULL DEFAULT NULL,
  `punch_type` enum('in','out') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `is_processed` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_raw_punches_employee_time`(`employee_code` ASC, `punch_time` ASC) USING BTREE,
  INDEX `ix_raw_punches_unprocessed`(`is_processed` ASC, `punch_time` ASC) USING BTREE,
  UNIQUE INDEX `uq_raw_punch`(`employee_code` ASC, `punch_time` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of attendance_raw_punches
-- ----------------------------

-- ----------------------------
-- Table structure for audit_logs
-- ----------------------------
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NULL DEFAULT NULL,
  `entity_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `entity_id` bigint UNSIGNED NOT NULL,
  `action` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `old_value` json NULL,
  `new_value` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_audit_entity`(`entity_type` ASC, `entity_id` ASC) USING BTREE,
  INDEX `ix_audit_user`(`user_id` ASC) USING BTREE,
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of audit_logs
-- ----------------------------

-- ----------------------------
-- Table structure for beds
-- ----------------------------
DROP TABLE IF EXISTS `beds`;
CREATE TABLE `beds`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `room_id` bigint UNSIGNED NOT NULL,
  `bed_label` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `status` enum('available','occupied','maintenance') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'available',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_beds_room_label`(`room_id` ASC, `bed_label` ASC) USING BTREE,
  CONSTRAINT `fk_beds_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of beds
-- ----------------------------

-- ----------------------------
-- Table structure for buffer_deductions
-- ----------------------------
DROP TABLE IF EXISTS `buffer_deductions`;
CREATE TABLE `buffer_deductions`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `attendance_date` date NOT NULL,
  `late_minutes_deducted` smallint UNSIGNED NOT NULL,
  `buffer_remaining_after` smallint UNSIGNED NOT NULL,
  `attendance_summary_id` bigint UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_buf_ded_emp`(`employee_id` ASC, `attendance_date` ASC) USING BTREE,
  INDEX `fk_buf_ded_attendance`(`attendance_summary_id` ASC) USING BTREE,
  CONSTRAINT `fk_buf_ded_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_buf_ded_attendance` FOREIGN KEY (`attendance_summary_id`) REFERENCES `attendance_daily_summary` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of buffer_deductions
-- ----------------------------

-- ----------------------------
-- Table structure for buildings
-- ----------------------------
DROP TABLE IF EXISTS `buildings`;
CREATE TABLE `buildings`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_buildings_name`(`name` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of buildings
-- ----------------------------

-- ----------------------------
-- Table structure for consultations
-- ----------------------------
DROP TABLE IF EXISTS `consultations`;
CREATE TABLE `consultations`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `appointment_id` bigint UNSIGNED NOT NULL,
  `doctor_id` bigint UNSIGNED NOT NULL,
  `diagnosis` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `complaints` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `doctor_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `follow_up_date` date NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_consultation_appointment`(`appointment_id` ASC) USING BTREE,
  INDEX `fk_consultations_doctor`(`doctor_id` ASC) USING BTREE,
  CONSTRAINT `fk_consultations_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_consultations_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of consultations
-- ----------------------------

-- ----------------------------
-- Table structure for departments
-- ----------------------------
DROP TABLE IF EXISTS `departments`;
CREATE TABLE `departments`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `head` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_departments_name`(`name` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 90001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of departments
-- ----------------------------
INSERT INTO `departments` VALUES (3, 'NURSING', 1, '2026-07-20 14:10:51', '2026-07-20 14:10:51', 'Department of NURSING', '—');
INSERT INTO `departments` VALUES (4, 'PHARMACY', 1, '2026-07-20 14:18:41', '2026-07-20 14:18:41', 'Department of PHARMACY', '—');
INSERT INTO `departments` VALUES (5, 'GENERAL MEDICINE', 1, '2026-07-20 14:20:17', '2026-07-20 14:20:17', 'Department of GENERAL MEDICINE', '—');
INSERT INTO `departments` VALUES (6, 'LABORATORY', 1, '2026-07-20 14:21:16', '2026-07-20 14:21:16', 'Department of LABORATORY', '—');
INSERT INTO `departments` VALUES (7, 'ADMINISTRATION', 1, '2026-07-20 14:24:34', '2026-07-20 14:24:34', 'Department of ADMINISTRATION', '—');
INSERT INTO `departments` VALUES (8, 'ORTHO', 1, '2026-07-20 14:26:48', '2026-07-20 14:26:48', 'Department of ORTHO', '—');
INSERT INTO `departments` VALUES (9, 'PEDIATRICS', 1, '2026-07-20 14:29:00', '2026-07-20 14:29:00', 'Department of PEDIATRICS', '—');
INSERT INTO `departments` VALUES (10, 'ANESTHESIA', 1, '2026-07-20 14:31:07', '2026-07-20 14:31:07', 'Department of ANESTHESIA', '—');
INSERT INTO `departments` VALUES (11, 'GYNEC', 1, '2026-07-20 14:35:05', '2026-07-20 14:35:05', 'Department of GYNEC', '—');
INSERT INTO `departments` VALUES (60001, 'SUPPORTING DEPT.', 1, '2026-07-21 09:56:31', '2026-07-21 09:56:31', NULL, '—');

-- ----------------------------
-- Table structure for designations
-- ----------------------------
DROP TABLE IF EXISTS `designations`;
CREATE TABLE `designations`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_designations_name`(`name` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of designations
-- ----------------------------

-- ----------------------------
-- Table structure for discharges
-- ----------------------------
DROP TABLE IF EXISTS `discharges`;
CREATE TABLE `discharges`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `admission_id` bigint UNSIGNED NOT NULL,
  `discharge_datetime` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `diagnosis_summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `treatment_summary` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `doctor_advice` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `discharge_condition` enum('recovered','referred','lama','expired','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `room_charges` decimal(10, 2) NOT NULL DEFAULT 0,
  `pharmacy_charges` decimal(10, 2) NOT NULL DEFAULT 0,
  `other_charges` decimal(10, 2) NOT NULL DEFAULT 0,
  `follow_up_date` date NULL DEFAULT NULL,
  `final_bill_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `amount_paid` decimal(10, 2) NOT NULL DEFAULT 0,
  `balance_due` decimal(10, 2) NOT NULL DEFAULT 0,
  `payment_mode` enum('cash','upi','card','insurance','credit') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'cash',
  `discharge_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `discharged_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_discharge_admission`(`admission_id` ASC) USING BTREE,
  INDEX `fk_discharges_by`(`discharged_by` ASC) USING BTREE,
  CONSTRAINT `fk_discharges_admission` FOREIGN KEY (`admission_id`) REFERENCES `admissions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_discharges_by` FOREIGN KEY (`discharged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of discharges
-- ----------------------------

-- ----------------------------
-- Table structure for employee_attendance_buffers
-- ----------------------------
DROP TABLE IF EXISTS `employee_attendance_buffers`;
CREATE TABLE `employee_attendance_buffers`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `period_month` tinyint UNSIGNED NOT NULL,
  `period_year` smallint UNSIGNED NOT NULL,
  `buffer_allocated_minutes` smallint UNSIGNED NOT NULL DEFAULT 30,
  `buffer_used_minutes` smallint UNSIGNED NOT NULL DEFAULT 0,
  `buffer_remaining_minutes` smallint UNSIGNED GENERATED ALWAYS AS (greatest(0, `buffer_allocated_minutes` - `buffer_used_minutes`)) STORED NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_buffer_emp_period`(`employee_id` ASC, `period_year` ASC, `period_month` ASC) USING BTREE,
  CONSTRAINT `fk_buffer_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of employee_attendance_buffers
-- ----------------------------

-- ----------------------------
-- Table structure for employee_documents
-- ----------------------------
DROP TABLE IF EXISTS `employee_documents`;
CREATE TABLE `employee_documents`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `doc_type` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `file_path` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `uploaded_by` bigint UNSIGNED NULL DEFAULT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_emp_docs_employee`(`employee_id` ASC) USING BTREE,
  INDEX `fk_emp_docs_uploaded_by`(`uploaded_by` ASC) USING BTREE,
  CONSTRAINT `fk_emp_docs_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_emp_docs_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of employee_documents
-- ----------------------------

-- ----------------------------
-- Table structure for employee_week_off_overrides
-- ----------------------------
DROP TABLE IF EXISTS `employee_week_off_overrides`;
CREATE TABLE `employee_week_off_overrides`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `period_month` tinyint UNSIGNED NOT NULL,
  `period_year` smallint UNSIGNED NOT NULL,
  `week_offs_allowed` smallint UNSIGNED NOT NULL,
  `set_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_emp_weekoff_override`(`employee_id` ASC, `period_year` ASC, `period_month` ASC) USING BTREE,
  INDEX `fk_weekoff_override_set_by`(`set_by` ASC) USING BTREE,
  CONSTRAINT `fk_weekoff_override_emp` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_weekoff_override_set_by` FOREIGN KEY (`set_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of employee_week_off_overrides
-- ----------------------------

-- ----------------------------
-- Table structure for employees
-- ----------------------------
DROP TABLE IF EXISTS `employees`;
CREATE TABLE `employees`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `full_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `department_id` bigint UNSIGNED NOT NULL,
  `designation_id` bigint UNSIGNED NOT NULL,
  `reporting_person_id` bigint UNSIGNED NULL DEFAULT NULL,
  `date_of_joining` date NOT NULL,
  `date_of_leaving` date NULL DEFAULT NULL,
  `gender` enum('male','female','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `date_of_birth` date NULL DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `bank_account_no` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `bank_ifsc` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `bank_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `uan_number` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `pf_enrolled` tinyint(1) NOT NULL DEFAULT 0,
  `esi_number` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `esi_enrolled` tinyint(1) NOT NULL DEFAULT 0,
  `status` enum('active','inactive') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `experience_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `qualification` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `salary_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT 'monthly',
  `basic_salary` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `per_day_salary` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `per_night_salary` decimal(10, 2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_employees_code`(`employee_code` ASC) USING BTREE,
  INDEX `ix_employees_department`(`department_id` ASC) USING BTREE,
  INDEX `ix_employees_designation`(`designation_id` ASC) USING BTREE,
  INDEX `fk_employees_reporting_person`(`reporting_person_id` ASC) USING BTREE,
  CONSTRAINT `fk_employees_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_employees_reporting_person` FOREIGN KEY (`reporting_person_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_employees_designation` FOREIGN KEY (`designation_id`) REFERENCES `staff_roles` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 90001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of employees
-- ----------------------------
INSERT INTO `employees` VALUES (93, 'EMP-33-8724-1', 'Aarav', 3, 3, NULL, '2024-06-12', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:48', '2026-07-21 12:00:48', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Sc Nursing (Critical Care)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (94, 'EMP-33-8949-2', 'Aadhavan', 3, 3, NULL, '2024-06-22', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:48', '2026-07-21 12:00:48', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Sc Nursing (Critical Care)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (95, 'EMP-33-9060-3', 'Aadhira', 3, 3, NULL, '2023-08-19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:48', '2026-07-21 12:00:48', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Sc Nursing (Critical Care)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (96, 'EMP-33-9174-4', 'Aakash', 3, 3, NULL, '2022-06-01', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:48', '2026-07-21 12:00:48', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Sc Nursing (Critical Care)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (97, 'EMP-33-9284-5', 'Aamani', 3, 3, NULL, '2025-06-13', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:48', '2026-07-21 12:00:48', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Sc Nursing (Critical Care)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (98, 'EMP-33-9394-6', 'Aarthi', 3, 3, NULL, '2023-04-04', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:49', '2026-07-21 12:00:49', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Sc Nursing (Critical Care)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (99, 'EMP-33-9508-7', 'Aaryan', 3, 3, NULL, '2022-07-02', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:49', '2026-07-21 12:00:49', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Sc Nursing (Critical Care)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (100, 'EMP-33-9618-8', 'Abinaya', 3, 3, NULL, '2022-01-14', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:49', '2026-07-21 12:00:49', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Sc Nursing (Critical Care)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (101, 'EMP-34-9733-1', 'Abinesh', 3, 4, NULL, '2023-04-24', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:49', '2026-07-21 12:00:49', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Nursing (RNC Registered)', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (102, 'EMP-34-9847-2', 'Abirami', 3, 4, NULL, '2021-12-12', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:49', '2026-07-21 12:00:49', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Nursing (RNC Registered)', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (103, 'EMP-34-9956-3', 'Adhavan', 3, 4, NULL, '2025-09-06', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:49', '2026-07-21 12:00:49', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Nursing (RNC Registered)', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (104, 'EMP-34-0070-4', 'Adhira', 3, 4, NULL, '2022-04-08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:49', '2026-07-21 12:00:49', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Nursing (RNC Registered)', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (105, 'EMP-34-0201-5', 'Adithya', 3, 4, NULL, '2022-12-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:49', '2026-07-21 12:00:49', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Nursing (RNC Registered)', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (106, 'EMP-34-0312-6', 'Aishwarya', 3, 4, NULL, '2021-06-02', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:49', '2026-07-21 12:00:49', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Nursing (RNC Registered)', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (107, 'EMP-34-0426-7', 'Akash', 3, 4, NULL, '2024-03-06', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:50', '2026-07-21 12:00:50', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Nursing (RNC Registered)', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (108, 'EMP-34-0541-8', 'Akila', 3, 4, NULL, '2021-05-22', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:50', '2026-07-21 12:00:50', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Nursing (RNC Registered)', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (109, 'EMP-35-0656-1', 'Akshay', 3, 5, NULL, '2025-12-15', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:50', '2026-07-21 12:00:50', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Nursing (GNM)', 'monthly', 18000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (110, 'EMP-35-0804-2', 'Amirtha', 3, 5, NULL, '2025-02-28', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:50', '2026-07-21 12:00:50', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Nursing (GNM)', 'monthly', 18000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (111, 'EMP-35-1047-3', 'Amritha', 3, 5, NULL, '2024-11-02', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:50', '2026-07-21 12:00:50', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Nursing (GNM)', 'monthly', 18000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (112, 'EMP-35-1193-4', 'Anand', 3, 5, NULL, '2021-05-04', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:50', '2026-07-21 12:00:50', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Nursing (GNM)', 'monthly', 18000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (113, 'EMP-35-1330-5', 'Ananya', 3, 5, NULL, '2022-07-07', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:50', '2026-07-21 12:00:50', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Nursing (GNM)', 'monthly', 18000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (114, 'EMP-35-1457-6', 'Anbarasu', 3, 5, NULL, '2021-12-04', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:51', '2026-07-21 12:00:51', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Nursing (GNM)', 'monthly', 18000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (115, 'EMP-35-1619-7', 'Anbu', 3, 5, NULL, '2023-06-12', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:51', '2026-07-21 12:00:51', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Nursing (GNM)', 'monthly', 18000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (116, 'EMP-35-1732-8', 'Anitha', 3, 5, NULL, '2022-01-11', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:51', '2026-07-21 12:00:51', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Nursing (GNM)', 'monthly', 18000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (117, 'EMP-46-1858-1', 'Anjali', 4, 6, NULL, '2025-07-07', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:51', '2026-07-21 12:00:51', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Pharm (Clinical Pharmacy)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (118, 'EMP-46-1987-2', 'Anjana', 4, 6, NULL, '2021-01-22', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:51', '2026-07-21 12:00:51', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Pharm (Clinical Pharmacy)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (119, 'EMP-46-2109-3', 'Anush', 4, 6, NULL, '2025-12-25', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:51', '2026-07-21 12:00:51', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Pharm (Clinical Pharmacy)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (120, 'EMP-46-2220-4', 'Anusha', 4, 6, NULL, '2023-02-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:51', '2026-07-21 12:00:51', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Pharm (Clinical Pharmacy)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (121, 'EMP-46-2352-5', 'Anushka', 4, 6, NULL, '2024-12-11', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:51', '2026-07-21 12:00:51', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Pharm (Clinical Pharmacy)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (122, 'EMP-46-2473-6', 'Aravind', 4, 6, NULL, '2022-04-14', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:52', '2026-07-21 12:00:52', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Pharm (Clinical Pharmacy)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (123, 'EMP-46-2609-7', 'Arjun', 4, 6, NULL, '2025-05-01', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:52', '2026-07-21 12:00:52', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Pharm (Clinical Pharmacy)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (124, 'EMP-46-2741-8', 'Arthi', 4, 6, NULL, '2023-08-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:52', '2026-07-21 12:00:52', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'M.Pharm (Clinical Pharmacy)', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (125, 'EMP-47-2872-1', 'Arul', 4, 7, NULL, '2022-07-19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:52', '2026-07-21 12:00:52', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Pharm (Registered Pharmacist)', 'monthly', 28000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (126, 'EMP-47-2998-2', 'Arulselvan', 4, 7, NULL, '2021-12-24', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:52', '2026-07-21 12:00:52', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Pharm (Registered Pharmacist)', 'monthly', 28000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (127, 'EMP-47-3133-3', 'Aruna', 4, 7, NULL, '2024-11-16', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:52', '2026-07-21 12:00:52', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Pharm (Registered Pharmacist)', 'monthly', 28000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (128, 'EMP-47-3267-4', 'Arun', 4, 7, NULL, '2021-08-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:52', '2026-07-21 12:00:52', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Pharm (Registered Pharmacist)', 'monthly', 28000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (129, 'EMP-47-3384-5', 'Arunmozhi', 4, 7, NULL, '2025-10-06', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:53', '2026-07-21 12:00:53', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Pharm (Registered Pharmacist)', 'monthly', 28000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (130, 'EMP-47-3499-6', 'Ashok', 4, 7, NULL, '2024-11-08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:53', '2026-07-21 12:00:53', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Pharm (Registered Pharmacist)', 'monthly', 28000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (131, 'EMP-47-3619-7', 'Ashwini', 4, 7, NULL, '2024-11-28', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:53', '2026-07-21 12:00:53', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Pharm (Registered Pharmacist)', 'monthly', 28000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (132, 'EMP-47-4045-8', 'Aswin', 4, 7, NULL, '2025-08-18', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:53', '2026-07-21 12:00:53', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Pharm (Registered Pharmacist)', 'monthly', 28000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (133, 'EMP-58-4157-1', 'Avinash', 5, 8, NULL, '2023-08-02', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:53', '2026-07-21 12:00:53', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBBS, MD (General Medicine)', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (134, 'EMP-58-4310-2', 'Bala', 5, 8, NULL, '2021-05-19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:53', '2026-07-21 12:00:53', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBBS, MD (General Medicine)', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (135, 'EMP-58-4456-3', 'Balaji', 5, 8, NULL, '2023-05-06', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:54', '2026-07-21 12:00:54', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBBS, MD (General Medicine)', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (136, 'EMP-58-4581-4', 'Banu', 5, 8, NULL, '2025-10-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:54', '2026-07-21 12:00:54', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBBS, MD (General Medicine)', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (137, 'EMP-58-4724-5', 'Bharani', 5, 8, NULL, '2022-05-15', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:54', '2026-07-21 12:00:54', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBBS, MD (General Medicine)', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (138, 'EMP-58-4884-6', 'Bharath', 5, 8, NULL, '2022-05-19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:54', '2026-07-21 12:00:54', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBBS, MD (General Medicine)', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (139, 'EMP-58-5032-7', 'Bhargavi', 5, 8, NULL, '2021-09-26', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:54', '2026-07-21 12:00:54', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBBS, MD (General Medicine)', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (140, 'EMP-58-5159-8', 'Bhavana', 5, 8, NULL, '2022-01-07', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:54', '2026-07-21 12:00:54', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBBS, MD (General Medicine)', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (141, 'EMP-59-5292-1', 'Bhoomika', 5, 9, NULL, '2024-10-21', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:54', '2026-07-21 12:00:54', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'MBBS, DNB (Internal Medicine)', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (142, 'EMP-59-5428-2', 'Brinda', 5, 9, NULL, '2024-03-20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:55', '2026-07-21 12:00:55', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'MBBS, DNB (Internal Medicine)', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (143, 'EMP-59-5600-3', 'Charan', 5, 9, NULL, '2025-07-12', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:55', '2026-07-21 12:00:55', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'MBBS, DNB (Internal Medicine)', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (144, 'EMP-59-5728-4', 'Chandra', 5, 9, NULL, '2021-07-20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:55', '2026-07-21 12:00:55', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'MBBS, DNB (Internal Medicine)', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (145, 'EMP-59-5855-5', 'Chandrika', 5, 9, NULL, '2023-04-21', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:55', '2026-07-21 12:00:55', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'MBBS, DNB (Internal Medicine)', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (146, 'EMP-59-5967-6', 'Darshan', 5, 9, NULL, '2025-06-25', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:55', '2026-07-21 12:00:55', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'MBBS, DNB (Internal Medicine)', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (147, 'EMP-59-6095-7', 'Deepa', 5, 9, NULL, '2024-01-20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:55', '2026-07-21 12:00:55', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'MBBS, DNB (Internal Medicine)', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (148, 'EMP-59-6217-8', 'Deepak', 5, 9, NULL, '2022-10-25', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:55', '2026-07-21 12:00:55', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'MBBS, DNB (Internal Medicine)', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (149, 'EMP-510-6329-1', 'Deepika', 5, 10, NULL, '2024-03-04', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:55', '2026-07-21 12:00:55', '2 years experience in patient care, hospital admin, and record management.', 'MBBS, DNB (Internal Medicine)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (150, 'EMP-510-6557-2', 'Deva', 5, 10, NULL, '2025-05-02', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:56', '2026-07-21 12:00:56', '2 years experience in patient care, hospital admin, and record management.', 'MBBS, DNB (Internal Medicine)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (151, 'EMP-510-6707-3', 'Devaki', 5, 10, NULL, '2023-07-15', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:56', '2026-07-21 12:00:56', '2 years experience in patient care, hospital admin, and record management.', 'MBBS, DNB (Internal Medicine)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (152, 'EMP-510-6860-4', 'Devan', 5, 10, NULL, '2024-01-15', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:56', '2026-07-21 12:00:56', '2 years experience in patient care, hospital admin, and record management.', 'MBBS, DNB (Internal Medicine)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (153, 'EMP-510-7034-5', 'Devika', 5, 10, NULL, '2025-05-09', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:56', '2026-07-21 12:00:56', '2 years experience in patient care, hospital admin, and record management.', 'MBBS, DNB (Internal Medicine)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (154, 'EMP-510-7147-6', 'Dhanalakshmi', 5, 10, NULL, '2024-09-15', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:56', '2026-07-21 12:00:56', '2 years experience in patient care, hospital admin, and record management.', 'MBBS, DNB (Internal Medicine)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (155, 'EMP-510-7264-7', 'Dhanush', 5, 10, NULL, '2024-08-28', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:56', '2026-07-21 12:00:56', '2 years experience in patient care, hospital admin, and record management.', 'MBBS, DNB (Internal Medicine)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (156, 'EMP-510-7373-8', 'Dharani', 5, 10, NULL, '2022-07-06', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:57', '2026-07-21 12:00:57', '2 years experience in patient care, hospital admin, and record management.', 'MBBS, DNB (Internal Medicine)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (157, 'EMP-590002-7495-1', 'Dharshini', 5, 90002, NULL, '2024-01-07', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:57', '2026-07-21 12:00:57', '2 years experience in patient care, hospital admin, and record management.', 'MBBS (CRMI Intern)', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (158, 'EMP-590002-7610-2', 'Dheeraj', 5, 90002, NULL, '2023-08-08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:57', '2026-07-21 12:00:57', '2 years experience in patient care, hospital admin, and record management.', 'MBBS (CRMI Intern)', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (159, 'EMP-590002-7740-3', 'Dinesh', 5, 90002, NULL, '2024-02-12', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:57', '2026-07-21 12:00:57', '2 years experience in patient care, hospital admin, and record management.', 'MBBS (CRMI Intern)', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (160, 'EMP-590002-7855-4', 'Divya', 5, 90002, NULL, '2024-03-25', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:57', '2026-07-21 12:00:57', '2 years experience in patient care, hospital admin, and record management.', 'MBBS (CRMI Intern)', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (161, 'EMP-590002-7972-5', 'Eashwar', 5, 90002, NULL, '2022-06-26', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:57', '2026-07-21 12:00:57', '2 years experience in patient care, hospital admin, and record management.', 'MBBS (CRMI Intern)', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (162, 'EMP-590002-8090-6', 'Ezhil', 5, 90002, NULL, '2022-12-19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:57', '2026-07-21 12:00:57', '2 years experience in patient care, hospital admin, and record management.', 'MBBS (CRMI Intern)', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (163, 'EMP-590002-8345-7', 'Gayathri', 5, 90002, NULL, '2022-10-13', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:57', '2026-07-21 12:00:57', '2 years experience in patient care, hospital admin, and record management.', 'MBBS (CRMI Intern)', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (164, 'EMP-590002-8464-8', 'Giri', 5, 90002, NULL, '2025-07-04', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:58', '2026-07-21 12:00:58', '2 years experience in patient care, hospital admin, and record management.', 'MBBS (CRMI Intern)', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (165, 'EMP-611-8657-1', 'Gokul', 6, 11, NULL, '2024-01-20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:58', '2026-07-21 12:00:58', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Ph.D Clinical Pathology & MLT', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (166, 'EMP-611-8808-2', 'Gokila', 6, 11, NULL, '2025-05-09', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:58', '2026-07-21 12:00:58', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Ph.D Clinical Pathology & MLT', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (167, 'EMP-611-8961-3', 'Gomathi', 6, 11, NULL, '2025-01-12', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:58', '2026-07-21 12:00:58', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Ph.D Clinical Pathology & MLT', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (168, 'EMP-611-9099-4', 'Gowri', 6, 11, NULL, '2024-03-23', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:58', '2026-07-21 12:00:58', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Ph.D Clinical Pathology & MLT', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (169, 'EMP-611-9229-5', 'Gowtham', 6, 11, NULL, '2022-06-04', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:58', '2026-07-21 12:00:58', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Ph.D Clinical Pathology & MLT', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (170, 'EMP-611-9359-6', 'Hari', 6, 11, NULL, '2025-08-14', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:59', '2026-07-21 12:00:59', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Ph.D Clinical Pathology & MLT', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (171, 'EMP-611-9498-7', 'Harini', 6, 11, NULL, '2021-03-17', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:59', '2026-07-21 12:00:59', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Ph.D Clinical Pathology & MLT', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (172, 'EMP-611-9652-8', 'Harish', 6, 11, NULL, '2025-07-13', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:59', '2026-07-21 12:00:59', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Ph.D Clinical Pathology & MLT', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (173, 'EMP-612-9800-1', 'Haritha', 6, 12, NULL, '2021-12-28', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:59', '2026-07-21 12:00:59', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Medical Laboratory Technology (MLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (174, 'EMP-612-9917-2', 'Hemalatha', 6, 12, NULL, '2025-07-28', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:59', '2026-07-21 12:00:59', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Medical Laboratory Technology (MLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (175, 'EMP-612-0137-3', 'Hemant', 6, 12, NULL, '2022-12-15', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:00:59', '2026-07-21 12:00:59', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Medical Laboratory Technology (MLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (176, 'EMP-612-0373-4', 'Hema', 6, 12, NULL, '2024-07-28', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:00', '2026-07-21 12:01:00', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Medical Laboratory Technology (MLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (177, 'EMP-612-0497-5', 'Ilakkiya', 6, 12, NULL, '2022-11-22', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:00', '2026-07-21 12:01:00', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Medical Laboratory Technology (MLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (178, 'EMP-612-0669-6', 'Ilamaran', 6, 12, NULL, '2021-12-01', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:00', '2026-07-21 12:01:00', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Medical Laboratory Technology (MLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (179, 'EMP-612-0784-7', 'Ilango', 6, 12, NULL, '2021-10-21', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:00', '2026-07-21 12:01:00', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Medical Laboratory Technology (MLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (180, 'EMP-612-0906-8', 'Indhu', 6, 12, NULL, '2022-12-07', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:00', '2026-07-21 12:01:00', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'B.Sc Medical Laboratory Technology (MLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (181, 'EMP-690001-1078-1', 'Indrajith', 6, 90001, NULL, '2024-05-08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:00', '2026-07-21 12:01:00', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Medical Lab Technology (DMLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (182, 'EMP-690001-1211-2', 'Iniya', 6, 90001, NULL, '2023-08-18', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:00', '2026-07-21 12:01:00', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Medical Lab Technology (DMLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (183, 'EMP-690001-1333-3', 'Iniyan', 6, 90001, NULL, '2021-07-23', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:00', '2026-07-21 12:01:00', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Medical Lab Technology (DMLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (184, 'EMP-690001-1463-4', 'Inban', 6, 90001, NULL, '2023-12-01', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:01', '2026-07-21 12:01:01', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Medical Lab Technology (DMLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (185, 'EMP-690001-1584-5', 'Ishwarya', 6, 90001, NULL, '2022-02-15', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:01', '2026-07-21 12:01:01', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Medical Lab Technology (DMLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (186, 'EMP-690001-1707-6', 'Jagadeesh', 6, 90001, NULL, '2023-07-20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:01', '2026-07-21 12:01:01', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Medical Lab Technology (DMLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (187, 'EMP-690001-1838-7', 'Janani', 6, 90001, NULL, '2023-12-04', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:01', '2026-07-21 12:01:01', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Medical Lab Technology (DMLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (188, 'EMP-690001-1956-8', 'Janarthanan', 6, 90001, NULL, '2024-04-26', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:01', '2026-07-21 12:01:01', '2 years experience in patient care, hospital admin, and record management.', 'Diploma in Medical Lab Technology (DMLT)', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (189, 'EMP-713-2092-1', 'Janavi', 7, 13, NULL, '2022-12-14', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:01', '2026-07-21 12:01:01', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBA (HR Management), PGDHRM', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (190, 'EMP-713-2221-2', 'Jasmine', 7, 13, NULL, '2023-08-24', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:01', '2026-07-21 12:01:01', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBA (HR Management), PGDHRM', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (191, 'EMP-713-2337-3', 'Jeeva', 7, 13, NULL, '2024-10-27', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:01', '2026-07-21 12:01:01', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBA (HR Management), PGDHRM', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (192, 'EMP-713-2468-4', 'Jeevika', 7, 13, NULL, '2024-03-16', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:02', '2026-07-21 12:01:02', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBA (HR Management), PGDHRM', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (193, 'EMP-713-2648-5', 'Jenisha', 7, 13, NULL, '2025-09-25', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:02', '2026-07-21 12:01:02', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBA (HR Management), PGDHRM', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (194, 'EMP-713-2780-6', 'Jeyan', 7, 13, NULL, '2025-03-07', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:02', '2026-07-21 12:01:02', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBA (HR Management), PGDHRM', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (195, 'EMP-713-2908-7', 'Jothi', 7, 13, NULL, '2022-01-19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:02', '2026-07-21 12:01:02', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBA (HR Management), PGDHRM', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (196, 'EMP-713-3025-8', 'Joshna', 7, 13, NULL, '2024-09-14', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:02', '2026-07-21 12:01:02', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'MBA (HR Management), PGDHRM', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (197, 'EMP-714-3163-1', 'Kabilan', 7, 14, NULL, '2024-10-13', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:02', '2026-07-21 12:01:02', '2 years experience in patient care, hospital admin, and record management.', 'B.Com, Diploma in Hospital Admin', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (198, 'EMP-714-3290-2', 'Kalyani', 7, 14, NULL, '2023-05-06', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:02', '2026-07-21 12:01:02', '2 years experience in patient care, hospital admin, and record management.', 'B.Com, Diploma in Hospital Admin', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (199, 'EMP-714-3410-3', 'Kamala', 7, 14, NULL, '2023-11-20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:03', '2026-07-21 12:01:03', '2 years experience in patient care, hospital admin, and record management.', 'B.Com, Diploma in Hospital Admin', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (200, 'EMP-714-3534-4', 'Kannan', 7, 14, NULL, '2021-05-11', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:03', '2026-07-21 12:01:03', '2 years experience in patient care, hospital admin, and record management.', 'B.Com, Diploma in Hospital Admin', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (201, 'EMP-714-3651-5', 'Karthick', 7, 14, NULL, '2024-02-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:03', '2026-07-21 12:01:03', '2 years experience in patient care, hospital admin, and record management.', 'B.Com, Diploma in Hospital Admin', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (202, 'EMP-714-3797-6', 'Karthika', 7, 14, NULL, '2021-10-09', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:03', '2026-07-21 12:01:03', '2 years experience in patient care, hospital admin, and record management.', 'B.Com, Diploma in Hospital Admin', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (203, 'EMP-714-3930-7', 'Kavi', 7, 14, NULL, '2021-07-26', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:03', '2026-07-21 12:01:03', '2 years experience in patient care, hospital admin, and record management.', 'B.Com, Diploma in Hospital Admin', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (204, 'EMP-714-4053-8', 'Kavin', 7, 14, NULL, '2024-11-08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:03', '2026-07-21 12:01:03', '2 years experience in patient care, hospital admin, and record management.', 'B.Com, Diploma in Hospital Admin', 'monthly', 30000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (205, 'EMP-715-4184-1', 'Kavitha', 7, 15, NULL, '2024-09-16', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:03', '2026-07-21 12:01:03', '2 years experience in patient care, hospital admin, and record management.', 'B.Com (Finance & Tally ERP)', 'monthly', 24000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (206, 'EMP-715-4318-2', 'Keerthana', 7, 15, NULL, '2022-10-11', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:03', '2026-07-21 12:01:03', '2 years experience in patient care, hospital admin, and record management.', 'B.Com (Finance & Tally ERP)', 'monthly', 24000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (207, 'EMP-715-4473-3', 'Keerthi', 7, 15, NULL, '2025-06-11', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:04', '2026-07-21 12:01:04', '2 years experience in patient care, hospital admin, and record management.', 'B.Com (Finance & Tally ERP)', 'monthly', 24000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (208, 'EMP-715-4695-4', 'Kishore', 7, 15, NULL, '2025-08-10', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:04', '2026-07-21 12:01:04', '2 years experience in patient care, hospital admin, and record management.', 'B.Com (Finance & Tally ERP)', 'monthly', 24000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (209, 'EMP-715-4845-5', 'Komathi', 7, 15, NULL, '2024-11-22', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:04', '2026-07-21 12:01:04', '2 years experience in patient care, hospital admin, and record management.', 'B.Com (Finance & Tally ERP)', 'monthly', 24000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (210, 'EMP-715-4980-6', 'Krishnan', 7, 15, NULL, '2022-01-27', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:04', '2026-07-21 12:01:04', '2 years experience in patient care, hospital admin, and record management.', 'B.Com (Finance & Tally ERP)', 'monthly', 24000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (211, 'EMP-715-5102-7', 'Krithika', 7, 15, NULL, '2021-01-09', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:04', '2026-07-21 12:01:04', '2 years experience in patient care, hospital admin, and record management.', 'B.Com (Finance & Tally ERP)', 'monthly', 24000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (212, 'EMP-715-5222-8', 'Kumaran', 7, 15, NULL, '2022-10-06', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:04', '2026-07-21 12:01:04', '2 years experience in patient care, hospital admin, and record management.', 'B.Com (Finance & Tally ERP)', 'monthly', 24000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (213, 'EMP-816-5333-1', 'Lakshmi', 8, 16, NULL, '2024-02-09', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:04', '2026-07-21 12:01:04', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 80000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (214, 'EMP-816-5454-2', 'Lavanya', 8, 16, NULL, '2023-08-13', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:05', '2026-07-21 12:01:05', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 80000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (215, 'EMP-816-5579-3', 'Logesh', 8, 16, NULL, '2024-04-06', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:05', '2026-07-21 12:01:05', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 80000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (216, 'EMP-816-5721-4', 'Lokesh', 8, 16, NULL, '2021-12-15', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:05', '2026-07-21 12:01:05', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 80000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (217, 'EMP-816-5865-5', 'Madhan', 8, 16, NULL, '2025-05-19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:05', '2026-07-21 12:01:05', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 80000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (218, 'EMP-816-5995-6', 'Madhavi', 8, 16, NULL, '2021-06-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:05', '2026-07-21 12:01:05', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 80000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (219, 'EMP-816-6114-7', 'Madhumitha', 8, 16, NULL, '2023-02-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:05', '2026-07-21 12:01:05', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 80000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (220, 'EMP-816-6247-8', 'Mahalakshmi', 8, 16, NULL, '2023-02-09', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:05', '2026-07-21 12:01:05', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 80000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (221, 'EMP-817-6376-1', 'Mahesh', 8, 17, NULL, '2022-05-26', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:06', '2026-07-21 12:01:06', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 60000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (222, 'EMP-817-6519-2', 'Mahima', 8, 17, NULL, '2025-10-07', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:06', '2026-07-21 12:01:06', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 60000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (223, 'EMP-817-6641-3', 'Malathi', 8, 17, NULL, '2021-02-09', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:06', '2026-07-21 12:01:06', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 60000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (224, 'EMP-817-6769-4', 'Manikandan', 8, 17, NULL, '2022-02-11', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:06', '2026-07-21 12:01:06', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 60000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (225, 'EMP-817-6903-5', 'Manimegalai', 8, 17, NULL, '2023-01-17', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:06', '2026-07-21 12:01:06', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 60000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (226, 'EMP-817-7022-6', 'Manoj', 8, 17, NULL, '2024-02-06', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:06', '2026-07-21 12:01:06', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 60000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (227, 'EMP-817-7137-7', 'Meena', 8, 17, NULL, '2024-06-28', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:06', '2026-07-21 12:01:06', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 60000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (228, 'EMP-817-7255-8', 'Meenakshi', 8, 17, NULL, '2021-12-22', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:06', '2026-07-21 12:01:06', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 60000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (229, 'EMP-918-7382-1', 'Megha', 9, 18, NULL, '2021-11-28', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:07', '2026-07-21 12:01:07', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (230, 'EMP-918-7515-2', 'Mithra', 9, 18, NULL, '2022-12-23', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:07', '2026-07-21 12:01:07', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (231, 'EMP-918-7644-3', 'Mithran', 9, 18, NULL, '2022-04-10', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:07', '2026-07-21 12:01:07', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (232, 'EMP-918-7786-4', 'Mohan', 9, 18, NULL, '2023-12-18', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:07', '2026-07-21 12:01:07', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (233, 'EMP-918-7915-5', 'Monika', 9, 18, NULL, '2021-07-28', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:07', '2026-07-21 12:01:07', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (234, 'EMP-918-8177-6', 'Mugilan', 9, 18, NULL, '2023-07-23', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:07', '2026-07-21 12:01:07', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (235, 'EMP-918-8381-7', 'Murali', 9, 18, NULL, '2023-11-17', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:08', '2026-07-21 12:01:08', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (236, 'EMP-918-8584-8', 'Muthu', 9, 18, NULL, '2024-01-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:08', '2026-07-21 12:01:08', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 50000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (237, 'EMP-919-8712-1', 'Nandhini', 9, 19, NULL, '2024-03-27', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:08', '2026-07-21 12:01:08', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'Bachelor Degree / Diploma', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (238, 'EMP-919-8863-2', 'Naren', 9, 19, NULL, '2023-11-11', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:08', '2026-07-21 12:01:08', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'Bachelor Degree / Diploma', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (239, 'EMP-919-8979-3', 'Narmadha', 9, 19, NULL, '2025-03-19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:08', '2026-07-21 12:01:08', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'Bachelor Degree / Diploma', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (240, 'EMP-919-9105-4', 'Naveen', 9, 19, NULL, '2022-05-13', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:08', '2026-07-21 12:01:08', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'Bachelor Degree / Diploma', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (241, 'EMP-919-9305-5', 'Navin', 9, 19, NULL, '2021-12-14', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:08', '2026-07-21 12:01:08', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'Bachelor Degree / Diploma', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (242, 'EMP-919-9501-6', 'Nila', 9, 19, NULL, '2022-03-17', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:09', '2026-07-21 12:01:09', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'Bachelor Degree / Diploma', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (243, 'EMP-919-9635-7', 'Nithin', 9, 19, NULL, '2024-08-15', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:09', '2026-07-21 12:01:09', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'Bachelor Degree / Diploma', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (244, 'EMP-919-9786-8', 'Nithya', 9, 19, NULL, '2022-10-24', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:09', '2026-07-21 12:01:09', '4 years experience in hospital workflow, patient routines, and diagnostics.', 'Bachelor Degree / Diploma', 'monthly', 35000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (245, 'EMP-920-9920-1', 'Nivetha', 9, 20, NULL, '2021-10-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:09', '2026-07-21 12:01:09', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (246, 'EMP-920-0077-2', 'Nivedha', 9, 20, NULL, '2025-12-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:09', '2026-07-21 12:01:09', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (247, 'EMP-920-0274-3', 'Pavithra', 9, 20, NULL, '2024-01-02', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:09', '2026-07-21 12:01:09', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (248, 'EMP-920-0389-4', 'Pandian', 9, 20, NULL, '2022-05-27', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:10', '2026-07-21 12:01:10', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (249, 'EMP-920-0512-5', 'Parthiban', 9, 20, NULL, '2023-01-26', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:10', '2026-07-21 12:01:10', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (250, 'EMP-920-0743-6', 'Pavan', 9, 20, NULL, '2021-06-04', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:10', '2026-07-21 12:01:10', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (251, 'EMP-920-0957-7', 'Perumal', 9, 20, NULL, '2025-04-01', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:10', '2026-07-21 12:01:10', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (252, 'EMP-920-1086-8', 'Pooja', 9, 20, NULL, '2021-07-14', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:10', '2026-07-21 12:01:10', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 20000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (253, 'EMP-1021-1225-1', 'Prabhu', 10, 21, NULL, '2021-10-13', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:10', '2026-07-21 12:01:10', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 70000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (254, 'EMP-1021-1355-2', 'Pradeep', 10, 21, NULL, '2021-09-14', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:10', '2026-07-21 12:01:10', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 70000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (255, 'EMP-1021-1478-3', 'Pragathi', 10, 21, NULL, '2021-05-28', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:11', '2026-07-21 12:01:11', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 70000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (256, 'EMP-1021-1613-4', 'Prakash', 10, 21, NULL, '2025-09-08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:11', '2026-07-21 12:01:11', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 70000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (257, 'EMP-1021-1739-5', 'Pranav', 10, 21, NULL, '2025-06-19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:11', '2026-07-21 12:01:11', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 70000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (258, 'EMP-1021-1864-6', 'Pranitha', 10, 21, NULL, '2022-05-10', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:11', '2026-07-21 12:01:11', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 70000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (259, 'EMP-1021-1976-7', 'Prasanna', 10, 21, NULL, '2025-05-08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:11', '2026-07-21 12:01:11', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 70000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (260, 'EMP-1021-2117-8', 'Prashanth', 10, 21, NULL, '2023-02-02', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:11', '2026-07-21 12:01:11', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 70000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (261, 'EMP-1122-2260-1', 'Praveen', 11, 22, NULL, '2025-06-04', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:11', '2026-07-21 12:01:11', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 65000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (262, 'EMP-1122-2396-2', 'Priya', 11, 22, NULL, '2021-09-20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:12', '2026-07-21 12:01:12', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 65000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (263, 'EMP-1122-2578-3', 'Priyadharshini', 11, 22, NULL, '2023-05-12', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:12', '2026-07-21 12:01:12', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 65000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (264, 'EMP-1122-2757-4', 'Priyanka', 11, 22, NULL, '2022-08-08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:12', '2026-07-21 12:01:12', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 65000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (265, 'EMP-1122-2869-5', 'Rahul', 11, 22, NULL, '2023-12-08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:12', '2026-07-21 12:01:12', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 65000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (266, 'EMP-1122-2981-6', 'Rajalakshmi', 11, 22, NULL, '2024-04-13', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:12', '2026-07-21 12:01:12', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 65000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (267, 'EMP-1122-3106-7', 'Rajan', 11, 22, NULL, '2022-08-13', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:12', '2026-07-21 12:01:12', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 65000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (268, 'EMP-1122-3740-8', 'Rajesh', 11, 22, NULL, '2021-02-19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:13', '2026-07-21 12:01:13', '8+ years leading hospital operations, managing staff, and enforcing clinical quality standards.', 'Bachelor Degree / Diploma', 'monthly', 65000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (269, 'EMP-1123-3852-1', 'Rajkumar', 11, 23, NULL, '2024-10-19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:13', '2026-07-21 12:01:13', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (270, 'EMP-1123-3970-2', 'Rakshana', 11, 23, NULL, '2025-08-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:13', '2026-07-21 12:01:13', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (271, 'EMP-1123-4081-3', 'Ram', 11, 23, NULL, '2023-08-10', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:13', '2026-07-21 12:01:13', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (272, 'EMP-1123-4198-4', 'Ramya', 11, 23, NULL, '2022-01-09', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:13', '2026-07-21 12:01:13', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (273, 'EMP-1123-4560-5', 'Ranjani', 11, 23, NULL, '2024-03-17', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:14', '2026-07-21 12:01:14', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (274, 'EMP-1123-4688-6', 'Ranjith', 11, 23, NULL, '2021-05-24', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:14', '2026-07-21 12:01:14', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (275, 'EMP-1123-4815-7', 'Revathi', 11, 23, NULL, '2021-01-16', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:14', '2026-07-21 12:01:14', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (276, 'EMP-1123-4933-8', 'Rithika', 11, 23, NULL, '2024-01-28', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:14', '2026-07-21 12:01:14', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 40000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (277, 'EMP-6000160001-5053-1', 'Rohan', 60001, 60001, NULL, '2025-06-28', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:14', '2026-07-21 12:01:14', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 10000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (278, 'EMP-6000160001-5174-2', 'Rohini', 60001, 60001, NULL, '2024-08-07', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:14', '2026-07-21 12:01:14', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 10000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (279, 'EMP-6000160001-5297-3', 'Ruban', 60001, 60001, NULL, '2025-01-17', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:14', '2026-07-21 12:01:14', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 10000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (280, 'EMP-6000160001-5413-4', 'Sadhana', 60001, 60001, NULL, '2022-09-06', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:15', '2026-07-21 12:01:15', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 10000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (281, 'EMP-6000160001-5529-5', 'Sakthi', 60001, 60001, NULL, '2025-06-25', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:15', '2026-07-21 12:01:15', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 10000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (282, 'EMP-6000160001-5651-6', 'Sakthivel', 60001, 60001, NULL, '2022-08-08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:15', '2026-07-21 12:01:15', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 10000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (283, 'EMP-6000160001-5764-7', 'Sangeetha', 60001, 60001, NULL, '2023-12-14', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:15', '2026-07-21 12:01:15', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 10000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (284, 'EMP-6000160001-5875-8', 'Sanjay', 60001, 60001, NULL, '2021-04-08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:15', '2026-07-21 12:01:15', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 10000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (285, 'EMP-6000160002-5991-1', 'Sanjana', 60001, 60002, NULL, '2022-09-12', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:15', '2026-07-21 12:01:15', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (286, 'EMP-6000160002-6106-2', 'Santhosh', 60001, 60002, NULL, '2023-02-13', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:15', '2026-07-21 12:01:15', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (287, 'EMP-6000160002-6226-3', 'Saranya', 60001, 60002, NULL, '2021-11-24', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:15', '2026-07-21 12:01:15', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (288, 'EMP-6000160002-6345-4', 'Saravanan', 60001, 60002, NULL, '2021-02-06', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:15', '2026-07-21 12:01:15', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (289, 'EMP-6000160002-6459-5', 'Sathish', 60001, 60002, NULL, '2024-03-02', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:16', '2026-07-21 12:01:16', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (290, 'EMP-6000160002-6574-6', 'Savitha', 60001, 60002, NULL, '2025-11-18', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:16', '2026-07-21 12:01:16', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (291, 'EMP-6000160002-6689-7', 'Selva', 60001, 60002, NULL, '2022-02-21', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:16', '2026-07-21 12:01:16', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (292, 'EMP-6000160002-6800-8', 'Selvi', 60001, 60002, NULL, '2024-06-09', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:16', '2026-07-21 12:01:16', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 25000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (293, 'EMP-6000160003-6910-1', 'Senthil', 60001, 60003, NULL, '2022-12-19', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:16', '2026-07-21 12:01:16', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (294, 'EMP-6000160003-7022-2', 'Shalini', 60001, 60003, NULL, '2025-03-23', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:16', '2026-07-21 12:01:16', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (295, 'EMP-6000160003-7132-3', 'Shanmathi', 60001, 60003, NULL, '2021-01-22', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:16', '2026-07-21 12:01:16', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (296, 'EMP-6000160003-7256-4', 'Sharanya', 60001, 60003, NULL, '2022-06-09', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:16', '2026-07-21 12:01:16', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (297, 'EMP-6000160003-7367-5', 'Sharmila', 60001, 60003, NULL, '2023-07-24', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:16', '2026-07-21 12:01:16', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (298, 'EMP-6000160003-7478-6', 'Shobana', 60001, 60003, NULL, '2021-12-14', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:17', '2026-07-21 12:01:17', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (299, 'EMP-6000160003-7586-7', 'Shruthi', 60001, 60003, NULL, '2024-07-01', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:17', '2026-07-21 12:01:17', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (300, 'EMP-6000160003-7696-8', 'Siva', 60001, 60003, NULL, '2025-02-16', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:17', '2026-07-21 12:01:17', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 15000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (301, 'EMP-6000160004-7803-1', 'Sivakumar', 60001, 60004, NULL, '2021-09-01', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:17', '2026-07-21 12:01:17', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 12000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (302, 'EMP-6000160004-7917-2', 'Sneha', 60001, 60004, NULL, '2024-08-23', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:17', '2026-07-21 12:01:17', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 12000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (303, 'EMP-6000160004-8025-3', 'Sowmiya', 60001, 60004, NULL, '2024-06-01', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:17', '2026-07-21 12:01:17', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 12000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (304, 'EMP-6000160004-8130-4', 'Sreeja', 60001, 60004, NULL, '2023-09-18', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:17', '2026-07-21 12:01:17', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 12000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (305, 'EMP-6000160004-8238-5', 'Sridhar', 60001, 60004, NULL, '2025-09-03', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:17', '2026-07-21 12:01:17', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 12000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (306, 'EMP-6000160004-8347-6', 'Sriram', 60001, 60004, NULL, '2022-10-08', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:17', '2026-07-21 12:01:17', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 12000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (307, 'EMP-6000160004-8459-7', 'Subash', 60001, 60004, NULL, '2023-07-05', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:18', '2026-07-21 12:01:18', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 12000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (308, 'EMP-6000160004-8575-8', 'Subha', 60001, 60004, NULL, '2022-03-20', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 12:01:18', '2026-07-21 12:01:18', '2 years experience in patient care, hospital admin, and record management.', 'Bachelor Degree / Diploma', 'monthly', 12000.00, 0.00, 0.00);
INSERT INTO `employees` VALUES (30001, 'EMP-858543-921', 'Vignesh', 7, 13, NULL, '2026-07-21', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, 'active', '2026-07-21 13:30:58', '2026-07-21 13:30:58', 'Nil', 'MBA', 'monthly', 40000.00, 0.00, 0.00);

-- ----------------------------
-- Table structure for fine_types
-- ----------------------------
DROP TABLE IF EXISTS `fine_types`;
CREATE TABLE `fine_types`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `default_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `trigger_rule` enum('unapproved_absence_no_leave','manual') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'manual',
  `calculation_basis` enum('flat','per_day','percent_of_day_salary') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'flat',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_fine_types_name`(`name` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of fine_types
-- ----------------------------
INSERT INTO `fine_types` VALUES (1, 'Unapproved Absence', 500.00, 'unapproved_absence_no_leave', 'flat', NULL, 1);
INSERT INTO `fine_types` VALUES (2, 'Punch Miss', 100.00, 'manual', 'flat', NULL, 1);

-- ----------------------------
-- Table structure for fines
-- ----------------------------
DROP TABLE IF EXISTS `fines`;
CREATE TABLE `fines`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `fine_type_id` bigint UNSIGNED NOT NULL,
  `fine_date` date NOT NULL,
  `amount` decimal(10, 2) NOT NULL,
  `reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `is_auto_generated` tinyint(1) NOT NULL DEFAULT 0,
  `assigned_month` tinyint UNSIGNED NULL DEFAULT NULL,
  `assigned_year` smallint UNSIGNED NULL DEFAULT NULL,
  `status` enum('active','waived','cancelled','deducted') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'active',
  `waived_by` bigint UNSIGNED NULL DEFAULT NULL,
  `waived_at` timestamp NULL DEFAULT NULL,
  `waiver_reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `payroll_run_id` bigint UNSIGNED NULL DEFAULT NULL,
  `created_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_fines_employee`(`employee_id` ASC, `fine_date` ASC) USING BTREE,
  INDEX `fk_fines_type`(`fine_type_id` ASC) USING BTREE,
  INDEX `fk_fines_created_by`(`created_by` ASC) USING BTREE,
  INDEX `fk_fines_payroll_run`(`payroll_run_id` ASC) USING BTREE,
  INDEX `fk_fines_waived_by`(`waived_by` ASC) USING BTREE,
  CONSTRAINT `fk_fines_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_fines_type` FOREIGN KEY (`fine_type_id`) REFERENCES `fine_types` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_fines_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_fines_payroll_run` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_fines_waived_by` FOREIGN KEY (`waived_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of fines
-- ----------------------------

-- ----------------------------
-- Table structure for floors
-- ----------------------------
DROP TABLE IF EXISTS `floors`;
CREATE TABLE `floors`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `building_id` bigint UNSIGNED NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `fk_floors_building`(`building_id` ASC) USING BTREE,
  CONSTRAINT `fk_floors_building` FOREIGN KEY (`building_id`) REFERENCES `buildings` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of floors
-- ----------------------------

-- ----------------------------
-- Table structure for goods_receipt_items
-- ----------------------------
DROP TABLE IF EXISTS `goods_receipt_items`;
CREATE TABLE `goods_receipt_items`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `goods_receipt_id` bigint UNSIGNED NOT NULL,
  `purchase_order_item_id` bigint UNSIGNED NULL DEFAULT NULL,
  `medicine_id` bigint UNSIGNED NOT NULL,
  `batch_id` bigint UNSIGNED NULL DEFAULT NULL,
  `batch_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expiry_date` date NOT NULL,
  `qty_received` int NOT NULL,
  `purchase_price` decimal(10, 2) NOT NULL DEFAULT 0,
  `selling_price` decimal(10, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_grn_items_grn`(`goods_receipt_id` ASC) USING BTREE,
  INDEX `ix_grn_items_medicine`(`medicine_id` ASC) USING BTREE,
  INDEX `fk_grn_items_po_item`(`purchase_order_item_id` ASC) USING BTREE,
  INDEX `fk_grn_items_batch`(`batch_id` ASC) USING BTREE,
  CONSTRAINT `fk_grn_items_grn` FOREIGN KEY (`goods_receipt_id`) REFERENCES `goods_receipts` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_grn_items_po_item` FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_grn_items_medicine` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_grn_items_batch` FOREIGN KEY (`batch_id`) REFERENCES `medicine_batches` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of goods_receipt_items
-- ----------------------------

-- ----------------------------
-- Table structure for goods_receipts
-- ----------------------------
DROP TABLE IF EXISTS `goods_receipts`;
CREATE TABLE `goods_receipts`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `grn_number` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `purchase_order_id` bigint UNSIGNED NULL DEFAULT NULL,
  `supplier_id` bigint UNSIGNED NOT NULL,
  `supplier_bill_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `supplier_bill_date` date NOT NULL,
  `received_date` date NOT NULL,
  `total_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `paid_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `payment_status` enum('unpaid','partial','paid') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'unpaid',
  `status` enum('open','closed') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'open',
  `received_by` bigint UNSIGNED NULL DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_goods_receipts_number`(`grn_number` ASC) USING BTREE,
  INDEX `ix_grn_po`(`purchase_order_id` ASC) USING BTREE,
  INDEX `ix_grn_supplier`(`supplier_id` ASC) USING BTREE,
  INDEX `ix_grn_bill_number`(`supplier_bill_number` ASC) USING BTREE,
  INDEX `fk_grn_received_by`(`received_by` ASC) USING BTREE,
  CONSTRAINT `fk_grn_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_grn_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `pharmacy_suppliers` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_grn_received_by` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of goods_receipts
-- ----------------------------

-- ----------------------------
-- Table structure for holidays
-- ----------------------------
DROP TABLE IF EXISTS `holidays`;
CREATE TABLE `holidays`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `holiday_date` date NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `is_optional` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_holidays_date`(`holiday_date` ASC) USING BTREE,
  INDEX `fk_holidays_created_by`(`created_by` ASC) USING BTREE,
  CONSTRAINT `fk_holidays_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of holidays
-- ----------------------------

-- ----------------------------
-- Table structure for leave_balances
-- ----------------------------
DROP TABLE IF EXISTS `leave_balances`;
CREATE TABLE `leave_balances`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `leave_type_id` bigint UNSIGNED NOT NULL,
  `year` smallint NOT NULL,
  `allocated_days` decimal(5, 2) NOT NULL DEFAULT 0,
  `used_days` decimal(5, 2) NOT NULL DEFAULT 0,
  `balance_days` decimal(5, 2) GENERATED ALWAYS AS (`allocated_days` - `used_days`) STORED NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_leave_balance`(`employee_id` ASC, `leave_type_id` ASC, `year` ASC) USING BTREE,
  INDEX `fk_leave_balance_type`(`leave_type_id` ASC) USING BTREE,
  CONSTRAINT `fk_leave_balance_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_leave_balance_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of leave_balances
-- ----------------------------

-- ----------------------------
-- Table structure for leave_requests
-- ----------------------------
DROP TABLE IF EXISTS `leave_requests`;
CREATE TABLE `leave_requests`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `leave_type_id` bigint UNSIGNED NOT NULL,
  `from_date` date NOT NULL,
  `to_date` date NOT NULL,
  `is_half_day` tinyint(1) NOT NULL DEFAULT 0,
  `reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `reporting_person_status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending',
  `reporting_person_id` bigint UNSIGNED NULL DEFAULT NULL,
  `reporting_person_acted_at` timestamp NULL DEFAULT NULL,
  `hr_status` enum('pending','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending',
  `hr_user_id` bigint UNSIGNED NULL DEFAULT NULL,
  `hr_acted_at` timestamp NULL DEFAULT NULL,
  `result` enum('pending','paid_leave','lop','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_leave_requests_employee`(`employee_id` ASC, `from_date` ASC) USING BTREE,
  INDEX `fk_leave_requests_type`(`leave_type_id` ASC) USING BTREE,
  INDEX `fk_leave_requests_reporting_person`(`reporting_person_id` ASC) USING BTREE,
  INDEX `fk_leave_requests_hr_user`(`hr_user_id` ASC) USING BTREE,
  CONSTRAINT `fk_leave_requests_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_leave_requests_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_leave_requests_reporting_person` FOREIGN KEY (`reporting_person_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_leave_requests_hr_user` FOREIGN KEY (`hr_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of leave_requests
-- ----------------------------

-- ----------------------------
-- Table structure for leave_types
-- ----------------------------
DROP TABLE IF EXISTS `leave_types`;
CREATE TABLE `leave_types`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `quota_days` decimal(5, 2) NOT NULL DEFAULT 0,
  `quota_period` enum('monthly','yearly') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'yearly',
  `is_half_day_allowed` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_lop_applicable` tinyint(1) NOT NULL DEFAULT 1,
  `can_carry_forward` tinyint(1) NOT NULL DEFAULT 0,
  `max_carry_forward_days` decimal(5, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_leave_types_name`(`name` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of leave_types
-- ----------------------------
INSERT INTO `leave_types` VALUES (1, 'Casual Leave', 1.50, 'monthly', 0, 1, 0, 0, 0.00);
INSERT INTO `leave_types` VALUES (2, 'Privilege Leave', 2.00, 'monthly', 0, 1, 0, 0, 0.00);
INSERT INTO `leave_types` VALUES (3, 'Loss of Pay', 0.00, 'monthly', 0, 1, 1, 0, 0.00);

-- ----------------------------
-- Table structure for medicine_batches
-- ----------------------------
DROP TABLE IF EXISTS `medicine_batches`;
CREATE TABLE `medicine_batches`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `medicine_id` bigint UNSIGNED NOT NULL,
  `batch_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expiry_date` date NOT NULL,
  `qty_in_stock` int NOT NULL DEFAULT 0,
  `purchase_price` decimal(10, 2) NOT NULL DEFAULT 0,
  `selling_price` decimal(10, 2) NOT NULL DEFAULT 0,
  `received_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_med_batches_medicine`(`medicine_id` ASC) USING BTREE,
  INDEX `ix_med_batches_expiry`(`expiry_date` ASC) USING BTREE,
  CONSTRAINT `fk_med_batches_medicine` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of medicine_batches
-- ----------------------------
INSERT INTO `medicine_batches` VALUES (1, 1, '8945', '2028-10-30', 100, 10000.00, 10000.00, '2026-07-29 14:01:18');

-- ----------------------------
-- Table structure for medicine_categories
-- ----------------------------
DROP TABLE IF EXISTS `medicine_categories`;
CREATE TABLE `medicine_categories`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_medicine_categories_name`(`name` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 196250 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of medicine_categories
-- ----------------------------
INSERT INTO `medicine_categories` VALUES (1, 'Analgesics');
INSERT INTO `medicine_categories` VALUES (2, 'Antibiotics');
INSERT INTO `medicine_categories` VALUES (3, 'Antacids');
INSERT INTO `medicine_categories` VALUES (4, 'Antihistamines');
INSERT INTO `medicine_categories` VALUES (5, 'Vitamins & Supplements');
INSERT INTO `medicine_categories` VALUES (6, 'Antidiabetics');
INSERT INTO `medicine_categories` VALUES (7, 'Cardiac');
INSERT INTO `medicine_categories` VALUES (8, 'Other');

-- ----------------------------
-- Table structure for medicines
-- ----------------------------
DROP TABLE IF EXISTS `medicines`;
CREATE TABLE `medicines`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `generic_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `form` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `strength` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `category_id` bigint UNSIGNED NULL DEFAULT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `manufacturer` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `hsn_code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `gst_percent` decimal(5, 2) NOT NULL DEFAULT 0,
  `reorder_level` int NOT NULL DEFAULT 0,
  `barcode` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `unit` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `stock_qty` int NOT NULL DEFAULT 0,
  `price` decimal(10, 2) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_medicines_category`(`category_id` ASC) USING BTREE,
  INDEX `ix_medicines_barcode`(`barcode` ASC) USING BTREE,
  CONSTRAINT `fk_medicines_category` FOREIGN KEY (`category_id`) REFERENCES `medicine_categories` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of medicines
-- ----------------------------
INSERT INTO `medicines` VALUES (1, 'Paracetamol 1000', '', 'Tablet', '84512', 7, '', 'MSPK', '123456', 100.00, 10, '7986', 'Strip', 0, 0.00, 1, '2026-07-29 14:00:42', '2026-07-29 14:00:42');

-- ----------------------------
-- Table structure for module_actions
-- ----------------------------
DROP TABLE IF EXISTS `module_actions`;
CREATE TABLE `module_actions`  (
  `module_id` bigint UNSIGNED NOT NULL,
  `action_id` bigint UNSIGNED NOT NULL,
  PRIMARY KEY (`module_id`, `action_id`) USING BTREE,
  INDEX `fk_module_actions_action`(`action_id` ASC) USING BTREE,
  CONSTRAINT `fk_module_actions_module` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_module_actions_action` FOREIGN KEY (`action_id`) REFERENCES `actions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of module_actions
-- ----------------------------
INSERT INTO `module_actions` VALUES (1, 4);
INSERT INTO `module_actions` VALUES (2, 5);
INSERT INTO `module_actions` VALUES (3, 6);
INSERT INTO `module_actions` VALUES (4, 7);
INSERT INTO `module_actions` VALUES (4, 8);
INSERT INTO `module_actions` VALUES (5, 9);
INSERT INTO `module_actions` VALUES (6, 10);
INSERT INTO `module_actions` VALUES (6, 11);
INSERT INTO `module_actions` VALUES (8, 12);
INSERT INTO `module_actions` VALUES (10, 15);
INSERT INTO `module_actions` VALUES (11, 13);
INSERT INTO `module_actions` VALUES (11, 14);
INSERT INTO `module_actions` VALUES (12, 16);

-- ----------------------------
-- Table structure for modules
-- ----------------------------
DROP TABLE IF EXISTS `modules`;
CREATE TABLE `modules`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `display_order` smallint UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_modules_code`(`code` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 190646 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of modules
-- ----------------------------
INSERT INTO `modules` VALUES (1, 'hr_employee', 'HR & Employee Management', 1);
INSERT INTO `modules` VALUES (2, 'shift_roster', 'Shift & Roster Management', 2);
INSERT INTO `modules` VALUES (3, 'attendance', 'Attendance Engine', 3);
INSERT INTO `modules` VALUES (4, 'leave', 'Leave Engine', 4);
INSERT INTO `modules` VALUES (5, 'fine', 'Fine Engine', 5);
INSERT INTO `modules` VALUES (6, 'payroll', 'Payroll Engine', 6);
INSERT INTO `modules` VALUES (7, 'patient', 'Patient Records', 7);
INSERT INTO `modules` VALUES (8, 'appointment', 'Appointment / Token', 8);
INSERT INTO `modules` VALUES (9, 'consultation', 'Doctor Consultation & Prescription', 9);
INSERT INTO `modules` VALUES (10, 'pharmacy', 'Pharmacy Module', 10);
INSERT INTO `modules` VALUES (11, 'admission', 'Admission & Bed Management', 11);
INSERT INTO `modules` VALUES (12, 'discharge', 'Discharge & Patient History', 12);

-- ----------------------------
-- Table structure for overtime_entries
-- ----------------------------
DROP TABLE IF EXISTS `overtime_entries`;
CREATE TABLE `overtime_entries`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `entry_date` date NOT NULL,
  `entry_type` enum('extra_day','hourly') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `hours` decimal(4, 2) NULL DEFAULT NULL,
  `computed_amount` decimal(10, 2) NOT NULL,
  `notes` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `payroll_run_id` bigint UNSIGNED NULL DEFAULT NULL,
  `created_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_overtime_employee`(`employee_id` ASC, `entry_date` ASC) USING BTREE,
  INDEX `fk_overtime_created_by`(`created_by` ASC) USING BTREE,
  INDEX `fk_overtime_payroll_run`(`payroll_run_id` ASC) USING BTREE,
  CONSTRAINT `fk_overtime_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_overtime_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_overtime_payroll_run` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of overtime_entries
-- ----------------------------

-- ----------------------------
-- Table structure for patients
-- ----------------------------
DROP TABLE IF EXISTS `patients`;
CREATE TABLE `patients`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `date_of_birth` date NULL DEFAULT NULL,
  `age_years` smallint UNSIGNED NULL DEFAULT NULL,
  `gender` enum('male','female','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `mobile_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `blood_group` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `notes` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_patients_mobile`(`mobile_number` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of patients
-- ----------------------------

-- ----------------------------
-- Table structure for payroll_config
-- ----------------------------
DROP TABLE IF EXISTS `payroll_config`;
CREATE TABLE `payroll_config`  (
  `config_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `config_value` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`config_key`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of payroll_config
-- ----------------------------
INSERT INTO `payroll_config` VALUES ('ESI_EMPLOYEE_PERCENT', '0.75', 'Employee ESI contribution, % of gross', '2026-07-27 12:17:30');
INSERT INTO `payroll_config` VALUES ('ESI_EMPLOYER_PERCENT', '3.25', 'Employer ESI contribution, % of gross', '2026-07-27 12:17:31');
INSERT INTO `payroll_config` VALUES ('ESI_GROSS_CEILING', '21000', 'Gross above which ESI does not apply', '2026-07-27 15:53:18');
INSERT INTO `payroll_config` VALUES ('PF_EMPLOYEE_PERCENT', '12', 'Employee PF contribution, % of Basic+DA', '2026-07-27 12:17:30');
INSERT INTO `payroll_config` VALUES ('PF_EMPLOYER_EPF_PERCENT', '3.67', 'Employer EPF share, % of Basic+DA', '2026-07-27 12:17:30');
INSERT INTO `payroll_config` VALUES ('PF_EMPLOYER_EPS_PERCENT', '8.33', 'Employer EPS share, % of Basic+DA', '2026-07-27 12:17:30');
INSERT INTO `payroll_config` VALUES ('PF_WAGE_CEILING', '15000', 'Max Basic+DA considered for PF', '2026-07-27 15:05:20');
INSERT INTO `payroll_config` VALUES ('STANDARD_SHIFT_MINUTES', '480', 'Shift length used to convert late minutes to a day fraction', '2026-07-27 12:17:31');

-- ----------------------------
-- Table structure for payroll_items
-- ----------------------------
DROP TABLE IF EXISTS `payroll_items`;
CREATE TABLE `payroll_items`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `payroll_run_id` bigint UNSIGNED NOT NULL,
  `employee_id` bigint UNSIGNED NOT NULL,
  `salary_structure_id` bigint UNSIGNED NULL DEFAULT NULL,
  `days_present` decimal(4, 1) NOT NULL DEFAULT 0,
  `days_paid_leave` decimal(4, 1) NOT NULL DEFAULT 0,
  `days_lop` decimal(4, 1) NOT NULL DEFAULT 0,
  `shifts_worked` decimal(4, 1) NOT NULL DEFAULT 0,
  `base_salary_component` decimal(10, 2) NOT NULL DEFAULT 0,
  `night_shift_component` decimal(10, 2) NOT NULL DEFAULT 0,
  `buffer_late_deduction` decimal(10, 2) NOT NULL DEFAULT 0,
  `gross_pay` decimal(10, 2) NOT NULL DEFAULT 0,
  `lop_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `overtime_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `pf_employee_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `pf_employer_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `esi_employee_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `esi_employer_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `fines_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `net_pay` decimal(10, 2) NOT NULL DEFAULT 0,
  `generated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_payroll_item`(`payroll_run_id` ASC, `employee_id` ASC) USING BTREE,
  INDEX `fk_payroll_items_employee`(`employee_id` ASC) USING BTREE,
  INDEX `fk_payroll_items_salary_structure`(`salary_structure_id` ASC) USING BTREE,
  CONSTRAINT `fk_payroll_items_run` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_payroll_items_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_payroll_items_salary_structure` FOREIGN KEY (`salary_structure_id`) REFERENCES `salary_structures` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of payroll_items
-- ----------------------------

-- ----------------------------
-- Table structure for payroll_runs
-- ----------------------------
DROP TABLE IF EXISTS `payroll_runs`;
CREATE TABLE `payroll_runs`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `period_month` tinyint UNSIGNED NOT NULL,
  `period_year` smallint UNSIGNED NOT NULL,
  `status` enum('draft','locked','paid') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'draft',
  `salary_date_type` enum('last_day_of_month','first_of_next_month') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'last_day_of_month',
  `salary_date` date NULL DEFAULT NULL,
  `locked_by` bigint UNSIGNED NULL DEFAULT NULL,
  `locked_at` timestamp NULL DEFAULT NULL,
  `confirmed_by` bigint UNSIGNED NULL DEFAULT NULL,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_payroll_run_period`(`period_year` ASC, `period_month` ASC) USING BTREE,
  INDEX `fk_payroll_runs_locked_by`(`locked_by` ASC) USING BTREE,
  INDEX `fk_payroll_runs_confirmed_by`(`confirmed_by` ASC) USING BTREE,
  CONSTRAINT `fk_payroll_runs_locked_by` FOREIGN KEY (`locked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_payroll_runs_confirmed_by` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of payroll_runs
-- ----------------------------

-- ----------------------------
-- Table structure for permissions
-- ----------------------------
DROP TABLE IF EXISTS `permissions`;
CREATE TABLE `permissions`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `module_id` bigint UNSIGNED NOT NULL,
  `action_id` bigint UNSIGNED NOT NULL,
  `code` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_permissions_module_action`(`module_id` ASC, `action_id` ASC) USING BTREE,
  UNIQUE INDEX `uq_permissions_code`(`code` ASC) USING BTREE,
  INDEX `fk_permissions_action`(`action_id` ASC) USING BTREE,
  CONSTRAINT `fk_permissions_module` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_permissions_action` FOREIGN KEY (`action_id`) REFERENCES `actions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 112883 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of permissions
-- ----------------------------
INSERT INTO `permissions` VALUES (1, 1, 3, 'hr_employee.delete', 'Delete — HR & Employee Management');
INSERT INTO `permissions` VALUES (2, 1, 2, 'hr_employee.modify', 'Create / Edit — HR & Employee Management');
INSERT INTO `permissions` VALUES (3, 1, 1, 'hr_employee.view', 'View / Read — HR & Employee Management');
INSERT INTO `permissions` VALUES (4, 2, 3, 'shift_roster.delete', 'Delete — Shift & Roster Management');
INSERT INTO `permissions` VALUES (5, 2, 2, 'shift_roster.modify', 'Create / Edit — Shift & Roster Management');
INSERT INTO `permissions` VALUES (6, 2, 1, 'shift_roster.view', 'View / Read — Shift & Roster Management');
INSERT INTO `permissions` VALUES (7, 3, 3, 'attendance.delete', 'Delete — Attendance Engine');
INSERT INTO `permissions` VALUES (8, 3, 2, 'attendance.modify', 'Create / Edit — Attendance Engine');
INSERT INTO `permissions` VALUES (9, 3, 1, 'attendance.view', 'View / Read — Attendance Engine');
INSERT INTO `permissions` VALUES (10, 4, 3, 'leave.delete', 'Delete — Leave Engine');
INSERT INTO `permissions` VALUES (11, 4, 2, 'leave.modify', 'Create / Edit — Leave Engine');
INSERT INTO `permissions` VALUES (12, 4, 1, 'leave.view', 'View / Read — Leave Engine');
INSERT INTO `permissions` VALUES (13, 5, 3, 'fine.delete', 'Delete — Fine Engine');
INSERT INTO `permissions` VALUES (14, 5, 2, 'fine.modify', 'Create / Edit — Fine Engine');
INSERT INTO `permissions` VALUES (15, 5, 1, 'fine.view', 'View / Read — Fine Engine');
INSERT INTO `permissions` VALUES (16, 6, 3, 'payroll.delete', 'Delete — Payroll Engine');
INSERT INTO `permissions` VALUES (17, 6, 2, 'payroll.modify', 'Create / Edit — Payroll Engine');
INSERT INTO `permissions` VALUES (18, 6, 1, 'payroll.view', 'View / Read — Payroll Engine');
INSERT INTO `permissions` VALUES (19, 7, 3, 'patient.delete', 'Delete — Patient Records');
INSERT INTO `permissions` VALUES (20, 7, 2, 'patient.modify', 'Create / Edit — Patient Records');
INSERT INTO `permissions` VALUES (21, 7, 1, 'patient.view', 'View / Read — Patient Records');
INSERT INTO `permissions` VALUES (22, 8, 3, 'appointment.delete', 'Delete — Appointment / Token');
INSERT INTO `permissions` VALUES (23, 8, 2, 'appointment.modify', 'Create / Edit — Appointment / Token');
INSERT INTO `permissions` VALUES (24, 8, 1, 'appointment.view', 'View / Read — Appointment / Token');
INSERT INTO `permissions` VALUES (25, 9, 3, 'consultation.delete', 'Delete — Doctor Consultation & Prescription');
INSERT INTO `permissions` VALUES (26, 9, 2, 'consultation.modify', 'Create / Edit — Doctor Consultation & Prescription');
INSERT INTO `permissions` VALUES (27, 9, 1, 'consultation.view', 'View / Read — Doctor Consultation & Prescription');
INSERT INTO `permissions` VALUES (28, 10, 3, 'pharmacy.delete', 'Delete — Pharmacy Module');
INSERT INTO `permissions` VALUES (29, 10, 2, 'pharmacy.modify', 'Create / Edit — Pharmacy Module');
INSERT INTO `permissions` VALUES (30, 10, 1, 'pharmacy.view', 'View / Read — Pharmacy Module');
INSERT INTO `permissions` VALUES (31, 11, 3, 'admission.delete', 'Delete — Admission & Bed Management');
INSERT INTO `permissions` VALUES (32, 11, 2, 'admission.modify', 'Create / Edit — Admission & Bed Management');
INSERT INTO `permissions` VALUES (33, 11, 1, 'admission.view', 'View / Read — Admission & Bed Management');
INSERT INTO `permissions` VALUES (34, 12, 3, 'discharge.delete', 'Delete — Discharge & Patient History');
INSERT INTO `permissions` VALUES (35, 12, 2, 'discharge.modify', 'Create / Edit — Discharge & Patient History');
INSERT INTO `permissions` VALUES (36, 12, 1, 'discharge.view', 'View / Read — Discharge & Patient History');
INSERT INTO `permissions` VALUES (37, 1, 4, 'hr_employee.approve_increment', 'Approve Salary Increment — HR & Employee Management');
INSERT INTO `permissions` VALUES (38, 2, 5, 'shift_roster.publish_roster', 'Publish Roster — Shift & Roster Management');
INSERT INTO `permissions` VALUES (39, 3, 6, 'attendance.approve_correction', 'Approve Attendance Correction — Attendance Engine');
INSERT INTO `permissions` VALUES (40, 4, 7, 'leave.approve_leave_reporting', 'Approve Leave (Reporting Person) — Leave Engine');
INSERT INTO `permissions` VALUES (41, 4, 8, 'leave.approve_leave_hr', 'Approve Leave (HR, Final) — Leave Engine');
INSERT INTO `permissions` VALUES (42, 5, 9, 'fine.waive_fine', 'Waive / Cancel a Fine — Fine Engine');
INSERT INTO `permissions` VALUES (43, 6, 10, 'payroll.lock_payroll', 'Lock Payroll Run — Payroll Engine');
INSERT INTO `permissions` VALUES (44, 6, 11, 'payroll.generate_payslip', 'Generate Payslip — Payroll Engine');
INSERT INTO `permissions` VALUES (45, 8, 12, 'appointment.close_appointment', 'Close / Cancel Appointment — Appointment / Token');
INSERT INTO `permissions` VALUES (46, 10, 15, 'pharmacy.generate_bill', 'Generate Pharmacy Bill — Pharmacy Module');
INSERT INTO `permissions` VALUES (47, 11, 13, 'admission.convert_to_admission', 'Convert Appointment to Admission — Admission & Bed Management');
INSERT INTO `permissions` VALUES (48, 11, 14, 'admission.assign_bed', 'Assign / Change Bed — Admission & Bed Management');
INSERT INTO `permissions` VALUES (49, 12, 16, 'discharge.discharge_patient', 'Discharge Patient — Discharge & Patient History');

-- ----------------------------
-- Table structure for pharmacy_bill_items
-- ----------------------------
DROP TABLE IF EXISTS `pharmacy_bill_items`;
CREATE TABLE `pharmacy_bill_items`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `pharmacy_bill_id` bigint UNSIGNED NOT NULL,
  `medicine_id` bigint UNSIGNED NOT NULL,
  `batch_id` bigint UNSIGNED NULL DEFAULT NULL,
  `discount_percent` decimal(5, 2) NOT NULL DEFAULT 0,
  `quantity` int UNSIGNED NOT NULL,
  `unit_price` decimal(10, 2) NOT NULL,
  `subtotal` decimal(10, 2) GENERATED ALWAYS AS (`quantity` * `unit_price`) STORED NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_bill_items_bill`(`pharmacy_bill_id` ASC) USING BTREE,
  INDEX `fk_bill_items_medicine`(`medicine_id` ASC) USING BTREE,
  INDEX `fk_bill_items_batch`(`batch_id` ASC) USING BTREE,
  CONSTRAINT `fk_bill_items_bill` FOREIGN KEY (`pharmacy_bill_id`) REFERENCES `pharmacy_bills` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_bill_items_medicine` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_bill_items_batch` FOREIGN KEY (`batch_id`) REFERENCES `medicine_batches` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of pharmacy_bill_items
-- ----------------------------

-- ----------------------------
-- Table structure for pharmacy_bills
-- ----------------------------
DROP TABLE IF EXISTS `pharmacy_bills`;
CREATE TABLE `pharmacy_bills`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `patient_id` bigint UNSIGNED NOT NULL,
  `appointment_id` bigint UNSIGNED NULL DEFAULT NULL,
  `admission_id` bigint UNSIGNED NULL DEFAULT NULL,
  `bill_number` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `bill_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `discount_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `tax_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `net_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `paid_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `balance_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `payment_mode` enum('cash','upi','card','insurance','credit') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'cash',
  `payment_status` enum('pending','paid','partial') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending',
  `closed_at` timestamp NULL DEFAULT NULL,
  `generated_by` bigint UNSIGNED NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_pharmacy_bills_number`(`bill_number` ASC) USING BTREE,
  INDEX `ix_pharmacy_bills_patient`(`patient_id` ASC) USING BTREE,
  INDEX `fk_pharmacy_bills_appointment`(`appointment_id` ASC) USING BTREE,
  INDEX `fk_pharmacy_bills_generated_by`(`generated_by` ASC) USING BTREE,
  INDEX `fk_pharmacy_bills_admission`(`admission_id` ASC) USING BTREE,
  CONSTRAINT `fk_pharmacy_bills_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_pharmacy_bills_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_pharmacy_bills_generated_by` FOREIGN KEY (`generated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_pharmacy_bills_admission` FOREIGN KEY (`admission_id`) REFERENCES `admissions` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of pharmacy_bills
-- ----------------------------

-- ----------------------------
-- Table structure for pharmacy_suppliers
-- ----------------------------
DROP TABLE IF EXISTS `pharmacy_suppliers`;
CREATE TABLE `pharmacy_suppliers`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `contact_person` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `gstin` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of pharmacy_suppliers
-- ----------------------------

-- ----------------------------
-- Table structure for prescription_items
-- ----------------------------
DROP TABLE IF EXISTS `prescription_items`;
CREATE TABLE `prescription_items`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `prescription_id` bigint UNSIGNED NOT NULL,
  `medicine_id` bigint UNSIGNED NOT NULL,
  `dose_morning` tinyint UNSIGNED NOT NULL DEFAULT 0,
  `dose_afternoon` tinyint UNSIGNED NOT NULL DEFAULT 0,
  `dose_night` tinyint UNSIGNED NOT NULL DEFAULT 0,
  `duration_days` smallint UNSIGNED NOT NULL DEFAULT 1,
  `food_instruction` enum('before_food','after_food','anytime') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'anytime',
  `notes` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_prescription_items_prescription`(`prescription_id` ASC) USING BTREE,
  INDEX `fk_prescription_items_medicine`(`medicine_id` ASC) USING BTREE,
  CONSTRAINT `fk_prescription_items_prescription` FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_prescription_items_medicine` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of prescription_items
-- ----------------------------

-- ----------------------------
-- Table structure for prescriptions
-- ----------------------------
DROP TABLE IF EXISTS `prescriptions`;
CREATE TABLE `prescriptions`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `consultation_id` bigint UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `fk_prescriptions_consultation`(`consultation_id` ASC) USING BTREE,
  CONSTRAINT `fk_prescriptions_consultation` FOREIGN KEY (`consultation_id`) REFERENCES `consultations` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of prescriptions
-- ----------------------------

-- ----------------------------
-- Table structure for purchase_order_items
-- ----------------------------
DROP TABLE IF EXISTS `purchase_order_items`;
CREATE TABLE `purchase_order_items`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `purchase_order_id` bigint UNSIGNED NOT NULL,
  `medicine_id` bigint UNSIGNED NOT NULL,
  `ordered_qty` int NOT NULL,
  `received_qty` int NOT NULL DEFAULT 0,
  `estimated_price` decimal(10, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_po_items_po`(`purchase_order_id` ASC) USING BTREE,
  INDEX `ix_po_items_medicine`(`medicine_id` ASC) USING BTREE,
  CONSTRAINT `fk_po_items_po` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_po_items_medicine` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of purchase_order_items
-- ----------------------------

-- ----------------------------
-- Table structure for purchase_orders
-- ----------------------------
DROP TABLE IF EXISTS `purchase_orders`;
CREATE TABLE `purchase_orders`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `po_number` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `supplier_id` bigint UNSIGNED NOT NULL,
  `order_date` date NOT NULL,
  `expected_date` date NULL DEFAULT NULL,
  `status` enum('draft','placed','partially_received','received','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'draft',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_purchase_orders_number`(`po_number` ASC) USING BTREE,
  INDEX `ix_purchase_orders_supplier`(`supplier_id` ASC) USING BTREE,
  INDEX `ix_purchase_orders_status`(`status` ASC) USING BTREE,
  INDEX `fk_po_created_by`(`created_by` ASC) USING BTREE,
  CONSTRAINT `fk_po_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `pharmacy_suppliers` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_po_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of purchase_orders
-- ----------------------------

-- ----------------------------
-- Table structure for role_leave_policies
-- ----------------------------
DROP TABLE IF EXISTS `role_leave_policies`;
CREATE TABLE `role_leave_policies`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_id` bigint UNSIGNED NOT NULL,
  `leave_type_id` bigint UNSIGNED NOT NULL,
  `quota_days` decimal(5, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_role_leave_policy`(`role_id` ASC, `leave_type_id` ASC) USING BTREE,
  INDEX `fk_rlp_leave_type`(`leave_type_id` ASC) USING BTREE,
  CONSTRAINT `fk_rlp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_rlp_leave_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of role_leave_policies
-- ----------------------------

-- ----------------------------
-- Table structure for role_permissions
-- ----------------------------
DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions`  (
  `role_id` bigint UNSIGNED NOT NULL,
  `permission_id` bigint UNSIGNED NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`) USING BTREE,
  INDEX `fk_role_permissions_permission`(`permission_id` ASC) USING BTREE,
  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of role_permissions
-- ----------------------------
INSERT INTO `role_permissions` VALUES (1, 1);
INSERT INTO `role_permissions` VALUES (1, 2);
INSERT INTO `role_permissions` VALUES (1, 3);
INSERT INTO `role_permissions` VALUES (1, 4);
INSERT INTO `role_permissions` VALUES (1, 5);
INSERT INTO `role_permissions` VALUES (1, 6);
INSERT INTO `role_permissions` VALUES (1, 7);
INSERT INTO `role_permissions` VALUES (1, 8);
INSERT INTO `role_permissions` VALUES (1, 9);
INSERT INTO `role_permissions` VALUES (1, 10);
INSERT INTO `role_permissions` VALUES (1, 11);
INSERT INTO `role_permissions` VALUES (1, 12);
INSERT INTO `role_permissions` VALUES (1, 13);
INSERT INTO `role_permissions` VALUES (1, 14);
INSERT INTO `role_permissions` VALUES (1, 15);
INSERT INTO `role_permissions` VALUES (1, 16);
INSERT INTO `role_permissions` VALUES (1, 17);
INSERT INTO `role_permissions` VALUES (1, 18);
INSERT INTO `role_permissions` VALUES (1, 19);
INSERT INTO `role_permissions` VALUES (1, 20);
INSERT INTO `role_permissions` VALUES (1, 21);
INSERT INTO `role_permissions` VALUES (1, 22);
INSERT INTO `role_permissions` VALUES (1, 23);
INSERT INTO `role_permissions` VALUES (1, 24);
INSERT INTO `role_permissions` VALUES (1, 25);
INSERT INTO `role_permissions` VALUES (1, 26);
INSERT INTO `role_permissions` VALUES (1, 27);
INSERT INTO `role_permissions` VALUES (1, 28);
INSERT INTO `role_permissions` VALUES (1, 29);
INSERT INTO `role_permissions` VALUES (1, 30);
INSERT INTO `role_permissions` VALUES (1, 31);
INSERT INTO `role_permissions` VALUES (1, 32);
INSERT INTO `role_permissions` VALUES (1, 33);
INSERT INTO `role_permissions` VALUES (1, 34);
INSERT INTO `role_permissions` VALUES (1, 35);
INSERT INTO `role_permissions` VALUES (1, 36);
INSERT INTO `role_permissions` VALUES (1, 37);
INSERT INTO `role_permissions` VALUES (1, 38);
INSERT INTO `role_permissions` VALUES (1, 39);
INSERT INTO `role_permissions` VALUES (1, 40);
INSERT INTO `role_permissions` VALUES (1, 41);
INSERT INTO `role_permissions` VALUES (1, 42);
INSERT INTO `role_permissions` VALUES (1, 43);
INSERT INTO `role_permissions` VALUES (1, 44);
INSERT INTO `role_permissions` VALUES (1, 45);
INSERT INTO `role_permissions` VALUES (1, 46);
INSERT INTO `role_permissions` VALUES (1, 47);
INSERT INTO `role_permissions` VALUES (1, 48);
INSERT INTO `role_permissions` VALUES (1, 49);

-- ----------------------------
-- Table structure for roles
-- ----------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_roles_name`(`name` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 90200 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of roles
-- ----------------------------
INSERT INTO `roles` VALUES (1, 'Administrator', 'Full access to every module and action', '2026-07-15 09:29:21');

-- ----------------------------
-- Table structure for room_types
-- ----------------------------
DROP TABLE IF EXISTS `room_types`;
CREATE TABLE `room_types`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `daily_rate` decimal(10, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_room_types_name`(`name` ASC) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of room_types
-- ----------------------------

-- ----------------------------
-- Table structure for rooms
-- ----------------------------
DROP TABLE IF EXISTS `rooms`;
CREATE TABLE `rooms`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `ward_id` bigint UNSIGNED NOT NULL,
  `room_type_id` bigint UNSIGNED NOT NULL,
  `room_number` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `fk_rooms_ward`(`ward_id` ASC) USING BTREE,
  INDEX `fk_rooms_room_type`(`room_type_id` ASC) USING BTREE,
  CONSTRAINT `fk_rooms_ward` FOREIGN KEY (`ward_id`) REFERENCES `wards` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_rooms_room_type` FOREIGN KEY (`room_type_id`) REFERENCES `room_types` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of rooms
-- ----------------------------

-- ----------------------------
-- Table structure for roster_entries
-- ----------------------------
DROP TABLE IF EXISTS `roster_entries`;
CREATE TABLE `roster_entries`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `roster_date` date NOT NULL,
  `shift_id` bigint UNSIGNED NULL DEFAULT NULL,
  `is_week_off` tinyint(1) NOT NULL DEFAULT 0,
  `is_holiday` tinyint(1) NOT NULL DEFAULT 0,
  `is_manual_override` tinyint(1) NOT NULL DEFAULT 0,
  `notes` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `created_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_roster_employee_date`(`employee_id` ASC, `roster_date` ASC) USING BTREE,
  INDEX `ix_roster_date`(`roster_date` ASC) USING BTREE,
  INDEX `fk_roster_shift`(`shift_id` ASC) USING BTREE,
  INDEX `fk_roster_created_by`(`created_by` ASC) USING BTREE,
  CONSTRAINT `fk_roster_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_roster_shift` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_roster_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of roster_entries
-- ----------------------------

-- ----------------------------
-- Table structure for salary_structures
-- ----------------------------
DROP TABLE IF EXISTS `salary_structures`;
CREATE TABLE `salary_structures`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `salary_basis` enum('monthly_fixed','per_day','per_shift') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'monthly_fixed',
  `fixed_salary` decimal(10, 2) NULL DEFAULT NULL,
  `basic_da_amount` decimal(10, 2) NULL DEFAULT NULL,
  `hra_amount` decimal(10, 2) NULL DEFAULT NULL,
  `rate_per_day` decimal(10, 2) NULL DEFAULT NULL,
  `rate_per_shift` decimal(10, 2) NULL DEFAULT NULL,
  `base_salary` decimal(10, 2) NULL DEFAULT NULL,
  `night_shift_extra_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `pf_applicable` tinyint(1) NOT NULL DEFAULT 1,
  `esi_applicable` tinyint(1) NOT NULL DEFAULT 1,
  `effective_from` date NOT NULL,
  `effective_to` date NULL DEFAULT NULL,
  `created_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_salary_structures_employee`(`employee_id` ASC, `effective_from` ASC) USING BTREE,
  INDEX `fk_salary_structures_created_by`(`created_by` ASC) USING BTREE,
  CONSTRAINT `fk_salary_structures_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_salary_structures_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of salary_structures
-- ----------------------------

-- ----------------------------
-- Table structure for shift_rate_history
-- ----------------------------
DROP TABLE IF EXISTS `shift_rate_history`;
CREATE TABLE `shift_rate_history`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `shift_id` bigint UNSIGNED NOT NULL,
  `night_rate_amount` decimal(10, 2) NOT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date NULL DEFAULT NULL,
  `reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `changed_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_shift_rate_shift`(`shift_id` ASC, `effective_from` ASC) USING BTREE,
  INDEX `fk_shift_rate_changed_by`(`changed_by` ASC) USING BTREE,
  CONSTRAINT `fk_shift_rate_shift` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_shift_rate_changed_by` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of shift_rate_history
-- ----------------------------

-- ----------------------------
-- Table structure for shifts
-- ----------------------------
DROP TABLE IF EXISTS `shifts`;
CREATE TABLE `shifts`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `crosses_midnight` tinyint(1) NOT NULL DEFAULT 0,
  `buffer_minutes` smallint UNSIGNED NOT NULL DEFAULT 10,
  `is_night_shift` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `grace_period_minutes` int NOT NULL DEFAULT 0,
  `biometric_in_start` time NULL DEFAULT NULL,
  `biometric_in_end` time NULL DEFAULT NULL,
  `biometric_out_start` time NULL DEFAULT NULL,
  `biometric_out_end` time NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_shifts_name`(`name` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of shifts
-- ----------------------------
INSERT INTO `shifts` VALUES (1, 'Day Shift', '09:00:00', '16:00:00', 0, 10, 0, 1, '2026-07-27 14:39:06', 10, '07:00:00', '09:00:00', '16:00:00', '18:00:00');
INSERT INTO `shifts` VALUES (2, 'Night Shift', '20:00:00', '08:00:00', 0, 10, 1, 1, '2026-07-27 14:39:06', 10, '18:00:00', '20:00:00', '08:00:00', '10:00:00');

-- ----------------------------
-- Table structure for staff_roles
-- ----------------------------
DROP TABLE IF EXISTS `staff_roles`;
CREATE TABLE `staff_roles`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `department_id` bigint UNSIGNED NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `basic_salary` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `hra` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `da` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `lop_deduction` decimal(10, 2) NOT NULL DEFAULT 0.00,
  `casual_leave_count` int NOT NULL DEFAULT 0,
  `privilege_leave_count` int NOT NULL DEFAULT 0,
  `weekly_off_count` int NOT NULL DEFAULT 0,
  `shift_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `shift_start_time` time NULL DEFAULT NULL,
  `shift_end_time` time NULL DEFAULT NULL,
  `biometric_in_start` time NULL DEFAULT NULL,
  `biometric_in_end` time NULL DEFAULT NULL,
  `biometric_out_start` time NULL DEFAULT NULL,
  `biometric_out_end` time NULL DEFAULT NULL,
  `is_night_shift` tinyint(1) NOT NULL DEFAULT 0,
  `grace_period_minutes` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `default_shift_id` bigint UNSIGNED NULL DEFAULT NULL,
  `capacity` int NULL DEFAULT NULL,
  `break_minutes` int NULL DEFAULT NULL,
  `notes` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `monthly_buffer_minutes` int NOT NULL DEFAULT 30,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `fk_staff_roles_dept`(`department_id` ASC) USING BTREE,
  INDEX `fk_staff_roles_default_shift`(`default_shift_id` ASC) USING BTREE,
  CONSTRAINT `fk_staff_roles_dept` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_staff_roles_default_shift` FOREIGN KEY (`default_shift_id`) REFERENCES `shifts` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 120001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of staff_roles
-- ----------------------------
INSERT INTO `staff_roles` VALUES (3, 3, 'Head Nurse', NULL, 1, 35000.00, 0.00, 0.00, 0.00, 0, 0, 4, 'Day Shift', '09:00:00', '16:00:00', '07:00:00', '09:00:00', '16:00:00', '18:00:00', 0, 10, '2026-07-20 14:10:51', '2026-07-27 14:52:28', 1, 12, 30, 'ICU handover at 09:15', 30);
INSERT INTO `staff_roles` VALUES (4, 3, 'Staff Nurse', NULL, 1, 25000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:14:04', '2026-07-20 14:14:04', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (5, 3, 'Junior Nurse', NULL, 1, 18000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:14:30', '2026-07-20 14:14:30', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (6, 4, 'Chief Pharmacist', NULL, 1, 35000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:18:41', '2026-07-20 14:18:41', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (7, 4, 'Dispensing Pharmacist', NULL, 1, 28000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:18:41', '2026-07-20 14:18:41', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (8, 5, 'Senior Consultant', NULL, 1, 50000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:20:17', '2026-07-20 14:20:17', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (9, 5, 'Resident Doctor', NULL, 1, 40000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:20:17', '2026-07-20 14:20:17', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (10, 5, 'Intern Doctor', NULL, 1, 20000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:20:17', '2026-07-20 14:20:17', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (11, 6, 'Chief Technician', NULL, 1, 30000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:21:16', '2026-07-20 14:21:16', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (12, 6, 'Lab Analyst', NULL, 1, 20000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:21:16', '2026-07-20 14:21:16', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (13, 7, 'HR Manager', NULL, 1, 40000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:24:35', '2026-07-20 14:24:35', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (14, 7, 'Receptionist', NULL, 1, 30000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:24:35', '2026-07-20 14:24:35', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (15, 7, 'Billing Executive ', NULL, 1, 24000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:24:35', '2026-07-20 14:24:35', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (16, 8, 'Surgeon', NULL, 1, 80000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:26:48', '2026-07-20 14:26:48', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (17, 8, 'Chief Consultant', NULL, 1, 60000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:26:48', '2026-07-20 14:26:48', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (18, 9, 'Chief Consultant', NULL, 1, 50000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:29:00', '2026-07-20 14:29:00', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (19, 9, 'Resident Doctor', NULL, 1, 35000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:29:00', '2026-07-20 14:29:00', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (20, 9, 'Intern Doctor', NULL, 1, 20000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:29:00', '2026-07-20 14:29:00', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (21, 10, 'Chief Anesthesiologist', NULL, 1, 70000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:31:07', '2026-07-20 14:31:07', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (22, 11, 'Chief Gynecologist', NULL, 1, 65000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:35:05', '2026-07-20 14:35:05', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (23, 11, 'Gynec Consultant', NULL, 1, 40000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-20 14:35:05', '2026-07-20 14:35:05', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (60001, 60001, 'House Keeping', NULL, 1, 10000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-21 09:56:31', '2026-07-21 09:56:31', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (60002, 60001, 'Ambulance Driver', NULL, 1, 25000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-21 09:56:31', '2026-07-21 09:56:31', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (60003, 60001, 'Caretaker', NULL, 1, 15000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-21 09:56:31', '2026-07-21 09:56:31', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (60004, 60001, 'Security Guard', NULL, 1, 12000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-21 09:56:31', '2026-07-21 09:56:31', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (90001, 6, 'Phlebotomist', NULL, 1, 20000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-21 11:49:28', '2026-07-21 11:49:28', NULL, NULL, NULL, NULL, 30);
INSERT INTO `staff_roles` VALUES (90002, 5, 'Intern', NULL, 1, 15000.00, 0.00, 0.00, 0.00, 0, 0, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, '2026-07-21 11:49:29', '2026-07-21 11:49:29', NULL, NULL, NULL, NULL, 30);

-- ----------------------------
-- Table structure for stock_movements
-- ----------------------------
DROP TABLE IF EXISTS `stock_movements`;
CREATE TABLE `stock_movements`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `medicine_id` bigint UNSIGNED NOT NULL,
  `batch_id` bigint UNSIGNED NULL DEFAULT NULL,
  `movement_type` enum('receipt','sale','return','adjustment') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `quantity` int NOT NULL,
  `reference_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `reference_id` bigint UNSIGNED NULL DEFAULT NULL,
  `patient_id` bigint UNSIGNED NULL DEFAULT NULL,
  `movement_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_stock_mvmt_medicine`(`medicine_id` ASC) USING BTREE,
  INDEX `ix_stock_mvmt_batch`(`batch_id` ASC) USING BTREE,
  INDEX `ix_stock_mvmt_date`(`movement_date` ASC) USING BTREE,
  INDEX `ix_stock_mvmt_patient`(`patient_id` ASC) USING BTREE,
  INDEX `ix_stock_mvmt_type`(`movement_type` ASC) USING BTREE,
  CONSTRAINT `fk_stock_mvmt_medicine` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_stock_mvmt_batch` FOREIGN KEY (`batch_id`) REFERENCES `medicine_batches` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_stock_mvmt_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of stock_movements
-- ----------------------------
INSERT INTO `stock_movements` VALUES (1, 1, 1, 'receipt', 100, 'manual_entry', 1, NULL, '2026-07-29', '2026-07-29 14:01:18');

-- ----------------------------
-- Table structure for system_config
-- ----------------------------
DROP TABLE IF EXISTS `system_config`;
CREATE TABLE `system_config`  (
  `config_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `config_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `updated_by` bigint UNSIGNED NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`config_key`) USING BTREE,
  INDEX `fk_sys_config_user`(`updated_by` ASC) USING BTREE,
  CONSTRAINT `fk_sys_config_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of system_config
-- ----------------------------
INSERT INTO `system_config` VALUES ('DEFAULT_BUFFER_MINUTES', '30', 'Default monthly late-arrival buffer (minutes) for all roles', NULL, '2026-07-15 09:29:46');
INSERT INTO `system_config` VALUES ('FUTURE_BOOKING_ENABLED', '0', '1 = future-date appointment booking enabled in UI', NULL, '2026-07-15 09:29:46');
INSERT INTO `system_config` VALUES ('HOSPITAL_ADDRESS', '', 'Full address for letterhead', NULL, '2026-07-15 09:29:46');
INSERT INTO `system_config` VALUES ('HOSPITAL_GSTIN', '', 'GST Identification Number', NULL, '2026-07-15 09:29:46');
INSERT INTO `system_config` VALUES ('HOSPITAL_LOGO_PATH', '', 'Relative server path to logo image', NULL, '2026-07-15 09:29:46');
INSERT INTO `system_config` VALUES ('HOSPITAL_NAME', 'Neha Hospitals', 'Display name on bills, payslips, reports', NULL, '2026-07-15 09:29:46');
INSERT INTO `system_config` VALUES ('HOSPITAL_PHONE', '', 'Primary contact number', NULL, '2026-07-15 09:29:46');
INSERT INTO `system_config` VALUES ('SALARY_DATE_TYPE', 'last_day_of_month', 'last_day_of_month | first_of_next_month', NULL, '2026-07-15 09:29:46');
INSERT INTO `system_config` VALUES ('TOKEN_SCOPE', 'hospital', 'Token counter scope: hospital | department', NULL, '2026-07-15 09:29:46');

-- ----------------------------
-- Table structure for user_permission_overrides
-- ----------------------------
DROP TABLE IF EXISTS `user_permission_overrides`;
CREATE TABLE `user_permission_overrides`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `permission_id` bigint UNSIGNED NOT NULL,
  `effect` enum('allow','deny') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `granted_by` bigint UNSIGNED NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_user_permission_override`(`user_id` ASC, `permission_id` ASC) USING BTREE,
  INDEX `fk_upo_permission`(`permission_id` ASC) USING BTREE,
  INDEX `fk_upo_granted_by`(`granted_by` ASC) USING BTREE,
  CONSTRAINT `fk_upo_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_upo_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_upo_granted_by` FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of user_permission_overrides
-- ----------------------------

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NULL DEFAULT NULL,
  `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `password_hash` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `role_id` bigint UNSIGNED NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_users_username`(`username` ASC) USING BTREE,
  INDEX `ix_users_employee`(`employee_id` ASC) USING BTREE,
  INDEX `fk_users_role`(`role_id` ASC) USING BTREE,
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_users_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30002 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of users
-- ----------------------------
INSERT INTO `users` VALUES (1, NULL, 'admin', '', '', '$2b$10$6W9/BqnSNqfu0U/XloygBeO1aMUAki1/e3YFMW2zS/erBDbf50jMS', 1, 1, NULL, '2026-07-15 10:25:29', '2026-07-15 10:28:41');

-- ----------------------------
-- Table structure for wards
-- ----------------------------
DROP TABLE IF EXISTS `wards`;
CREATE TABLE `wards`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `floor_id` bigint UNSIGNED NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `fk_wards_floor`(`floor_id` ASC) USING BTREE,
  CONSTRAINT `fk_wards_floor` FOREIGN KEY (`floor_id`) REFERENCES `floors` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of wards
-- ----------------------------

-- ----------------------------
-- Table structure for week_off_policies
-- ----------------------------
DROP TABLE IF EXISTS `week_off_policies`;
CREATE TABLE `week_off_policies`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `designation_id` bigint UNSIGNED NOT NULL,
  `week_offs_per_month` smallint UNSIGNED NOT NULL DEFAULT 4,
  `preferred_day_of_week` tinyint NULL DEFAULT NULL,
  `notes` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_week_off_policy_designation`(`designation_id` ASC) USING BTREE,
  CONSTRAINT `fk_week_off_policies_designation` FOREIGN KEY (`designation_id`) REFERENCES `designations` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Records of week_off_policies
-- ----------------------------

-- ----------------------------
-- View structure for v_effective_permissions
-- ----------------------------
DROP VIEW IF EXISTS `v_effective_permissions`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `v_effective_permissions` AS WITH `granted` AS (SELECT `u`.`id` AS `user_id`,`rp`.`permission_id` AS `permission_id` FROM `nehahospitals`.`users` AS `u` JOIN `nehahospitals`.`role_permissions` AS `rp` ON `rp`.`role_id`=`u`.`role_id` UNION SELECT `upo`.`user_id` AS `user_id`,`upo`.`permission_id` AS `permission_id` FROM `nehahospitals`.`user_permission_overrides` AS `upo` WHERE `upo`.`effect`=_UTF8MB4'allow' AND (`upo`.`expires_at` IS NULL OR `upo`.`expires_at`>CURRENT_TIMESTAMP())), `denied` AS (SELECT `upo`.`user_id` AS `user_id`,`upo`.`permission_id` AS `permission_id` FROM `nehahospitals`.`user_permission_overrides` AS `upo` WHERE `upo`.`effect`=_UTF8MB4'deny' AND (`upo`.`expires_at` IS NULL OR `upo`.`expires_at`>CURRENT_TIMESTAMP())) SELECT `g`.`user_id` AS `user_id`,`p`.`id` AS `permission_id`,`m`.`code` AS `module_code`,`a`.`code` AS `action_code`,`p`.`code` AS `permission_code` FROM (((`granted` AS `g` JOIN `nehahospitals`.`permissions` AS `p` ON `p`.`id`=`g`.`permission_id`) JOIN `nehahospitals`.`modules` AS `m` ON `m`.`id`=`p`.`module_id`) JOIN `nehahospitals`.`actions` AS `a` ON `a`.`id`=`p`.`action_id`) LEFT JOIN `denied` AS `d` ON `d`.`user_id`=`g`.`user_id` AND `d`.`permission_id`=`g`.`permission_id` WHERE `d`.`user_id` IS NULL WITH CASCADED CHECK OPTION;

-- ----------------------------
-- View structure for v_patient_history
-- ----------------------------
DROP VIEW IF EXISTS `v_patient_history`;
CREATE ALGORITHM = UNDEFINED SQL SECURITY DEFINER VIEW `v_patient_history` AS SELECT `p`.`id` AS `patient_id`,`p`.`full_name` AS `patient_name`,`a`.`id` AS `appointment_id`,`a`.`appointment_date` AS `visit_date`,`a`.`token_number` AS `token_number`,`d`.`full_name` AS `doctor_name`,`c`.`diagnosis` AS `diagnosis`,`ad`.`id` AS `admission_id`,`ad`.`admission_datetime` AS `admission_datetime`,`dis`.`discharge_datetime` AS `discharge_datetime`,`dis`.`final_bill_amount` AS `final_bill_amount` FROM ((((`nehahospitals`.`patients` AS `p` JOIN `nehahospitals`.`appointments` AS `a` ON `a`.`patient_id`=`p`.`id`) LEFT JOIN `nehahospitals`.`employees` AS `d` ON `d`.`id`=`a`.`doctor_id`) LEFT JOIN `nehahospitals`.`consultations` AS `c` ON `c`.`appointment_id`=`a`.`id`) LEFT JOIN `nehahospitals`.`admissions` AS `ad` ON `ad`.`appointment_id`=`a`.`id`) LEFT JOIN `nehahospitals`.`discharges` AS `dis` ON `dis`.`admission_id`=`ad`.`id` ORDER BY `a`.`appointment_date` DESC WITH CASCADED CHECK OPTION;

SET FOREIGN_KEY_CHECKS = 1;
