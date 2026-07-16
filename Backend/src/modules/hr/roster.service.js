const q = require('./roster.queries');

const getRoster = async (month, year, departmentId) => {
  return q.getEmployeeShifts(month, year, departmentId);
};

const saveRosterDay = async (data) => {
  await q.upsertEmployeeShift(data.employee_id, data.shift_date, data.shift_id, data.is_week_off, data.is_night_duty);
};

module.exports = {
  getRoster, saveRosterDay
};
