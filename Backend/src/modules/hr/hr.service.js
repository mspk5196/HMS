const q = require('./hr.queries');
const { AppError } = require('../../utils/errors');

const VALID_SHIFT_CATEGORIES = ['day', 'night', 'day_and_night', 'general'];

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

  if (data.shift_category && !VALID_SHIFT_CATEGORIES.includes(data.shift_category)) {
    throw new AppError(`shift_category must be one of: ${VALID_SHIFT_CATEGORIES.join(', ')}`, 400);
  }

  return q.createEmployee({ ...data, employee_code: code });
};

const updateEmployee = async (id, data, userId = null) => {
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

  if (data.shift_category !== undefined && data.shift_category !== null && data.shift_category !== '') {
    if (!VALID_SHIFT_CATEGORIES.includes(data.shift_category)) {
      throw new AppError(`shift_category must be one of: ${VALID_SHIFT_CATEGORIES.join(', ')}`, 400);
    }
  }

  const auditEntries = [];

  // 1. Track payment mode change
  if (data.payment_mode !== undefined && data.payment_mode !== null) {
    const oldMode = emp.payment_mode || 'account';
    const newMode = data.payment_mode;
    if (oldMode !== newMode) {
      auditEntries.push({
        employeeId: id,
        changeType: 'payment_mode',
        fieldName: 'payment_mode',
        oldValue: oldMode,
        newValue: newMode,
        notes: `Payment mode changed from ${oldMode === 'cash' ? 'Cash' : 'Bank Account'} to ${newMode === 'cash' ? 'Cash' : 'Bank Account'}`,
        changedBy: userId,
      });
    }
  }

  // 2. Track Profile & Bank updates
  const trackedFields = [
    { field: 'full_name', label: 'Full Name', type: 'profile_update' },
    { field: 'phone', label: 'Phone', type: 'profile_update' },
    { field: 'address', label: 'Address', type: 'profile_update' },
    { field: 'gender', label: 'Gender', type: 'profile_update' },
    { field: 'qualification', label: 'Qualification', type: 'profile_update' },
    { field: 'experience_description', label: 'Experience Description', type: 'profile_update' },
    { field: 'status', label: 'Status', type: 'status_change' },
    { field: 'bank_account_no', label: 'Bank Account No', type: 'bank_details' },
    { field: 'bank_name', label: 'Bank Name', type: 'bank_details' },
    { field: 'bank_ifsc', label: 'Bank IFSC', type: 'bank_details' },
    { field: 'uan_number', label: 'UAN Number', type: 'profile_update' },
    { field: 'esi_number', label: 'ESI Number', type: 'profile_update' },
    { field: 'pf_enrolled', label: 'PF Enrolled', type: 'profile_update', isBool: true },
    { field: 'esi_enrolled', label: 'ESI Enrolled', type: 'profile_update', isBool: true },
    { field: 'shift_category', label: 'Shift Category', type: 'profile_update' },
    { field: 'custom_shift_start', label: 'Shift Start Time', type: 'profile_update' },
    { field: 'custom_shift_end', label: 'Shift End Time', type: 'profile_update' },
    { field: 'custom_buffer_minutes', label: 'Grace Buffer Mins', type: 'profile_update' },
    { field: 'aadhar_number', label: 'Aadhar Card No', type: 'profile_update' },
    { field: 'pan_number', label: 'PAN Card No', type: 'profile_update' },
  ];

  for (const { field, label, type, isBool } of trackedFields) {
    if (data[field] !== undefined) {
      const oldVal = isBool ? (emp[field] ? 'Yes' : 'No') : String(emp[field] ?? '').trim();
      const newVal = isBool ? (Boolean(data[field] === '1' || data[field] === 1 || data[field] === true || data[field] === 'true') ? 'Yes' : 'No') : String(data[field] ?? '').trim();
      if (oldVal !== newVal) {
        auditEntries.push({
          employeeId: id,
          changeType: type,
          fieldName: field,
          oldValue: oldVal || null,
          newValue: newVal || null,
          notes: `${label} updated`,
          changedBy: userId,
        });
      }
    }
  }

  await q.updateEmployee(id, data);

  if (auditEntries.length > 0) {
    try {
      await q.createEmployeeAuditLogsBatch(auditEntries);
    } catch (e) {
      console.error('Failed to write employee audit logs:', e.message);
    }
  }
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

const updateShiftTimings = async (data) => {
  return q.updateShiftTimings(data);
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

/* ─── SHIFT OVERRIDES ─── */

const upsertShiftOverride = async (employeeId, data, userId) => {
  const { override_date, start_time, end_time, note } = data;
  if (!override_date || !start_time || !end_time) {
    throw new AppError('override_date, start_time, and end_time are required', 400);
  }
  const emp = await q.getEmployee(employeeId);
  if (!emp) throw new AppError('Employee not found', 404);

  await q.upsertShiftOverride({ employee_id: employeeId, override_date, start_time, end_time, note, created_by: userId });
  return { employee_id: employeeId, override_date, start_time, end_time };
};

const listShiftOverrides = async (employeeId) => {
  const emp = await q.getEmployee(employeeId);
  if (!emp) throw new AppError('Employee not found', 404);
  return q.listShiftOverrides(employeeId);
};

const deleteShiftOverride = async (employeeId, overrideDate) => {
  const affected = await q.deleteShiftOverride(employeeId, overrideDate);
  if (!affected) throw new AppError('No override found for this date', 404);
};

module.exports = {
  createEmployee, updateEmployee,
  bulkImportEmployees: q.bulkImportEmployees,
  createShift, updateShift, updateShiftTimings, deleteShift,
  createDepartment, updateDepartment, deleteDepartment,
  createDesignation, createRole,
  createStaffRole, updateStaffRole, deleteStaffRole,
  remapEmployee, updateEmployeeSalary,
  upsertShiftOverride, listShiftOverrides, deleteShiftOverride,
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
  listEmployeeAuditLogs: q.listEmployeeAuditLogs,
  listEmployeePayoutLogs: q.listEmployeePayoutLogs,
};
