const aiClient = require('../../services/aiClient');
const aiQueries = require('./roster.ai.queries');
const rosterService = require('./roster.service');
const rosterQueries = require('./roster.queries');
const db = require('../../config/db');
const { AppError } = require('../../utils/errors');

/**
 * List rule templates for a department
 */
const listRuleTemplates = async (departmentId, staffRoleId) => {
  return aiQueries.getRuleTemplates(departmentId, staffRoleId);
};

const createRuleTemplate = async (data, userId) => {
  const { departmentId, staffRoleId, name, rules, isDefault } = data;
  if (!departmentId || !name || !rules) {
    throw new AppError('departmentId, name, and rules are required', 400);
  }
  const id = await aiQueries.saveRuleTemplate({
    departmentId,
    staffRoleId,
    name,
    rules,
    isDefault: Boolean(isDefault),
    userId
  });
  return { id, message: 'Template saved successfully' };
};

const updateRuleTemplate = async (id, data) => {
  await aiQueries.updateRuleTemplate(id, data);
  return { id, message: 'Template updated successfully' };
};

const deleteRuleTemplate = async (id) => {
  await aiQueries.deleteRuleTemplate(id);
  return { message: 'Template deleted successfully' };
};

/**
 * Check AI Microservice Health
 */
const checkAiHealth = async () => {
  try {
    const res = await aiClient.healthCheck();
    return { online: true, ...res };
  } catch (err) {
    return { online: false, error: err.message };
  }
};

/**
 * Generate AI Duty Roster
 */
const generateAiRoster = async (
  { departmentId, staffRoleId, startDate, endDate, rules, prompt, pinnedShifts },
  userId
) => {
  if (!departmentId || !startDate || !endDate) {
    throw new AppError('departmentId, startDate, and endDate are required', 400);
  }

  // 1. Fetch eligible employees
  const employees = await rosterService.getEmployeesForRoster(departmentId, staffRoleId);
  if (!employees.length) {
    throw new AppError('No active employees found for the selected department/role', 400);
  }

  const employeeIds = employees.map((e) => Number(e.employee_id || e.id));

  // 2. Fetch active shifts
  const [shifts] = await db.query('SELECT * FROM shifts WHERE is_active = 1');
  if (!shifts.length) {
    throw new AppError('No shifts defined in the system', 400);
  }

  // 3. Fetch approved leaves for the date range
  const approvedLeaves = await aiQueries.getApprovedLeavesForPeriod(
    employeeIds,
    startDate,
    endDate
  );

  // 4. Build AI Solver Payload
  const defaultRules = {
    min_staff_per_shift: {},
    min_rest_hours_between_shifts: 12,
    max_consecutive_working_days: 6,
    max_night_shifts_per_week: 3,
    require_off_after_night_shift: true,
    weekly_offs_per_employee: 1,
    approved_leaves: approvedLeaves,
    pinned_shifts: pinnedShifts || []
  };

  const mergedRules = {
    ...defaultRules,
    ...(rules || {}),
    approved_leaves: approvedLeaves,
    pinned_shifts: pinnedShifts || rules?.pinned_shifts || []
  };

  const payload = {
    department_id: Number(departmentId),
    staff_role_id: staffRoleId ? Number(staffRoleId) : null,
    start_date: startDate,
    end_date: endDate,
    prompt: prompt || rules?.prompt || null,
    employees: employees.map((e) => ({
      id: Number(e.employee_id || e.id),
      name: e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.name || `Employee #${e.employee_id || e.id}`,
      staff_role_id: e.designation_id || e.staff_role_id,
      role_name: e.role_name || e.staff_role_name,
      gender: e.gender,
      is_doctor: Boolean(e.is_doctor),
      is_night_eligible: e.shift_category !== 'General_Only',
      max_consecutive_days: 6,
      target_weekly_offs: Number(e.weekly_off_count || 1)
    })),
    shifts: shifts.map((s) => {
      const name = s.name || s.shift_name || `Shift #${s.id}`;
      const code = s.code || s.shift_code || (name.toLowerCase().startsWith('night') ? 'N' : name.toLowerCase().startsWith('day') ? 'D' : name.charAt(0).toUpperCase());
      return {
        id: s.id,
        shift_code: code,
        shift_name: name,
        start_time: s.start_time,
        end_time: s.end_time,
        is_night_shift: Boolean(s.is_night_shift || /night/i.test(name)),
        is_active: s.is_active !== 0
      };
    }),
    rules: mergedRules
  };

  // 5. Call Standalone AI Service
  const solution = await aiClient.solveRoster(payload);

  // 6. Save generation record to MySQL
  const generationId = await aiQueries.saveAiGeneration({
    departmentId,
    staffRoleId,
    fromDate: startDate,
    toDate: endDate,
    ruleSnapshot: { ...mergedRules, prompt: prompt || rules?.prompt || null },
    proposedRoster: solution.assignments,
    violations: solution.violations,
    metrics: solution.metrics,
    score: solution.metrics?.fairness_score,
    userId
  });

  return {
    generation_id: generationId,
    status: solution.status,
    solve_time_seconds: solution.solve_time_seconds,
    assignments: solution.assignments,
    violations: solution.violations,
    metrics: solution.metrics,
    prompt_logs: solution.prompt_logs || [],
    message: solution.message
  };
};

/**
 * Approve and Commit AI Generated Roster to Live Database
 */
const approveAiRoster = async (generationId, modifiedAssignments, userId) => {
  const gen = await aiQueries.getAiGenerationById(generationId);
  if (!gen) {
    throw new AppError('AI Generation record not found', 404);
  }

  const assignmentsToSave = modifiedAssignments || gen.proposed_roster;
  if (!Array.isArray(assignmentsToSave) || !assignmentsToSave.length) {
    throw new AppError('No assignments to commit', 400);
  }

  // Convert assignments into format expected by roster_entries
  const rows = assignmentsToSave
    .filter((a) => !a.is_leave) // Leave is recorded in leave_requests
    .map((a) => ({
      employee_id: a.employee_id,
      roster_date: a.date,
      shift_id: a.is_week_off ? null : a.shift_id,
      is_week_off: Boolean(a.is_week_off),
      custom_start_time: null,
      custom_end_time: null,
      notes: 'AI Generated Duty Roster'
    }));

  // Perform bulk upsert into roster_entries inside a transaction
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    for (const r of rows) {
      await conn.query(
        `INSERT INTO roster_entries 
         (employee_id, roster_date, shift_id, is_week_off, custom_start_time, custom_end_time, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           shift_id = VALUES(shift_id),
           is_week_off = VALUES(is_week_off),
           notes = VALUES(notes),
           updated_at = NOW()`,
        [
          r.employee_id,
          r.roster_date,
          r.shift_id,
          r.is_week_off ? 1 : 0,
          r.custom_start_time,
          r.custom_end_time,
          r.notes,
          userId
        ]
      );
    }

    // Update generation status to approved
    await conn.query(
      `UPDATE roster_ai_generations 
       SET status = 'approved', reviewed_by = ?, approved_at = NOW() 
       WHERE id = ?`,
      [userId, generationId]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return {
    success: true,
    total_committed: rows.length,
    message: 'AI Duty Roster approved and committed to database successfully'
  };
};

module.exports = {
  listRuleTemplates,
  createRuleTemplate,
  updateRuleTemplate,
  deleteRuleTemplate,
  checkAiHealth,
  generateAiRoster,
  approveAiRoster
};
