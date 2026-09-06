require('../Backend/node_modules/dotenv').config({ path: require('path').resolve(__dirname, '../Backend/.env') });
const { listBiometricEnrolledUsers } = require('../Backend/src/modules/attendance/attendance.queries');

async function main() {
  const res = await listBiometricEnrolledUsers({ limit: 5 });
  console.log('Total enrolled:', res.total);
  console.log('Sample rows:', res.users.map(u => ({
    code: u.enroll_code,
    name: u.name,
    is_linked: u.is_linked,
    emp_name: u.employee_name,
    dept: u.department_name,
    role: u.designation_title,
  })));
  process.exit(0);
}

main().catch(console.error);
