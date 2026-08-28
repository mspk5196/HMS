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

 Date: 28/08/2026 13:41:39
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
) ENGINE = InnoDB AUTO_INCREMENT = 182477 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 90001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for admission_daily_notes
-- ----------------------------
DROP TABLE IF EXISTS `admission_daily_notes`;
CREATE TABLE `admission_daily_notes`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `admission_id` bigint UNSIGNED NOT NULL,
  `note_date` date NOT NULL,
  `doctor_id` bigint UNSIGNED NULL DEFAULT NULL,
  `bp` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `pulse` smallint UNSIGNED NULL DEFAULT NULL,
  `temperature` decimal(4, 1) NULL DEFAULT NULL,
  `spo2` tinyint UNSIGNED NULL DEFAULT NULL,
  `advice` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_admission_daily_notes_admission`(`admission_id` ASC) USING BTREE,
  INDEX `ix_admission_daily_notes_date`(`note_date` ASC) USING BTREE,
  INDEX `fk_admission_daily_notes_doctor`(`doctor_id` ASC) USING BTREE,
  INDEX `fk_admission_daily_notes_created_by`(`created_by` ASC) USING BTREE,
  CONSTRAINT `fk_admission_daily_notes_admission` FOREIGN KEY (`admission_id`) REFERENCES `admissions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_admission_daily_notes_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_admission_daily_notes_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
  `status` enum('admitted','payment_pending','discharged') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'admitted',
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
) ENGINE = InnoDB AUTO_INCREMENT = 90001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for appointment_payments
-- ----------------------------
DROP TABLE IF EXISTS `appointment_payments`;
CREATE TABLE `appointment_payments`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `appointment_id` bigint UNSIGNED NOT NULL,
  `amount_paid` decimal(10, 2) NOT NULL DEFAULT 0,
  `payment_mode` enum('cash','upi','card','insurance','credit') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'cash',
  `payment_type` enum('consultation','doctor_fee','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'consultation',
  `notes` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `paid_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `received_by` bigint UNSIGNED NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `fk_appointment_payments_appointment`(`appointment_id` ASC) USING BTREE,
  INDEX `fk_appointment_payments_received_by`(`received_by` ASC) USING BTREE,
  CONSTRAINT `fk_appointment_payments_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_appointment_payments_received_by` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
  `doctor_fee` decimal(10, 2) NOT NULL DEFAULT 0,
  `closed_at` timestamp NULL DEFAULT NULL,
  `closed_by` bigint UNSIGNED NULL DEFAULT NULL,
  `status` enum('waiting','in_consultation','completed','payment_pending','converted_to_admission','closed','cancelled') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'waiting',
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
) ENGINE = InnoDB AUTO_INCREMENT = 150001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for approval_workflows
-- ----------------------------
DROP TABLE IF EXISTS `approval_workflows`;
CREATE TABLE `approval_workflows`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `permission_code` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  `level1_type` enum('role','user') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'role',
  `level1_role_id` bigint UNSIGNED NULL DEFAULT NULL,
  `level1_user_id` bigint UNSIGNED NULL DEFAULT NULL,
  `level2_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `level2_type` enum('role','user') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'role',
  `level2_role_id` bigint UNSIGNED NULL DEFAULT NULL,
  `level2_user_id` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_approval_workflows_code`(`permission_code` ASC) USING BTREE,
  INDEX `fk_aw_level1_role`(`level1_role_id` ASC) USING BTREE,
  INDEX `fk_aw_level1_user`(`level1_user_id` ASC) USING BTREE,
  INDEX `fk_aw_level2_role`(`level2_role_id` ASC) USING BTREE,
  INDEX `fk_aw_level2_user`(`level2_user_id` ASC) USING BTREE,
  CONSTRAINT `fk_aw_level1_role` FOREIGN KEY (`level1_role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_aw_level1_user` FOREIGN KEY (`level1_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_aw_level2_role` FOREIGN KEY (`level2_role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_aw_level2_user` FOREIGN KEY (`level2_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
-- Table structure for beds
-- ----------------------------
DROP TABLE IF EXISTS `beds`;
CREATE TABLE `beds`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `room_id` bigint UNSIGNED NOT NULL,
  `bed_label` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `status` enum('available','occupied','pending_clearance','maintenance') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'available',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_beds_room_label`(`room_id` ASC, `bed_label` ASC) USING BTREE,
  CONSTRAINT `fk_beds_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 120001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
-- Table structure for buildings
-- ----------------------------
DROP TABLE IF EXISTS `buildings`;
CREATE TABLE `buildings`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_buildings_name`(`name` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 60001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 120001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
  `doctor_fee` decimal(10, 2) NOT NULL DEFAULT 0,
  `follow_up_date` date NULL DEFAULT NULL,
  `final_bill_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `amount_paid` decimal(10, 2) NOT NULL DEFAULT 0,
  `balance_due` decimal(10, 2) NOT NULL DEFAULT 0,
  `payment_status` enum('pending','partial','paid') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending',
  `payment_mode` enum('cash','upi','card','insurance','credit') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'cash',
  `discharge_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `discharged_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_discharge_admission`(`admission_id` ASC) USING BTREE,
  INDEX `fk_discharges_by`(`discharged_by` ASC) USING BTREE,
  CONSTRAINT `fk_discharges_admission` FOREIGN KEY (`admission_id`) REFERENCES `admissions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_discharges_by` FOREIGN KEY (`discharged_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 60001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for doctor_fee_rates
-- ----------------------------
DROP TABLE IF EXISTS `doctor_fee_rates`;
CREATE TABLE `doctor_fee_rates`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `doctor_id` bigint UNSIGNED NOT NULL,
  `opd_fee` decimal(10, 2) NOT NULL DEFAULT 0,
  `ipd_daily_fee` decimal(10, 2) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_doctor_fee_rate`(`doctor_id` ASC) USING BTREE,
  CONSTRAINT `fk_dfr_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
-- Table structure for employee_role_remapping_logs
-- ----------------------------
DROP TABLE IF EXISTS `employee_role_remapping_logs`;
CREATE TABLE `employee_role_remapping_logs`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `from_department_id` bigint UNSIGNED NULL DEFAULT NULL,
  `from_department_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `from_role_id` bigint UNSIGNED NULL DEFAULT NULL,
  `from_role_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `to_department_id` bigint UNSIGNED NOT NULL,
  `to_department_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `to_role_id` bigint UNSIGNED NOT NULL,
  `to_role_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `from_date` date NOT NULL,
  `to_date` date NULL DEFAULT NULL,
  `remapped_by` bigint UNSIGNED NULL DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_err_log_emp`(`employee_id` ASC) USING BTREE,
  CONSTRAINT `fk_err_log_emp` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 60001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for employee_salary_logs
-- ----------------------------
DROP TABLE IF EXISTS `employee_salary_logs`;
CREATE TABLE `employee_salary_logs`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `employee_id` bigint UNSIGNED NOT NULL,
  `previous_salary_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `new_salary_type` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `previous_basic_salary` decimal(10, 2) NOT NULL DEFAULT 0,
  `new_basic_salary` decimal(10, 2) NOT NULL DEFAULT 0,
  `previous_per_day_salary` decimal(10, 2) NOT NULL DEFAULT 0,
  `new_per_day_salary` decimal(10, 2) NOT NULL DEFAULT 0,
  `previous_per_night_salary` decimal(10, 2) NOT NULL DEFAULT 0,
  `new_per_night_salary` decimal(10, 2) NOT NULL DEFAULT 0,
  `effective_from` date NOT NULL,
  `reason` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `changed_by` bigint UNSIGNED NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_es_log_emp`(`employee_id` ASC) USING BTREE,
  CONSTRAINT `fk_es_log_emp` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 90001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 120001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 60001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 60001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 169002 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
  UNIQUE INDEX `uq_medicine_batch`(`medicine_id` ASC, `batch_number` ASC) USING BTREE,
  CONSTRAINT `fk_med_batches_medicine` FOREIGN KEY (`medicine_id`) REFERENCES `medicines` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 120001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for medicine_categories
-- ----------------------------
DROP TABLE IF EXISTS `medicine_categories`;
CREATE TABLE `medicine_categories`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_medicine_categories_name`(`name` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 226250 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for medicine_form_factors
-- ----------------------------
DROP TABLE IF EXISTS `medicine_form_factors`;
CREATE TABLE `medicine_form_factors`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `name`(`name` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1077671 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
  `tablets_per_strip` int NOT NULL DEFAULT 1,
  `stock_qty` int NOT NULL DEFAULT 0,
  `price` decimal(10, 2) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_medicines_category`(`category_id` ASC) USING BTREE,
  INDEX `ix_medicines_barcode`(`barcode` ASC) USING BTREE,
  CONSTRAINT `fk_medicines_category` FOREIGN KEY (`category_id`) REFERENCES `medicine_categories` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 90001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 607886 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 90001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for payment_receipt_items
-- ----------------------------
DROP TABLE IF EXISTS `payment_receipt_items`;
CREATE TABLE `payment_receipt_items`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `receipt_id` bigint UNSIGNED NOT NULL,
  `fee_type` enum('consultation','doctor_fee','room_charges','pharmacy','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `amount` decimal(10, 2) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `fk_pri_receipt`(`receipt_id` ASC) USING BTREE,
  CONSTRAINT `fk_pri_receipt` FOREIGN KEY (`receipt_id`) REFERENCES `payment_receipts` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for payment_receipts
-- ----------------------------
DROP TABLE IF EXISTS `payment_receipts`;
CREATE TABLE `payment_receipts`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `receipt_number` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `patient_id` bigint UNSIGNED NOT NULL,
  `appointment_id` bigint UNSIGNED NULL DEFAULT NULL,
  `admission_id` bigint UNSIGNED NULL DEFAULT NULL,
  `pharmacy_bill_id` bigint UNSIGNED NULL DEFAULT NULL,
  `payment_date` date NOT NULL,
  `total_amount` decimal(10, 2) NOT NULL DEFAULT 0,
  `payment_mode` enum('cash','upi','card','insurance','credit') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'cash',
  `received_by` bigint UNSIGNED NULL DEFAULT NULL,
  `notes` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_receipt_number`(`receipt_number` ASC) USING BTREE,
  INDEX `fk_pr_patient`(`patient_id` ASC) USING BTREE,
  INDEX `fk_pr_appointment`(`appointment_id` ASC) USING BTREE,
  INDEX `fk_pr_admission`(`admission_id` ASC) USING BTREE,
  INDEX `fk_pr_received_by`(`received_by` ASC) USING BTREE,
  INDEX `fk_pr_pharmacy_bill`(`pharmacy_bill_id` ASC) USING BTREE,
  CONSTRAINT `fk_pr_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_pr_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_pr_admission` FOREIGN KEY (`admission_id`) REFERENCES `admissions` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_pr_received_by` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_pr_pharmacy_bill` FOREIGN KEY (`pharmacy_bill_id`) REFERENCES `pharmacy_bills` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
-- Table structure for pending_approvals
-- ----------------------------
DROP TABLE IF EXISTS `pending_approvals`;
CREATE TABLE `pending_approvals`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `permission_code` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `action_label` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `requested_by` bigint UNSIGNED NOT NULL,
  `method` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `original_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `params_json` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `body_json` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `query_json` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `status` enum('pending_level1','pending_level2','approved','rejected') CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'pending_level1',
  `level1_approved_by` bigint UNSIGNED NULL DEFAULT NULL,
  `level1_approved_at` timestamp NULL DEFAULT NULL,
  `level2_approved_by` bigint UNSIGNED NULL DEFAULT NULL,
  `level2_approved_at` timestamp NULL DEFAULT NULL,
  `rejected_by` bigint UNSIGNED NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `result_json` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
  `error_message` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `ix_pending_approvals_status`(`status` ASC) USING BTREE,
  INDEX `ix_pending_approvals_requested_by`(`requested_by` ASC) USING BTREE,
  INDEX `fk_pa_level1_approved_by`(`level1_approved_by` ASC) USING BTREE,
  INDEX `fk_pa_level2_approved_by`(`level2_approved_by` ASC) USING BTREE,
  INDEX `fk_pa_rejected_by`(`rejected_by` ASC) USING BTREE,
  CONSTRAINT `fk_pa_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_pa_level1_approved_by` FOREIGN KEY (`level1_approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_pa_level2_approved_by` FOREIGN KEY (`level2_approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `fk_pa_rejected_by` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 43966 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 90001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for pharmacy_bills
-- ----------------------------
DROP TABLE IF EXISTS `pharmacy_bills`;
CREATE TABLE `pharmacy_bills`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `patient_id` bigint UNSIGNED NOT NULL,
  `appointment_id` bigint UNSIGNED NULL DEFAULT NULL,
  `admission_id` bigint UNSIGNED NULL DEFAULT NULL,
  `doctor_id` bigint UNSIGNED NULL DEFAULT NULL,
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
) ENGINE = InnoDB AUTO_INCREMENT = 180001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 30001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 60001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 60001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 95817 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 103790 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
-- Table structure for role_permissions
-- ----------------------------
DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE `role_permissions`  (
  `role_id` bigint UNSIGNED NOT NULL,
  `permission_id` bigint UNSIGNED NOT NULL,
  `skip_approval` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`role_id`, `permission_id`) USING BTREE,
  INDEX `fk_role_permissions_permission`(`permission_id` ASC) USING BTREE,
  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

-- ----------------------------
-- Table structure for roles
-- ----------------------------
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL DEFAULT NULL,
  `staff_role_id` bigint UNSIGNED NULL DEFAULT NULL,
  `priority` int NOT NULL DEFAULT 100,
  `can_access_settings` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uq_roles_name`(`name` ASC) USING BTREE,
  UNIQUE INDEX `uq_roles_staff_role`(`staff_role_id` ASC) USING BTREE,
  CONSTRAINT `fk_roles_staff_role` FOREIGN KEY (`staff_role_id`) REFERENCES `staff_roles` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT
) ENGINE = InnoDB AUTO_INCREMENT = 210200 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 90001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 90001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 60001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
-- Table structure for staff_roles
-- ----------------------------
DROP TABLE IF EXISTS `staff_roles`;
CREATE TABLE `staff_roles`  (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `department_id` bigint UNSIGNED NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `is_doctor` tinyint(1) NOT NULL DEFAULT 0,
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
) ENGINE = InnoDB AUTO_INCREMENT = 150001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 180001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 180002 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
) ENGINE = InnoDB AUTO_INCREMENT = 60001 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin ROW_FORMAT = Compact;

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
