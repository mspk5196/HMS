const db = require('../../config/db');

/** Ensure Day and Night shifts exist in the database and return their IDs */
const ensureDefaultShifts = async () => {
  // Check if Day Shift exists
  const [dayShifts] = await db.execute("SELECT id FROM shifts WHERE name = 'Day Shift' OR name = 'Day'");
  let dayShiftId;
  if (!dayShifts.length) {
    const [res] = await db.execute(
      `INSERT INTO shifts (name, start_time, end_time, crosses_midnight, buffer_minutes, is_night_shift, is_active)
       VALUES ('Day Shift', '09:00:00', '18:00:00', 0, 10, 0, 1)`
    );
    dayShiftId = res.insertId;
  } else {
    dayShiftId = dayShifts[0].id;
  }

  // Check if Night Shift exists
  const [nightShifts] = await db.execute("SELECT id FROM shifts WHERE name = 'Night Shift' OR name = 'Night'");
  let nightShiftId;
  if (!nightShifts.length) {
    const [res] = await db.execute(
      `INSERT INTO shifts (name, start_time, end_time, crosses_midnight, buffer_minutes, is_night_shift, is_active)
       VALUES ('Night Shift', '22:00:00', '06:00:00', 1, 10, 1, 1)`
    );
    nightShiftId = res.insertId;
  } else {
    nightShiftId = nightShifts[0].id;
  }

  return { dayShiftId, nightShiftId };
};

/** Get roster entries for a month, optionally filtered by dept/staffRole */
const getEmployeeShifts = async (month, year, departmentId, staffRoleId) => {
  let query = `
    SELECT re.employee_id, re.roster_date, re.shift_id, re.is_week_off,
           s.name AS shift_name, s.is_night_shift,
           e.full_name, e.employee_code,
           d.name AS department_name, sr.name AS role_name
    FROM roster_entries re
    JOIN employees e ON e.id = re.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN staff_roles sr ON sr.id = e.designation_id
    LEFT JOIN shifts s ON s.id = re.shift_id
    WHERE MONTH(re.roster_date) = ? AND YEAR(re.roster_date) = ?
  `;
  const params = [month, year];

  if (departmentId) {
    query += ` AND e.department_id = ?`;
    params.push(departmentId);
  }
  if (staffRoleId) {
    query += ` AND e.designation_id = ?`;
    params.push(staffRoleId);
  }

  query += ` ORDER BY e.full_name, re.roster_date`;
  const [rows] = await db.execute(query, params);
  return rows;
};

/** Get all employees for a given dept + staffRole (for building the roster grid) */
const getEmployeesByDeptAndRole = async (departmentId, staffRoleId) => {
  const filters = ['e.status = \'active\''];
  const params = [];

  if (departmentId) {
    filters.push('e.department_id = ?');
    params.push(departmentId);
  }
  if (staffRoleId) {
    filters.push('e.designation_id = ?');
    params.push(staffRoleId);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.execute(
    `SELECT e.id AS employee_id, e.full_name, e.employee_code,
            d.name AS department_name, sr.name AS role_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     ${where}
     ORDER BY e.full_name`,
    params
  );
  return rows;
};

const upsertEmployeeShift = async (employee_id, shift_date, shift_id, is_week_off, is_night_duty) => {
  const { dayShiftId, nightShiftId } = await ensureDefaultShifts();
  const finalShiftId = is_week_off ? null : (is_night_duty ? nightShiftId : dayShiftId);
  
  await db.execute(
    `INSERT INTO roster_entries (employee_id, roster_date, shift_id, is_week_off, is_holiday, is_manual_override)
     VALUES (?, ?, ?, ?, 0, 1)
     ON DUPLICATE KEY UPDATE
       shift_id           = VALUES(shift_id),
       is_week_off        = VALUES(is_week_off),
       is_manual_override = 1`,
    [employee_id, shift_date, finalShiftId, is_week_off ? 1 : 0]
  );
};

/**
 * Bulk upsert roster entries.
 * rows: [{ employee_id, shift_date, shift_type }]  where shift_type is 'day' | 'night' | 'wo' | ''
 */
const bulkUpsertShifts = async (rows) => {
  if (!rows.length) return;
  const { dayShiftId, nightShiftId } = await ensureDefaultShifts();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of rows) {
      const is_week_off = r.shift_type === 'wo' ? 1 : 0;
      let shift_id = null;
      if (r.shift_type === 'day') {
        shift_id = dayShiftId;
      } else if (r.shift_type === 'night') {
        shift_id = nightShiftId;
      }

      await conn.execute(
        `INSERT INTO roster_entries (employee_id, roster_date, shift_id, is_week_off, is_holiday, is_manual_override)
         VALUES (?, ?, ?, ?, 0, 1)
         ON DUPLICATE KEY UPDATE
           shift_id           = VALUES(shift_id),
           is_week_off        = VALUES(is_week_off),
           is_manual_override = 1`,
        [r.employee_id, r.shift_date, shift_id, is_week_off]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  getEmployeeShifts,
  getEmployeesByDeptAndRole,
  upsertEmployeeShift,
  bulkUpsertShifts,
};
