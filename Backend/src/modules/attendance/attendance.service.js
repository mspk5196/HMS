/**
 * attendance.service.js
 * Business logic for the Attendance module.
 *
 * Key responsibilities:
 *  1. processDailyAttendance() — core engine: reads raw punches, applies
 *     the biometric window, computes worked/late minutes, updates the
 *     daily summary, and drains the late-buffer pool.
 *  2. importPunches() — accepts eTimeTracker CSV rows and bulk-inserts.
 *  3. Thin wrappers for admin actions (manual mark, correction requests).
 */

const db = require('../../config/db');
const q = require('./attendance.queries');
const { AppError } = require('../../utils/errors');

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

/** Return the roster entry (shift) for an employee on a given date. */
const getShiftForDate = async (employeeId, date) => {
  const [rows] = await db.execute(
    `SELECT re.*, s.*,
            s.id AS shift_id, s.name AS shift_name,
            s.start_time, s.end_time, s.is_night_shift,
            s.grace_period_minutes
     FROM roster_entries re
     JOIN shifts s ON s.id = re.shift_id
     WHERE re.employee_id = ? AND re.roster_date = ?
     LIMIT 1`,
    [employeeId, date]
  );
  if (rows.length) return rows[0];

  // Fallback to employee's default shift (Wait, employees table has no shift_id)
  // Just return a generic 09:00 to 17:00 default shift if no roster exists, 
  // so we can still calculate late minutes.
  return {
    shift_id: null,
    shift_name: 'Default Shift',
    start_time: '09:00:00',
    end_time: '17:00:00',
    is_night_shift: 0,
    grace_period_minutes: 0
  };
};

/** Read DEFAULT_BUFFER_MINUTES from system_config. */
const getDefaultBufferMinutes = async () => {
  const [rows] = await db.execute(
    `SELECT config_value FROM system_config WHERE config_key = 'DEFAULT_BUFFER_MINUTES'`
  );
  return rows[0] ? parseInt(rows[0].config_value, 10) : 30;
};

/** Convert 'HH:MM:SS' or 'HH:MM' to total minutes since midnight. */
const timeToMinutes = (t) => {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  return parts[0] * 60 + parts[1];
};

/** Compute worked minutes between two Date objects (handles midnight crossover). */
const workedMinutes = (firstIn, lastOut) => {
  if (!firstIn || !lastOut) return 0;
  const diff = (new Date(lastOut) - new Date(firstIn)) / 60000;
  return Math.max(0, Math.round(diff));
};

/* ─────────────────────────────────────────────
   CORE ENGINE
───────────────────────────────────────────── */

/**
 * Process attendance for all employees for a given date.
 *
 * Algorithm:
 *  For each employee who has raw punches on `date`:
 *   1. Determine their shift for the day.
 *   2. Filter punches within the biometric window (shift times or admin override).
 *   3. First punch = first_punch_in, last punch = last_punch_out.
 *   4. Compute late_minutes = MAX(0, firstIn - shiftStart - gracePeriod).
 *   5. Deduct late_minutes from buffer; if buffer exhausted, excess goes to effective_late.
 *   6. Determine status: present / late_present / absent / half_day.
 *   7. Upsert attendance_daily_summary.
 *   8. Mark raw punches as processed.
 *
 * @param {string} date  YYYY-MM-DD
 */
