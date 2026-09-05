/**
 * attendance.service.js
 * Business logic for the Attendance module.
 *
 * The punch rules, as confirmed by the client:
 *
 *   - A punch-IN only counts inside [biometric_in_start, biometric_in_end],
 *     where in_end is the shift start. "If in time is 9am, staff should keep
 *     bio before 9am."
 *   - A punch-OUT only counts inside [biometric_out_start, biometric_out_end],
 *     where out_start is the shift end. "If out time is 4pm, after 4pm staff
 *     should keep bio."
 *   - Night shifts use different clock times but identical rules.
 *
 * Two separate allowances, deliberately not conflated:
 *   - shifts.grace_period_minutes — a daily grace. Inside it you are not late.
 *   - staff_roles.monthly_buffer_minutes — a monthly pool. Lateness beyond the
 *     grace drains it; only what exceeds the pool is chargeable to payroll.
 */

const db = require('../../config/db');
const q = require('./attendance.queries');
const { AppError } = require('../../utils/errors');

/* ─────────────────────────────────────────────
   TIME HELPERS
───────────────────────────────────────────── */

/** 'HH:MM[:SS]' → minutes since midnight. */
const timeToMinutes = (t) => {
  if (!t) return null;
  const [h, m] = String(t).split(':').map(Number);
  return h * 60 + m;
};

/** A Date → minutes since midnight, in the server's local zone. */
const dateToMinutes = (d) => {
  const dt = new Date(d);
  return dt.getHours() * 60 + dt.getMinutes();
};

const toISODate = (d) =>
  d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);

const minutesBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));

/**
 * Is `minute` inside [start, end]? Handles windows that wrap past midnight,
 * which night shifts always produce (e.g. punch-in 18:00 → 20:00 is fine, but
 * punch-out 08:00 → 10:00 belongs to the following calendar day).
 */
const withinWindow = (minute, start, end) => {
  if (start === null || end === null) return true;
  return start <= end
    ? minute >= start && minute <= end
    : minute >= start || minute <= end; // wraps midnight
};

/** 'HH:MM[:SS]' shifted by deltaMinutes → 'HH:MM:SS' */
const adjustTimeMinutes = (timeStr, deltaMinutes) => {
  if (!timeStr) return null;
  const mins = timeToMinutes(timeStr);
  if (mins === null) return null;
  const adjusted = (mins + deltaMinutes + 1440 * 10) % 1440;
  const h = String(Math.floor(adjusted / 60)).padStart(2, '0');
  const m = String(adjusted % 60).padStart(2, '0');
  return `${h}:${m}:00`;
};

const buildResolvedShift = ({
  shift_id = null,
  shift_name = 'Default',
  start_time = '08:00:00',
  end_time = '18:00:00',
  is_night_shift = 0,
  grace_period_minutes = 10,
  is_week_off = 0,
  is_holiday = 0,
}) => {
  if (is_week_off || is_holiday) {
    return {
      shift_id: null,
      shift_name,
      start_time: null,
      end_time: null,
      is_night_shift: 0,
      grace_period_minutes: 0,
      biometric_in_start: null,
      biometric_in_end: null,
      biometric_out_start: null,
      biometric_out_end: null,
      is_week_off: is_week_off ? 1 : 0,
      is_holiday: is_holiday ? 1 : 0,
    };
  }
  const sTime = start_time.length === 5 ? `${start_time}:00` : start_time;
  const eTime = end_time.length === 5 ? `${end_time}:00` : end_time;

  return {
    shift_id,
    shift_name,
    start_time: sTime,
    end_time: eTime,
    is_night_shift: is_night_shift ? 1 : 0,
    grace_period_minutes: Number(grace_period_minutes) || 0,
    biometric_in_start: adjustTimeMinutes(sTime, -60),
    biometric_in_end: sTime,
    biometric_out_start: eTime,
    biometric_out_end: adjustTimeMinutes(eTime, 60),
    is_week_off: 0,
    is_holiday: 0,
  };
};

const DEFAULT_SHIFT = buildResolvedShift({
  shift_id: null,
  shift_name: 'Default (unrostered)',
  start_time: '08:00:00',
  end_time: '18:00:00',
  is_night_shift: 0,
  grace_period_minutes: 10,
});

