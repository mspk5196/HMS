const db = require('../../config/db');

const getEmployeeShifts = async (month, year, departmentId) => {
  let query = `
    SELECT es.*, e.full_name, s.name AS shift_name, s.start_time, s.end_time 
    FROM employee_shifts es
    JOIN employees e ON e.id = es.employee_id
    LEFT JOIN shifts s ON s.id = es.shift_id
    WHERE MONTH(es.shift_date) = ? AND YEAR(es.shift_date) = ?
  `;
  const params = [month, year];
  
  if (departmentId) {
    query += ` AND e.department_id = ?`;
    params.push(departmentId);
  }
  
  const [rows] = await db.execute(query, params);
  return rows;
};

const upsertEmployeeShift = async (employee_id, shift_date, shift_id, is_week_off, is_night_duty) => {
  await db.execute(
    `INSERT INTO employee_shifts (employee_id, shift_date, shift_id, is_week_off, is_night_duty)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       shift_id = VALUES(shift_id), 
       is_week_off = VALUES(is_week_off), 
       is_night_duty = VALUES(is_night_duty)`,
    [employee_id, shift_date, shift_id || null, is_week_off ? 1 : 0, is_night_duty ? 1 : 0]
  );
};

module.exports = {
  getEmployeeShifts,
  upsertEmployeeShift
};
