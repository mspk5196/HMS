-- Migration: Add inactive employee exit tracking and mid-month settlement fields
-- Date: 2026-10-03

-- 1. Add inactive tracking columns to employees table
ALTER TABLE employees 
  ADD COLUMN IF NOT EXISTS inactive_reason TEXT NULL AFTER date_of_leaving,
  ADD COLUMN IF NOT EXISTS inactive_date DATE NULL AFTER inactive_reason,
  ADD COLUMN IF NOT EXISTS inactive_by BIGINT UNSIGNED NULL AFTER inactive_date,
  ADD COLUMN IF NOT EXISTS exit_document_path VARCHAR(500) NULL AFTER inactive_by;

-- 2. Add exit settlement and individual payment tracking columns to payroll_items table
ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS is_settlement TINYINT(1) NOT NULL DEFAULT 0 AFTER net_pay,
  ADD COLUMN IF NOT EXISTS payment_status ENUM('pending','paid') NOT NULL DEFAULT 'pending' AFTER is_settlement,
  ADD COLUMN IF NOT EXISTS payment_date DATE NULL AFTER payment_status,
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255) NULL AFTER payment_date,
  ADD COLUMN IF NOT EXISTS settled_at DATETIME NULL AFTER payment_reference,
  ADD COLUMN IF NOT EXISTS settled_by BIGINT UNSIGNED NULL AFTER settled_at,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER settled_by;
