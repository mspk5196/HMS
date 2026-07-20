/**
 * pharmacy.queries.js
 * All raw SQL for the Pharmacy module.
 */

const db = require('../../config/db');

/* ─────────────────────────────────────────────
   MEDICINES (master)
───────────────────────────────────────────── */

const listMedicines = async ({ search, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  let whereClause = '';
  const params = [];

  if (search) {
    whereClause = `WHERE (m.name LIKE ? OR m.generic_name LIKE ? OR m.barcode LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const [rows] = await db.query(
    `SELECT m.*, mc.name AS category_name
     FROM medicines m
     LEFT JOIN medicine_categories mc ON mc.id = m.category_id
     ${whereClause}
     ORDER BY m.name
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM medicines m ${whereClause}`, params
  );
  return { rows, total };
};

/** Look up a medicine by barcode (for scanner input). */
const getMedicineByBarcode = async (barcode) => {
  const [rows] = await db.execute(
    `SELECT m.*, mc.name AS category_name,
            COALESCE(SUM(mb.qty_in_stock), 0) AS total_stock
     FROM medicines m
     LEFT JOIN medicine_categories mc ON mc.id = m.category_id
     LEFT JOIN medicine_batches mb ON mb.medicine_id = m.id AND mb.qty_in_stock > 0
     WHERE m.barcode = ?
     GROUP BY m.id
     LIMIT 1`,
    [barcode]
  );
  return rows[0] ?? null;
};

const getMedicine = async (id) => {
  const [rows] = await db.execute(
    `SELECT m.*, mc.name AS category_name,
            COALESCE(SUM(mb.qty_in_stock), 0) AS total_stock
     FROM medicines m
     LEFT JOIN medicine_categories mc ON mc.id = m.category_id
     LEFT JOIN medicine_batches mb ON mb.medicine_id = m.id AND mb.qty_in_stock > 0
     WHERE m.id = ?
     GROUP BY m.id`,
    [id]
  );
  return rows[0] ?? null;
};

const createMedicine = async (data) => {
  const { name, generic_name, category_id, form, strength, unit,
    manufacturer, hsn_code, gst_percent, reorder_level, barcode, description } = data;
  const [result] = await db.execute(
    `INSERT INTO medicines
       (name, generic_name, category_id, form, strength, unit,
        manufacturer, hsn_code, gst_percent, reorder_level, barcode, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, generic_name ?? null, category_id ?? null, form ?? null,
     strength ?? null, unit ?? null, manufacturer ?? null, hsn_code ?? null,
     gst_percent ?? 0, reorder_level ?? 0, barcode ?? null, description ?? null]
  );
  return result.insertId;
};

const updateMedicine = async (id, data) => {
  const allowed = ['name', 'generic_name', 'category_id', 'form', 'strength', 'unit',
    'manufacturer', 'hsn_code', 'gst_percent', 'reorder_level', 'barcode', 'description', 'is_active'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); vals.push(data[key]); }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE medicines SET ${fields.join(', ')} WHERE id = ?`, vals);
};

/* ─────────────────────────────────────────────
   MEDICINE BATCHES (stock)
───────────────────────────────────────────── */

/** List batches for a medicine, FIFO order (earliest expiry first). */
const listBatches = async (medicineId) => {
  const [rows] = await db.execute(
    `SELECT * FROM medicine_batches
     WHERE medicine_id = ? AND qty_in_stock > 0
     ORDER BY expiry_date ASC`,
    [medicineId]
  );
  return rows;
};

/** List all batches (for stock management view). */
const listAllBatches = async ({ medicineId, lowStock, expiringSoon, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (medicineId) { filters.push('mb.medicine_id = ?'); params.push(medicineId); }
  if (lowStock) { filters.push('mb.qty_in_stock <= m.reorder_level'); }
  if (expiringSoon) {
    filters.push('mb.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)');
    filters.push('mb.qty_in_stock > 0');
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT mb.*, m.name AS medicine_name, m.generic_name, m.barcode, m.reorder_level
     FROM medicine_batches mb
     JOIN medicines m ON m.id = mb.medicine_id
     ${where}
     ORDER BY mb.expiry_date ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM medicine_batches mb
     JOIN medicines m ON m.id = mb.medicine_id ${where}`,
    params
  );
  return { rows, total };
};