/* ─────────────────────────────────────────────
   SHIFT RESOLUTION
───────────────────────────────────────────── */

/**
 * Which shift does this employee work on this date?
 * Priority order:
 *   1. employee_shift_overrides — per-day override for any category
 *   2. roster_entries — Day & Night duty roster (custom_start_time/end_time + buffer_minutes)
 *   3. employees category:
 *      - day / night: configured hospital-wide in shifts table (with grace_period_minutes)
 *      - general: individually configured per employee (custom_shift_start/end + custom_buffer_minutes)
 *   4. Hard fallback 08:00–18:00
 */
const getShiftForDate = async (employeeId, date) => {
  // Priority 1 — single-day override
  const [overrideRows] = await db.execute(
    `SELECT start_time, end_time FROM employee_shift_overrides
     WHERE employee_id = ? AND override_date = ? LIMIT 1`,
    [employeeId, date]
  );
  if (overrideRows.length) {
    const ov = overrideRows[0];
    const isNight = ov.start_time >= '18:00:00' || ov.end_time <= '09:00:00';
    return buildResolvedShift({
      shift_name: 'Override',
      start_time: ov.start_time,
      end_time: ov.end_time,
      is_night_shift: isNight ? 1 : 0,
      grace_period_minutes: 10,
    });
  }

  // Priority 2 — Day & Night duty roster (custom time ranges in roster_entries)
  const [rosterRows] = await db.execute(
    `SELECT re.custom_start_time, re.custom_end_time, re.buffer_minutes, re.is_week_off, re.is_holiday
     FROM roster_entries re
     WHERE re.employee_id = ? AND re.roster_date = ? LIMIT 1`,
    [employeeId, date]
  );
  if (rosterRows.length) {
    const re = rosterRows[0];
    if (re.is_week_off || re.is_holiday) {
      return buildResolvedShift({
        shift_name: re.is_holiday ? 'Holiday' : 'Week Off',
        is_week_off: re.is_week_off,
        is_holiday: re.is_holiday,
      });
    }
    if (re.custom_start_time && re.custom_end_time) {
      const isNight = re.custom_start_time >= '18:00:00';
      let grace = re.buffer_minutes;
      if (grace === null || grace === undefined) {
        const [sRows] = await db.execute(
          `SELECT grace_period_minutes FROM shifts WHERE is_night_shift = ? ORDER BY id ASC LIMIT 1`,
          [isNight ? 1 : 0]
        );
        grace = sRows[0]?.grace_period_minutes ?? 10;
      }
      return buildResolvedShift({
        shift_name: 'Roster',
        start_time: re.custom_start_time,
        end_time: re.custom_end_time,
        is_night_shift: isNight ? 1 : 0,
        grace_period_minutes: grace,
      });
    }
  }

  // Priority 3 — category resolution
  const [empRows] = await db.execute(
    `SELECT shift_category, custom_shift_start, custom_shift_end, custom_buffer_minutes FROM employees WHERE id = ? LIMIT 1`,
    [employeeId]
  );
  if (empRows.length) {
    const emp = empRows[0];

    // Day and Night shifts always follow the hospital-wide configured timing from shifts table
    if (emp.shift_category === 'day' || emp.shift_category === 'night') {
      const isNight = emp.shift_category === 'night';
      const [shiftRows] = await db.execute(
        `SELECT id, name, start_time, end_time, grace_period_minutes FROM shifts WHERE is_night_shift = ? ORDER BY id ASC LIMIT 1`,
        [isNight ? 1 : 0]
      );
      const configured = shiftRows[0];
      const start = configured?.start_time || (isNight ? '18:00:00' : '08:00:00');
      const end = configured?.end_time || (isNight ? '08:00:00' : '18:00:00');
      const grace = configured?.grace_period_minutes ?? 10;
      return buildResolvedShift({
        shift_id: configured?.id ?? null,
        shift_name: configured?.name || (isNight ? 'Night Shift' : 'Day Shift'),
        start_time: start,
        end_time: end,
        is_night_shift: isNight ? 1 : 0,
        grace_period_minutes: grace,
      });
    }

    // General shift: configured for each employee (individual timing and buffer)
    if (emp.shift_category === 'general') {
      const start = emp.custom_shift_start || '09:00:00';
      const end = emp.custom_shift_end || '17:00:00';
      const isNight = start >= '18:00:00';
      const grace = emp.custom_buffer_minutes ?? 10;
      return buildResolvedShift({
        shift_name: 'General Shift',
        start_time: start,
        end_time: end,
        is_night_shift: isNight ? 1 : 0,
        grace_period_minutes: grace,
      });
    }

    // Fallback custom timing
    if (emp.custom_shift_start && emp.custom_shift_end) {
      const isNight = emp.custom_shift_start >= '18:00:00';
      const grace = emp.custom_buffer_minutes ?? 10;
      return buildResolvedShift({
        shift_name: emp.shift_category ?? 'Custom',
        start_time: emp.custom_shift_start,
        end_time: emp.custom_shift_end,
        is_night_shift: isNight ? 1 : 0,
        grace_period_minutes: grace,
      });
    }
  }

  // Priority 4 — hard fallback
  return buildResolvedShift({
    shift_name: 'Default (unrostered)',
    start_time: '08:00:00',
    end_time: '18:00:00',
    is_night_shift: 0,
    grace_period_minutes: 10,
  });
};


