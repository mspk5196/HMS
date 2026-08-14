const db = require('../src/config/db');

async function migrate() {
  try {
    console.log('Running payment module migration...');

    // 1. Add payment_pending to appointments status enum
    const [[apptCols]] = await db.query("SHOW COLUMNS FROM appointments LIKE 'status'");
    if (!apptCols.Type.includes('payment_pending')) {
      await db.query(`ALTER TABLE appointments MODIFY COLUMN status ENUM('waiting','in_consultation','completed','payment_pending','converted_to_admission','closed','cancelled') NOT NULL DEFAULT 'waiting'`);
      console.log('✅ Added payment_pending to appointments.status enum');
    } else {
      console.log('payment_pending already in appointments.status');
    }

    // 2. Add doctor_fee to appointments
    const [apCols] = await db.query("SHOW COLUMNS FROM appointments LIKE 'doctor_fee'");
    if (apCols.length === 0) {
      await db.query("ALTER TABLE appointments ADD COLUMN doctor_fee DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER receptionist_notes");
      console.log('✅ Added doctor_fee to appointments');
    } else {
      console.log('doctor_fee already in appointments');
    }

    // 3. Add doctor_fee + payment_status to discharges
    const [dcFee] = await db.query("SHOW COLUMNS FROM discharges LIKE 'doctor_fee'");
    if (dcFee.length === 0) {
      await db.query("ALTER TABLE discharges ADD COLUMN doctor_fee DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER other_charges");
      console.log('✅ Added doctor_fee to discharges');
    } else {
      console.log('doctor_fee already in discharges');
    }

    const [dcStatus] = await db.query("SHOW COLUMNS FROM discharges LIKE 'payment_status'");
    if (dcStatus.length === 0) {
      await db.query("ALTER TABLE discharges ADD COLUMN payment_status ENUM('pending','partial','paid') NOT NULL DEFAULT 'pending' AFTER balance_due");
      console.log('✅ Added payment_status to discharges');
    } else {
      console.log('payment_status already in discharges');
    }

    // 4. Add payment_mode + notes to appointment_payments
    const [appmMode] = await db.query("SHOW COLUMNS FROM appointment_payments LIKE 'payment_mode'");
    if (appmMode.length === 0) {
      await db.query("ALTER TABLE appointment_payments ADD COLUMN payment_mode ENUM('cash','upi','card','insurance','credit') NOT NULL DEFAULT 'cash' AFTER amount_paid");
      await db.query("ALTER TABLE appointment_payments ADD COLUMN payment_type ENUM('consultation','doctor_fee','other') NOT NULL DEFAULT 'consultation' AFTER payment_mode");
      await db.query("ALTER TABLE appointment_payments ADD COLUMN notes VARCHAR(255) DEFAULT NULL AFTER payment_type");
      console.log('✅ Added payment_mode, payment_type, notes to appointment_payments');
    } else {
      console.log('payment_mode already in appointment_payments');
    }

    // 5. Create doctor_fee_rates table
    const [dfrTables] = await db.query("SHOW TABLES LIKE 'doctor_fee_rates'");
    if (dfrTables.length === 0) {
      await db.query(`
        CREATE TABLE doctor_fee_rates (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          doctor_id BIGINT UNSIGNED NOT NULL,
          opd_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
          ipd_daily_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_doctor_fee_rate (doctor_id),
          CONSTRAINT fk_dfr_doctor FOREIGN KEY (doctor_id) REFERENCES employees (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
      `);
      console.log('✅ Created doctor_fee_rates table');
    } else {
      console.log('doctor_fee_rates table already exists');
    }

    // 6. Create payment_receipts table
    const [prTables] = await db.query("SHOW TABLES LIKE 'payment_receipts'");
    if (prTables.length === 0) {
      await db.query(`
        CREATE TABLE payment_receipts (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          receipt_number VARCHAR(20) NOT NULL,
          patient_id BIGINT UNSIGNED NOT NULL,
          appointment_id BIGINT UNSIGNED DEFAULT NULL,
          admission_id BIGINT UNSIGNED DEFAULT NULL,
          payment_date DATE NOT NULL,
          total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          payment_mode ENUM('cash','upi','card','insurance','credit') NOT NULL DEFAULT 'cash',
          received_by BIGINT UNSIGNED DEFAULT NULL,
          notes VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_receipt_number (receipt_number),
          CONSTRAINT fk_pr_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE,
          CONSTRAINT fk_pr_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE SET NULL,
          CONSTRAINT fk_pr_admission FOREIGN KEY (admission_id) REFERENCES admissions (id) ON DELETE SET NULL,
          CONSTRAINT fk_pr_received_by FOREIGN KEY (received_by) REFERENCES users (id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
      `);
      console.log('✅ Created payment_receipts table');
    } else {
      console.log('payment_receipts table already exists');
    }

    // 7. Create payment_receipt_items table
    const [priTables] = await db.query("SHOW TABLES LIKE 'payment_receipt_items'");
    if (priTables.length === 0) {
      await db.query(`
        CREATE TABLE payment_receipt_items (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          receipt_id BIGINT UNSIGNED NOT NULL,
          fee_type ENUM('consultation','doctor_fee','room_charges','pharmacy','other') NOT NULL,
          description VARCHAR(255) DEFAULT NULL,
          amount DECIMAL(10,2) NOT NULL DEFAULT 0,
          PRIMARY KEY (id),
          CONSTRAINT fk_pri_receipt FOREIGN KEY (receipt_id) REFERENCES payment_receipts (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
      `);
      console.log('✅ Created payment_receipt_items table');
    } else {
      console.log('payment_receipt_items table already exists');
    }

    console.log('\n✅ All payment migrations complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
