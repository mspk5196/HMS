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

const deleteShift = async (id) => {
  const inUse = await q.isShiftInUse(id);
  if (inUse) {
    throw new AppError('Cannot delete shift: it is in use by employee roster or daily attendance.', 400);
  }
  await q.deleteShift(id);
};

const createDepartment = async (data) => {
  if (!data.name) throw new AppError('Department name is required', 400);
  return q.createDepartment(data);
};

const updateDepartment = async (id, data) => {
  if (data.name === '') throw new AppError('Department name cannot be empty', 400);
  await q.updateDepartment(id, data);
};

const deleteDepartment = async (id) => {
  const empCount = await q.countEmployeesInDepartment(id);
  if (empCount > 0) {
    throw new AppError(`Cannot delete department: ${empCount} employee(s) are assigned to it.`, 400);
  }
  await q.deleteDepartment(id);
};

const createDesignation = async (data) => {
  if (!data.name) throw new AppError('Designation name is required', 400);
  return q.createDesignation(data);
};

const createRole = async (data) => {
  if (!data.name) throw new AppError('Role name is required', 400);
  return q.createRole(data);
};

// Staff Roles
const createStaffRole = async (data) => {
  if (!data.department_id || !data.name) {
    throw new AppError('department_id and name are required', 400);
  }
  return q.createStaffRole(data);
};

const updateStaffRole = async (id, data) => {
  const role = await q.getStaffRole(id);
  if (!role) throw new AppError('Staff role not found', 404);
  await q.updateStaffRole(id, data);
};

const deleteStaffRole = async (id) => {
  const role = await q.getStaffRole(id);
  if (!role) throw new AppError('Staff role not found', 404);
  const empCount = await q.countEmployeesWithStaffRole(role.name, role.department_id);
  if (empCount > 0) {
    throw new AppError(`Cannot delete role: ${empCount} employee(s) are assigned to it.`, 400);
  }
  await q.deleteStaffRole(id);
};

module.exports = {
  createEmployee, updateEmployee,
  createShift, updateShift, deleteShift,
  createDepartment, updateDepartment, deleteDepartment,
  createDesignation, createRole,
  createStaffRole, updateStaffRole, deleteStaffRole,
  // Pass-through
  listEmployees: q.listEmployees,
  getEmployee: q.getEmployee,
  listDepartments: q.listDepartments,
  listDesignations: q.listDesignations,
  listRoles: q.listRoles,
  listShifts: q.listShifts,
  listStaffRoles: q.listStaffRoles,
  getStaffRole: q.getStaffRole,
};
