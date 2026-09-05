/**
 * salary.queries.js
 * All raw SQL for the Salary / Payroll module.
 */

const db = require('../../config/db');

/* ─────────────────────────────────────────────
   SALARY STRUCTURES
───────────────────────────────────────────── */

const listSalaryStructures = async (employeeId = null) => {
  const where = employeeId ? 'WHERE ss.employee_id = ?' : '';
  const params = employeeId ? [employeeId] : [];
  const [rows] = await db.execute(
    `SELECT ss.*, e.full_name, e.employee_code
     FROM salary_structures ss
     JOIN employees e ON e.id = ss.employee_id
     ${where}
     ORDER BY e.full_name, ss.effective_from DESC`,
    params
  );
  return rows;
};

const getSalaryStructure = async (id) => {
  const [rows] = await db.execute(`SELECT * FROM salary_structures WHERE id = ?`, [id]);
  return rows[0] ?? null;
};

/**
 * The salary in force for an employee during a given pay period.
 *
 * Resolution order:
 *   1. an employee-specific salary_structures row whose effective range covers
 *      the period — this is what preserves increment history, and
 *   2. otherwise the department-role default on staff_roles.
 *
 * Previously this joined salary_structures on designation_id (a column it does
 * not have) and returned null for everyone, so payroll silently skipped every
 * employee. It must never return null for an active employee whose role has a
 * salary set.
 */
const getEffectiveSalary = async (employeeId, month, year) => {
  const periodEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;

  const [override] = await db.execute(
    `SELECT ss.*
     FROM salary_structures ss
     WHERE ss.employee_id = ?
       AND ss.effective_from <= ?
       AND (ss.effective_to IS NULL OR ss.effective_to >= ?)
     ORDER BY ss.effective_from DESC
     LIMIT 1`,
    [employeeId, periodEnd, periodStart]
  );

  if (override.length) {
    const s = override[0];
    return {
      source: 'salary_structure',
      salary_structure_id: s.id,
      fixed_salary: Number(s.fixed_salary ?? 0),
      basic_da_amount: Number(s.basic_da_amount ?? 0),
      hra_amount: Number(s.hra_amount ?? 0),
      night_shift_extra_amount: Number(s.night_shift_extra_amount ?? 0),
      pf_applicable: !!s.pf_applicable,
      esi_applicable: !!s.esi_applicable,
    };
  }

  // Fall back to the role default the Department-Role screen actually writes.
  const [roleRows] = await db.execute(
    `SELECT sr.basic_salary, sr.hra, sr.da, e.basic_salary AS employee_basic,
            e.shift_category, e.per_day_salary, e.per_night_salary,
            e.pf_enrolled, e.esi_enrolled, e.uan_number, e.esi_number
     FROM employees e
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     WHERE e.id = ?`,
    [employeeId]
  );
  if (!roleRows.length) return null;

  const r = roleRows[0];
  // An employee-level override on the employees row wins over the role default.
  const employeeBasic = Number(r.employee_basic ?? 0);
  const roleBasic = Number(r.basic_salary ?? 0);
  const basic = employeeBasic > 0 ? employeeBasic : roleBasic;
  const hra = Number(r.hra ?? 0);
  const da = Number(r.da ?? 0);

  // staff_roles.basic_salary is the full monthly figure in this data set;
  // If HRA and DA are not separately defined, split dynamically as 70% Basic+DA and 30% HRA.
  const fixed = basic + hra + da;
  if (fixed <= 0) return null;

  const basicDa = (hra > 0 || da > 0) ? (basic + da) : Math.round(fixed * 0.7);
  const calculatedHra = (hra > 0 || da > 0) ? hra : (fixed - basicDa);

  const nightAllowance = r.shift_category === 'day_and_night'
    ? Math.max(0, Number(r.per_night_salary || 0) - Number(r.per_day_salary || 0))
    : 0;

  return {
    source: employeeBasic > 0 ? 'employee' : 'staff_role',
    salary_structure_id: null,
    fixed_salary: fixed,
    basic_da_amount: basicDa,
    hra_amount: calculatedHra,
    night_shift_extra_amount: nightAllowance,
    pf_applicable: Boolean(r.pf_enrolled),
    esi_applicable: Boolean(r.esi_enrolled),
    shift_category: r.shift_category,
    per_day_salary: Number(r.per_day_salary || 0),
    per_night_salary: Number(r.per_night_salary || 0),
  };
};

