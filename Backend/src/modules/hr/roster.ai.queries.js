const db = require('../../config/db');

/**
 * Fetch rule templates for department / role
 */
const getRuleTemplates = async (departmentId, staffRoleId) => {
  let sql = `
    SELECT id, department_id, staff_role_id, name, rules, is_default, created_by, created_at, updated_at
    FROM roster_rule_templates
    WHERE department_id = ?
  `;
  const params = [departmentId];
  if (staffRoleId) {
    sql += ` AND (staff_role_id = ? OR staff_role_id IS NULL)`;
    params.push(staffRoleId);
  }
  sql += ` ORDER BY is_default DESC, updated_at DESC`;
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

module.exports = {
  getRuleTemplates,
  getRuleTemplateById,
  saveRuleTemplate,
  updateRuleTemplate,
  deleteRuleTemplate,
  saveAiGeneration,
  getAiGenerationById,
  updateAiGenerationStatus,
  getApprovedLeavesForPeriod
};
