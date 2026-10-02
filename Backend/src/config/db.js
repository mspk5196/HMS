const mysql = require("mysql2/promise");
require("dotenv").config();

// Helper to format CA certificate if it's a single line PEM string
const formatCaCert = (cert) => {
  if (!cert) return undefined;
  const header = "-----BEGIN CERTIFICATE-----";
  const footer = "-----END CERTIFICATE-----";
  
  if (cert.includes(header) && cert.includes(footer)) {
    let body = cert.replace(header, "").replace(footer, "").trim();
    body = body.replace(/\s+/g, "");
    const chunks = [];
    for (let i = 0; i < body.length; i += 64) {
      chunks.push(body.substring(i, i + 64));
    }
    return `${header}\n${chunks.join("\n")}\n${footer}\n`;
  }
  return cert;
};

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 50,
  // Enforce IST (+05:30) timezone in MySQL connection
  timezone: '+05:30',
  // Return DATE/DATETIME/TIMESTAMP columns as exact string representations.
  // This avoids Javascript Date UTC offset conversions that distort local Indian Standard Time (IST) biometric punch timestamps.
  dateStrings: true,
  ...(process.env.DB_CA_CERT
    ? {
        ssl: {
          rejectUnauthorized: true,
          ca: formatCaCert(process.env.DB_CA_CERT),
        },
      }
    : process.env.DB_SSL === 'true'
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

// Ensure every connection session in the pool runs with IST timezone
db.on('connection', (connection) => {
  connection.query("SET time_zone = '+05:30'");
});

(async () => {
  try {
    const connection = await db.getConnection();
    await connection.query("SET time_zone = '+05:30'");
    console.log("✅ Connected to MySQL database (Timezone: IST +05:30)");

    // Ensure system_config.config_value is MEDIUMTEXT so large base64/JSON settings never fail
    try {
      await connection.query(`
        ALTER TABLE system_config MODIFY COLUMN config_value MEDIUMTEXT NULL
      `);
    } catch (migErr) {
      // Table might not exist yet or already altered
    }

    // ── Clinical module migrations ──────────────────────────────────────────

    // appointments: visiting doctor ref + per-appointment fee override
    const appointmentCols = [
      `ALTER TABLE appointments ADD COLUMN visiting_doctor_id INT UNSIGNED NULL AFTER doctor_id`,
      `ALTER TABLE appointments ADD COLUMN visiting_doctor_name VARCHAR(200) NULL AFTER visiting_doctor_id`,
      `ALTER TABLE appointments ADD COLUMN doctor_fee_override DECIMAL(10,2) NULL COMMENT 'Overrides master fee rate for this specific visit' AFTER doctor_fee`,
    ];
    for (const sql of appointmentCols) {
      try { await connection.query(sql); } catch { /* column exists */ }
    }

    // consultations: vitals columns
    const vitalsCols = [
      `ALTER TABLE consultations ADD COLUMN bp_systolic SMALLINT NULL COMMENT 'mmHg'`,
      `ALTER TABLE consultations ADD COLUMN bp_diastolic SMALLINT NULL COMMENT 'mmHg'`,
      `ALTER TABLE consultations ADD COLUMN temperature DECIMAL(4,1) NULL COMMENT 'Celsius'`,
      `ALTER TABLE consultations ADD COLUMN pulse SMALLINT NULL COMMENT 'bpm'`,
      `ALTER TABLE consultations ADD COLUMN spo2 TINYINT NULL COMMENT 'percent'`,
      `ALTER TABLE consultations ADD COLUMN weight DECIMAL(5,1) NULL COMMENT 'kg'`,
      `ALTER TABLE consultations ADD COLUMN height SMALLINT NULL COMMENT 'cm'`,
      `ALTER TABLE consultations ADD COLUMN blood_sugar SMALLINT NULL COMMENT 'mg/dL'`,
    ];
    for (const sql of vitalsCols) {
      try { await connection.query(sql); } catch { /* column exists */ }
    }

    // consultation_addenda: audit-safe addendum trail
    await connection.query(`
      CREATE TABLE IF NOT EXISTS consultation_addenda (
        id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        consultation_id INT UNSIGNED NOT NULL,
        added_by        INT UNSIGNED NOT NULL COMMENT 'employee id',
        note            TEXT NOT NULL,
        created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_consultation_id (consultation_id)
      )
    `);

    // admissions: per-admission doctor fee override
    const admissionCols = [
      `ALTER TABLE admission_beds ADD COLUMN visiting_doctor_id INT UNSIGNED NULL AFTER doctor_id`,
      `ALTER TABLE admission_beds ADD COLUMN visiting_doctor_name VARCHAR(200) NULL AFTER visiting_doctor_id`,
      `ALTER TABLE admission_beds ADD COLUMN doctor_fee_override DECIMAL(10,2) NULL COMMENT 'Overrides master IPD daily fee for this admission' AFTER doctor_id`,
    ];
    for (const sql of admissionCols) {
      try { await connection.query(sql); } catch { /* column exists */ }
    }

    connection.release();
  } catch (err) {
    console.error("❌ Database connection error:", err);
  }
})();

module.exports = db;