/** DEFAULT_BUFFER_MINUTES from system_config, used when a role sets none. */
const getDefaultBufferMinutes = async () => {
  const [rows] = await db.execute(
    `SELECT config_value FROM system_config WHERE config_key = 'DEFAULT_BUFFER_MINUTES'`
  );
  return rows[0] ? parseInt(rows[0].config_value, 10) : 30;
};

/* ─────────────────────────────────────────────
   PUNCH CLASSIFICATION
───────────────────────────────────────────── */

/**
 * Split a day's punches into arrival-side and departure-side.
 *
 * biometric_in_end (the shift start) is the time staff are *expected* to have
 * punched in by — not a cutoff that rejects them. Someone arriving at 09:25 for
 * a 09:00 shift has still arrived; they are simply late, and that lateness eats
 * the buffer. So the arrival side runs from biometric_in_start until the
 * departure window opens, and the departure side is the configured out window.
 *
 * Punches outside both are ignored for the summary but kept in the raw table.
 */
const classifyPunches = (punches, shift, override) => {
  // An admin override for the date replaces both windows with one wide window,
  // so everything inside it is in play and direction falls back to ordering.
  if (override) {
    const oStart = timeToMinutes(override.extended_start);
    const oEnd = timeToMinutes(override.extended_end);
    const inside = punches.filter((p) => withinWindow(dateToMinutes(p.punch_time), oStart, oEnd));
    const ignored = punches.filter((p) => !inside.includes(p));
    if (!inside.length) return { ins: [], outs: [], ignored };
    return {
      ins: inside.slice(0, Math.max(1, inside.length - 1)),
      outs: inside.length > 1 ? [inside[inside.length - 1]] : [],
      ignored,
    };
  }

  const inStart = timeToMinutes(shift.biometric_in_start);
  const outStart = timeToMinutes(shift.biometric_out_start);
  const outEnd = timeToMinutes(shift.biometric_out_end);

  const ins = [];
  const outs = [];
  const ignored = [];

  for (const p of punches) {
    const minute = dateToMinutes(p.punch_time);
    if (withinWindow(minute, outStart, outEnd)) outs.push(p);
    else if (withinWindow(minute, inStart, outStart)) ins.push(p);
    else ignored.push(p);
  }

  return { ins, outs, ignored };
};

/**
 * Break time = the gaps between the middle punch pairs.
 * With punches [09:08, 13:04, 13:46, 18:11] the span is 9h03m, of which 42m is
 * the 13:04→13:46 gap, giving 8h21m worked. Pairing is (out,in), (out,in)…
 */
const computeBreakMinutes = (sortedPunches) => {
  if (sortedPunches.length < 4) return 0;
  const middle = sortedPunches.slice(1, -1);
  let breakMins = 0;
  for (let i = 0; i + 1 < middle.length; i += 2) {
    breakMins += minutesBetween(middle[i].punch_time, middle[i + 1].punch_time);
  }
  return breakMins;
};

/* ─────────────────────────────────────────────
   CORE ENGINE
───────────────────────────────────────────── */

/**
 * Turn a day's raw punches into daily summary rows.
 *
 * @param {string} date YYYY-MM-DD
 */
