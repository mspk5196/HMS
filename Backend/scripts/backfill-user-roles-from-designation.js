const db = require('../src/config/db');

/**
 * One-time backfill: any login created before the auto-derive-role fix may
 * still be pinned to the baseline "Staff" role even though its employee's
 * designation now has a properly mirrored role. Move those logins over.
 */
async function backfill() {
  try {
    const [rows] = await db.query(
      `SELECT u.id AS user_id, u.username, u.role_id AS current_role_id,
              r_target.id AS target_role_id, r_target.name AS target_role_name,
              r_current.name AS current_role_name
       FROM users u
       JOIN employees e ON e.id = u.employee_id
       JOIN roles r_target ON r_target.staff_role_id = e.designation_id
       LEFT JOIN roles r_current ON r_current.id = u.role_id
       WHERE u.role_id != r_target.id`
    );

    if (!rows.length) {
      console.log('Nothing to backfill — every login already matches its employee designation.');
      process.exit(0);
    }

    for (const row of rows) {
      await db.query(`UPDATE users SET role_id = ? WHERE id = ?`, [row.target_role_id, row.user_id]);
      console.log(`✅ ${row.username}: ${row.current_role_name ?? row.current_role_id} → ${row.target_role_name}`);
    }

    console.log(`Backfilled ${rows.length} login(s).`);
    process.exit(0);
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  }
}

backfill();
