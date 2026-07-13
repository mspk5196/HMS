const mysql = require("mysql2/promise");
require("dotenv").config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 50,
  port: process.env.DB_PORT,
//   ssl: {
//     rejectUnauthorized: true,
//     ca: process.env.DB_CA_CERT
//   },
});

(async () => {
  try {
    const connection = await db.getConnection();
    console.log("✅ Connected to MySQL database");
    connection.release();
  } catch (err) {
    console.error("❌ Database connection error:", err);
  }
})();

module.exports = db;
