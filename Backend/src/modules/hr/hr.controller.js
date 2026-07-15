const svc = require('./hr.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created, paginated, fail } = require('../../utils/response');

const listEmployees = asyncHandler(async (req, res) => {
  const { search, departmentId, status, page = 1, limit = 50 } = req.query;
  const result = await svc.listEmployees({
    search: search || null,
    departmentId: departmentId ? Number(departmentId) : null,
    status: status !== undefined ? Number(status) : null,
    page: Number(page),
    limit: Number(limit)
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

const getEmployee = asyncHandler(async (req, res) => {
  const emp = await svc.getEmployee(Number(req.params.id));
  if (!emp) return res.status(404).json(fail('Employee not found'));
  return res.json(success(emp));
});

const createEmployee = asyncHandler(async (req, res) => {
  const id = await svc.createEmployee(req.body);
  return res.status(201).json(created({ id }, 'Employee created'));
});

const updateEmployee = asyncHandler(async (req, res) => {
  await svc.updateEmployee(Number(req.params.id), req.body);
  return res.json(success(null, 'Employee updated'));
});

const listDepartments = asyncHandler(async (req, res) => {
  return res.json(success(await svc.listDepartments()));
});

const listDesignations = asyncHandler(async (req, res) => {
  return res.json(success(await svc.listDesignations()));
});

const listRoles = asyncHandler(async (req, res) => {
  return res.json(success(await svc.listRoles()));
});

const listShifts = asyncHandler(async (req, res) => {
  return res.json(success(await svc.listShifts()));
});

const createShift = asyncHandler(async (req, res) => {
  const id = await svc.createShift(req.body);
  return res.status(201).json(created({ id }, 'Shift created'));
});

const updateShift = asyncHandler(async (req, res) => {
  await svc.updateShift(Number(req.params.id), req.body);
  return res.json(success(null, 'Shift updated'));
});

module.exports = {
  listEmployees, getEmployee, createEmployee, updateEmployee,
  listDepartments, listDesignations, listRoles,
  listShifts, createShift, updateShift,
};
