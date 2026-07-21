const db = require('../src/config/db');

(async () => {
  try {
    const [departments] = await db.execute(`SELECT id, name FROM departments ORDER BY id`);
    console.log('=== DEPARTMENTS & STAFF ROLES & MEMBER COUNTS ===');
    for (const d of departments) {
      const [roles] = await db.execute(`SELECT id, name FROM staff_roles WHERE department_id = ?`, [d.id]);
      console.log(`\n🏢 Department: ${d.name} (ID: ${d.id})`);
      for (const r of roles) {
        const [[{ count }]] = await db.execute(`SELECT COUNT(*) AS count FROM employees WHERE department_id = ? AND designation_id = ?`, [d.id, r.id]);
        const [empNames] = await db.execute(`SELECT full_name, qualification FROM employees WHERE department_id = ? AND designation_id = ? LIMIT 3`, [d.id, r.id]);
        const namesSample = empNames.map(e => `${e.full_name} (${e.qualification})`).join(', ');
        console.log(`   └─ Role: ${r.name} -> ${count} Members [Sample: ${namesSample}]`);
      }
    }
  } catch (err) {
    console.error('Check DB error:', err);
  }
})();
