/**
 * salary.queries.js
 * All raw SQL for the Salary / Payroll module.
 */

const db = require('../../config/db');

/* ─────────────────────────────────────────────
   SALARY STRUCTURES
───────────────────────────────────────────── */

const listSalaryStructures = async () => {
  const [rows] = await db.execute(
    `SELECT ss.*, d.name AS designation_name
     FROM salary_structures ss
     LEFT JOIN designations d ON d.id = ss.designation_id
     ORDER BY d.name, ss.salary_type`
  );
  return rows;
};

const getSalaryStructure = async (id) => {
  const [rows] = await db.execute(`SELECT * FROM salary_structures WHERE id = ?`, [id]);
  return rows[0] ?? null;
};

/** Return the effective salary structure for an employee (by designation or direct override). */
const getEmployeeSalaryStructure = async (employeeId) => {
  const [rows] = await db.execute(
    `SELECT ss.*
     FROM salary_structures ss
     JOIN employees e ON e.designation_id = ss.designation_id
     WHERE e.id = ?
     LIMIT 1`,
    [employeeId]
  );
  return rows[0] ?? null;
};

const createSalaryStructure = async (data) => {
  const { designation_id, salary_type, gross_monthly, rate_per_day, rate_per_shift, base_salary, night_shift_extra_amount, pf_percent, esi_percent } = data;
  const [result] = await db.execute(
    `INSERT INTO salary_structures
       (designation_id, salary_type, gross_monthly, rate_per_day, rate_per_shift,
        base_salary, night_shift_extra_amount, pf_percent, esi_percent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [designation_id, salary_type, gross_monthly ?? null, rate_per_day ?? null,
     rate_per_shift ?? null, base_salary ?? null, night_shift_extra_amount ?? 0,
     pf_percent ?? 12, esi_percent ?? 0.75]
  );
  return result.insertId;
};

const updateSalaryStructure = async (id, data) => {
  const fields = [];
  const vals = [];
  const allowed = ['gross_monthly', 'rate_per_day', 'rate_per_shift', 'base_salary',
    'night_shift_extra_amount', 'pf_percent', 'esi_percent'];
  for (const key of allowed) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); vals.push(data[key]); }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE salary_structures SET ${fields.join(', ')} WHERE id = ?`, vals);
};

/* ─────────────────────────────────────────────
   SHIFT RATE HISTORY (night-shift flat rate)
───────────────────────────────────────────── */

/** Get the active night-shift flat rate for a shift on a given date. */
const getNightShiftRate = async (shiftId, onDate) => {
  const [rows] = await db.execute(
    `SELECT night_rate_amount FROM shift_rate_history
     WHERE shift_id = ?
       AND effective_from <= ?
       AND (effective_to IS NULL OR effective_to >= ?)
     ORDER BY effective_from DESC
     LIMIT 1`,
    [shiftId, onDate, onDate]
  );
  return rows[0]?.night_rate_amount ?? 0;
};

/** Add a new night-shift rate (closes the previous active one). */
const addNightShiftRate = async ({ shift_id, night_rate_amount, effective_from, reason, changed_by }) => {
  // Close current active rate
  await db.execute(
    `UPDATE shift_rate_history
     SET effective_to = DATE_SUB(?, INTERVAL 1 DAY)
     WHERE shift_id = ? AND effective_to IS NULL`,
    [effective_from, shift_id]
  );
  // Insert new
  const [result] = await db.execute(
    `INSERT INTO shift_rate_history (shift_id, night_rate_amount, effective_from, reason, changed_by)
     VALUES (?, ?, ?, ?, ?)`,
    [shift_id, night_rate_amount, effective_from, reason ?? null, changed_by ?? null]
  );
  return result.insertId;
};

const listNightShiftRates = async (shiftId) => {
  const [rows] = await db.execute(
    `SELECT srh.*, s.name AS shift_name, u.username AS changed_by_name
     FROM shift_rate_history srh
     JOIN shifts s ON s.id = srh.shift_id
     LEFT JOIN users u ON u.id = srh.changed_by
     WHERE srh.shift_id = ?
     ORDER BY srh.effective_from DESC`,
    [shiftId]
  );
  return rows;
};

/* ─────────────────────────────────────────────
   PAYROLL RUNS
───────────────────────────────────────────── */

const listPayrollRuns = async (page = 1, limit = 12) => {
  const offset = (page - 1) * limit;
  const [rows] = await db.execute(
    `SELECT pr.*, u.username AS created_by_name, c.username AS confirmed_by_name
     FROM payroll_runs pr
     LEFT JOIN users u ON u.id = pr.created_by
     LEFT JOIN users c ON c.id = pr.confirmed_by
     ORDER BY pr.pay_year DESC, pr.pay_month DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM payroll_runs`);
  return { rows, total };
};

