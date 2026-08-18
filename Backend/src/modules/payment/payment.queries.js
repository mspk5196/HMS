/**
 * payment.queries.js
 * All SQL for the unified payment collection module.
 * Handles OPD (appointment) + IPD (discharge) payments,
 * doctor fee rate configuration, and receipt generation.
 */
const db = require('../../config/db');

/* ─────────────────────────────────────────────
   DOCTOR FEE RATES
───────────────────────────────────────────── */

const listDoctorFeeRates = async () => {
  const [rows] = await db.query(`
    SELECT dfr.*, e.full_name AS doctor_name, sr.name AS designation
    FROM doctor_fee_rates dfr
    JOIN employees e ON e.id = dfr.doctor_id
    LEFT JOIN staff_roles sr ON sr.id = e.designation_id
    ORDER BY e.full_name
  `);
  return rows;
};

const getAllDoctors = async () => {
  const [rows] = await db.query(`
    SELECT e.id, e.full_name, sr.id AS designation_id, sr.name AS designation,
           d.id AS department_id, d.name AS department_name,
           dfr.opd_fee, dfr.ipd_daily_fee
    FROM employees e
    JOIN staff_roles sr ON sr.id = e.designation_id
    JOIN departments d ON d.id = e.department_id
    LEFT JOIN doctor_fee_rates dfr ON dfr.doctor_id = e.id
    WHERE sr.is_doctor = 1
    ORDER BY e.full_name
  `);
  return rows;
};

const upsertDoctorFeeRate = async (doctorId, opdFee, ipdDailyFee) => {
  await db.query(`
    INSERT INTO doctor_fee_rates (doctor_id, opd_fee, ipd_daily_fee)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE opd_fee = VALUES(opd_fee), ipd_daily_fee = VALUES(ipd_daily_fee)
  `, [doctorId, opdFee, ipdDailyFee]);
};

const getDoctorFeeRate = async (doctorId) => {
  const [[row]] = await db.query(
    `SELECT * FROM doctor_fee_rates WHERE doctor_id = ?`, [doctorId]
  );
  return row ?? null;
};

/* ─────────────────────────────────────────────
   PENDING PAYMENTS (for Collect Payment page)
───────────────────────────────────────────── */

