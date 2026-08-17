const db = require('../src/config/db');

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return rows[0].c > 0;
}

async function migrate() {
  try {
    console.log('Linking Settings roles to Department & Role staff roles...');

    if (!(await columnExists('roles', 'staff_role_id'))) {
      await db.query(`ALTER TABLE roles ADD COLUMN staff_role_id BIGINT UNSIGNED NULL DEFAULT NULL AFTER description`);
      await db.query(`ALTER TABLE roles ADD UNIQUE INDEX uq_roles_staff_role (staff_role_id)`);
      // SET NULL (not CASCADE) — deleting a department role must never risk
      // cascading into deleting a `roles` row that a real login depends on.
      await db.query(`ALTER TABLE roles ADD CONSTRAINT fk_roles_staff_role FOREIGN KEY (staff_role_id) REFERENCES staff_roles (id) ON DELETE SET NULL`);
      console.log('✅ Added roles.staff_role_id');
    } else {
      console.log('roles.staff_role_id already exists.');
    }

    const [staffRoles] = await db.query(
      `SELECT sr.id, sr.name, d.name AS department_name
       FROM staff_roles sr JOIN departments d ON d.id = sr.department_id`
    );
    const [existingLinks] = await db.query(`SELECT staff_role_id FROM roles WHERE staff_role_id IS NOT NULL`);
    const linked = new Set(existingLinks.map((r) => r.staff_role_id));

    const [[{ maxPriority }]] = await db.query(`SELECT COALESCE(MAX(priority), 0) AS maxPriority FROM roles`);
    let priority = maxPriority;
    let created = 0;
    for (const sr of staffRoles) {
      if (linked.has(sr.id)) continue;
      priority += 1;
      const plainName = sr.name.trim();
      // roles.name is UNIQUE — a staff role can share a name with an existing
      // abstract role (e.g. "HR Manager"); disambiguate with the department.
      const [[nameClash]] = await db.query(`SELECT id FROM roles WHERE name = ?`, [plainName]);
      const name = nameClash ? `${plainName} (${sr.department_name})` : plainName;
      await db.query(
        `INSERT INTO roles (name, description, priority, can_access_settings, staff_role_id) VALUES (?, ?, ?, 0, ?)`,
        [name, 'Auto-linked from Department & Role', priority, sr.id]
      );
      created += 1;
    }
    console.log(`✅ Created ${created} role(s) mirrored from staff roles (${staffRoles.length - created} already linked).`);

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