const addBatch = async (data) => {
  const { medicine_id, batch_number, expiry_date, qty_in_stock, purchase_price, selling_price } = data;
  const [result] = await db.execute(
    `INSERT INTO medicine_batches
       (medicine_id, batch_number, expiry_date, qty_in_stock, purchase_price, selling_price)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [medicine_id, batch_number, expiry_date, qty_in_stock, purchase_price ?? 0, selling_price ?? 0]
  );
  return result.insertId;
};

/**
 * FIFO deduction — deducts `qty` from batches ordered by expiry_date ASC.
 * Returns array of { batch_id, deducted_qty, selling_price } for billing.
 */
const fifoDeduct = async (medicineId, qty) => {
  const batches = await listBatches(medicineId);
  const deductions = [];
  let remaining = qty;

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, batch.qty_in_stock);
    await db.execute(
      `UPDATE medicine_batches SET qty_in_stock = qty_in_stock - ? WHERE id = ?`,
      [take, batch.id]
    );
    deductions.push({ batch_id: batch.id, deducted_qty: take, selling_price: batch.selling_price });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error(`Insufficient stock for medicine id ${medicineId}. Short by ${remaining} units.`);
  }

  return deductions;
};

/* ─────────────────────────────────────────────
   PHARMACY BILLS
───────────────────────────────────────────── */

const listBills = async ({ patientId, appointmentId, admissionId, page = 1, limit = 30 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (patientId) { filters.push('pb.patient_id = ?'); params.push(patientId); }
  if (appointmentId) { filters.push('pb.appointment_id = ?'); params.push(appointmentId); }
  if (admissionId) { filters.push('pb.admission_id = ?'); params.push(admissionId); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT pb.*, p.full_name AS patient_name, p.mobile_number AS patient_mobile,
            u.username AS billed_by_name
     FROM pharmacy_bills pb
     JOIN patients p ON p.id = pb.patient_id
     LEFT JOIN users u ON u.id = pb.billed_by
     ${where}
     ORDER BY pb.bill_date DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM pharmacy_bills pb ${where}`, params
  );
  return { rows, total };
};

const getBill = async (id) => {
  const [rows] = await db.execute(
    `SELECT pb.*, p.full_name AS patient_name, p.mobile_number AS patient_mobile,
            u.username AS billed_by_name
     FROM pharmacy_bills pb
     JOIN patients p ON p.id = pb.patient_id
     LEFT JOIN users u ON u.id = pb.billed_by
     WHERE pb.id = ?`,
    [id]
  );
  const bill = rows[0] ?? null;
  if (!bill) return null;

  const [items] = await db.execute(
    `SELECT pbi.*, m.name AS medicine_name, m.generic_name, m.unit,
            mb.batch_number, mb.expiry_date
     FROM pharmacy_bill_items pbi
     JOIN medicines m ON m.id = pbi.medicine_id
     LEFT JOIN medicine_batches mb ON mb.id = pbi.batch_id
     WHERE pbi.bill_id = ?`,
    [id]
  );
  bill.items = items;
  return bill;
};

const createBill = async (header) => {
  const { patient_id, appointment_id, admission_id, bill_date, billed_by,
    total_amount, discount_amount, tax_amount, net_amount,
    payment_mode, payment_status } = header;
  const [result] = await db.execute(
    `INSERT INTO pharmacy_bills
       (patient_id, appointment_id, admission_id, bill_date, billed_by,
        total_amount, discount_amount, tax_amount, net_amount, payment_mode, payment_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [patient_id, appointment_id ?? null, admission_id ?? null, bill_date, billed_by ?? null,
     total_amount ?? 0, discount_amount ?? 0, tax_amount ?? 0, net_amount ?? 0,
     payment_mode ?? 'cash', payment_status ?? 'paid']
  );
  return result.insertId;
};

const addBillItem = async ({ bill_id, medicine_id, batch_id, quantity, unit_price, discount_percent, total_price }) => {
  await db.execute(
    `INSERT INTO pharmacy_bill_items
       (bill_id, medicine_id, batch_id, quantity, unit_price, discount_percent, total_price)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [bill_id, medicine_id, batch_id ?? null, quantity, unit_price, discount_percent ?? 0, total_price]
  );
};

/* ─────────────────────────────────────────────
   PRESCRIPTION-BASED SUGGESTIONS
───────────────────────────────────────────── */

/**
 * Given a list of medicine names/generics from a prescription,
 * return matching medicines with available stock.
 */
const suggestMedicines = async (terms) => {
  if (!terms || !terms.length) return [];
  const placeholders = terms.map(() => '?').join(',');
  const likeConditions = terms.map(() => '(m.name LIKE ? OR m.generic_name LIKE ?)').join(' OR ');
  const likeParams = terms.flatMap((t) => [`%${t}%`, `%${t}%`]);

  const [rows] = await db.execute(
    `SELECT m.id, m.name, m.generic_name, m.form, m.strength, m.unit,
            COALESCE(SUM(mb.qty_in_stock), 0) AS total_stock,
            MIN(mb.selling_price) AS selling_price
     FROM medicines m
     LEFT JOIN medicine_batches mb ON mb.medicine_id = m.id AND mb.qty_in_stock > 0
     WHERE m.is_active = 1 AND (${likeConditions})
     GROUP BY m.id
     ORDER BY total_stock DESC`,
    likeParams
  );
  return rows;
};

module.exports = {
  listMedicines, getMedicineByBarcode, getMedicine, createMedicine, updateMedicine,
  listBatches, listAllBatches, addBatch, fifoDeduct,
  listBills, getBill, createBill, addBillItem,
  suggestMedicines,
};
