const db = require('../../config/db');
const { MODULES, buildCatalog } = require('./actionCatalog');

const groupByModuleCode = Object.fromEntries(MODULES.map((m) => [m.code, m.group]));

/* ─────────────────────────────────────────────
   PERMISSION CATALOG (modules × actions)
───────────────────────────────────────────── */

let catalogSynced = false;

const syncCatalogToDb = async () => {
  try {
    const catalog = buildCatalog();
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Sync modules
      for (const m of MODULES) {
        await conn.execute(
          `INSERT INTO modules (code, name, display_order)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), display_order = VALUES(display_order)`,
          [m.code, m.name, m.order]
        );
      }

      const [modRows] = await conn.execute(`SELECT id, code FROM modules`);
      const modIdByCode = Object.fromEntries(modRows.map((r) => [r.code, r.id]));

      // 2. Sync standard & special actions
      for (const item of catalog) {
        await conn.execute(
          `INSERT INTO actions (code, name, is_special)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), is_special = VALUES(is_special)`,
          [item.action, item.label, item.isSpecial ? 1 : 0]
        );
      }

      const [actRows] = await conn.execute(`SELECT id, code FROM actions`);
      const actIdByCode = Object.fromEntries(actRows.map((r) => [r.code, r.id]));

      // 3. Sync permissions
      for (const item of catalog) {
        const moduleId = modIdByCode[item.module];
        const actionId = actIdByCode[item.action];
        if (!moduleId || !actionId) continue;

        const description = `${item.label} — ${item.module}`;
        await conn.execute(
          `INSERT INTO permissions (module_id, action_id, code, description)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE description = VALUES(description), module_id = VALUES(module_id), action_id = VALUES(action_id)`,
          [moduleId, actionId, item.code, description]
        );

        if (item.approvable) {
          await conn.execute(
            `INSERT INTO approval_workflows (permission_code, enabled, level1_type, level2_enabled, level2_type)
             VALUES (?, 0, 'role', 0, 'role')
             ON DUPLICATE KEY UPDATE permission_code = permission_code`,
            [item.code]
          );
        }
      }

      // 4. Ensure Administrator (role id 1) has all permissions granted with skip_approval
      await conn.execute(
        `INSERT INTO role_permissions (role_id, permission_id, skip_approval)
         SELECT 1, p.id, 1
         FROM permissions p
         ON DUPLICATE KEY UPDATE skip_approval = 1`
      );

      await conn.commit();
      catalogSynced = true;
    } catch (e) {
      await conn.rollback();
      console.error('RBAC syncCatalogToDb transaction error:', e);
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('RBAC catalog sync failed:', err);
  }
};

const getPermissionCatalog = async () => {
  if (!catalogSynced) {
    await syncCatalogToDb();
  }
  const [modules] = await db.execute(`SELECT id, code, name, display_order FROM modules ORDER BY display_order`);
  const [perms] = await db.execute(
    `SELECT p.id, p.code, p.description, p.module_id, a.code AS action_code, a.name AS action_name, a.is_special
     FROM permissions p
     JOIN actions a ON a.id = p.action_id
     ORDER BY p.module_id, a.is_special, a.id`
  );
  return modules.map((m) => ({
    ...m,
    group: groupByModuleCode[m.code] || 'Other',
    actions: perms.filter((p) => p.module_id === m.id),
  }));
};

/* ─────────────────────────────────────────────
   ROLES & PRIORITY
───────────────────────────────────────────── */