const processDailyAttendance = async (date) => {
  // Pick up any punches whose employee_code has since been registered.
  await q.linkOrphanPunches();

  const defaultBuffer = await getDefaultBufferMinutes();
  const punches = await q.getUnprocessedPunches(date, date);
  if (!punches.length) return { processed: 0, skipped: 0, date };

  const byEmployee = {};
  for (const p of punches) {
    (byEmployee[p.employee_id] ||= { employee: p, punches: [] }).punches.push(p);
  }

  const [month, year] = [Number(date.slice(5, 7)), Number(date.slice(0, 4))];
  let processed = 0;
  let skipped = 0;

  for (const empId of Object.keys(byEmployee)) {
    const employeeId = Number(empId);
    const { employee, punches: empPunches } = byEmployee[empId];

    const shift = await getShiftForDate(employeeId, date);
    const override = await q.getBiometricWindow(date, employee.designation_id ?? null);

    empPunches.sort((a, b) => new Date(a.punch_time) - new Date(b.punch_time));
    const { ins, outs } = classifyPunches(empPunches, shift, override);

    if (!ins.length && !outs.length) {
      // Every punch fell outside the accepted windows.
      skipped++;
      continue;
    }

    const firstIn = ins.length ? ins[0].punch_time : null;
    const lastOut = outs.length ? outs[outs.length - 1].punch_time : null;
    const isMissedPunch = !firstIn || !lastOut;

    // Lateness is measured against the shift start, after the daily grace.
    let lateMinutes = 0;
    if (firstIn && shift.start_time) {
      let rawLate = dateToMinutes(firstIn) - timeToMinutes(shift.start_time);
      if (shift.is_night_shift && rawLate < -360) {
        rawLate += 1440;
      }
      lateMinutes = Math.max(0, rawLate - (shift.grace_period_minutes ?? 0));
    }

    const accepted = [...ins, ...outs].sort((a, b) => new Date(a.punch_time) - new Date(b.punch_time));
    const breakMinutes = computeBreakMinutes(accepted);
    const span = firstIn && lastOut ? minutesBetween(firstIn, lastOut) : 0;
    const workedMinutes = Math.max(0, span - breakMinutes);

    let earlyLeaveMinutes = 0;
    if (lastOut && shift.end_time) {
      let rawEarly = timeToMinutes(shift.end_time) - dateToMinutes(lastOut);
      if (shift.is_night_shift && rawEarly < -360) {
        rawEarly += 1440;
      }
      earlyLeaveMinutes = Math.max(0, rawEarly);
    }

    const status = lateMinutes > 0 ? 'late_present' : 'present';

    await q.upsertDailySummary({
      employee_id: employeeId,
      attendance_date: date,
      shift_id: shift.shift_id ?? null,
      status,
      first_punch_in: firstIn,
      last_punch_out: lastOut,
      worked_minutes: workedMinutes,
      break_minutes: breakMinutes,
      late_minutes: lateMinutes,
      early_leave_minutes: earlyLeaveMinutes,
      is_missed_punch: isMissedPunch,
      biometric_window_extended: !!override,
      overtime_minutes: 0,
    });

    // Drain the monthly pool with whatever lateness survived the daily grace.
    if (lateMinutes > 0) {
      const summary = await q.getDailySummary(employeeId, date);
      const buffer = await q.getOrCreateBuffer(employeeId, month, year, defaultBuffer);
      const remaining = Number(buffer.buffer_remaining_minutes ?? buffer.buffer_allocated_minutes);
      const absorbable = Math.min(lateMinutes, Math.max(0, remaining));
      if (absorbable > 0 && summary) {
        await q.deductFromBuffer(buffer.id, absorbable);
        const updated = await q.getOrCreateBuffer(employeeId, month, year, defaultBuffer);
        await q.logBufferDeduction({
          employee_id: employeeId,
          attendance_date: date,
          late_minutes_deducted: absorbable,
          buffer_remaining_after: updated.buffer_remaining_minutes ?? 0,
          attendance_summary_id: summary.id,
        });
      }
    }

    processed++;
  }

  await db.execute(
    `UPDATE attendance_raw_punches
     SET is_processed = 1
     WHERE DATE(punch_time) = ? AND is_processed = 0 AND employee_id IS NOT NULL`,
    [date]
  );

  return { processed, skipped, date };
};

