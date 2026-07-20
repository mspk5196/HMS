const db = require('../src/config/db');

(async () => {
  try {
    console.log("Starting employees constraint migration...");

    // 1. Disable foreign key checks temporarily
    await db.query('SET FOREIGN_KEY_CHECKS = 0');

    // 2. Drop the old foreign key constraint
    try {
      console.log("Dropping old constraint 'fk_employees_designation'...");
      await db.query('ALTER TABLE employees DROP FOREIGN KEY fk_employees_designation');
      console.log("Old constraint dropped successfully.");
    } catch (e) {
      console.log("Old constraint 'fk_employees_designation' did not exist or was already dropped.");
    }

    // 3. Make sure all designation_id values in employees point to an existing staff_roles id
    // Get the first staff role id
    const [roles] = await db.query('SELECT id FROM staff_roles LIMIT 1');
    if (roles.length > 0) {
      const defaultRoleId = roles[0].id;
      console.log(`Setting existing employees' designation_id to default staff_roles.id = ${defaultRoleId}...`);
      await db.query('UPDATE employees SET designation_id = ?', [defaultRoleId]);
    } else {
      console.log("Warning: No roles found in staff_roles to default existing employees to.");
    }

    // 4. Add the new foreign key constraint pointing to staff_roles
    console.log("Adding new foreign key constraint pointing to 'staff_roles(id)'...");
    await db.query(`
      ALTER TABLE employees 
      ADD CONSTRAINT fk_employees_designation 
      FOREIGN KEY (designation_id) REFERENCES staff_roles(id)
    `);
    console.log("New foreign key constraint added successfully.");

    // 5. Re-enable foreign key checks
    await db.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log("Constraint migration completed successfully! ✅");
  } catch (err) {
    console.error("Migration failed! ❌", err);
  } finally {
    process.exit(0);
  }
})();