const listRoles = async () => {
  const [rows] = await db.execute(
    `SELECT r.id, r.name, r.description, r.priority, r.can_access_settings,
            r.staff_role_id, d.id AS department_id, d.name AS department_name,
            sr.is_doctor,
            (CASE
               WHEN r.staff_role_id IS NULL THEN 0
               WHEN sr.is_doctor = 1 THEN 1
               WHEN d.name IN ('Medical', 'Nursing', 'Nursing Training', 'Laboratory', 'Radiology & Scan', 'Security', 'House Keeping', 'Pharmacy') THEN 1
               ELSE 0
             END) AS is_clinical,
            (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
     FROM roles r
     LEFT JOIN staff_roles sr ON sr.id = r.staff_role_id
     LEFT JOIN departments d ON d.id = sr.department_id
     ORDER BY r.priority ASC, r.id ASC`
  );
  return rows;
};

const createRole = async ({ name, description, priority, can_access_settings = 0 }) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Role name is required');
  
  const [[existing]] = await db.execute(`SELECT id FROM roles WHERE LOWER(name) = LOWER(?)`, [trimmed]);
  if (existing) throw new Error(`A role named "${trimmed}" already exists`);

  const p = Number(priority) || 10;
  const [res] = await db.execute(
    `INSERT INTO roles (name, description, priority, can_access_settings) VALUES (?, ?, ?, ?)`,
    [trimmed, description?.trim() || null, p, can_access_settings ? 1 : 0]
  );
  return res.insertId;
};

const updateRole = async (id, { name, description, priority, can_access_settings }) => {
  const roleId = Number(id);
  const [[role]] = await db.execute(`SELECT id, name FROM roles WHERE id = ?`, [roleId]);
  if (!role) throw new Error('Role not found');

  if (roleId === 1 && name && name.trim().toLowerCase() !== 'administrator') {
    throw new Error('Administrator role name cannot be modified');
  }

  const fields = [];
  const vals = [];

  if (name !== undefined) {
    const trimmed = String(name || '').trim();
    if (!trimmed) throw new Error('Role name cannot be empty');
    const [[clash]] = await db.execute(`SELECT id FROM roles WHERE LOWER(name) = LOWER(?) AND id != ?`, [trimmed, roleId]);
    if (clash) throw new Error(`A role named "${trimmed}" already exists`);
    fields.push('name = ?');
    vals.push(trimmed);
  }

  if (description !== undefined) {
    fields.push('description = ?');
    vals.push(description ? description.trim() : null);
  }

  if (priority !== undefined) {
    fields.push('priority = ?');
    vals.push(Math.max(1, Number(priority) || 1));
  }

  if (can_access_settings !== undefined) {
    fields.push('can_access_settings = ?');
    vals.push(can_access_settings ? 1 : 0);
  }

  if (!fields.length) return;
  vals.push(roleId);

  await db.execute(`UPDATE roles SET ${fields.join(', ')} WHERE id = ?`, vals);
};

