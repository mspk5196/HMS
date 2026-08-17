const db = require('../src/config/db');
const { MODULES, MODULE_ACTIONS, buildCatalog } = require('../src/modules/rbac/actionCatalog');

const DEFAULT_ROLES = [
  { name: 'Administrator', description: 'Full access to every module and action', priority: 1, can_access_settings: 1 },
  { name: 'Doctor', description: 'Consultations, admissions, prescriptions', priority: 2, can_access_settings: 0 },
  { name: 'Receptionist', description: 'Front-desk: patients, appointments, OPD payments', priority: 3, can_access_settings: 0 },
  { name: 'Nurse', description: 'Ward care: admissions, daily notes, bed status', priority: 4, can_access_settings: 0 },
  { name: 'Pharmacist', description: 'Pharmacy dispensing and billing', priority: 5, can_access_settings: 0 },
  { name: 'Accountant', description: 'Billing, discharge payments, fee rates', priority: 6, can_access_settings: 0 },
  { name: 'HR Manager', description: 'Employees, departments, shifts, leave', priority: 7, can_access_settings: 0 },
];

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return rows[0].c > 0;
}

async function tableExists(table) {
  const [rows] = await db.query(`SHOW TABLES LIKE ?`, [table]);
  return rows.length > 0;
}

async function migrate() {
  try {
    console.log('Running RBAC suite migration...');

    // Guards this whole migration to run its destructive reseed exactly once —
    // approval_workflows existing means a prior run already rebuilt the catalog,
    // and re-truncating permissions/role_permissions would blow away anything
    // an admin configured through the UI since.
    const alreadyMigrated = await tableExists('approval_workflows');

    // 1. Schema additions
    if (!(await columnExists('roles', 'priority'))) {
      await db.query(`ALTER TABLE roles ADD COLUMN priority INT NOT NULL DEFAULT 100 AFTER description`);
      console.log('✅ Added roles.priority');
    }
    if (!(await columnExists('roles', 'can_access_settings'))) {
      await db.query(`ALTER TABLE roles ADD COLUMN can_access_settings TINYINT(1) NOT NULL DEFAULT 0 AFTER priority`);
      console.log('✅ Added roles.can_access_settings');
    }
    if (!(await columnExists('role_permissions', 'skip_approval'))) {
      await db.query(`ALTER TABLE role_permissions ADD COLUMN skip_approval TINYINT(1) NOT NULL DEFAULT 0`);
      console.log('✅ Added role_permissions.skip_approval');
    }

    if (!(await tableExists('approval_workflows'))) {
      await db.query(`
        CREATE TABLE approval_workflows (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          permission_code VARCHAR(120) NOT NULL,
          enabled TINYINT(1) NOT NULL DEFAULT 0,
          level1_type ENUM('role','user') NOT NULL DEFAULT 'role',
          level1_role_id BIGINT UNSIGNED NULL DEFAULT NULL,
          level1_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
          level2_enabled TINYINT(1) NOT NULL DEFAULT 0,
          level2_type ENUM('role','user') NOT NULL DEFAULT 'role',
          level2_role_id BIGINT UNSIGNED NULL DEFAULT NULL,
          level2_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE INDEX uq_approval_workflows_code (permission_code),
          CONSTRAINT fk_aw_level1_role FOREIGN KEY (level1_role_id) REFERENCES roles (id) ON DELETE SET NULL,
          CONSTRAINT fk_aw_level1_user FOREIGN KEY (level1_user_id) REFERENCES users (id) ON DELETE SET NULL,
          CONSTRAINT fk_aw_level2_role FOREIGN KEY (level2_role_id) REFERENCES roles (id) ON DELETE SET NULL,
          CONSTRAINT fk_aw_level2_user FOREIGN KEY (level2_user_id) REFERENCES users (id) ON DELETE SET NULL
        ) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin
      `);
      console.log('✅ Created approval_workflows');
    }

    if (!(await tableExists('pending_approvals'))) {
      await db.query(`
        CREATE TABLE pending_approvals (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          permission_code VARCHAR(120) NOT NULL,
          action_label VARCHAR(150) NULL DEFAULT NULL,
          requested_by BIGINT UNSIGNED NOT NULL,
          method VARCHAR(10) NOT NULL,
          original_url VARCHAR(500) NOT NULL,
          params_json TEXT NULL,
          body_json TEXT NULL,
          query_json TEXT NULL,
          status ENUM('pending_level1','pending_level2','approved','rejected') NOT NULL DEFAULT 'pending_level1',
          level1_approved_by BIGINT UNSIGNED NULL DEFAULT NULL,
          level1_approved_at TIMESTAMP NULL DEFAULT NULL,
          level2_approved_by BIGINT UNSIGNED NULL DEFAULT NULL,
          level2_approved_at TIMESTAMP NULL DEFAULT NULL,
          rejected_by BIGINT UNSIGNED NULL DEFAULT NULL,
          rejected_at TIMESTAMP NULL DEFAULT NULL,
          rejection_reason VARCHAR(500) NULL DEFAULT NULL,
          result_json TEXT NULL,
          error_message VARCHAR(500) NULL DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP NULL DEFAULT NULL,
          PRIMARY KEY (id),
          INDEX ix_pending_approvals_status (status),
          INDEX ix_pending_approvals_requested_by (requested_by),
          CONSTRAINT fk_pa_requested_by FOREIGN KEY (requested_by) REFERENCES users (id) ON DELETE CASCADE,
          CONSTRAINT fk_pa_level1_approved_by FOREIGN KEY (level1_approved_by) REFERENCES users (id) ON DELETE SET NULL,
          CONSTRAINT fk_pa_level2_approved_by FOREIGN KEY (level2_approved_by) REFERENCES users (id) ON DELETE SET NULL,
          CONSTRAINT fk_pa_rejected_by FOREIGN KEY (rejected_by) REFERENCES users (id) ON DELETE SET NULL
        ) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_bin
      `);
      console.log('✅ Created pending_approvals');
    }

    if (alreadyMigrated) {
      console.log('Catalog already seeded on a prior run — skipping destructive reseed of permissions/roles to avoid clobbering UI-configured data.');
      console.log('Migration complete (no-op).');
      process.exit(0);
    }

    // 2. Rebuild modules / actions / module_actions / permissions from the catalog.
    // Only 'Administrator' existed before this migration, so it's safe to
    // clear and reseed role_permissions/permissions/modules/actions wholesale.
    await db.query(`SET FOREIGN_KEY_CHECKS = 0`);
    await db.query(`TRUNCATE TABLE role_permissions`);
    await db.query(`TRUNCATE TABLE permissions`);
    await db.query(`TRUNCATE TABLE module_actions`);
    await db.query(`TRUNCATE TABLE modules`);
    await db.query(`TRUNCATE TABLE actions`);
    await db.query(`SET FOREIGN_KEY_CHECKS = 1`);

    const moduleIdByCode = {};
    for (const mod of MODULES) {
      const [r] = await db.query(`INSERT INTO modules (code, name, display_order) VALUES (?, ?, ?)`, [mod.code, mod.name, mod.order]);
      moduleIdByCode[mod.code] = r.insertId;
    }

    const actionIdByCode = {};
    const catalog = buildCatalog();
    for (const entry of catalog) {
      if (!actionIdByCode[entry.action]) {
        const [r] = await db.query(`INSERT INTO actions (code, name, is_special) VALUES (?, ?, ?)`, [entry.action, entry.label, entry.isSpecial ? 1 : 0]);
        actionIdByCode[entry.action] = r.insertId;
      }
    }

    for (const entry of catalog) {
      const moduleId = moduleIdByCode[entry.module];
      const actionId = actionIdByCode[entry.action];
      await db.query(`INSERT IGNORE INTO module_actions (module_id, action_id) VALUES (?, ?)`, [moduleId, actionId]);
      await db.query(
        `INSERT INTO permissions (module_id, action_id, code, description) VALUES (?, ?, ?, ?)`,
        [moduleId, actionId, entry.code, `${entry.label} — ${entry.module}`]
      );
    }
    console.log(`✅ Seeded ${catalog.length} permissions across ${MODULES.length} modules`);

    // 3. Roles — keep/insert by name so re-running this script is safe.
    for (const role of DEFAULT_ROLES) {
      const [[existing]] = await db.query(`SELECT id FROM roles WHERE name = ?`, [role.name]);
      if (existing) {
        await db.query(`UPDATE roles SET priority = ?, can_access_settings = ?, description = ? WHERE id = ?`,
          [role.priority, role.can_access_settings, role.description, existing.id]);
      } else {
        await db.query(`INSERT INTO roles (name, description, priority, can_access_settings) VALUES (?, ?, ?, ?)`,
          [role.name, role.description, role.priority, role.can_access_settings]);
      }
    }
    console.log(`✅ Seeded ${DEFAULT_ROLES.length} roles`);

    // 4. Administrator gets every permission, all skip_approval.
    const [[adminRole]] = await db.query(`SELECT id FROM roles WHERE name = 'Administrator'`);
    const [allPerms] = await db.query(`SELECT id FROM permissions`);
    for (const p of allPerms) {
      await db.query(`INSERT INTO role_permissions (role_id, permission_id, skip_approval) VALUES (?, ?, 1)`, [adminRole.id, p.id]);
    }
    console.log('✅ Granted Administrator all permissions (skip approval)');

    // 5. One approval_workflows row per approvable permission, disabled by default.
    const approvable = catalog.filter((e) => e.approvable);
    for (const entry of approvable) {
      await db.query(`INSERT IGNORE INTO approval_workflows (permission_code, enabled) VALUES (?, 0)`, [entry.code]);
    }
    console.log(`✅ Seeded ${approvable.length} approval workflow rows (disabled by default)`);

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
