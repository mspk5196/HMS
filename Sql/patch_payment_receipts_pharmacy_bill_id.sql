-- Migration Patch: Add pharmacy_bill_id to payment_receipts table
-- Run this SQL in your MySQL database

ALTER TABLE `payment_receipts`
  ADD COLUMN `pharmacy_bill_id` BIGINT UNSIGNED NULL DEFAULT NULL AFTER `admission_id`;

ALTER TABLE `payment_receipts`
  ADD CONSTRAINT `fk_pr_pharmacy_bill` FOREIGN KEY (`pharmacy_bill_id`) REFERENCES `pharmacy_bills` (`id`) ON DELETE SET NULL;