/* ─────────────────────────────────────────────
   PUNCH IMPORT
───────────────────────────────────────────── */

/**
 * Import raw punches. Rows may identify the employee by employee_code (what the
 * device exports) or employee_id. Codes that match nobody are still stored —
 * they are real punches — and reported back so the admin can fix the mapping.
 */
const importPunches = async (rows) => {
  if (!Array.isArray(rows) || !rows.length) {
    throw new AppError('No punch rows provided', 400);
  }

  const prepared = [];
  for (const [i, r] of rows.entries()) {
    if (!r.punch_time) throw new AppError(`Row ${i + 1}: punch_time is required`, 400);
    if (!r.employee_code && !r.employee_id) {
      throw new AppError(`Row ${i + 1}: employee_code or employee_id is required`, 400);
    }
    prepared.push({ ...r });
  }

  // Fill in the missing half of the code/id pair in both directions.
  const codes = [...new Set(prepared.filter((r) => r.employee_code).map((r) => String(r.employee_code)))];
  const codeToId = await q.resolveEmployeeCodes(codes);

  const idsNeedingCode = [...new Set(prepared.filter((r) => !r.employee_code && r.employee_id).map((r) => r.employee_id))];
  let idToCode = new Map();
  if (idsNeedingCode.length) {
    const placeholders = idsNeedingCode.map(() => '?').join(',');
    const [found] = await db.query(
      `SELECT id, employee_code FROM employees WHERE id IN (${placeholders})`,
      idsNeedingCode
    );
    idToCode = new Map(found.map((e) => [e.id, e.employee_code]));
  }

  const unmatchedCodes = new Set();
  const toInsert = prepared.map((r) => {
    const code = r.employee_code ? String(r.employee_code) : idToCode.get(r.employee_id);
    const id = r.employee_id ?? codeToId.get(code) ?? null;
    if (!id) unmatchedCodes.add(code);
    return {
      employee_code: code,
      employee_id: id,
      device_id: r.device_id ?? null,
      punch_time: r.punch_time,
      punch_type: r.punch_type ?? null,
    };
  });

  const missingCode = toInsert.find((r) => !r.employee_code);
  if (missingCode) {
    throw new AppError('Some rows reference an employee_id that does not exist', 400);
  }

  const { inserted } = await q.bulkInsertPunches(toInsert);

  // Link orphan punches
  await q.linkOrphanPunches();

  // Automatically recalculate attendance summaries for all affected dates
  const affectedDates = [...new Set(toInsert.map((r) => String(r.punch_time).slice(0, 10)).filter(Boolean))];
  let recalculatedDays = 0;
  for (const dt of affectedDates) {
    try {
      await processDay(dt);
      recalculatedDays++;
    } catch (e) {
      console.warn(`Failed to auto-process attendance for date ${dt}:`, e.message);
    }
  }

  return {
    received: rows.length,
    inserted,
    duplicatesIgnored: rows.length - inserted,
    unmatchedCodes: [...unmatchedCodes],
    affectedDates,
    recalculatedDays,
  };
};

/* ─────────────────────────────────────────────
   ADMIN ACTIONS
───────────────────────────────────────────── */

const markAttendanceManually = async (employeeId, date, status, markedBy) => {
  // Must match the attendance_daily_summary.status enum exactly.
  const validStatuses = ['present', 'late_present', 'absent', 'on_leave', 'lop', 'week_off', 'holiday'];
  if (!validStatuses.includes(status)) {
    throw new AppError(`Invalid status. Allowed: ${validStatuses.join(', ')}`, 400);
  }
  await q.adminMarkAttendance(employeeId, date, status, markedBy);
};

const submitCorrectionRequest = async (data) => {
  if (!data.employee_id || !data.attendance_date || !data.reason) {
    throw new AppError('employee_id, attendance_date and reason are required', 400);
  }
  return q.createCorrectionRequest(data);
};

