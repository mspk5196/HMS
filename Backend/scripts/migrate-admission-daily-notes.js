const db = require('../src/config/db');

async function migrate() {
  try {
    console.log('Running admission_daily_notes migration...');

    const [tables] = await db.query("SHOW TABLES LIKE 'admission_daily_notes'");
    if (tables.length > 0) {
      console.log('admission_daily_notes already exists.');
      process.exit(0);
    }

    await db.query(`
      CREATE TABLE admission_daily_notes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        admission_id BIGINT UNSIGNED NOT NULL,
        note_date DATE NOT NULL,
        doctor_id BIGINT UNSIGNED NULL DEFAULT NULL,
        bp VARCHAR(20) NULL DEFAULT NULL,
        pulse SMALLINT UNSIGNED NULL DEFAULT NULL,
        temperature DECIMAL(4,1) NULL DEFAULT NULL,
        spo2 TINYINT UNSIGNED NULL DEFAULT NULL,
        advice TEXT NULL,
        created_by BIGINT UNSIGNED NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX ix_admission_daily_notes_admission (admission_id),
        INDEX ix_admission_daily_notes_date (note_date),
        CONSTRAINT fk_admission_daily_notes_admission FOREIGN KEY (admission_id) REFERENCES admissions (id) ON DELETE CASCADE ON UPDATE RESTRICT,
        CONSTRAINT fk_admission_daily_notes_doctor FOREIGN KEY (doctor_id) REFERENCES employees (id) ON DELETE SET NULL ON UPDATE RESTRICT,
        CONSTRAINT fk_admission_daily_notes_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE RESTRICT
      ) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin
    `);
    console.log('✅ Created admission_daily_notes table');

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
