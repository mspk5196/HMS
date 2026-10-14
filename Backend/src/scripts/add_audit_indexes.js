require('dotenv').config();
const db = require('../config/db');

async function addIndexIfNotExists(table, indexName, createSql) {
  const [indexes] = await db.query(`SHOW INDEX FROM ${table} WHERE Key_name = ?`, [indexName]);
  if (indexes.length === 0) {
    console.log(`Adding index ${indexName} on ${table}...`);
    await db.query(createSql);
    console.log(`✓ Added ${indexName}`);
  } else {
    console.log(`- Index ${indexName} already exists on ${table}`);
  }
}

async function run() {
  console.log('--- Optimizing Audit Log Indexes for Millions of Rows ---');

  // Indexes on request_audit_logs
  await addIndexIfNotExists(
    'request_audit_logs',
    'idx_req_audit_role',
    'CREATE INDEX idx_req_audit_role ON request_audit_logs (role_name)'
  );

  await addIndexIfNotExists(
    'request_audit_logs',
    'idx_req_audit_username',
    'CREATE INDEX idx_req_audit_username ON request_audit_logs (username)'
  );

  await addIndexIfNotExists(
    'request_audit_logs',
    'idx_req_audit_endpoint_prefix',
    'CREATE INDEX idx_req_audit_endpoint_prefix ON request_audit_logs (endpoint(191))'
  );

  await addIndexIfNotExists(
    'request_audit_logs',
    'idx_req_audit_created_status',
    'CREATE INDEX idx_req_audit_created_status ON request_audit_logs (created_at, status_code)'
  );

  await addIndexIfNotExists(
    'request_audit_logs',
    'idx_req_audit_created_method',
    'CREATE INDEX idx_req_audit_created_method ON request_audit_logs (created_at, method)'
  );

  await addIndexIfNotExists(
    'request_audit_logs',
    'idx_req_audit_user_created',
    'CREATE INDEX idx_req_audit_user_created ON request_audit_logs (user_id, created_at)'
  );

  // Indexes on employee_audit_logs
  await addIndexIfNotExists(
    'employee_audit_logs',
    'idx_emp_audit_emp_created',
    'CREATE INDEX idx_emp_audit_emp_created ON employee_audit_logs (employee_id, created_at)'
  );

  console.log('--- All Audit Indexes Verified & Configured Successfully ---');
  process.exit(0);
}

run().catch((err) => {
  console.error('Failed to configure audit indexes:', err);
  process.exit(1);
});