const getPayrollRun = async (id) => {
  const [rows] = await db.execute(
    `SELECT pr.*, u.username AS created_by_name
     FROM payroll_runs pr
     LEFT JOIN users u ON u.id = pr.created_by
     WHERE pr.id = ?`,
    [id]
  );
  return rows[0] ?? null;
};

const createPayrollRun = async ({ pay_month, pay_year, salary_date_type, salary_date, created_by }) => {
  const [result] = await db.execute(
    `INSERT INTO payroll_runs (pay_month, pay_year, status, salary_date_type, salary_date, created_by)
     VALUES (?, ?, 'draft', ?, ?, ?)`,
    [pay_month, pay_year, salary_date_type, salary_date ?? null, created_by ?? null]
  );
  return result.insertId;
};

const updatePayrollRunStatus = async (id, status) => {
  await db.execute(`UPDATE payroll_runs SET status = ? WHERE id = ?`, [status, id]);
};

const confirmPayrollRun = async (id, confirmedBy) => {
  await db.execute(
    `UPDATE payroll_runs SET status = 'locked', confirmed_by = ?, confirmed_at = NOW() WHERE id = ?`,
    [confirmedBy, id]
  );
};

/* ─────────────────────────────────────────────
   PAYROLL ITEMS (per-employee lines)
───────────────────────────────────────────── */

const getPayrollItems = async (runId, page = 1, limit = 100) => {
  const offset = (page - 1) * limit;
  const [rows] = await db.execute(
    `SELECT pi.*, e.full_name, e.employee_code,
            d.name AS department_name, des.name AS designation_name
     FROM payroll_items pi
     JOIN employees e ON e.id = pi.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN designations des ON des.id = e.designation_id
     WHERE pi.payroll_run_id = ?
     ORDER BY e.full_name
     LIMIT ? OFFSET ?`,
    [runId, limit, offset]
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM payroll_items WHERE payroll_run_id = ?`, [runId]
  );
  return { rows, total };
};

const upsertPayrollItem = async (data) => {
  const {
    payroll_run_id, employee_id, salary_structure_id,
    days_present, days_absent, days_half, days_lop,
    shifts_worked, base_salary_component, night_shift_component, buffer_late_deduction,
    gross_pay, lop_amount, overtime_amount,
    pf_employee_amount, pf_employer_amount, esi_employee_amount, esi_employer_amount,
    fines_amount, net_pay,
  } = data;

  await db.execute(
    `INSERT INTO payroll_items
       (payroll_run_id, employee_id, salary_structure_id,
        days_present, days_absent, days_half, days_lop,
        shifts_worked, base_salary_component, night_shift_component, buffer_late_deduction,
        gross_pay, lop_amount, overtime_amount,
        pf_employee_amount, pf_employer_amount, esi_employee_amount, esi_employer_amount,
        fines_amount, net_pay)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       salary_structure_id = VALUES(salary_structure_id),
       days_present = VALUES(days_present),
       days_absent = VALUES(days_absent),
       days_half = VALUES(days_half),
       days_lop = VALUES(days_lop),
       shifts_worked = VALUES(shifts_worked),
       base_salary_component = VALUES(base_salary_component),
       night_shift_component = VALUES(night_shift_component),
       buffer_late_deduction = VALUES(buffer_late_deduction),
       gross_pay = VALUES(gross_pay),
       lop_amount = VALUES(lop_amount),
       overtime_amount = VALUES(overtime_amount),
       pf_employee_amount = VALUES(pf_employee_amount),
       pf_employer_amount = VALUES(pf_employer_amount),
       esi_employee_amount = VALUES(esi_employee_amount),
       esi_employer_amount = VALUES(esi_employer_amount),
       fines_amount = VALUES(fines_amount),
       net_pay = VALUES(net_pay)`,
    [payroll_run_id, employee_id, salary_structure_id ?? null,
     days_present ?? 0, days_absent ?? 0, days_half ?? 0, days_lop ?? 0,
     shifts_worked ?? 0, base_salary_component ?? 0, night_shift_component ?? 0,
     buffer_late_deduction ?? 0, gross_pay ?? 0, lop_amount ?? 0, overtime_amount ?? 0,
     pf_employee_amount ?? 0, pf_employer_amount ?? 0,
     esi_employee_amount ?? 0, esi_employer_amount ?? 0,
     fines_amount ?? 0, net_pay ?? 0]
  );
};

/* ─────────────────────────────────────────────
   FINES (for payroll deduction)
───────────────────────────────────────────── */

/** Sum active fines for an employee in a given month/year. */
const getActiveFinesAmount = async (employeeId, month, year) => {
  const [rows] = await db.execute(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM fines
     WHERE employee_id = ?
       AND assigned_month = ?
       AND assigned_year = ?
       AND status = 'active'`,
    [employeeId, month, year]
  );
  return Number(rows[0].total);
};

