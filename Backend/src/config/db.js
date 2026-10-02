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

(async () => {
  try {
    const connection = await db.getConnection();
    console.log("✅ Connected to MySQL database");

    // Ensure system_config.config_value is MEDIUMTEXT so large base64/JSON settings never fail
    try {
      await connection.query(`
        ALTER TABLE system_config MODIFY COLUMN config_value MEDIUMTEXT NULL
      `);
    } catch (migErr) {
      // Table might not exist yet or already altered
    }

    connection.release();
  } catch (err) {
    console.error("❌ Database connection error:", err);
  }
})();

module.exports = db;
