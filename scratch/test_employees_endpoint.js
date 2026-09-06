require('../Backend/node_modules/dotenv').config({ path: require('path').resolve(__dirname, '../Backend/.env') });
const db = require('../Backend/src/config/db');

async function main() {
  const [emps] = await db.query(`
    SELECT e.id, e.employee_code, e.full_name, d.name AS department_name, COALESCE(sr.name, des.name) AS role_name
    FROM employees e
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN staff_roles sr ON e.designation_id = sr.id
    LEFT JOIN designations des ON e.designation_id = des.id
    WHERE e.status = 'active'
    ORDER BY e.full_name ASC
  `);
  console.log('Active employees count:', emps.length);
  process.exit(0);
}

main().catch(console.error);
