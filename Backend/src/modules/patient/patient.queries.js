/**
 * patient.queries.js
 * All raw SQL for Patient Records, Appointment/Token, Admission & Bed
 * Management, and Discharge & Patient History.
 *
 * Rewritten against the live schema — the previous version's
 * createAppointment/createAdmission/createDischarge referenced columns that
 * never existed (appointments.department_id/type/consult_fee/booked_by,
 * admission_beds.allocated_from/allocated_to) and would fail on first use.
 */

const db = require('../../config/db');

/* ─────────────────────────────────────────────
   PATIENTS
───────────────────────────────────────────── */

const listPatients = async ({ search, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  let whereClause = '';
  const params = [];
  if (search) {
    whereClause = `WHERE (full_name LIKE ? OR mobile_number LIKE ? OR id = ?)`;
    const s = `%${search}%`;
    const numId = parseInt(search, 10) || 0;
    params.push(s, s, numId);
  }

  const [rows] = await db.query(
    `SELECT * FROM patients ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM patients ${whereClause}`, params);
  return { rows, total };
};

/**
 * One mobile number can belong to several patients (a family). Reception
 * always needs every name+age on that number together so a father and son
 * are never confused for one another.
 */
const findPatientsByMobile = async (mobile) => {
  const [rows] = await db.execute(
    `SELECT * FROM patients WHERE mobile_number = ? ORDER BY full_name`,
    [mobile]
  );
  return rows;
};

const getPatient = async (id) => {
  const [rows] = await db.query(`SELECT * FROM patients WHERE id = ?`, [id]);
  return rows[0] ?? null;
};

const createPatient = async (data) => {
  const { full_name, date_of_birth, age_years, gender, mobile_number, address, blood_group, notes } = data;
  const [result] = await db.query(
    `INSERT INTO patients (full_name, date_of_birth, age_years, gender, mobile_number, address, blood_group, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [full_name, date_of_birth ?? null, age_years ?? null, gender, mobile_number,
     address ?? null, blood_group ?? null, notes ?? null]
  );
  return result.insertId;
};

const updatePatient = async (id, data) => {
  const allowed = ['full_name', 'date_of_birth', 'age_years', 'gender', 'mobile_number', 'address', 'blood_group', 'notes'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      vals.push(data[key] === '' ? null : data[key]);
    }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.query(`UPDATE patients SET ${fields.join(', ')} WHERE id = ?`, vals);
};

/* ─────────────────────────────────────────────
   APPOINTMENTS / TOKEN
───────────────────────────────────────────── */

const listAppointments = async ({ patientId, doctorId, date, status, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (patientId) { filters.push('a.patient_id = ?'); params.push(patientId); }
  if (doctorId) { filters.push('a.doctor_id = ?'); params.push(doctorId); }
  if (date) { filters.push('a.appointment_date = ?'); params.push(date); }
  if (status) { filters.push('a.status = ?'); params.push(status); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT a.*, p.full_name AS patient_name, p.age_years, p.gender, p.mobile_number AS mobile,
            e.full_name AS doctor_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     LEFT JOIN employees e ON e.id = a.doctor_id
     ${where}
     ORDER BY a.appointment_date DESC, a.token_number ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM appointments a ${where}`, params);
  return { rows, total };
};

const getAppointment = async (id) => {
  const [rows] = await db.execute(
    `SELECT a.*, p.full_name AS patient_name, p.age_years, p.gender, p.mobile_number AS mobile,
            e.full_name AS doctor_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     LEFT JOIN employees e ON e.id = a.doctor_id
     WHERE a.id = ?`,
    [id]
  );
  return rows[0] ?? null;
};

/** Next token for a calendar date — a single hospital-wide counter (system_config.TOKEN_SCOPE). */
const getNextTokenNumber = async (appointmentDate) => {
  const [rows] = await db.execute(
    `SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token
     FROM appointments WHERE appointment_date = ?`,
    [appointmentDate]
  );
  return rows[0].next_token;
};

const createAppointment = async (data) => {
  const {
    patient_id, doctor_id, appointment_date, token_number,
    is_future_booking, visit_type, receptionist_notes, created_by,
  } = data;
  const [result] = await db.query(
    `INSERT INTO appointments
       (patient_id, doctor_id, appointment_date, token_number, is_future_booking, visit_type,
        receptionist_notes, created_by, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'waiting')`,
    [patient_id, doctor_id, appointment_date, token_number,
     is_future_booking ? 1 : 0, visit_type ?? 'walk_in', receptionist_notes ?? null, created_by ?? null]
  );
  return result.insertId;
};

const updateAppointmentStatus = async (id, status, closedBy = null) => {
  const closesVisit = ['closed', 'cancelled', 'completed', 'converted_to_admission'].includes(status);
  if (closesVisit) {
    await db.execute(
      `UPDATE appointments SET status = ?, closed_at = NOW(), closed_by = ? WHERE id = ?`,
      [status, closedBy, id]
    );
  } else {
    await db.execute(`UPDATE appointments SET status = ? WHERE id = ?`, [status, id]);
  }
};

/**
 * Mark a walk-in visit as payment_pending (Save & Move to Payment).
 * The appointment stays open (not 'closed') until full payment is collected.
 * doctor_fee is stored on the appointment row for the payment page to read.
 */
const markAppointmentPaymentPending = async (appointmentId, doctorFee) => {
  await db.execute(
    `UPDATE appointments SET status = 'payment_pending', doctor_fee = ? WHERE id = ?`,
    [doctorFee ?? 0, appointmentId]
  );
};

/** Actually close an appointment after payment is collected. */
const closeAppointment = async (appointmentId, closedBy) => {
  await db.execute(
    `UPDATE appointments SET status = 'closed', closed_at = NOW(), closed_by = ? WHERE id = ?`,
    [closedBy ?? null, appointmentId]
  );
};

// Keep legacy name for backward compat if referenced elsewhere
const closeWalkInVisit = markAppointmentPaymentPending;

const getAppointmentPayments = async (appointmentId) => {
  const [rows] = await db.execute(
    `SELECT ap.*, u.username AS received_by_name
     FROM appointment_payments ap
     LEFT JOIN users u ON u.id = ap.received_by
     WHERE ap.appointment_id = ? ORDER BY ap.paid_at`,
    [appointmentId]
  );
  return rows;
};

/* ─────────────────────────────────────────────
   ADMISSIONS & BEDS
───────────────────────────────────────────── */

const listAdmissions = async ({ patientId, status, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (patientId) { filters.push('ad.patient_id = ?'); params.push(patientId); }
  if (status) {
    if (status === 'admitted') {
      filters.push("ad.status IN ('admitted', 'payment_pending')");
    } else {
      filters.push('ad.status = ?');
      params.push(status);
    }
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT ad.*, p.full_name AS patient_name, p.age_years, p.gender, p.mobile_number AS mobile,
            e.full_name AS doctor_name
     FROM admissions ad
     JOIN patients p ON p.id = ad.patient_id
     LEFT JOIN employees e ON e.id = ad.admitting_doctor_id
     ${where}
     ORDER BY ad.admission_datetime DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM admissions ad ${where}`, params);
  return { rows, total };
};

const getAdmission = async (id) => {
  const [rows] = await db.execute(
    `SELECT ad.*, p.full_name AS patient_name, p.age_years, p.gender, p.mobile_number AS mobile,
            e.full_name AS doctor_name
     FROM admissions ad
     JOIN patients p ON p.id = ad.patient_id
     LEFT JOIN employees e ON e.id = ad.admitting_doctor_id
     WHERE ad.id = ?`,
    [id]
  );
  if (!rows.length) return null;

  const [beds] = await db.execute(
    `SELECT ab.*, b.bed_label, r.room_number, rt.name AS room_type_name, rt.daily_rate,
            w.name AS ward_name
     FROM admission_beds ab
     JOIN beds b ON b.id = ab.bed_id
     JOIN rooms r ON r.id = b.room_id
     JOIN room_types rt ON rt.id = r.room_type_id
     JOIN wards w ON w.id = r.ward_id
     WHERE ab.admission_id = ?
     ORDER BY ab.occupied_from`,
    [id]
  );
  return { ...rows[0], beds };
};

/**
 * Admit a patient, optionally spanning several beds (a stay can need more
 * than one room over time, or several beds at once).
 */
const createAdmission = async ({ patient_id, appointment_id, admitting_doctor_id, admission_datetime, notes, created_by, bed_ids }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO admissions (patient_id, appointment_id, admitting_doctor_id, admission_datetime, notes, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, 'admitted')`,
      [patient_id, appointment_id ?? null, admitting_doctor_id, admission_datetime ?? new Date(), notes ?? null, created_by ?? null]
    );
    const admissionId = result.insertId;

    for (const bedId of bed_ids ?? []) {
      const [[bed]] = await conn.execute(`SELECT status FROM beds WHERE id = ? FOR UPDATE`, [bedId]);
      if (!bed) throw new Error(`Bed ${bedId} does not exist`);
      if (bed.status !== 'available') throw new Error(`Bed ${bedId} is not available (status: ${bed.status})`);

      await conn.execute(
        `INSERT INTO admission_beds (admission_id, bed_id, occupied_from) VALUES (?, ?, NOW())`,
        [admissionId, bedId]
      );
      await conn.execute(`UPDATE beds SET status = 'occupied' WHERE id = ?`, [bedId]);
    }

    if (appointment_id) {
      await conn.execute(`UPDATE appointments SET status = 'converted_to_admission' WHERE id = ?`, [appointment_id]);
    }

    await conn.commit();
    return admissionId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** Assign an additional/replacement bed mid-stay. */
const assignBed = async (admissionId, bedId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[bed]] = await conn.execute(`SELECT status FROM beds WHERE id = ? FOR UPDATE`, [bedId]);
    if (!bed) throw new Error(`Bed ${bedId} does not exist`);
    if (bed.status !== 'available') throw new Error(`Bed ${bedId} is not available (status: ${bed.status})`);

    await conn.execute(
      `INSERT INTO admission_beds (admission_id, bed_id, occupied_from) VALUES (?, ?, NOW())`,
      [admissionId, bedId]
    );
    await conn.execute(`UPDATE beds SET status = 'occupied' WHERE id = ?`, [bedId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** Release one bed from an admission without discharging the patient (a room change). */
const releaseBedFromAdmission = async (admissionId, bedId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE admission_beds SET occupied_to = NOW()
       WHERE admission_id = ? AND bed_id = ? AND occupied_to IS NULL`,
      [admissionId, bedId]
    );
    await conn.execute(`UPDATE beds SET status = 'available' WHERE id = ?`, [bedId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/* ─────────────────────────────────────────────
   DISCHARGE CHARGE COMPUTATION
───────────────────────────────────────────── */

/** Room charges = each bed-stay segment's nights (min. 1) × its room type's daily rate. */
const computeRoomCharges = async (admissionId) => {
  const [rows] = await db.execute(
    `SELECT ab.occupied_from, ab.occupied_to, rt.daily_rate
     FROM admission_beds ab
     JOIN beds b ON b.id = ab.bed_id
     JOIN rooms r ON r.id = b.room_id
     JOIN room_types rt ON rt.id = r.room_type_id
     WHERE ab.admission_id = ?`,
    [admissionId]
  );
  let total = 0;
  const breakdown = [];
  for (const r of rows) {
    const from = new Date(r.occupied_from);
    const to = r.occupied_to ? new Date(r.occupied_to) : new Date();
    const nights = Math.max(1, Math.ceil((to - from) / (1000 * 60 * 60 * 24)));
    const charge = nights * Number(r.daily_rate);
    total += charge;
    breakdown.push({ nights, daily_rate: Number(r.daily_rate), charge });
  }
  return { total: Math.round(total * 100) / 100, breakdown };
};

/** Pharmacy charges = every bill raised against this admission. */
const computePharmacyCharges = async (admissionId) => {
  const [[row]] = await db.execute(
    `SELECT COALESCE(SUM(net_amount), 0) AS total FROM pharmacy_bills WHERE admission_id = ?`,
    [admissionId]
  );
  return Number(row.total);
};

/* ─────────────────────────────────────────────
   DISCHARGES
───────────────────────────────────────────── */

const getDischargeByAdmission = async (admissionId) => {
  const [rows] = await db.execute(`SELECT * FROM discharges WHERE admission_id = ?`, [admissionId]);
  return rows[0] ?? null;
};

/**
 * Discharge a patient. Beds go to 'pending_clearance', NOT 'available' —
 * they only become available once the bill is fully paid (see
 * releaseBedsIfPaid). This is a confirmed, deliberate rule.
 */
/**
 * Save discharge clinical data + fee breakdown (Save & Move to Payment).
 * Does NOT record payment — payment_status = 'pending'.
 * Admission stays as 'admitted'; beds remain occupied until payment is complete.
 */
const createDischarge = async (data) => {
  const {
    admission_id, discharge_datetime, diagnosis_summary, treatment_summary, doctor_advice,
    discharge_condition, room_charges, pharmacy_charges, doctor_fee, other_charges,
    follow_up_date, final_bill_amount, discharge_notes, discharged_by,
  } = data;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Check if discharge record already exists (upsert pattern)
    const [[existing]] = await conn.execute(
      `SELECT id FROM discharges WHERE admission_id = ?`, [admission_id]
    );

    let dischargeId;
    if (existing) {
      // Update existing record (re-saving discharge details)
      await conn.execute(
        `UPDATE discharges SET
           discharge_datetime = ?, diagnosis_summary = ?, treatment_summary = ?,
           doctor_advice = ?, discharge_condition = ?, room_charges = ?,
           pharmacy_charges = ?, doctor_fee = ?, other_charges = ?,
           follow_up_date = ?, final_bill_amount = ?,
           balance_due = ?, discharge_notes = ?, discharged_by = ?,
           payment_status = 'pending'
         WHERE admission_id = ?`,
        [discharge_datetime ?? new Date(), diagnosis_summary ?? null, treatment_summary ?? null,
         doctor_advice ?? null, discharge_condition ?? 'recovered', room_charges ?? 0,
         pharmacy_charges ?? 0, doctor_fee ?? 0, other_charges ?? 0, follow_up_date ?? null,
         final_bill_amount ?? 0, final_bill_amount ?? 0,
         discharge_notes ?? null, discharged_by ?? null, admission_id]
      );
      dischargeId = existing.id;
    } else {
      const [result] = await conn.execute(
        `INSERT INTO discharges
           (admission_id, discharge_datetime, diagnosis_summary, treatment_summary, doctor_advice,
            discharge_condition, room_charges, pharmacy_charges, doctor_fee, other_charges,
            follow_up_date, final_bill_amount, amount_paid, balance_due, payment_mode,
            discharge_notes, discharged_by, payment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'cash', ?, ?, 'pending')`,
        [admission_id, discharge_datetime ?? new Date(), diagnosis_summary ?? null, treatment_summary ?? null,
         doctor_advice ?? null, discharge_condition ?? 'recovered', room_charges ?? 0,
         pharmacy_charges ?? 0, doctor_fee ?? 0, other_charges ?? 0, follow_up_date ?? null,
         final_bill_amount ?? 0, final_bill_amount ?? 0,
         discharge_notes ?? null, discharged_by ?? null]
      );
      dischargeId = result.insertId;
    }

    // Mark admission as payment_pending (not discharged yet)
    await conn.execute(`UPDATE admissions SET status = 'payment_pending' WHERE id = ?`, [admission_id]);

    // Beds remain occupied — no status change until payment is collected

    await conn.commit();
    return dischargeId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Finalize discharge after full payment: mark admission 'discharged',
 * set beds to pending_clearance (released to 'available' once fully paid).
 */
const finalizeDischarge = async (admissionId) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`UPDATE admissions SET status = 'discharged' WHERE id = ?`, [admissionId]);
    const [beds] = await conn.execute(
      `SELECT bed_id FROM admission_beds WHERE admission_id = ? AND occupied_to IS NULL`,
      [admissionId]
    );
    for (const { bed_id } of beds) {
      await conn.execute(`UPDATE beds SET status = 'pending_clearance' WHERE id = ?`, [bed_id]);
      await conn.execute(
        `UPDATE admission_beds SET occupied_to = NOW() WHERE admission_id = ? AND bed_id = ? AND occupied_to IS NULL`,
        [admissionId, bed_id]
      );
    }
    await conn.commit();
    return beds.length;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** Record an additional payment against an already-discharged patient's bill. */
const recordDischargePayment = async (dischargeId, amount) => {
  await db.execute(
    `UPDATE discharges
     SET amount_paid = amount_paid + ?, balance_due = GREATEST(0, balance_due - ?)
     WHERE id = ?`,
    [amount, amount, dischargeId]
  );
};

/** Beds still pending_clearance whose discharge bill is now fully paid become available. */
const releaseBedsIfPaid = async (admissionId) => {
  const [[discharge]] = await db.execute(
    `SELECT balance_due FROM discharges WHERE admission_id = ?`, [admissionId]
  );
  if (!discharge || Number(discharge.balance_due) > 0) return { released: 0 };

  const [beds] = await db.execute(
    `SELECT bed_id FROM admission_beds WHERE admission_id = ?`, [admissionId]
  );
  for (const { bed_id } of beds) {
    await db.execute(
      `UPDATE beds SET status = 'available' WHERE id = ? AND status = 'pending_clearance'`,
      [bed_id]
    );
  }
  return { released: beds.length };
};

/* ─────────────────────────────────────────────
   ADMISSION DAILY NOTES (day-wise vitals/advice)
───────────────────────────────────────────── */

const createAdmissionDailyNote = async (data) => {
  const { admission_id, note_date, doctor_id, bp, pulse, temperature, spo2, advice, created_by } = data;
  const [result] = await db.execute(
    `INSERT INTO admission_daily_notes (admission_id, note_date, doctor_id, bp, pulse, temperature, spo2, advice, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [admission_id, note_date, doctor_id ?? null, bp ?? null, pulse ?? null, temperature ?? null, spo2 ?? null, advice ?? null, created_by ?? null]
  );
  return result.insertId;
};

const listAdmissionDailyNotes = async (admissionId) => {
  const [rows] = await db.execute(
    `SELECT n.*, e.full_name AS doctor_name
     FROM admission_daily_notes n
     LEFT JOIN employees e ON e.id = n.doctor_id
     WHERE n.admission_id = ?
     ORDER BY n.note_date DESC, n.created_at DESC`,
    [admissionId]
  );
  return rows;
};

/* ─────────────────────────────────────────────
   ADMISSION FULL TIMELINE
───────────────────────────────────────────── */

/**
 * Everything about one admission in one place: bed/room stay history,
 * day-wise vitals/advice notes, medicines given (grouped by bill date),
 * computed charges, and the discharge record folded in (not a separate view).
 */
const getAdmissionTimeline = async (admissionId) => {
  const admission = await getAdmission(admissionId);
  if (!admission) return null;

  const notes = await listAdmissionDailyNotes(admissionId);

  const [medicineBills] = await db.execute(
    `SELECT pb.id AS bill_id, pb.bill_number, pb.bill_date, pb.net_amount,
            pbi.quantity, pbi.unit_price, pbi.subtotal, m.name AS medicine_name
     FROM pharmacy_bills pb
     JOIN pharmacy_bill_items pbi ON pbi.pharmacy_bill_id = pb.id
     JOIN medicines m ON m.id = pbi.medicine_id
     WHERE pb.admission_id = ?
     ORDER BY pb.bill_date ASC`,
    [admissionId]
  );

  const room = await computeRoomCharges(admissionId);
  const pharmacyTotal = await computePharmacyCharges(admissionId);
  const discharge = await getDischargeByAdmission(admissionId);

  return {
    admission,
    beds: admission.beds,
    dailyNotes: notes,
    medicineBills,
    charges: {
      room_charges: room.total,
      room_charge_breakdown: room.breakdown,
      pharmacy_charges: pharmacyTotal,
      doctor_fee: discharge?.doctor_fee ?? null,
      other_charges: discharge?.other_charges ?? null,
      final_bill_amount: discharge?.final_bill_amount ?? null,
    },
    discharge,
  };
};

/* ─────────────────────────────────────────────
   FULL PATIENT HISTORY
───────────────────────────────────────────── */

/**
 * Every appointment, admission, prescription, pharmacy bill and discharge for
 * one patient, independent of any single active visit.
 */
const getPatientHistory = async (patientId) => {
  const [appointments] = await db.execute(
    `SELECT a.*, e.full_name AS doctor_name
     FROM appointments a
     LEFT JOIN employees e ON e.id = a.doctor_id
     WHERE a.patient_id = ?
     ORDER BY a.appointment_date DESC, a.token_number DESC`,
    [patientId]
  );

  const [admissions] = await db.execute(
    `SELECT ad.*, e.full_name AS doctor_name
     FROM admissions ad
     LEFT JOIN employees e ON e.id = ad.admitting_doctor_id
     WHERE ad.patient_id = ?
     ORDER BY ad.admission_datetime DESC`,
    [patientId]
  );

  const [consultations] = await db.execute(
    `SELECT c.*, a.appointment_date, e.full_name AS doctor_name
     FROM consultations c
     JOIN appointments a ON a.id = c.appointment_id
     LEFT JOIN employees e ON e.id = c.doctor_id
     WHERE a.patient_id = ?
     ORDER BY c.created_at DESC`,
    [patientId]
  );

  const consultationIds = consultations.map((c) => c.id);
  let prescriptions = [];
  if (consultationIds.length) {
    const placeholders = consultationIds.map(() => '?').join(',');
    const [pres] = await db.query(
      `SELECT p.*, pi.medicine_id, pi.dose_morning, pi.dose_afternoon, pi.dose_night,
              pi.duration_days, pi.food_instruction, m.name AS medicine_name
       FROM prescriptions p
       JOIN prescription_items pi ON pi.prescription_id = p.id
       JOIN medicines m ON m.id = pi.medicine_id
       WHERE p.consultation_id IN (${placeholders})`,
      consultationIds
    );
    prescriptions = pres;
  }

  const [pharmacyBills] = await db.execute(
    `SELECT id, bill_number, bill_date, net_amount, payment_status, appointment_id, admission_id
     FROM pharmacy_bills WHERE patient_id = ? ORDER BY bill_date DESC`,
    [patientId]
  );

  const admissionIds = admissions.map((a) => a.id);
  let discharges = [];
  if (admissionIds.length) {
    const placeholders = admissionIds.map(() => '?').join(',');
    const [d] = await db.query(
      `SELECT * FROM discharges WHERE admission_id IN (${placeholders}) ORDER BY discharge_datetime DESC`,
      admissionIds
    );
    discharges = d;
  }

  const [paymentReceipts] = await db.query(
    `SELECT r.*,
            COALESCE(ri.fee_types, '') AS fee_types,
            COALESCE(ri.item_descriptions, '') AS item_descriptions,
            COALESCE(e_appt.full_name, e_adm.full_name, e_pb.full_name, '') AS doctor_name,
            COALESCE(e_appt.qualification, sr_appt.name, e_adm.qualification, sr_adm.name, e_pb.qualification, sr_pb.name, '') AS doctor_qualification,
            COALESCE(r.pharmacy_bill_id, pb.id) AS pharmacy_bill_id,
            pb.bill_number
     FROM payment_receipts r
     LEFT JOIN (
       SELECT receipt_id,
              GROUP_CONCAT(DISTINCT fee_type ORDER BY id SEPARATOR ', ') AS fee_types,
              GROUP_CONCAT(DISTINCT description ORDER BY id SEPARATOR ' | ') AS item_descriptions
       FROM payment_receipt_items
       GROUP BY receipt_id
     ) ri ON ri.receipt_id = r.id
     LEFT JOIN appointments appt ON appt.id = r.appointment_id
     LEFT JOIN employees e_appt ON e_appt.id = appt.doctor_id
     LEFT JOIN staff_roles sr_appt ON sr_appt.id = e_appt.designation_id
     LEFT JOIN admissions adm ON adm.id = r.admission_id
     LEFT JOIN employees e_adm ON e_adm.id = adm.admitting_doctor_id
     LEFT JOIN staff_roles sr_adm ON sr_adm.id = e_adm.designation_id
     LEFT JOIN pharmacy_bills pb ON pb.id = COALESCE(
       r.pharmacy_bill_id,
       (SELECT id FROM pharmacy_bills WHERE patient_id = r.patient_id AND DATE(bill_date) = DATE(r.payment_date) LIMIT 1)
     )
     LEFT JOIN employees e_pb ON e_pb.id = COALESCE(
       pb.doctor_id,
       (SELECT doctor_id FROM appointments WHERE id = pb.appointment_id),
       (SELECT admitting_doctor_id FROM admissions WHERE id = pb.admission_id)
     )
     LEFT JOIN staff_roles sr_pb ON sr_pb.id = e_pb.designation_id
     WHERE r.patient_id = ?
     ORDER BY r.created_at DESC`,
    [patientId]
  );

  return { appointments, admissions, consultations, prescriptions, pharmacyBills, discharges, paymentReceipts };
};

module.exports = {
  listPatients, findPatientsByMobile, getPatient, createPatient, updatePatient,
  listAppointments, getAppointment, getNextTokenNumber, createAppointment,
  updateAppointmentStatus, closeWalkInVisit,
  markAppointmentPaymentPending, closeAppointment, getAppointmentPayments,
  listAdmissions, getAdmission, createAdmission, assignBed, releaseBedFromAdmission,
  computeRoomCharges, computePharmacyCharges,
  getDischargeByAdmission, createDischarge, finalizeDischarge,
  recordDischargePayment, releaseBedsIfPaid,
  createAdmissionDailyNote, listAdmissionDailyNotes, getAdmissionTimeline,
  getPatientHistory,
};
