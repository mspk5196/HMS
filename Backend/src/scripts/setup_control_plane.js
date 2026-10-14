const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function setupControlPlane() {
  console.log('Connecting to MySQL to initialize Control Plane database...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
    timezone: '+05:30'
  });

  try {
    const schemaSqlPath = path.resolve(__dirname, '../../../Sql/control_plane_schema.sql');
    const seedSqlPath = path.resolve(__dirname, '../../../Sql/seed_control_plane.sql');

    console.log(`Executing schema: ${schemaSqlPath}`);
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
    await connection.query(schemaSql);
    console.log('✅ control_plane_db schema created successfully.');

    console.log(`Executing seed: ${seedSqlPath}`);
    const seedSql = fs.readFileSync(seedSqlPath, 'utf8');
    await connection.query(seedSql);
    console.log('✅ control_plane_db seed executed successfully.');

    // Also verify tenant database exists
    const [rows] = await connection.query("SHOW DATABASES LIKE 'nehahospitals'");
    if (rows.length > 0) {
      console.log('✅ Tenant database "nehahospitals" confirmed present.');
    } else {
      console.warn('⚠️ Warning: "nehahospitals" database not found.');
    }
  } catch (err) {
    console.error('❌ Error setting up control plane database:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

setupControlPlane();
