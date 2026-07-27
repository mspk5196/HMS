/**
 * migrate-staff-salary-phase.js
 *
 * Schema reconciliation for the Staff & Salary phase.
 * Idempotent — safe to run repeatedly; a second run is a no-op.
 *
 * 1. shifts      + grace_period_minutes, biometric_in_start/in_end/out_start/out_end
 *                  (these are already written by hr.queries.createShift/updateShift,
 *                   so shift CRUD errors out until they exist)
 * 2. staff_roles + default_shift_id, capacity, break_minutes, notes,
 *                  monthly_buffer_minutes
 * 3. attendance_daily_summary.status + 'late_present', + overtime_minutes
 *    attendance_raw_punches         + employee_id, punch_type, is_processed
 *                  (the processing loop and punch import both reference these
 *                   and the table has none of them)
 * 4. payroll_config seeded with the PF/ESI constants that are hardcoded today
 *
 * Supersedes the never-run add-attendance-cols.js.
 *
 * Run:  node scripts/migrate-staff-salary-phase.js
 */

require('dotenv').config();
const db = require('../src/config/db');

const dbName = process.env.DB_NAME;

/* ─── introspection helpers ─── */

const columnExists = async (table, column) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column]
  );
  return rows[0].count > 0;
};

const constraintExists = async (table, constraint) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [dbName, table, constraint]
  );
  return rows[0].count > 0;
};

const indexExists = async (table, index) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [dbName, table, index]
  );
  return rows[0].count > 0;
};