const createSalaryStructure = async (data) => {
  const {
    employee_id, salary_basis, fixed_salary, basic_da_amount, hra_amount,
    night_shift_extra_amount, pf_applicable, esi_applicable,
    effective_from, effective_to, created_by,
  } = data;
  const [result] = await db.execute(
    `INSERT INTO salary_structures
       (employee_id, salary_basis, fixed_salary, basic_da_amount, hra_amount,
        night_shift_extra_amount, pf_applicable, esi_applicable,
        effective_from, effective_to, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [employee_id, salary_basis ?? 'monthly_fixed', fixed_salary ?? null,
     basic_da_amount ?? null, hra_amount ?? null, night_shift_extra_amount ?? 0,
     pf_applicable === false ? 0 : 1, esi_applicable === false ? 0 : 1,
     effective_from, effective_to ?? null, created_by ?? null]
  );
  return result.insertId;
};

/** Close the currently-open structure and open a new one — an increment. */
const addSalaryRevision = async (data) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE salary_structures
       SET effective_to = DATE_SUB(?, INTERVAL 1 DAY)
       WHERE employee_id = ? AND effective_to IS NULL`,
      [data.effective_from, data.employee_id]
    );
    const [res] = await conn.execute(
      `INSERT INTO salary_structures
         (employee_id, salary_basis, fixed_salary, basic_da_amount, hra_amount,
          night_shift_extra_amount, pf_applicable, esi_applicable, effective_from, created_by)
       VALUES (?, 'monthly_fixed', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.employee_id, data.fixed_salary ?? null, data.basic_da_amount ?? null,
       data.hra_amount ?? null, data.night_shift_extra_amount ?? 0,
       data.pf_applicable === false ? 0 : 1, data.esi_applicable === false ? 0 : 1,
       data.effective_from, data.created_by ?? null]
    );
    await conn.commit();
    return res.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const updateSalaryStructure = async (id, data) => {
  const allowed = ['salary_basis', 'fixed_salary', 'basic_da_amount', 'hra_amount',
    'night_shift_extra_amount', 'effective_from', 'effective_to'];
  const booleans = ['pf_applicable', 'esi_applicable'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); vals.push(data[key]); }
  }
  for (const key of booleans) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); vals.push(data[key] ? 1 : 0); }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE salary_structures SET ${fields.join(', ')} WHERE id = ?`, vals);
};

/* ─────────────────────────────────────────────
   PAYROLL CONFIG
───────────────────────────────────────────── */

/** All payroll constants as a { key: number } map. Never hardcode these. */
const getPayrollConfig = async () => {
  const [rows] = await db.execute(`SELECT config_key, config_value FROM payroll_config`);
  return Object.fromEntries(rows.map((r) => [r.config_key, Number(r.config_value)]));
};

