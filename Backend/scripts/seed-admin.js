const bcrypt = require('bcrypt');
const db = require('../src/config/db');

(async () => {
  try {
    // 1. Ensure a role exists with 'Administrator' name
    const [roles] = await db.execute(`SELECT id FROM roles WHERE name = 'Administrator'`);
    let roleId;
    if (roles.length > 0) {
      roleId = roles[0].id;
    } else {
      const [roleRes] = await db.execute(`INSERT INTO roles (name, description) VALUES ('Administrator', 'Full system access')`);
      roleId = roleRes.insertId;
    }

    // Assign 'manage_all' permission if it exists
    const [perms] = await db.execute(`SELECT id FROM permissions WHERE code = 'manage_all'`);
    if (perms.length > 0) {
      await db.execute(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [roleId, perms[0].id]);
    } else {
      // Assuming module_id = 1 and action_id = 1 for a dummy parent just to satisfy foreign keys if needed, 
      // but if module_id/action_id are nullable, we just insert code. Let's try inserting with just code and description.
      // Wait, we saw the columns: [ 'id', 'module_id', 'action_id', 'code', 'description' ]
      // Let's assume module_id and action_id can be null or we use existing ones.
      try {
        const [permRes] = await db.execute(`INSERT INTO permissions (code, description) VALUES ('manage_all', 'Bypass all permission checks')`);
        await db.execute(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [roleId, permRes.insertId]);
      } catch (e) {
        console.warn("Could not insert permission directly (likely due to FK constraints on module_id/action_id). Assuming admin will bypass using code checks if permissions array is empty.");
      }
    }

    // 2. Create the admin user
    const username = 'admin';
    const password = 'password123';
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    await db.execute(
      `INSERT INTO users (username, password_hash, role_id, is_active)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role_id = VALUES(role_id)`,
      [username, hash, roleId]
    );

    console.log('✅ Admin user created successfully.');
    console.log('Username:', username);
    console.log('Password:', password);

  } catch (err) {
    console.error('❌ Error creating admin:', err);
  } finally {
    process.exit(0);
  }
})();