const reviewCorrectionRequest = async (requestId, decision, reviewedBy) => {
  if (!['approved', 'rejected'].includes(decision.status)) {
    throw new AppError('status must be approved or rejected', 400);
  }

  const req = await q.getCorrectionRequest(requestId);
  if (!req) throw new AppError('Correction request not found', 404);
  if (req.status !== 'pending') {
    throw new AppError(`This request was already ${req.status}`, 400);
  }

  await q.reviewCorrectionRequest(requestId, { status: decision.status, reviewed_by: reviewedBy });
  if (decision.status !== 'approved') return;

  const attendanceDate = toISODate(req.attendance_date);
  const shift = await getShiftForDate(req.employee_id, attendanceDate);

  let lateMinutes = 0;
  if (req.requested_in_time && shift.start_time) {
    const rawLate = dateToMinutes(req.requested_in_time) - timeToMinutes(shift.start_time);
    lateMinutes = Math.max(0, rawLate - (shift.grace_period_minutes ?? 0));
  }
  const worked = req.requested_in_time && req.requested_out_time
    ? minutesBetween(req.requested_in_time, req.requested_out_time)
    : 0;

  await q.upsertDailySummary({
    employee_id: req.employee_id,
    attendance_date: attendanceDate,
    shift_id: shift.shift_id ?? null,
    status: lateMinutes > 0 ? 'late_present' : 'present',
    first_punch_in: req.requested_in_time,
    last_punch_out: req.requested_out_time,
    worked_minutes: worked,
    break_minutes: 0,
    late_minutes: lateMinutes,
    early_leave_minutes: 0,
    is_missed_punch: false,
    overtime_minutes: 0,
  });
};

const createBiometricWindow = async (data, createdBy) => {
  if (!data.window_date || !data.extended_start || !data.extended_end) {
    throw new AppError('window_date, extended_start and extended_end are required', 400);
  }
  return q.createBiometricWindow({ ...data, created_by: createdBy });
};

/**
 * Record a manual in/out for one employee on one date, replacing whatever raw
 * punches exist for that day, then reprocess just that employee.
 */
const addManualPunch = async (employeeId, date, checkIn, checkOut, overtimeMinutes = 0) => {
  if (!employeeId || !date || !checkIn) {
    throw new AppError('employeeId, date and checkIn are required', 400);
  }

  const [emp] = await db.execute(`SELECT employee_code FROM employees WHERE id = ?`, [employeeId]);
  if (!emp.length) throw new AppError('Employee not found', 404);
  const employeeCode = emp[0].employee_code;

  await q.deleteRawPunches(employeeId, date);

  const stamp = (t) => `${date} ${String(t).length === 5 ? `${t}:00` : t}`;
  const rows = [{
    employee_code: employeeCode, employee_id: employeeId,
    device_id: 'MANUAL', punch_time: stamp(checkIn), punch_type: 'in',
  }];
  if (checkOut) {
    rows.push({
      employee_code: employeeCode, employee_id: employeeId,
      device_id: 'MANUAL', punch_time: stamp(checkOut), punch_type: 'out',
    });
  }

  await q.bulkInsertPunches(rows);
  await processDailyAttendance(date);

  if (overtimeMinutes > 0) {
    const summary = await q.getDailySummary(employeeId, date);
    if (summary) {
      await q.upsertDailySummary({
        employee_id: employeeId,
        attendance_date: date,
        shift_id: summary.shift_id,
        status: summary.status,
        first_punch_in: summary.first_in_time,
        last_punch_out: summary.last_out_time,
        worked_minutes: summary.worked_minutes,
        break_minutes: summary.break_minutes,
        late_minutes: summary.late_minutes,
        early_leave_minutes: summary.early_leave_minutes,
        is_missed_punch: summary.is_missed_punch,
        overtime_minutes: overtimeMinutes,
      });
    }
  }

  return q.getDailySummary(employeeId, date);
};

const getEmployeeBuffer = async (employeeId, month, year) =>
  q.getEmployeeBufferWithRole(employeeId, month, year);

module.exports = {
  processDailyAttendance,
  importPunches,
  markAttendanceManually,
  submitCorrectionRequest,
  reviewCorrectionRequest,
  createBiometricWindow,
  addManualPunch,
  getEmployeeBuffer,
  getShiftForDate,
  classifyPunches,
  listDailySummaries: q.listDailySummaries,
  getDailySummary: q.getDailySummary,
  listBiometricWindows: q.listBiometricWindows,
  listCorrectionRequests: q.listCorrectionRequests,
  getBufferSummary: q.getBufferSummary,
  getUnmatchedPunches: q.getUnmatchedPunches,
};
