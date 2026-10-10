const db = require('../../config/db');

/**
 * Fetch rule templates for department / role
 */
const getRuleTemplates = async (departmentId, staffRoleId, includeAll = false) => {
  let sql = `
    SELECT t.id, t.department_id, t.staff_role_id, t.name, t.rules, t.is_default, t.created_by, t.created_at, t.updated_at,
           d.name AS department_name
    FROM roster_rule_templates t
    LEFT JOIN departments d ON t.department_id = d.id
  `;
  const params = [];
  const conditions = [];

  if (departmentId && !includeAll) {
    conditions.push(`(t.department_id = ? OR t.department_id IS NULL)`);
    params.push(departmentId);
  }
  if (staffRoleId) {
    conditions.push(`(t.staff_role_id = ? OR t.staff_role_id IS NULL)`);
    params.push(staffRoleId);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }

  sql += ` ORDER BY t.is_default DESC, t.updated_at DESC`;
  const [rows] = await db.query(sql, params);
  return rows.map((r) => ({
    ...r,
    rules: typeof r.rules === 'string' ? JSON.parse(r.rules) : r.rules,
    is_default: Boolean(r.is_default)
  }));
};

const getRuleTemplateById = async (id) => {
  const [rows] = await db.query(
    `SELECT * FROM roster_rule_templates WHERE id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    ...r,
    rules: typeof r.rules === 'string' ? JSON.parse(r.rules) : r.rules,
    is_default: Boolean(r.is_default)
  };
};

const saveRuleTemplate = async ({ departmentId, staffRoleId, name, rules, isDefault, userId }) => {
  if (isDefault) {
    // reset other default templates for this department
    await db.query(
      `UPDATE roster_rule_templates SET is_default = 0 WHERE department_id = ?`,
      [departmentId]
    );
  }
  const [res] = await db.query(
    `INSERT INTO roster_rule_templates 
     (department_id, staff_role_id, name, rules, is_default, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [departmentId, staffRoleId || null, name, JSON.stringify(rules), isDefault ? 1 : 0, userId || null]
  );
  return res.insertId;
};

const updateRuleTemplate = async (id, { name, rules, isDefault, departmentId }) => {
  if (isDefault && departmentId) {
    await db.query(
      `UPDATE roster_rule_templates SET is_default = 0 WHERE department_id = ?`,
      [departmentId]
    );
  }
  await db.query(
    `UPDATE roster_rule_templates 
     SET name = COALESCE(?, name),
         rules = COALESCE(?, rules),
         is_default = COALESCE(?, is_default),
         updated_at = NOW()
     WHERE id = ?`,
    [name || null, rules ? JSON.stringify(rules) : null, isDefault !== undefined ? (isDefault ? 1 : 0) : null, id]
  );
};

const deleteRuleTemplate = async (id) => {
  await db.query(`DELETE FROM roster_rule_templates WHERE id = ?`, [id]);
};

/**
 * Save AI Generation log / draft
 */
const saveAiGeneration = async ({
  departmentId,
  staffRoleId,
  fromDate,
  toDate,
  ruleSnapshot,
  proposedRoster,
  violations,
  metrics,
  score,
  userId
}) => {
  const [res] = await db.query(
    `INSERT INTO roster_ai_generations 
     (department_id, staff_role_id, from_date, to_date, rule_snapshot, proposed_roster, violations, metrics, score, status, reviewed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?)`,
    [
      departmentId,
      staffRoleId || null,
      fromDate,
      toDate,
      JSON.stringify(ruleSnapshot || {}),
      JSON.stringify(proposedRoster || []),
      JSON.stringify(violations || []),
      JSON.stringify(metrics || {}),
      score || null,
      userId || null
    ]
  );
  return res.insertId;
};

const getAiGenerationById = async (id) => {
  const [rows] = await db.query(
    `SELECT * FROM roster_ai_generations WHERE id = ?`,
    [id]
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    ...r,
    rule_snapshot: typeof r.rule_snapshot === 'string' ? JSON.parse(r.rule_snapshot) : r.rule_snapshot,
    proposed_roster: typeof r.proposed_roster === 'string' ? JSON.parse(r.proposed_roster) : r.proposed_roster,
    violations: typeof r.violations === 'string' ? JSON.parse(r.violations) : r.violations,
    metrics: typeof r.metrics === 'string' ? JSON.parse(r.metrics) : r.metrics
  };
};

const updateAiGenerationStatus = async (id, status, reviewedBy) => {
  await db.query(
    `UPDATE roster_ai_generations 
     SET status = ?, reviewed_by = ?, approved_at = CASE WHEN ? = 'approved' THEN NOW() ELSE approved_at END
     WHERE id = ?`,
    [status, reviewedBy || null, status, id]
  );
};

/**
 * Fetch approved leaves within range for employee list
 */
const getApprovedLeavesForPeriod = async (employeeIds, fromDate, toDate) => {
  const validIds = (employeeIds || []).filter((id) => Number.isInteger(Number(id)) && Number(id) > 0);
  if (!validIds.length) return [];
  const placeholders = validIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT lr.employee_id, lr.from_date, lr.to_date, lr.result, lr.hr_status
     FROM leave_requests lr
     WHERE lr.employee_id IN (${placeholders})
       AND (lr.result = 'approved' OR lr.hr_status = 'approved')
       AND lr.from_date <= ?
       AND lr.to_date >= ?`,
    [...validIds, toDate, fromDate]
  );
  
  // Expand date range into individual days
  const leaves = [];
  for (const r of rows) {
    const start = new Date(r.from_date);
    const end = new Date(r.to_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      if (iso >= fromDate && iso <= toDate) {
        leaves.push({
          employee_id: Number(r.employee_id),
          date: iso
        });
      }
    }
  }
  return leaves;
};

/**
 * Fetch past roster history (last 7-14 days) to support historical continuity rules
 */
const getRecentRosterHistory = async (employeeIds, startDate, lookbackDays = 14) => {
  const validIds = (employeeIds || []).filter((id) => Number.isInteger(Number(id)) && Number(id) > 0);
  if (!validIds.length || !startDate) return [];
  const placeholders = validIds.map(() => '?').join(',');
  try {
    const [rows] = await db.query(
      `SELECT re.employee_id, re.roster_date, re.is_week_off, re.is_night_shift, 
              s.code AS shift_code, s.name AS shift_name
       FROM roster_entries re
       LEFT JOIN shifts s ON s.id = re.shift_id
       WHERE re.employee_id IN (${placeholders})
         AND re.roster_date >= DATE_SUB(?, INTERVAL ? DAY)
         AND re.roster_date < ?
       ORDER BY re.roster_date ASC`,
      [...validIds, startDate, lookbackDays, startDate]
    );
    return rows.map((r) => ({
      employee_id: Number(r.employee_id),
      date: r.roster_date instanceof Date ? r.roster_date.toISOString().slice(0, 10) : String(r.roster_date).slice(0, 10),
      is_week_off: Boolean(r.is_week_off),
      is_night_shift: Boolean(r.is_night_shift || /night/i.test(r.shift_name || '')),
      shift_code: r.shift_code || (r.is_night_shift ? 'N' : 'M'),
      shift_name: r.shift_name || (r.is_night_shift ? 'Night Shift' : 'Morning Shift')
    }));
  } catch (err) {
    console.warn('Failed to fetch recent roster history:', err.message);
    return [];
  }
};

module.exports = {
  getRuleTemplates,
  getRuleTemplateById,
  saveRuleTemplate,
  updateRuleTemplate,
  deleteRuleTemplate,
  saveAiGeneration,
  getAiGenerationById,
  updateAiGenerationStatus,
  getApprovedLeavesForPeriod,
  getRecentRosterHistory
};
