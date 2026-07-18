const q = require('./roster.queries');

const getRoster = async (month, year, departmentId, staffRoleId) => {
  return q.getEmployeeShifts(month, year, departmentId, staffRoleId);
};

const getEmployeesForRoster = async (departmentId, staffRoleId) => {
  return q.getEmployeesByDeptAndRole(departmentId, staffRoleId);
};

const saveRosterDay = async (data) => {
  await q.upsertEmployeeShift(
    data.employee_id,
    data.shift_date,
    data.shift_id,
    data.is_week_off,
    data.is_night_duty
  );
};

const bulkSaveRoster = async (rows) => {
  await q.bulkUpsertShifts(rows);
};

module.exports = {
  getRoster,
  getEmployeesForRoster,
  saveRosterDay,
  bulkSaveRoster,
};