const setPayrollConfig = async (key, value) => {
  await db.execute(
    `INSERT INTO payroll_config (config_key, config_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
    [key, String(value)]
  );
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

// Note: the columns are period_month / period_year, and there is no created_by.
const listPayrollRuns = async (page = 1, limit = 12) => {
  const offset = (page - 1) * limit;
  const [rows] = await db.query(
    `SELECT pr.*, l.username AS locked_by_name, c.username AS confirmed_by_name,
            (SELECT COUNT(*) FROM payroll_items pi WHERE pi.payroll_run_id = pr.id) AS item_count,
            (SELECT COALESCE(SUM(pi.net_pay), 0) FROM payroll_items pi WHERE pi.payroll_run_id = pr.id) AS total_net
     FROM payroll_runs pr
     LEFT JOIN users l ON l.id = pr.locked_by
     LEFT JOIN users c ON c.id = pr.confirmed_by
     ORDER BY pr.period_year DESC, pr.period_month DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM payroll_runs`);
  return { rows, total };
};

const getPayrollRun = async (id) => {
  const [rows] = await db.execute(
    `SELECT pr.*, l.username AS locked_by_name, c.username AS confirmed_by_name
     FROM payroll_runs pr
     LEFT JOIN users l ON l.id = pr.locked_by
     LEFT JOIN users c ON c.id = pr.confirmed_by
     WHERE pr.id = ?`,
    [id]
  );
  return rows[0] ?? null;
};

const findPayrollRunByPeriod = async (month, year) => {
  const [rows] = await db.execute(
    `SELECT * FROM payroll_runs WHERE period_month = ? AND period_year = ?`,
    [month, year]
  );
  return rows[0] ?? null;
};

const createPayrollRun = async ({ period_month, period_year, salary_date_type, salary_date }) => {
  const [result] = await db.execute(
    `INSERT INTO payroll_runs (period_month, period_year, status, salary_date_type, salary_date)
     VALUES (?, ?, 'draft', ?, ?)`,
    [period_month, period_year, salary_date_type ?? 'last_day_of_month', salary_date ?? null]
  );
  return result.insertId;
};

const updatePayrollRunStatus = async (id, status) => {
  await db.execute(`UPDATE payroll_runs SET status = ? WHERE id = ?`, [status, id]);
};

const lockPayrollRun = async (id, lockedBy) => {
  await db.execute(
    `UPDATE payroll_runs
     SET status = 'locked', locked_by = ?, locked_at = NOW(),
         confirmed_by = ?, confirmed_at = NOW()
     WHERE id = ?`,
    [lockedBy ?? null, lockedBy ?? null, id]
  );
};

const clearPayrollItems = async (runId) => {
  await db.execute(`DELETE FROM payroll_items WHERE payroll_run_id = ?`, [runId]);
};

/* ─────────────────────────────────────────────
   PAYROLL ITEMS (per-employee lines)
───────────────────────────────────────────── */

const getPayrollItems = async (runId, page = 1, limit = 100) => {
  const offset = (page - 1) * limit;
  const [rows] = await db.query(
    `SELECT pi.*, e.full_name, e.employee_code, e.uan_number, e.esi_number,
            e.bank_account_no, e.bank_name, e.bank_ifsc,
            d.name AS department_name, COALESCE(sr.name, '') AS designation_name
     FROM payroll_items pi
     JOIN employees e ON e.id = pi.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
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

/**
 * Write one employee's payslip line.
 *
 * The real columns are days_present / days_paid_leave / days_lop — there is no
 * days_absent or days_half (half-day leave is out of scope by decision).
 * salary_structure_id is nullable here because a salary may resolve from the
 * role default rather than an explicit structure row.
 */
const upsertPayrollItem = async (data) => {
  const {
    payroll_run_id, employee_id, salary_structure_id,
    days_present, days_paid_leave, days_lop, shifts_worked,
    base_salary_component, earned_basic, earned_hra, night_shift_component, buffer_late_deduction,
    gross_pay, lop_amount, overtime_amount,
    pf_wage, esi_wage,
    pf_employee_amount, pf_employer_amount, pf_employer_eps_amount, pf_employer_epf_amount,
    esi_employee_amount, esi_employer_amount,
    fines_amount, net_pay,
  } = data;

  await db.execute(
    `INSERT INTO payroll_items
       (payroll_run_id, employee_id, salary_structure_id,
        days_present, days_paid_leave, days_lop, shifts_worked,
        base_salary_component, earned_basic, earned_hra, night_shift_component, buffer_late_deduction,
        gross_pay, lop_amount, overtime_amount,
        pf_wage, esi_wage,
        pf_employee_amount, pf_employer_amount, pf_employer_eps_amount, pf_employer_epf_amount,
        esi_employee_amount, esi_employer_amount,
        fines_amount, net_pay)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       salary_structure_id = VALUES(salary_structure_id),
       days_present = VALUES(days_present),
       days_paid_leave = VALUES(days_paid_leave),
       days_lop = VALUES(days_lop),
       shifts_worked = VALUES(shifts_worked),
       base_salary_component = VALUES(base_salary_component),
       earned_basic = VALUES(earned_basic),
       earned_hra = VALUES(earned_hra),
       night_shift_component = VALUES(night_shift_component),
       buffer_late_deduction = VALUES(buffer_late_deduction),
       gross_pay = VALUES(gross_pay),
       lop_amount = VALUES(lop_amount),
       overtime_amount = VALUES(overtime_amount),
       pf_wage = VALUES(pf_wage),
       esi_wage = VALUES(esi_wage),
       pf_employee_amount = VALUES(pf_employee_amount),
       pf_employer_amount = VALUES(pf_employer_amount),
       pf_employer_eps_amount = VALUES(pf_employer_eps_amount),
       pf_employer_epf_amount = VALUES(pf_employer_epf_amount),
       esi_employee_amount = VALUES(esi_employee_amount),
       esi_employer_amount = VALUES(esi_employer_amount),
       fines_amount = VALUES(fines_amount),
       net_pay = VALUES(net_pay)`,
    [payroll_run_id, employee_id, salary_structure_id ?? null,
     days_present ?? 0, days_paid_leave ?? 0, days_lop ?? 0, shifts_worked ?? 0,
     base_salary_component ?? 0, earned_basic ?? 0, earned_hra ?? 0, night_shift_component ?? 0, buffer_late_deduction ?? 0,
     gross_pay ?? 0, lop_amount ?? 0, overtime_amount ?? 0,
     pf_wage ?? 0, esi_wage ?? 0,
     pf_employee_amount ?? 0, pf_employer_amount ?? 0, pf_employer_eps_amount ?? 0, pf_employer_epf_amount ?? 0,
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

  const [rows] = await db.query(
    `SELECT f.*, e.full_name, e.employee_code, ft.name AS fine_type_name,
            c.username AS created_by_name, w.username AS waived_by_name
     FROM fines f
     JOIN employees e ON e.id = f.employee_id
     JOIN fine_types ft ON ft.id = f.fine_type_id
     LEFT JOIN users c ON c.id = f.created_by
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

/** The configured fine type for a trigger rule (e.g. unapproved absences). */
const getFineTypeByTriggerRule = async (triggerRule) => {
  const [rows] = await db.execute(
    `SELECT * FROM fine_types WHERE trigger_rule = ? AND is_active = 1 LIMIT 1`,
    [triggerRule]
  );
  return rows[0] ?? null;
};

const listFineTypes = async () => {
  const [rows] = await db.execute(`SELECT * FROM fine_types ORDER BY name`);
  return rows;
};

const createFineType = async (data) => {
  const { name, default_amount, trigger_rule, calculation_basis, description, is_active } = data;
  const [result] = await db.execute(
    `INSERT INTO fine_types (name, default_amount, trigger_rule, calculation_basis, description, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, default_amount ?? 0, trigger_rule ?? 'manual', calculation_basis ?? 'flat',
     description ?? null, is_active === false ? 0 : 1]
  );
  return result.insertId;
};

const updateFineType = async (id, data) => {
  const allowed = ['name', 'default_amount', 'trigger_rule', 'calculation_basis', 'description'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); vals.push(data[key]); }
  }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); vals.push(data.is_active ? 1 : 0); }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE fine_types SET ${fields.join(', ')} WHERE id = ?`, vals);
};

const createFine = async (data) => {
  const { employee_id, fine_type_id, amount, fine_date, reason, created_by, is_auto_generated, assigned_month, assigned_year } = data;
  const [result] = await db.execute(
    `INSERT INTO fines (employee_id, fine_type_id, amount, fine_date, reason, created_by,
       is_auto_generated, assigned_month, assigned_year, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [employee_id, fine_type_id, amount, fine_date, reason ?? null,
     created_by ?? null, is_auto_generated ? 1 : 0,
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

// Real columns: entry_date, entry_type ENUM('extra_day','hourly'), hours,
// computed_amount, notes, created_by. The previous version wrote six names that
// do not exist, so every overtime write failed.
const listOvertimeEntries = async ({ employeeId, runId, month, year, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];
  if (employeeId) { filters.push('oe.employee_id = ?'); params.push(employeeId); }
  if (runId) { filters.push('oe.payroll_run_id = ?'); params.push(runId); }
  if (month) { filters.push('MONTH(oe.entry_date) = ?'); params.push(month); }
  if (year) { filters.push('YEAR(oe.entry_date) = ?'); params.push(year); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT oe.*, e.full_name, e.employee_code FROM overtime_entries oe
     JOIN employees e ON e.id = oe.employee_id
     ${where}
     ORDER BY oe.entry_date DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM overtime_entries oe ${where}`, params
  );
  return { rows, total };
};

const createOvertimeEntry = async ({ employee_id, entry_date, entry_type, hours, computed_amount, notes, created_by }) => {
  const [result] = await db.execute(
    `INSERT INTO overtime_entries
       (employee_id, entry_date, entry_type, hours, computed_amount, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [employee_id, entry_date, entry_type, hours ?? null, computed_amount ?? 0,
     notes ?? null, created_by ?? null]
  );
  return result.insertId;
};

/**
 * Extra *days* worked in a period. Hourly overtime is deliberately excluded:
 * it is logged for the record only and carries no pay.
 */
const countPaidExtraDays = async (employeeId, month, year) => {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS extra_days,
            COALESCE(SUM(computed_amount), 0) AS total_amount
     FROM overtime_entries
     WHERE employee_id = ?
       AND MONTH(entry_date) = ? AND YEAR(entry_date) = ?`,
    [employeeId, month, year]
  );
  return {
    extra_days: Number(rows[0]?.extra_days ?? 0),
    total_amount: Number(rows[0]?.total_amount ?? 0),
  };
};

module.exports = {
  listSalaryStructures, getSalaryStructure, getEffectiveSalary,
  createSalaryStructure, addSalaryRevision, updateSalaryStructure,
  getPayrollConfig, setPayrollConfig,
  getNightShiftRate, addNightShiftRate, listNightShiftRates,
  listPayrollRuns, getPayrollRun, findPayrollRunByPeriod, createPayrollRun,
  updatePayrollRunStatus, lockPayrollRun, clearPayrollItems,
  getPayrollItems, listPayrollItems: getPayrollItems, upsertPayrollItem,
  getActiveFinesAmount, markFinesDeducted, listFines, createFine, updateFineStatus,
  listFineTypes, createFineType, updateFineType, getFineTypeByTriggerRule,
  listOvertimeEntries, createOvertimeEntry, countPaidExtraDays,
};
