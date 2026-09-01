const q = require('./hr.queries');
const { AppError } = require('../../utils/errors');

const createEmployee = async (data) => {
  if (!data.employee_code || !data.full_name || !data.date_of_joining || !data.department_id || !data.designation_id) {
    throw new AppError('employee_code, full_name, date_of_joining, department_id, and designation_id are required', 400);
  }

  // employee_code is the join key for every biometric punch, so a collision is a
  // real conflict rather than something to auto-resolve. Check up front to give a
  // usable message instead of a bare duplicate-key error.
  const code = String(data.employee_code).trim();
  if (!code) throw new AppError('employee_code cannot be blank', 400);

  const existing = await q.getEmployeeByCode(code);
  if (existing) {
    throw new AppError(
      `Employee code "${code}" is already used by ${existing.full_name}.`,
      409
    );
  }

  return q.createEmployee({ ...data, employee_code: code });
};

const updateEmployee = async (id, data) => {
  const emp = await q.getEmployee(id);
  if (!emp) throw new AppError('Employee not found', 404);

  if (data.employee_code !== undefined) {
    const code = String(data.employee_code).trim();
    if (!code) throw new AppError('employee_code cannot be blank', 400);
    if (code !== emp.employee_code) {
      const clash = await q.getEmployeeByCode(code);
      if (clash) {
        throw new AppError(`Employee code "${code}" is already used by ${clash.full_name}.`, 409);
      }
    }
    data = { ...data, employee_code: code };
  }

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

const remapEmployee = async (data, userId) => {
  if (!data.employee_id || !data.to_department_id || !data.to_role_id || !data.from_date) {
    throw new AppError('employee_id, to_department_id, to_role_id, and from_date are required', 400);
  }
  await q.remapEmployee(data, userId);
};

const updateEmployeeSalary = async (employeeId, data, userId) => {
  if (!data.effective_from) {
    throw new AppError('effective_from date is required', 400);
  }
  await q.updateEmployeeSalary(employeeId, data, userId);
};

module.exports = {
  createEmployee, updateEmployee,
  bulkImportEmployees: q.bulkImportEmployees,
  createShift, updateShift, deleteShift,
  createDepartment, updateDepartment, deleteDepartment,
  createDesignation, createRole,
  createStaffRole, updateStaffRole, deleteStaffRole,
  remapEmployee, updateEmployeeSalary,
  // Pass-through
  listEmployees: q.listEmployees,
  listDoctors: q.listDoctors,
  getEmployee: q.getEmployee,
  listDepartments: q.listDepartments,
  listDesignations: q.listDesignations,
  listRoles: q.listRoles,
  listShifts: q.listShifts,
  listStaffRoles: q.listStaffRoles,
  getStaffRole: q.getStaffRole,
  listRemappingLogs: q.listRemappingLogs,
  listSalaryLogs: q.listSalaryLogs,
};
