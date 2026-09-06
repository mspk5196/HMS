const { query } = require('./Backend/src/config/db');

async function check() {
  const [users] = await query('SELECT * FROM biometric_enrolled_users LIMIT 5');
  console.log('Enrolled users in DB:', users);
  const [emps] = await query('SELECT id, employee_code, full_name, department_name, role_name FROM employees LIMIT 5');
  console.log('Sample employees:', emps);
  process.exit(0);
}

check().catch(console.error);