const processDailyAttendance = async (date) => {
  const defaultBuffer = await getDefaultBufferMinutes();

  // Fetch all unprocessed punches for the date
  const punches = await q.getUnprocessedPunches(date, date);
  if (!punches.length) return { processed: 0, date };

  // Group by employee
  const byEmployee = {};
  for (const p of punches) {
    if (!byEmployee[p.employee_id]) byEmployee[p.employee_id] = { employee: p, punches: [] };
    byEmployee[p.employee_id].punches.push(p);
  }

  const [month, year] = [new Date(date).getMonth() + 1, new Date(date).getFullYear()];
  let processed = 0;

  for (const empId of Object.keys(byEmployee)) {
    const { employee, punches: empPunches } = byEmployee[empId];
    const shift = await getShiftForDate(Number(empId), date);
    const biometricWindow = await q.getBiometricWindow(date, employee.role_id ?? null);

    const hasShift = !!shift && !!shift.start_time;

    // Determine acceptance window
    let windowStart = null;
    let windowEnd = null;
    if (biometricWindow) {
      windowStart = biometricWindow.extended_start;
      windowEnd = biometricWindow.extended_end;
    } else if (hasShift) {
      windowStart = shift.start_time;
      windowEnd = shift.is_night_shift
        ? '23:59:59'   // Night shift: accept until midnight
        : shift.end_time;
    }

    // Filter punches within window
    let validPunches = empPunches;
    if (windowStart && windowEnd) {
      const wsMin = timeToMinutes(windowStart);
      const weMin = timeToMinutes(windowEnd) + 120; // +2 hr tolerance after end
      validPunches = empPunches.filter((p) => {
        const pt = new Date(p.punch_time);
        const ptMin = pt.getHours() * 60 + pt.getMinutes();
        return ptMin >= wsMin - 60 && ptMin <= weMin; // -1hr before shift start
      });
    }

    if (!validPunches.length) continue; // No valid punches → skip (will stay absent)

    validPunches.sort((a, b) => new Date(a.punch_time) - new Date(b.punch_time));
    const firstIn = validPunches[0].punch_time;
    const lastOut = validPunches[validPunches.length - 1].punch_time;
    const isMissedPunch = validPunches.length === 1; // Only one punch = missed out-punch

    // Compute late minutes — purely: actualIn - shiftStart (NO grace period)
    // Late minutes are deducted from the monthly buffer pool instead
    let lateMinutes = 0;
    if (hasShift) {
      const shiftStartMin = timeToMinutes(shift.start_time);
      const actualInMin = new Date(firstIn).getHours() * 60 + new Date(firstIn).getMinutes();
      lateMinutes = Math.max(0, actualInMin - shiftStartMin);
    }

    // Compute worked minutes
    const worked = workedMinutes(firstIn, lastOut);
    const shiftMinutes = shift ? timeToMinutes(shift.end_time) - timeToMinutes(shift.start_time) : 480;

    // Determine attendance status (db enum only allows: present, absent, on_leave, lop, week_off, holiday)
    let status = 'present';
    if (isMissedPunch) {
      status = 'present'; // treat as present but flag missed punch
    }

    await q.upsertDailySummary({
      employee_id: empId,
      attendance_date: date,
      shift_id: shift?.shift_id ?? null,
      status,
      first_punch_in: firstIn,
      last_punch_out: isMissedPunch ? null : lastOut,
      worked_minutes: worked,
      late_minutes: lateMinutes,
      is_missed_punch: isMissedPunch,
      overtime_minutes: 0,
    });

    // Get the summary row we just upserted (need its id for buffer log)
    const summary = await q.getDailySummary(empId, date);

    // Buffer pool: absorb late minutes
    if (lateMinutes > 0 && summary) {
      const buffer = await q.getOrCreateBuffer(empId, month, year, defaultBuffer);
      const absorbable = Math.min(lateMinutes, buffer.buffer_remaining_minutes);
      if (absorbable > 0) {
        await q.deductFromBuffer(buffer.id, absorbable);
        const updatedBuffer = await q.getOrCreateBuffer(empId, month, year, defaultBuffer);
        await q.logBufferDeduction({
          employee_id: empId,
          attendance_date: date,
          late_minutes_deducted: absorbable,
          buffer_remaining_after: updatedBuffer.buffer_remaining_minutes,
          attendance_summary_id: summary.id,
        });
      }
    }

    processed++;
  }

  // Mark raw punches as processed
  await db.execute(
    `UPDATE attendance_raw_punches
     SET is_processed = 1
     WHERE DATE(punch_time) = ? AND is_processed = 0`,
    [date]
  );

  return { processed, date };
};

/* ─────────────────────────────────────────────
   PUNCH IMPORT (eTimeTracker CSV rows)
───────────────────────────────────────────── */

/**
 * Import raw punch data from eTimeTracker export.
 * Expects an array of objects: { employee_id, punch_time, device_id?, punch_type? }
 */
const importPunches = async (rows) => {
  if (!Array.isArray(rows) || !rows.length) {
    throw new AppError('No punch rows provided', 400);
  }
  // Minimal validation
  for (const r of rows) {
    if (!r.employee_id || !r.punch_time) {
      throw new AppError('Each row must have employee_id and punch_time', 400);
    }
  }
  await q.bulkInsertPunches(rows);
  return { imported: rows.length };
};

/* ─────────────────────────────────────────────
   ADMIN MANUAL MARK
───────────────────────────────────────────── */

const markAttendanceManually = async (employeeId, date, status, markedBy) => {
  const validStatuses = ['present', 'absent', 'half_day', 'week_off', 'holiday', 'late_present'];
  if (!validStatuses.includes(status)) {
    throw new AppError(`Invalid status. Allowed: ${validStatuses.join(', ')}`, 400);
  }
  await q.adminMarkAttendance(employeeId, date, status, markedBy);
};