const getColumnType = async (table, column) => {
  const [rows] = await db.query(
    `SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column]
  );
  return rows[0]?.type ?? null;
};

/** Add a column only if it is missing. */
const addColumn = async (table, column, definition) => {
  if (await columnExists(table, column)) {
    console.log(`   · ${table}.${column} already exists`);
    return false;
  }
  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`   ✚ ${table}.${column} added`);
  return true;
};

/* ─── steps ─── */

const addShiftColumns = async () => {
  console.log('\n[1/4] shifts — biometric window + grace period');
  await addColumn('shifts', 'grace_period_minutes', 'INT NOT NULL DEFAULT 0');
  await addColumn('shifts', 'biometric_in_start', 'TIME NULL DEFAULT NULL');
  await addColumn('shifts', 'biometric_in_end', 'TIME NULL DEFAULT NULL');
  await addColumn('shifts', 'biometric_out_start', 'TIME NULL DEFAULT NULL');
  await addColumn('shifts', 'biometric_out_end', 'TIME NULL DEFAULT NULL');

  // Seed sensible windows for any shift that has none:
  //   punch-IN  must land before the shift start  → [start - 2h, start]
  //   punch-OUT must land after  the shift end    → [end,        end + 2h]
  const [res] = await db.query(
    `UPDATE shifts
        SET biometric_in_start  = SUBTIME(start_time, '02:00:00'),
            biometric_in_end    = start_time,
            biometric_out_start = end_time,
            biometric_out_end   = ADDTIME(end_time, '02:00:00')
      WHERE biometric_in_start IS NULL
         OR biometric_in_end   IS NULL
         OR biometric_out_start IS NULL
         OR biometric_out_end  IS NULL`
  );
  console.log(`   ↻ ${res.affectedRows} shift(s) given default biometric windows`);
};

const addStaffRoleColumns = async () => {
  console.log('\n[2/4] staff_roles — default shift link + capacity/break/notes');
  await addColumn('staff_roles', 'default_shift_id', 'BIGINT UNSIGNED NULL DEFAULT NULL');
  await addColumn('staff_roles', 'capacity', 'INT NULL DEFAULT NULL');
  await addColumn('staff_roles', 'break_minutes', 'INT NULL DEFAULT NULL');
  await addColumn('staff_roles', 'notes', 'VARCHAR(255) NULL DEFAULT NULL');
  // Monthly cumulative late-buffer pool, per role. Distinct from the per-shift
  // daily grace period — see attendance.service.
  await addColumn('staff_roles', 'monthly_buffer_minutes', 'INT NOT NULL DEFAULT 30');

  // Backfill default_shift_id from the denormalised shift_name where it matches the catalog.
  const [res] = await db.query(
    `UPDATE staff_roles sr
       JOIN shifts s ON s.name = sr.shift_name
        SET sr.default_shift_id = s.id
      WHERE sr.default_shift_id IS NULL
        AND sr.shift_name IS NOT NULL`
  );
  console.log(`   ↻ ${res.affectedRows} staff_role(s) linked to a catalog shift by name`);

  if (await constraintExists('staff_roles', 'fk_staff_roles_default_shift')) {
    console.log('   · fk_staff_roles_default_shift already exists');
  } else {
    try {
      await db.query(
        `ALTER TABLE staff_roles
           ADD CONSTRAINT fk_staff_roles_default_shift
           FOREIGN KEY (default_shift_id) REFERENCES shifts (id)
           ON DELETE SET NULL ON UPDATE RESTRICT`
      );
      console.log('   ✚ fk_staff_roles_default_shift added');
    } catch (err) {
      // A missing FK does not break the application — warn and continue.
      console.warn(`   ⚠ could not add fk_staff_roles_default_shift: ${err.message}`);
    }
  }
};

const fixAttendanceTables = async () => {
  console.log("\n[3/4] attendance — status enum, overtime, raw punch processing columns");

  const type = await getColumnType('attendance_daily_summary', 'status');
  if (!type) {
    console.warn('   ⚠ attendance_daily_summary.status not found — skipping enum');
  } else if (type.includes("'late_present'")) {
    console.log("   · 'late_present' already present in the enum");
  } else {
    await db.query(
      `ALTER TABLE attendance_daily_summary
         MODIFY COLUMN status
         ENUM('present','late_present','absent','on_leave','lop','week_off','holiday')
         NOT NULL`
    );
    console.log("   ✚ 'late_present' added to the status enum");
  }

  await addColumn('attendance_daily_summary', 'overtime_minutes', 'INT NOT NULL DEFAULT 0');

  // attendance_raw_punches is keyed by employee_code (the eSSL device only knows
  // codes, and the raw rows are an immutable audit trail). The processing loop
  // additionally needs a resolved employee_id, a direction, and a processed flag.
  await addColumn('attendance_raw_punches', 'employee_id', 'BIGINT UNSIGNED NULL DEFAULT NULL');
  await addColumn('attendance_raw_punches', 'punch_type', "ENUM('in','out') NULL DEFAULT NULL");
  await addColumn('attendance_raw_punches', 'is_processed', 'TINYINT(1) NOT NULL DEFAULT 0');

  // Backfill employee_id for any punches already imported by code.
  const [res] = await db.query(
    `UPDATE attendance_raw_punches rp
       JOIN employees e ON e.employee_code = rp.employee_code
        SET rp.employee_id = e.id
      WHERE rp.employee_id IS NULL`
  );
  console.log(`   ↻ ${res.affectedRows} raw punch(es) resolved to an employee_id`);

  if (await indexExists('attendance_raw_punches', 'ix_raw_punches_unprocessed')) {
    console.log('   · ix_raw_punches_unprocessed already exists');
  } else {
    try {
      await db.query(
        `CREATE INDEX ix_raw_punches_unprocessed
           ON attendance_raw_punches (is_processed, punch_time)`
      );
      console.log('   ✚ ix_raw_punches_unprocessed added');
    } catch (err) {
      console.warn(`   ⚠ could not add ix_raw_punches_unprocessed: ${err.message}`);
    }
  }

  // Punch import uses INSERT IGNORE to make re-imports safe, which needs a
  // unique key to ignore against. The same person cannot punch twice in the
  // same second, so (employee_code, punch_time) is the natural key.
  if (await indexExists('attendance_raw_punches', 'uq_raw_punch')) {
    console.log('   · uq_raw_punch already exists');
  } else {
    try {
      const [dupes] = await db.query(
        `SELECT COUNT(*) AS c FROM (
           SELECT employee_code, punch_time FROM attendance_raw_punches
           GROUP BY employee_code, punch_time HAVING COUNT(*) > 1
         ) x`
      );
      if (Number(dupes[0].c) > 0) {
        console.warn(`   ⚠ ${dupes[0].c} duplicate punch(es) present — skipping uq_raw_punch, dedupe first`);
      } else {
        await db.query(
          `CREATE UNIQUE INDEX uq_raw_punch
             ON attendance_raw_punches (employee_code, punch_time)`
        );
        console.log('   ✚ uq_raw_punch added');
      }
    } catch (err) {
      console.warn(`   ⚠ could not add uq_raw_punch: ${err.message}`);
    }
  }
};

/**
 * PF/ESI constants live in payroll_config so they can be changed without a
 * code change. Insert-if-missing only — never overwrite a value an admin set.
 */
const PAYROLL_DEFAULTS = [
  ['PF_EMPLOYEE_PERCENT',     '12',    'Employee PF contribution, % of Basic+DA'],
  ['PF_EMPLOYER_EPF_PERCENT', '3.67',  'Employer EPF share, % of Basic+DA'],
  ['PF_EMPLOYER_EPS_PERCENT', '8.33',  'Employer EPS share, % of Basic+DA'],
  ['PF_WAGE_CEILING',         '15000', 'Max Basic+DA considered for PF'],
  ['ESI_EMPLOYEE_PERCENT',    '0.75',  'Employee ESI contribution, % of gross'],
  ['ESI_EMPLOYER_PERCENT',    '3.25',  'Employer ESI contribution, % of gross'],
  ['ESI_GROSS_CEILING',       '21000', 'Gross above which ESI does not apply'],
  ['STANDARD_SHIFT_MINUTES',  '480',   'Shift length used to convert late minutes to a day fraction'],
];

/**
 * A payslip may derive its salary from the department-role default rather than
 * an explicit salary_structures row, so the link has to be optional. It was
 * declared NOT NULL, which made every such payslip fail to write.
 */
const relaxPayrollItemStructureLink = async () => {
  console.log('\n[4/5] payroll_items.salary_structure_id — allow NULL');
  const [rows] = await db.query(
    `SELECT IS_NULLABLE AS nullable FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payroll_items' AND COLUMN_NAME = 'salary_structure_id'`,
    [dbName]
  );
  if (!rows.length) {
    console.warn('   ⚠ payroll_items.salary_structure_id not found — skipping');
    return;
  }
  if (rows[0].nullable === 'YES') {
    console.log('   · already nullable');
    return;
  }
  await db.query(
    `ALTER TABLE payroll_items MODIFY COLUMN salary_structure_id BIGINT UNSIGNED NULL DEFAULT NULL`
  );
  console.log('   ✚ salary_structure_id is now nullable');
};

const seedPayrollConfig = async () => {
  console.log('\n[5/5] payroll_config — seed PF/ESI constants');
  let added = 0;
  for (const [key, value, description] of PAYROLL_DEFAULTS) {
    const [res] = await db.query(
      `INSERT IGNORE INTO payroll_config (config_key, config_value, description)
       VALUES (?, ?, ?)`,
      [key, value, description]
    );
    if (res.affectedRows > 0) {
      added++;
      console.log(`   ✚ ${key} = ${value}`);
    } else {
      console.log(`   · ${key} already set`);
    }
  }
  console.log(`   ${added} new config key(s)`);
};

/* ─── runner ─── */

(async () => {
  let failed = false;
  try {
    console.log(`Staff & Salary phase migration → schema "${dbName}"`);
    await addShiftColumns();
    await addStaffRoleColumns();
    await fixAttendanceTables();
    await relaxPayrollItemStructureLink();
    await seedPayrollConfig();
    console.log('\n✅ Migration complete.');
  } catch (err) {
    failed = true;
    console.error('\n❌ Migration failed:', err.message);
    console.error(err);
  } finally {
    await db.end().catch(() => {});
    process.exit(failed ? 1 : 0);
  }
})();