/** OPD appointments that are payment_pending */
const listPendingOPD = async ({ search } = {}) => {
  let where = `WHERE a.status = 'payment_pending'`;
  const params = [];
  if (search) {
    where += ` AND (p.full_name LIKE ? OR p.mobile_number LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  const [rows] = await db.query(`
    SELECT
      a.id AS appointment_id,
      a.appointment_date,
      a.token_number,
      a.doctor_fee,
      a.created_at,
      p.id AS patient_id,
      p.full_name AS patient_name,
      p.mobile_number,
      p.age_years,
      p.gender,
      e.full_name AS doctor_name,
      COALESCE(SUM(ap.amount_paid), 0) AS amount_paid,
      a.doctor_fee - COALESCE(SUM(ap.amount_paid), 0) AS balance_due
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    LEFT JOIN employees e ON e.id = a.doctor_id
    LEFT JOIN appointment_payments ap ON ap.appointment_id = a.id
    ${where}
    GROUP BY a.id, a.appointment_date, a.token_number, a.doctor_fee, a.created_at,
      p.id, p.full_name, p.mobile_number, p.age_years, p.gender, e.full_name
    ORDER BY a.appointment_date DESC, a.token_number ASC
  `, params);
  return rows;
};

/** IPD admissions whose discharge record has payment_status = 'pending' or 'partial' */
const listPendingIPD = async ({ search } = {}) => {
  let where = `WHERE d.payment_status IN ('pending', 'partial')`;
  const params = [];
  if (search) {
    where += ` AND (p.full_name LIKE ? OR p.mobile_number LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  const [rows] = await db.query(`
    SELECT
      d.id AS discharge_id,
      d.admission_id,
      d.discharge_datetime,
      d.room_charges,
      d.pharmacy_charges,
      d.doctor_fee,
      d.other_charges,
      d.final_bill_amount,
      d.amount_paid,
      d.balance_due,
      d.payment_status,
      d.discharge_condition,
      p.id AS patient_id,
      p.full_name AS patient_name,
      p.mobile_number,
      p.age_years,
      p.gender,
      e.full_name AS doctor_name
    FROM discharges d
    JOIN admissions ad ON ad.id = d.admission_id
    JOIN patients p ON p.id = ad.patient_id
    LEFT JOIN employees e ON e.id = ad.admitting_doctor_id
    ${where}
    ORDER BY d.discharge_datetime DESC
  `, params);
  return rows;
};

/** Pharmacy bills that have payment_status IN ('pending', 'partial') */
const listPendingPharmacy = async ({ search } = {}) => {
  let where = `WHERE pb.payment_status IN ('pending', 'partial') AND pb.balance_amount > 0`;
  const params = [];
  if (search) {
    where += ` AND (p.full_name LIKE ? OR p.mobile_number LIKE ? OR pb.bill_number LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const [rows] = await db.query(`
    SELECT
      pb.id AS pharmacy_bill_id,
      pb.bill_number,
      pb.bill_date,
      pb.net_amount,
      pb.paid_amount,
      pb.balance_amount AS balance_due,
      pb.payment_status,
      p.id AS patient_id,
      p.full_name AS patient_name,
      p.mobile_number,
      p.age_years,
      p.gender,
      u.username AS generated_by_name,
      e.full_name AS doctor_name,
      COALESCE(e.qualification, sr.name) AS doctor_qualification
    FROM pharmacy_bills pb
    JOIN patients p ON p.id = pb.patient_id
    LEFT JOIN users u ON u.id = pb.generated_by
    LEFT JOIN appointments appt ON appt.id = pb.appointment_id
    LEFT JOIN admissions adm ON adm.id = pb.admission_id
    LEFT JOIN employees e ON e.id = COALESCE(pb.doctor_id, appt.doctor_id, adm.admitting_doctor_id)
    LEFT JOIN staff_roles sr ON sr.id = e.designation_id
    ${where}
    ORDER BY pb.bill_date DESC
  `, params);
  return rows;
};

/* ─────────────────────────────────────────────
   RECEIPT GENERATION
───────────────────────────────────────────── */

const generateReceiptNumber = async () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const [[{ cnt }]] = await db.query(
    `SELECT COUNT(*) AS cnt FROM payment_receipts WHERE DATE(created_at) = CURDATE()`
  );
  const seq = String(Number(cnt) + 1).padStart(3, '0');
  return `RCPT-${date}-${seq}`;
};

/**
 * Record OPD payment: insert payment record, update appointment_payments,
 * close appointment if fully paid.
 */
const recordOPDPayment = async ({ appointmentId, amount, paymentMode, notes, receivedBy }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Get appointment info
    const [[appt]] = await conn.execute(
      `SELECT a.*, p.id AS patient_id FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       WHERE a.id = ?`, [appointmentId]
    );
    if (!appt) throw new Error('Appointment not found');

    const totalFee = Number(appt.doctor_fee) || 0;
    const [[{ paid }]] = await conn.execute(
      `SELECT COALESCE(SUM(amount_paid), 0) AS paid FROM appointment_payments WHERE appointment_id = ?`,
      [appointmentId]
    );
    const alreadyPaid = Number(paid);
    const balance = totalFee - alreadyPaid;
    const payAmt = Math.min(Number(amount), balance > 0 ? balance : Number(amount));

    // Insert payment record
    await conn.execute(
      `INSERT INTO appointment_payments (appointment_id, amount_paid, payment_mode, payment_type, notes, received_by)
       VALUES (?, ?, ?, 'consultation', ?, ?)`,
      [appointmentId, payAmt, paymentMode || 'cash', notes || null, receivedBy || null]
    );

    // Generate receipt
    const receiptNumber = await generateReceiptNumber();
    const [rcptResult] = await conn.execute(
      `INSERT INTO payment_receipts (receipt_number, patient_id, appointment_id, payment_date, total_amount, payment_mode, received_by, notes)
       VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?)`,
      [receiptNumber, appt.patient_id, appointmentId, payAmt, paymentMode || 'cash', receivedBy || null, notes || null]
    );
    const receiptId = rcptResult.insertId;

    await conn.execute(
      `INSERT INTO payment_receipt_items (receipt_id, fee_type, description, amount)
       VALUES (?, 'doctor_fee', 'Doctor Consultation Fee', ?)`,
      [receiptId, payAmt]
    );

    // Check if fully paid — close appointment
    const newPaid = alreadyPaid + payAmt;
    let closed = false;
    if (newPaid >= totalFee || totalFee === 0) {
      await conn.execute(
        `UPDATE appointments SET status = 'closed', closed_at = NOW(), closed_by = ? WHERE id = ?`,
        [receivedBy || null, appointmentId]
      );
      closed = true;
    }

    await conn.commit();
    return { receiptNumber, amount: payAmt, closed };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Record IPD discharge payment. Updates discharges table, finalizes discharge
 * when fully paid (changes admission status, sets beds to pending_clearance).
 */
const recordIPDPayment = async ({ admissionId, amount, paymentMode, notes, receivedBy }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[discharge]] = await conn.execute(
      `SELECT d.*, ad.patient_id FROM discharges d
       JOIN admissions ad ON ad.id = d.admission_id
       WHERE d.admission_id = ?`, [admissionId]
    );
    if (!discharge) throw new Error('No discharge record for this admission');

    const balance = Number(discharge.balance_due);
    const payAmt = Math.min(Number(amount), balance > 0 ? balance : Number(amount));

    // Update discharge record
    const newAmtPaid = Number(discharge.amount_paid) + payAmt;
    const newBalance = Math.max(0, Number(discharge.final_bill_amount) - newAmtPaid);
    const newStatus = newBalance <= 0 ? 'paid' : 'partial';

    await conn.execute(
      `UPDATE discharges SET amount_paid = ?, balance_due = ?, payment_status = ?, payment_mode = ?
       WHERE admission_id = ?`,
      [newAmtPaid, newBalance, newStatus, paymentMode || 'cash', admissionId]
    );

    // Generate receipt
    const receiptNumber = await generateReceiptNumber();
    const [rcptResult] = await conn.execute(
      `INSERT INTO payment_receipts (receipt_number, patient_id, admission_id, payment_date, total_amount, payment_mode, received_by, notes)
       VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?)`,
      [receiptNumber, discharge.patient_id, admissionId, payAmt, paymentMode || 'cash', receivedBy || null, notes || null]
    );
    const receiptId = rcptResult.insertId;

    // Insert receipt line items proportionally
    const items = [
      { fee_type: 'room_charges', desc: 'Room Charges', amount: discharge.room_charges },
      { fee_type: 'pharmacy', desc: 'Pharmacy Bills', amount: discharge.pharmacy_charges },
      { fee_type: 'doctor_fee', desc: 'Doctor Fee', amount: discharge.doctor_fee },
      { fee_type: 'other', desc: 'Other Charges', amount: discharge.other_charges },
    ];
    for (const item of items) {
      if (Number(item.amount) > 0) {
        await conn.execute(
          `INSERT INTO payment_receipt_items (receipt_id, fee_type, description, amount) VALUES (?, ?, ?, ?)`,
          [receiptId, item.fee_type, item.desc, item.amount]
        );
      }
    }

    // Finalize if fully paid
    let bedsReleased = 0;
    if (newBalance <= 0) {
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
      bedsReleased = beds.length;
    }

    await conn.commit();
    return { receiptNumber, amount: payAmt, balance: newBalance, closed: newBalance <= 0, bedsReleased };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/**
 * Record Pharmacy Bill payment. Updates pharmacy_bills table (paid_amount, balance_amount, payment_status, closed_at),
 * creates a receipt entry in payment_receipts & payment_receipt_items.
 */
const recordPharmacyPayment = async ({ pharmacyBillId, amount, paymentMode, notes, receivedBy }) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[bill]] = await conn.execute(
      `SELECT pb.*, p.id AS patient_id FROM pharmacy_bills pb
       JOIN patients p ON p.id = pb.patient_id
       WHERE pb.id = ?`, [pharmacyBillId]
    );
    if (!bill) throw new Error('Pharmacy bill not found');

    const balance = Number(bill.balance_amount);
    const payAmt = Math.min(Number(amount), balance > 0 ? balance : Number(amount));

    const newAmtPaid = Number(bill.paid_amount) + payAmt;
    const newBalance = Math.max(0, Number(bill.net_amount) - newAmtPaid);
    const newStatus = newBalance <= 0 ? 'paid' : 'partial';

    await conn.execute(
      `UPDATE pharmacy_bills
       SET paid_amount = ?, balance_amount = ?, payment_status = ?, payment_mode = ?,
           closed_at = IF(? <= 0, NOW(), closed_at)
       WHERE id = ?`,
      [newAmtPaid, newBalance, newStatus, paymentMode || 'cash', newBalance, pharmacyBillId]
    );

    // Generate receipt
    const receiptNumber = await generateReceiptNumber();
    const [rcptResult] = await conn.execute(
      `INSERT INTO payment_receipts (receipt_number, patient_id, payment_date, total_amount, payment_mode, received_by, notes)
       VALUES (?, ?, CURDATE(), ?, ?, ?, ?)`,
      [receiptNumber, bill.patient_id, payAmt, paymentMode || 'cash', receivedBy || null, notes || null]
    );
    const receiptId = rcptResult.insertId;

    await conn.execute(
      `INSERT INTO payment_receipt_items (receipt_id, fee_type, description, amount)
       VALUES (?, 'pharmacy', ?, ?)`,
      [receiptId, `Pharmacy Bill #${bill.bill_number}`, payAmt]
    );

    await conn.commit();
    return { receiptNumber, amount: payAmt, balance: newBalance, closed: newBalance <= 0 };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

/** Get all receipts for a patient */
const listReceiptsByPatient = async (patientId) => {
  const [rows] = await db.query(`
    SELECT r.*, GROUP_CONCAT(ri.fee_type ORDER BY ri.id SEPARATOR ', ') AS fee_types
    FROM payment_receipts r
    LEFT JOIN payment_receipt_items ri ON ri.receipt_id = r.id
    WHERE r.patient_id = ?
    GROUP BY r.id
    ORDER BY r.created_at DESC
  `, [patientId]);
  return rows;
};

module.exports = {
  listDoctorFeeRates,
  getAllDoctors,
  upsertDoctorFeeRate,
  getDoctorFeeRate,
  listPendingOPD,
  listPendingIPD,
  listPendingPharmacy,
  recordOPDPayment,
  recordIPDPayment,
  recordPharmacyPayment,
  listReceiptsByPatient,
};
