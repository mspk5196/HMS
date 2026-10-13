require('dotenv').config();
const db = require('../config/db');

async function run() {
  console.log('--- Creating doctor_voiceprints Table ---');
  await db.query(`
    CREATE TABLE IF NOT EXISTS doctor_voiceprints (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      doctor_id BIGINT UNSIGNED NOT NULL UNIQUE,
      embedding_vector JSON NOT NULL,
      audio_duration_seconds DECIMAL(5, 2) NULL,
      sample_rate INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_doc_vp_doctor FOREIGN KEY (doctor_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✓ Successfully created / verified doctor_voiceprints table');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
