/* ============================================================================
   SCHEMA v3 — Pharmacy Management (Stock, Purchasing, Expiry, Movements)
   ============================================================================
   Apply after v2-full / v2-additions. Run once against the live database.

   Covers the full pharmacy loop:
     Ordering        : pharmacy_suppliers, purchase_orders, purchase_order_items
     Goods receipt    : goods_receipts, goods_receipt_items  (supplier bill entry)
     Stock            : medicine_batches (existing) + stock_movements ledger
     Dispensing       : pharmacy_bills / pharmacy_bill_items (existing, repaired below)
     Reporting        : stock_movements powers expiry / non-movable / patient-wise /
                         drug-wise / daily movement reports; medicines.reorder_level
                         is the "minimum stock threshold".

   SECTION A also repairs two pre-existing bugs where the application code
   (pharmacy.queries.js) referenced columns that were never added to the schema:
     - medicines.generic_name / form / strength   (SELECTed everywhere, never created)
     - pharmacy_bills had no bill_number generation path and the code wrote to a
       `billed_by` column that doesn't exist (schema has `generated_by`) — the
       queries file is corrected alongside this migration.
   ============================================================================ */


/* ============================================================================
   SECTION A — Repairs to existing tables
   ============================================================================ */

ALTER TABLE medicines
  ADD COLUMN generic_name VARCHAR(150) NULL AFTER name,
  ADD COLUMN form         VARCHAR(40)  NULL AFTER generic_name,
  ADD COLUMN strength     VARCHAR(40)  NULL AFTER form;

/*
 Payment tracking on a pharmacy bill:
   paid_amount     — running total actually collected from the party so far.
   balance_amount  — net_amount - paid_amount (0 once settled).
   closed_at       — set once the counter flow ("Save and close order") completes.
 Lets a bill be generated, a partial amount taken, and closed later without
 re-touching stock.
*/
ALTER TABLE pharmacy_bills
  ADD COLUMN paid_amount    DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER net_amount,
  ADD COLUMN balance_amount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER paid_amount,
  ADD COLUMN closed_at      TIMESTAMP NULL DEFAULT NULL       AFTER payment_status;


/* ============================================================================
   SECTION B — Suppliers
   ============================================================================ */

CREATE TABLE pharmacy_suppliers (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100) NULL,
  phone          VARCHAR(20)  NULL,
  email          VARCHAR(100) NULL,
  address        VARCHAR(255) NULL,
  gstin          VARCHAR(20)  NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/* ============================================================================
   SECTION C — Purchase Orders  ("Items to order" -> "Place order")
   ============================================================================ */

CREATE TABLE purchase_orders (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  po_number      VARCHAR(30) NOT NULL,
  supplier_id    BIGINT UNSIGNED NOT NULL,
  order_date     DATE NOT NULL,
  expected_date  DATE NULL,
  status         ENUM('draft','placed','partially_received','received','cancelled')
                 NOT NULL DEFAULT 'draft',
  notes          TEXT NULL,
  created_by     BIGINT UNSIGNED NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_purchase_orders_number (po_number),
  KEY ix_purchase_orders_supplier (supplier_id),
  KEY ix_purchase_orders_status (status),
  CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES pharmacy_suppliers(id),
  CONSTRAINT fk_po_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE purchase_order_items (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id  BIGINT UNSIGNED NOT NULL,
  medicine_id        BIGINT UNSIGNED NOT NULL,
  ordered_qty        INT NOT NULL,
  received_qty       INT NOT NULL DEFAULT 0,
  estimated_price    DECIMAL(10,2) NOT NULL DEFAULT 0,
  KEY ix_po_items_po (purchase_order_id),
  KEY ix_po_items_medicine (medicine_id),
  CONSTRAINT fk_po_items_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_po_items_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/* ============================================================================
   SECTION D — Goods Receipt / GRN
   ("Received with bill" -> "Pharmacy entry (bill number)" -> "Enter paid amount"
    -> "Save and close order")
   ============================================================================ */

CREATE TABLE goods_receipts (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  grn_number            VARCHAR(30) NOT NULL,
  purchase_order_id     BIGINT UNSIGNED NULL,
  supplier_id           BIGINT UNSIGNED NOT NULL,
  supplier_bill_number  VARCHAR(50) NOT NULL,
  supplier_bill_date    DATE NOT NULL,
  received_date         DATE NOT NULL,
  total_amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_amount           DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_status        ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  status                ENUM('open','closed') NOT NULL DEFAULT 'open',
  received_by           BIGINT UNSIGNED NULL,
  notes                 TEXT NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_goods_receipts_number (grn_number),
  KEY ix_grn_po (purchase_order_id),
  KEY ix_grn_supplier (supplier_id),
  KEY ix_grn_bill_number (supplier_bill_number),
  CONSTRAINT fk_grn_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_grn_supplier FOREIGN KEY (supplier_id) REFERENCES pharmacy_suppliers(id),
  CONSTRAINT fk_grn_received_by FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE goods_receipt_items (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  goods_receipt_id   BIGINT UNSIGNED NOT NULL,
  purchase_order_item_id BIGINT UNSIGNED NULL,
  medicine_id        BIGINT UNSIGNED NOT NULL,
  batch_id           BIGINT UNSIGNED NULL, -- the medicine_batches row this receipt created
  batch_number       VARCHAR(50) NOT NULL,
  expiry_date        DATE NOT NULL,
  qty_received       INT NOT NULL,
  purchase_price     DECIMAL(10,2) NOT NULL DEFAULT 0,
  selling_price      DECIMAL(10,2) NOT NULL DEFAULT 0,
  KEY ix_grn_items_grn (goods_receipt_id),
  KEY ix_grn_items_medicine (medicine_id),
  CONSTRAINT fk_grn_items_grn FOREIGN KEY (goods_receipt_id) REFERENCES goods_receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_grn_items_po_item FOREIGN KEY (purchase_order_item_id) REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_grn_items_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  CONSTRAINT fk_grn_items_batch FOREIGN KEY (batch_id) REFERENCES medicine_batches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


/* ============================================================================
   SECTION E — Stock movement ledger
   Every unit that enters (GRN) or leaves (bill/return/adjustment) stock gets a
   row here. This single table drives:
     - Non-movable stock report  (batches with qty_in_stock > 0 but no 'sale'
       movement in the lookback window)
     - Expiry stock report       (joined against medicine_batches.expiry_date)
     - Patient-wise / drug-wise / daily movement reports
   ============================================================================ */

CREATE TABLE stock_movements (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  medicine_id      BIGINT UNSIGNED NOT NULL,
  batch_id         BIGINT UNSIGNED NULL,
  movement_type    ENUM('receipt','sale','return','adjustment') NOT NULL,
  quantity         INT NOT NULL,             -- positive = stock in, negative = stock out
  reference_type   VARCHAR(30) NULL,         -- 'goods_receipt' | 'pharmacy_bill' | 'adjustment'
  reference_id     BIGINT UNSIGNED NULL,
  patient_id       BIGINT UNSIGNED NULL,     -- set for 'sale' movements
  movement_date    DATE NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_stock_mvmt_medicine (medicine_id),
  KEY ix_stock_mvmt_batch (batch_id),
  KEY ix_stock_mvmt_date (movement_date),
  KEY ix_stock_mvmt_patient (patient_id),
  KEY ix_stock_mvmt_type (movement_type),
  CONSTRAINT fk_stock_mvmt_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  CONSTRAINT fk_stock_mvmt_batch FOREIGN KEY (batch_id) REFERENCES medicine_batches(id) ON DELETE SET NULL,
  CONSTRAINT fk_stock_mvmt_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
