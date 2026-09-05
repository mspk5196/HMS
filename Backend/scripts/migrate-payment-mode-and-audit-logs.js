const db = require('../src/config/db');

async function migrate() {
  console.log('🚀 Starting Payment Mode and Audit Logs Migration...');

  // 1. Add payment_mode to employees
  const [empCols] = await db.query("SHOW COLUMNS FROM employees LIKE 'payment_mode'");
  if (empCols.length === 0) {
    await db.query("ALTER TABLE employees ADD COLUMN payment_mode ENUM('account', 'cash') NOT NULL DEFAULT 'account' AFTER bank_name");
    console.log('✅ Added payment_mode to employees');
  } else {
    console.log('ℹ️ payment_mode already exists in employees');
  }

  // 2. Add payment_mode to payroll_items
  const [piCols] = await db.query("SHOW COLUMNS FROM payroll_items LIKE 'payment_mode'");
  if (piCols.length === 0) {
    await db.query("ALTER TABLE payroll_items ADD COLUMN payment_mode ENUM('account', 'cash') NOT NULL DEFAULT 'account' AFTER salary_structure_id");
    console.log('✅ Added payment_mode to payroll_items');
  } else {
    console.log('ℹ️ payment_mode already exists in payroll_items');
  }

  // Backfill existing payroll_items payment_mode from employees
  await db.query(`
    UPDATE payroll_items pi
    JOIN employees e ON e.id = pi.employee_id
    SET pi.payment_mode = COALESCE(e.payment_mode, 'account')
    WHERE pi.payment_mode IS NULL OR pi.payment_mode = ''
  `);
  console.log('✅ Backfilled payment_mode in existing payroll_items');

  // 3. Create employee_audit_logs table
  await db.query(`
    CREATE TABLE IF NOT EXISTS employee_audit_logs (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      employee_id BIGINT UNSIGNED NOT NULL,
      change_type ENUM('payment_mode', 'profile_update', 'bank_details', 'status_change') NOT NULL DEFAULT 'profile_update',
      field_name VARCHAR(100) NOT NULL,
      old_value TEXT NULL,
      new_value TEXT NULL,
      notes VARCHAR(255) NULL,
      changed_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_emp_audit_employee (employee_id),
      INDEX idx_emp_audit_type (change_type),
      INDEX idx_emp_audit_created (created_at),
      CONSTRAINT fk_emp_audit_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
      CONSTRAINT fk_emp_audit_user FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Created employee_audit_logs table');

  console.log('🎉 Migration completed successfully!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