const deleteRole = async (id) => {
  const roleId = Number(id);
  if (roleId === 1) {
    throw new Error('Administrator role cannot be deleted');
  }

  const [[role]] = await db.execute(`SELECT id, name FROM roles WHERE id = ?`, [roleId]);
  if (!role) throw new Error('Role not found');

  const [[{ user_count }]] = await db.execute(`SELECT COUNT(*) AS user_count FROM users WHERE role_id = ?`, [roleId]);
  if (user_count > 0) {
    throw new Error(`Cannot delete role "${role.name}": ${user_count} user(s) are currently assigned to this role. Please reassign them first.`);
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);
    await conn.execute(`DELETE FROM roles WHERE id = ?`, [roleId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const updateRolePriorities = async (orderedIds) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < orderedIds.length; i++) {
      await conn.execute(`UPDATE roles SET priority = ? WHERE id = ?`, [i + 1, orderedIds[i]]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ─────────────────────────────────────────────
   ROLE PERMISSION MATRIX
───────────────────────────────────────────── */

const getRoleMatrix = async (roleId) => {
  const [rows] = await db.execute(
    `SELECT p.code, rp.skip_approval
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = ?`,
    [roleId]
  );
  const matrix = {};
  for (const r of rows) {
    matrix[r.code] = { granted: true, skip_approval: !!r.skip_approval };
  }
  return matrix;
};

/** entries: [{ code, granted, skip_approval }] — full replace for this role. */
const setRoleMatrix = async (roleId, entries) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);

    const granted = entries.filter((e) => e.granted);
    if (granted.length) {
      const [permRows] = await conn.query(
        `SELECT id, code FROM permissions WHERE code IN (${granted.map(() => '?').join(',')})`,
        granted.map((e) => e.code)
      );
      const idByCode = Object.fromEntries(permRows.map((p) => [p.code, p.id]));
      for (const e of granted) {
        const permId = idByCode[e.code];
        if (!permId) continue;
        await conn.execute(
          `INSERT INTO role_permissions (role_id, permission_id, skip_approval) VALUES (?, ?, ?)`,
          [roleId, permId, e.skip_approval ? 1 : 0]
        );
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** Same entries applied to several roles at once — the Role Permissions multi-select "Apply" action. */
const setRoleMatrixBulk = async (roleIds, entries) => {
  for (const roleId of roleIds) {
    await setRoleMatrix(roleId, entries);
  }
};

const hasSkipApproval = async (roleId, permissionCode) => {
  const [[row]] = await db.execute(
    `SELECT rp.skip_approval
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = ? AND p.code = ?`,
    [roleId, permissionCode]
  );
  return !!row?.skip_approval;
};

/* ─────────────────────────────────────────────
   SETTINGS ACCESS
───────────────────────────────────────────── */

const getSettingsAccessRoles = async () => {
  const [rows] = await db.execute(`SELECT id, name, description, can_access_settings FROM roles ORDER BY priority ASC, id ASC`);
  return rows;
};

const setSettingsAccessRoles = async (roleIds) => {
  await db.execute(`UPDATE roles SET can_access_settings = 0`);
  if (roleIds.length) {
    await db.query(`UPDATE roles SET can_access_settings = 1 WHERE id IN (${roleIds.map(() => '?').join(',')})`, roleIds);
  }
};

/* ─────────────────────────────────────────────
   APPROVAL WORKFLOWS (config)
───────────────────────────────────────────── */

const listApprovalWorkflows = async () => {
  const [rows] = await db.execute(
    `SELECT aw.*, p.description AS permission_description, m.name AS module_name
     FROM approval_workflows aw
     JOIN permissions p ON p.code = aw.permission_code
     JOIN modules m ON m.id = p.module_id
     ORDER BY m.display_order, aw.permission_code`
  );
  return rows;
};

const getApprovalWorkflow = async (permissionCode) => {
  const [[row]] = await db.execute(`SELECT * FROM approval_workflows WHERE permission_code = ?`, [permissionCode]);
  return row ?? null;
};

const upsertApprovalWorkflow = async (permissionCode, data) => {
  const {
    enabled, level1_type, level1_role_id, level1_user_id,
    level2_enabled, level2_type, level2_role_id, level2_user_id,
  } = data;
  await db.execute(
    `UPDATE approval_workflows SET
       enabled = ?, level1_type = ?, level1_role_id = ?, level1_user_id = ?,
       level2_enabled = ?, level2_type = ?, level2_role_id = ?, level2_user_id = ?
     WHERE permission_code = ?`,
    [
      enabled ? 1 : 0, level1_type || 'role', level1_type === 'role' ? (level1_role_id || null) : null, level1_type === 'user' ? (level1_user_id || null) : null,
      level2_enabled ? 1 : 0, level2_type || 'role', level2_type === 'role' ? (level2_role_id || null) : null, level2_type === 'user' ? (level2_user_id || null) : null,
      permissionCode,
    ]
  );
};

/* ─────────────────────────────────────────────
   PENDING APPROVALS
───────────────────────────────────────────── */

const createPendingApproval = async (data) => {
  const { permission_code, requested_by, method, original_url, params, body, query } = data;
  const [[perm]] = await db.execute(`SELECT description FROM permissions WHERE code = ?`, [permission_code]);
  const [result] = await db.execute(
    `INSERT INTO pending_approvals (permission_code, action_label, requested_by, method, original_url, params_json, body_json, query_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [permission_code, perm?.description ?? permission_code, requested_by, method, original_url,
      JSON.stringify(params ?? {}), JSON.stringify(body ?? {}), JSON.stringify(query ?? {})]
  );
  return result.insertId;
};

const getPendingApproval = async (id) => {
  const [[row]] = await db.execute(`SELECT * FROM pending_approvals WHERE id = ?`, [id]);
  return row ?? null;
};

/** Approvals awaiting THIS user's action at their current level (by role or by specific user). */
const listApprovalsForApprover = async (user) => {
  const [rows] = await db.execute(
    `SELECT pa.*, u.username AS requested_by_username, u.email AS requested_by_email
     FROM pending_approvals pa
     JOIN users u ON u.id = pa.requested_by
     JOIN approval_workflows aw ON aw.permission_code = pa.permission_code
     WHERE
       (pa.status = 'pending_level1' AND (
         (aw.level1_type = 'role' AND aw.level1_role_id = ?) OR
         (aw.level1_type = 'user' AND aw.level1_user_id = ?)
       ))
       OR
       (pa.status = 'pending_level2' AND (
         (aw.level2_type = 'role' AND aw.level2_role_id = ?) OR
         (aw.level2_type = 'user' AND aw.level2_user_id = ?)
       ))
     ORDER BY pa.created_at DESC`,
    [user.role_id, user.id, user.role_id, user.id]
  );
  return rows;
};

const listAllPendingApprovals = async (status) => {
  const params = [];
  let where = '';
  if (status) { where = 'WHERE pa.status = ?'; params.push(status); }
  const [rows] = await db.execute(
    `SELECT pa.*, u.username AS requested_by_username
     FROM pending_approvals pa
     JOIN users u ON u.id = pa.requested_by
     ${where}
     ORDER BY pa.created_at DESC`,
    params
  );
  return rows;
};

const markLevel1Approved = async (id, approverId) => {
  await db.execute(
    `UPDATE pending_approvals SET level1_approved_by = ?, level1_approved_at = NOW(), status = 'pending_level2' WHERE id = ?`,
    [approverId, id]
  );
};

const markLevel2Approved = async (id, approverId) => {
  await db.execute(
    `UPDATE pending_approvals SET level2_approved_by = ?, level2_approved_at = NOW() WHERE id = ?`,
    [approverId, id]
  );
};

const markResolved = async (id, { status, result, error }) => {
  await db.execute(
    `UPDATE pending_approvals SET status = ?, result_json = ?, error_message = ?, resolved_at = NOW() WHERE id = ?`,
    [status, result ? JSON.stringify(result) : null, error ?? null, id]
  );
};

const markRejected = async (id, rejectedBy, reason) => {
  await db.execute(
    `UPDATE pending_approvals SET status = 'rejected', rejected_by = ?, rejected_at = NOW(), rejection_reason = ?, resolved_at = NOW() WHERE id = ?`,
    [rejectedBy, reason ?? null, id]
  );
};

const getUserById = async (id) => {
  const [[row]] = await db.execute(
    `SELECT u.*, r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    [id]
  );
  return row ?? null;
};

module.exports = {
  getPermissionCatalog,
  listRoles, createRole, updateRole, deleteRole, updateRolePriorities,
  getRoleMatrix, setRoleMatrix, setRoleMatrixBulk, hasSkipApproval,
  getSettingsAccessRoles, setSettingsAccessRoles,
  listApprovalWorkflows, getApprovalWorkflow, upsertApprovalWorkflow,
  createPendingApproval, getPendingApproval,
  listApprovalsForApprover, listAllPendingApprovals,
  markLevel1Approved, markLevel2Approved, markResolved, markRejected,
  getUserById,
};
