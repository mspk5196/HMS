/**
 * Applies schema v3 — Pharmacy Management (stock, purchasing, expiry, movements).
 * Idempotent: safe to re-run, checks for existing columns/tables before creating.
 * See Sql/neha_hospital_schema-v3-pharmacy-management.sql for the full annotated version.
 */
const db = require('../src/config/db');

const checkColumnExists = async (dbName, table, column) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column]
  );
  return rows[0].count > 0;
};

const checkTableExists = async (dbName, table) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [dbName, table]
  );
  return rows[0].count > 0;
};

(async () => {
  try {
    const dbName = process.env.DB_NAME.replace(/'/g, '');
    console.log(`Starting pharmacy v3 migration on database "${dbName}"...`);

    // ── Section A: repairs to existing tables ──────────────────────────────
    const medicineCols = [
      { name: 'generic_name', type: 'VARCHAR(150) NULL', after: 'name' },
      { name: 'form', type: 'VARCHAR(40) NULL', after: 'generic_name' },
      { name: 'strength', type: 'VARCHAR(40) NULL', after: 'form' },
    ];
    for (const col of medicineCols) {
      if (await checkColumnExists(dbName, 'medicines', col.name)) {
        console.log(`  medicines.${col.name} already exists — skipping.`);
      } else {
        await db.query(`ALTER TABLE medicines ADD COLUMN ${col.name} ${col.type} AFTER ${col.after}`);
        console.log(`  added medicines.${col.name}`);
      }
    }

    const billCols = [
      { name: 'paid_amount', type: 'DECIMAL(10,2) NOT NULL DEFAULT 0', after: 'net_amount' },
      { name: 'balance_amount', type: 'DECIMAL(10,2) NOT NULL DEFAULT 0', after: 'paid_amount' },
      { name: 'closed_at', type: 'TIMESTAMP NULL DEFAULT NULL', after: 'payment_status' },
    ];
    for (const col of billCols) {
      if (await checkColumnExists(dbName, 'pharmacy_bills', col.name)) {
        console.log(`  pharmacy_bills.${col.name} already exists — skipping.`);
      } else {
        await db.query(`ALTER TABLE pharmacy_bills ADD COLUMN ${col.name} ${col.type} AFTER ${col.after}`);
        console.log(`  added pharmacy_bills.${col.name}`);
      }
    }

    // ── Section B: suppliers ────────────────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS pharmacy_suppliers (
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
    `);
    console.log('  pharmacy_suppliers checked/created.');

    // ── Section C: purchase orders ──────────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
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
    `);
    console.log('  purchase_orders checked/created.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
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
    `);
    console.log('  purchase_order_items checked/created.');

    // ── Section D: goods receipt / GRN ──────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS goods_receipts (
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
    `);
    console.log('  goods_receipts checked/created.');

    await db.query(`
      CREATE TABLE IF NOT EXISTS goods_receipt_items (
        id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        goods_receipt_id   BIGINT UNSIGNED NOT NULL,
        purchase_order_item_id BIGINT UNSIGNED NULL,
        medicine_id        BIGINT UNSIGNED NOT NULL,
        batch_id           BIGINT UNSIGNED NULL,
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
    `);
    console.log('  goods_receipt_items checked/created.');

    // ── Section E: stock movement ledger ────────────────────────────────────
    await db.query(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        medicine_id      BIGINT UNSIGNED NOT NULL,
        batch_id         BIGINT UNSIGNED NULL,
        movement_type    ENUM('receipt','sale','return','adjustment') NOT NULL,
        quantity         INT NOT NULL,
        reference_type   VARCHAR(30) NULL,
        reference_id     BIGINT UNSIGNED NULL,
        patient_id       BIGINT UNSIGNED NULL,
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
    `);
    console.log('  stock_movements checked/created.');

    console.log('Pharmacy v3 migration completed successfully! ✅');
  } catch (err) {
    console.error('Migration failed! ❌', err);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
})();