/** Mark all active fines for an employee/period as deducted after payroll lock. */
const markFinesDeducted = async (employeeId, month, year) => {
  await db.execute(
    `UPDATE fines SET status = 'deducted'
     WHERE employee_id = ? AND assigned_month = ? AND assigned_year = ? AND status = 'active'`,
    [employeeId, month, year]
  );
};

/** List all fines with optional filters. */
const listFines = async ({ employeeId, status, month, year, page = 1, limit = 30 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (employeeId) { filters.push('f.employee_id = ?'); params.push(employeeId); }
  if (status) { filters.push('f.status = ?'); params.push(status); }
  if (month) { filters.push('f.assigned_month = ?'); params.push(month); }
  if (year) { filters.push('f.assigned_year = ?'); params.push(year); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await db.execute(
    `SELECT f.*, e.full_name, e.employee_code, ft.name AS fine_type_name,
            u.username AS imposed_by_name, w.username AS waived_by_name
     FROM fines f
     JOIN employees e ON e.id = f.employee_id
     JOIN fine_types ft ON ft.id = f.fine_type_id
     LEFT JOIN users u ON u.id = f.imposed_by
     LEFT JOIN users w ON w.id = f.waived_by
     ${where}
     ORDER BY f.fine_date DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM fines f ${where}`, params
  );
  return { rows, total };
};

const createFine = async (data) => {
  const { employee_id, fine_type_id, amount, fine_date, reason, imposed_by, is_auto_generated, assigned_month, assigned_year } = data;
  const [result] = await db.execute(
    `INSERT INTO fines (employee_id, fine_type_id, amount, fine_date, reason, imposed_by,
       is_auto_generated, assigned_month, assigned_year, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [employee_id, fine_type_id, amount, fine_date, reason ?? null,
     imposed_by ?? null, is_auto_generated ? 1 : 0,
     assigned_month ?? null, assigned_year ?? null]
  );
  return result.insertId;
};

const updateFineStatus = async (id, status, { waived_by, waiver_reason }) => {
  await db.execute(
    `UPDATE fines SET status = ?, waived_by = ?, waived_at = NOW(), waiver_reason = ?
     WHERE id = ?`,
    [status, waived_by ?? null, waiver_reason ?? null, id]
  );
};

/* ─────────────────────────────────────────────
   OVERTIME
───────────────────────────────────────────── */

const listOvertimeEntries = async ({ employeeId, runId, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];
  if (employeeId) { filters.push('oe.employee_id = ?'); params.push(employeeId); }
  if (runId) { filters.push('oe.payroll_run_id = ?'); params.push(runId); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.execute(
    `SELECT oe.*, e.full_name FROM overtime_entries oe
     JOIN employees e ON e.id = oe.employee_id
     ${where}
     ORDER BY oe.overtime_date DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM overtime_entries oe ${where}`, params
  );
  return { rows, total };
};

const createOvertimeEntry = async (data) => {
  const { employee_id, overtime_date, extra_hours, rate_per_hour, reason, approved_by } = data;
  const amount = parseFloat(extra_hours) * parseFloat(rate_per_hour || 0);
  const [result] = await db.execute(
    `INSERT INTO overtime_entries (employee_id, overtime_date, extra_hours, rate_per_hour, amount, reason, approved_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [employee_id, overtime_date, extra_hours, rate_per_hour ?? 0, amount, reason ?? null, approved_by ?? null]
  );
  return result.insertId;
};

module.exports = {
  listSalaryStructures, getSalaryStructure, getEmployeeSalaryStructure,
  createSalaryStructure, updateSalaryStructure,
  getNightShiftRate, addNightShiftRate, listNightShiftRates,
  listPayrollRuns, getPayrollRun, createPayrollRun, updatePayrollRunStatus, confirmPayrollRun,
  getPayrollItems, upsertPayrollItem,
  getActiveFinesAmount, markFinesDeducted, listFines, createFine, updateFineStatus,
  listOvertimeEntries, createOvertimeEntry,
};
