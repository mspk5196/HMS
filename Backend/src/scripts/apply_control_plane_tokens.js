const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  console.log('Applying control_plane_tokens_and_audit.sql to MySQL...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
  });

  try {
    const sqlPath = path.resolve(__dirname, '../../../Sql/control_plane_tokens_and_audit.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await connection.query(sql);
    console.log('✅ control_plane_tokens_and_audit.sql applied successfully.');
  } catch (err) {
    console.error('❌ Error applying SQL:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

run();
