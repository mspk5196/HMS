const q = require('./hr.queries');
const { AppError } = require('../../utils/errors');

const createEmployee = async (data) => {
  if (!data.employee_code || !data.full_name || !data.gender || !data.dob || !data.date_of_joining || !data.department_id || !data.designation_id) {
    throw new AppError('employee_code, full_name, gender, dob, date_of_joining, department_id, and designation_id are required', 400);
  }
  return q.createEmployee(data);
};

const updateEmployee = async (id, data) => {
  const emp = await q.getEmployee(id);
  if (!emp) throw new AppError('Employee not found', 404);
  await q.updateEmployee(id, data);
};

const createShift = async (data) => {
  if (!data.name || !data.start_time || !data.end_time) {
    throw new AppError('name, start_time, and end_time are required', 400);
  }
  return q.createShift(data);
};

const updateShift = async (id, data) => {
  await q.updateShift(id, data);
};

const createDepartment = async (data) => {
  if (!data.name) throw new AppError('Department name is required', 400);
  return q.createDepartment(data);
};

const createDesignation = async (data) => {
  if (!data.name) throw new AppError('Designation name is required', 400);
  return q.createDesignation(data);
};

const createRole = async (data) => {
  if (!data.name) throw new AppError('Role name is required', 400);
  return q.createRole(data);
};

module.exports = {
  createEmployee, updateEmployee,
  createShift, updateShift,
  createDepartment, createDesignation, createRole,
  // Pass-through
  listEmployees: q.listEmployees,
  getEmployee: q.getEmployee,
  listDepartments: q.listDepartments,
  listDesignations: q.listDesignations,
  listRoles: q.listRoles,
  listShifts: q.listShifts,
};