/* ─────────────────────────────────────────────
   CORRECTION REQUESTS
───────────────────────────────────────────── */

const submitCorrectionRequest = async (data) => {
  if (!data.employee_id || !data.attendance_date || !data.reason) {
    throw new AppError('employee_id, attendance_date and reason are required', 400);
  }
  return q.createCorrectionRequest(data);
};

const reviewCorrectionRequest = async (requestId, decision, reviewedBy) => {
  const allowed = ['approved', 'rejected'];
  if (!allowed.includes(decision.status)) {
    throw new AppError('status must be approved or rejected', 400);
  }
  await q.reviewCorrectionRequest(requestId, { ...decision, reviewed_by: reviewedBy });

  // If approved, apply the correction to the daily summary
  if (decision.status === 'approved') {
    const [rows] = await db.execute(
      `SELECT * FROM attendance_correction_requests WHERE id = ?`, [requestId]
    );
    if (rows[0]) {
      const req = rows[0];
      const worked = req.requested_first_in && req.requested_last_out
        ? workedMinutes(req.requested_first_in, req.requested_last_out)
        : null;
      await q.upsertDailySummary({
        employee_id: req.employee_id,
        attendance_date: req.attendance_date,
        shift_id: null, // Preserve existing — this is a partial update via ON DUPLICATE KEY
        status: 'present',
        first_punch_in: req.requested_first_in,
        last_punch_out: req.requested_last_out,
        worked_minutes: worked ?? 0,
        late_minutes: 0,
        is_missed_punch: false,
      });
    }
  }
};

/* ─────────────────────────────────────────────
   BIOMETRIC WINDOW MANAGEMENT
───────────────────────────────────────────── */

const createBiometricWindow = async (data, createdBy) => {
  if (!data.window_date || !data.extended_start || !data.extended_end) {
    throw new AppError('window_date, extended_start and extended_end are required', 400);
  }
  return q.createBiometricWindow({ ...data, created_by: createdBy });
};

const addManualPunch = async (employeeId, date, checkIn, checkOut, overtimeMinutes = 0) => {
  if (!employeeId || !date || !checkIn) {
    throw new AppError('employeeId, date and checkIn are required', 400);
  }

  // Delete any existing punches for this employee on this date
  await q.deleteRawPunches(employeeId, date);

  const punchesToInsert = [];
  const checkInTime = `${date} ${checkIn.length === 5 ? checkIn + ':00' : checkIn}`;
  punchesToInsert.push({
    employee_id: employeeId,
    device_id: 'MANUAL',
    punch_time: checkInTime,
    punch_type: 'in'
  });

  if (checkOut) {
    const checkOutTime = `${date} ${checkOut.length === 5 ? checkOut + ':00' : checkOut}`;
    punchesToInsert.push({
      employee_id: employeeId,
      device_id: 'MANUAL',
      punch_time: checkOutTime,
      punch_type: 'out'
    });
  }

  await q.bulkInsertPunches(punchesToInsert);

  // Process attendance — computes late, worked, status, buffer deductions
  await processDailyAttendance(date);

  // After processing, upsert overtime_minutes (manual entry)
  if (overtimeMinutes > 0) {
    const summary = await q.getDailySummary(employeeId, date);
    if (summary) {
      await q.upsertDailySummary({
        employee_id: employeeId,
        attendance_date: date,
        shift_id: summary.shift_id,
        status: summary.status,
        first_punch_in: summary.first_punch_in,
        last_punch_out: summary.last_punch_out,
        worked_minutes: summary.worked_minutes,
        late_minutes: summary.late_minutes,
        is_missed_punch: summary.is_missed_punch,
        overtime_minutes: overtimeMinutes,
      });
    }
  }
};

/** Get buffer status for a single employee in the current month (for UI display). */
const getEmployeeBuffer = async (employeeId, month, year) => {
  return q.getEmployeeBufferWithRole(employeeId, month, year);
};

module.exports = {
  processDailyAttendance,
  importPunches,
  markAttendanceManually,
  submitCorrectionRequest,
  reviewCorrectionRequest,
  createBiometricWindow,
  addManualPunch,
  getEmployeeBuffer,
  listDailySummaries: q.listDailySummaries,
  getDailySummary: q.getDailySummary,
  listBiometricWindows: q.listBiometricWindows,
  listCorrectionRequests: q.listCorrectionRequests,
  getBufferSummary: q.getBufferSummary,
};
