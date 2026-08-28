/**
 * pharmacy.queries.js
 * All raw SQL for the Pharmacy module.
 */

const db = require('../../config/db');

/* ─────────────────────────────────────────────
   MEDICINES (master)
───────────────────────────────────────────── */

const listMedicines = async ({ search, includeInactive = false, inStockOnly = false, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (!includeInactive) {
    conditions.push('m.is_active = 1');
  }

  if (search) {
    conditions.push('(LOWER(m.name) LIKE LOWER(?) OR LOWER(m.generic_name) LIKE LOWER(?) OR LOWER(m.barcode) LIKE LOWER(?))');
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  if (inStockOnly) {
    conditions.push('(SELECT COALESCE(SUM(mb.qty_in_stock), 0) FROM medicine_batches mb WHERE mb.medicine_id = m.id) > 0');
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Correlated subqueries (not JOIN + GROUP BY) so this stays valid under
  // strict ONLY_FULL_GROUP_BY sql_mode regardless of how MySQL is configured.
  const [rows] = await db.query(
    `SELECT m.*, mc.name AS category_name,
            COALESCE((SELECT SUM(mb.qty_in_stock) FROM medicine_batches mb WHERE mb.medicine_id = m.id), 0) AS total_stock,
            (SELECT MIN(mb.selling_price) FROM medicine_batches mb WHERE mb.medicine_id = m.id AND mb.qty_in_stock > 0) AS selling_price
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
            COALESCE((SELECT SUM(mb.qty_in_stock) FROM medicine_batches mb WHERE mb.medicine_id = m.id), 0) AS total_stock,
            (SELECT MIN(mb.selling_price) FROM medicine_batches mb WHERE mb.medicine_id = m.id AND mb.qty_in_stock > 0) AS selling_price
     FROM medicines m
     LEFT JOIN medicine_categories mc ON mc.id = m.category_id
     WHERE m.barcode = ?
     LIMIT 1`,
    [barcode]
  );
  return rows[0] ?? null;
};

const getMedicine = async (id) => {
  const [rows] = await db.execute(
    `SELECT m.*, mc.name AS category_name,
            COALESCE((SELECT SUM(mb.qty_in_stock) FROM medicine_batches mb WHERE mb.medicine_id = m.id), 0) AS total_stock,
            (SELECT MIN(mb.selling_price) FROM medicine_batches mb WHERE mb.medicine_id = m.id AND mb.qty_in_stock > 0) AS selling_price
     FROM medicines m
     LEFT JOIN medicine_categories mc ON mc.id = m.category_id
     WHERE m.id = ?`,
    [id]
  );
  return rows[0] ?? null;
};

const createMedicine = async (data) => {
  const { name, generic_name, category_id, form, strength, unit, tablets_per_strip,
    manufacturer, hsn_code, gst_percent, reorder_level, barcode, description } = data;
  const [result] = await db.execute(
    `INSERT INTO medicines
       (name, generic_name, category_id, form, strength, unit, tablets_per_strip,
        manufacturer, hsn_code, gst_percent, reorder_level, barcode, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, generic_name ?? null, category_id ?? null, form ?? null,
     strength ?? null, unit ?? null, tablets_per_strip ?? 1, manufacturer ?? null, hsn_code ?? null,
     gst_percent ?? 0, reorder_level ?? 0, barcode ?? null, description ?? null]
  );
  return result.insertId;
};

const updateMedicine = async (id, data) => {
  const allowed = ['name', 'generic_name', 'category_id', 'form', 'strength', 'unit', 'tablets_per_strip',
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

const deleteMedicine = async (id) => {
  const [[{ count }]] = await db.execute(
    `SELECT (
       (SELECT COUNT(*) FROM medicine_batches WHERE medicine_id = ?) +
       (SELECT COUNT(*) FROM pharmacy_bill_items WHERE medicine_id = ?) +
       (SELECT COUNT(*) FROM stock_movements WHERE medicine_id = ?) +
       (SELECT COUNT(*) FROM purchase_order_items WHERE medicine_id = ?)
     ) AS count`,
    [id, id, id, id]
  );

  if (Number(count) > 0) {
    await db.execute(`UPDATE medicines SET is_active = 0 WHERE id = ?`, [id]);
  } else {
    await db.execute(`DELETE FROM medicines WHERE id = ?`, [id]);
  }
};

const listCategories = async () => {
  const [rows] = await db.execute(
    `SELECT mc.*, COUNT(m.id) AS medicine_count
     FROM medicine_categories mc
     LEFT JOIN medicines m ON m.category_id = mc.id AND m.is_active = 1
     GROUP BY mc.id, mc.name
     ORDER BY mc.name`
  );
  return rows;
};

const createCategory = async (name) => {
  const [result] = await db.execute(`INSERT INTO medicine_categories (name) VALUES (?)`, [name]);
  return result.insertId;
};

const updateCategory = async (id, name) => {
  await db.execute(`UPDATE medicine_categories SET name = ? WHERE id = ?`, [name, id]);
};

const deleteCategory = async (id) => {
  const [[{ count }]] = await db.execute(
    `SELECT COUNT(*) AS count FROM medicines WHERE category_id = ? AND is_active = 1`,
    [id]
  );
  if (Number(count) > 0) {
    throw new Error(`Cannot delete category because ${count} medicine(s) are assigned to it. Please reassign or remove those medicines first.`);
  }

  await db.execute(`UPDATE medicines SET category_id = NULL WHERE category_id = ?`, [id]);
  await db.execute(`DELETE FROM medicine_categories WHERE id = ?`, [id]);
};

/* ─────────────────────────────────────────────
   FORM FACTORS
───────────────────────────────────────────── */

const listFormFactors = async () => {
  const [rows] = await db.execute(`SELECT * FROM medicine_form_factors ORDER BY name`);
  return rows;
};

const createFormFactor = async (name) => {
  const [result] = await db.execute(`INSERT INTO medicine_form_factors (name) VALUES (?)`, [name]);
  return result.insertId;
};

const updateFormFactor = async (id, name) => {
  await db.execute(`UPDATE medicine_form_factors SET name = ? WHERE id = ?`, [name, id]);
};

const deleteFormFactor = async (id) => {
  await db.execute(`DELETE FROM medicine_form_factors WHERE id = ?`, [id]);
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
   PHARMACY BILLS  (dispense / sale-counter flow)
───────────────────────────────────────────── */

const listBills = async ({ patientId, appointmentId, admissionId, paymentStatus, page = 1, limit = 30 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];

  if (patientId) { filters.push('pb.patient_id = ?'); params.push(patientId); }
  if (appointmentId) { filters.push('pb.appointment_id = ?'); params.push(appointmentId); }
  if (admissionId) { filters.push('pb.admission_id = ?'); params.push(admissionId); }
  if (paymentStatus) { filters.push('pb.payment_status = ?'); params.push(paymentStatus); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT pb.*, p.full_name AS patient_name, p.mobile_number AS patient_mobile,
            u.username AS generated_by_name,
            e.full_name AS doctor_name,
            COALESCE(e.qualification, sr.name) AS doctor_qualification,
            sr.name AS doctor_designation
     FROM pharmacy_bills pb
     JOIN patients p ON p.id = pb.patient_id
     LEFT JOIN users u ON u.id = pb.generated_by
     LEFT JOIN appointments appt ON appt.id = pb.appointment_id
     LEFT JOIN admissions adm ON adm.id = pb.admission_id
     LEFT JOIN employees e ON e.id = COALESCE(pb.doctor_id, appt.doctor_id, adm.admitting_doctor_id)
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
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

const getBill = async (idOrNumber) => {
  const isNumeric = !Number.isNaN(Number(idOrNumber)) && Number(idOrNumber) > 0;
  const whereClause = isNumeric ? `WHERE pb.id = ? OR pb.bill_number = ?` : `WHERE pb.bill_number = ?`;
  const params = isNumeric ? [Number(idOrNumber), String(idOrNumber)] : [String(idOrNumber)];

  const [rows] = await db.execute(
    `SELECT pb.*, p.full_name AS patient_name, p.mobile_number AS patient_mobile,
            u.username AS generated_by_name,
            e.full_name AS doctor_name,
            COALESCE(e.qualification, sr.name) AS doctor_qualification,
            sr.name AS doctor_designation
     FROM pharmacy_bills pb
     JOIN patients p ON p.id = pb.patient_id
     LEFT JOIN users u ON u.id = pb.generated_by
     LEFT JOIN appointments appt ON appt.id = pb.appointment_id
     LEFT JOIN admissions adm ON adm.id = pb.admission_id
     LEFT JOIN employees e ON e.id = COALESCE(pb.doctor_id, appt.doctor_id, adm.admitting_doctor_id)
     LEFT JOIN staff_roles sr ON sr.id = e.designation_id
     ${whereClause}`,
    params
  );
  const bill = rows[0] ?? null;
  if (!bill) return null;

  const [items] = await db.execute(
    `SELECT pbi.*, pbi.subtotal AS total_price, m.name AS medicine_name, m.generic_name, m.unit,
            mb.batch_number, mb.expiry_date
     FROM pharmacy_bill_items pbi
     JOIN medicines m ON m.id = pbi.medicine_id
     LEFT JOIN medicine_batches mb ON mb.id = pbi.batch_id
     WHERE pbi.pharmacy_bill_id = ?`,
    [bill.id]
  );
  bill.items = items;
  return bill;
};

/**
 * Insert the bill header, then stamp a human bill_number derived from the
 * new row's id (PB-000123). Two statements on the same connection so the
 * number can never collide.
 */
const createBill = async (header) => {
  const { patient_id, appointment_id, admission_id, doctor_id, bill_date, generated_by,
    total_amount, discount_amount, tax_amount, net_amount, paid_amount, balance_amount,
    payment_mode, payment_status, closed_at } = header;
  const [result] = await db.execute(
    `INSERT INTO pharmacy_bills
       (patient_id, appointment_id, admission_id, doctor_id, bill_number, bill_date, generated_by,
        total_amount, discount_amount, tax_amount, net_amount, paid_amount, balance_amount,
        payment_mode, payment_status, closed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [patient_id, appointment_id ?? null, admission_id ?? null, doctor_id ?? null, `TMP-${Date.now()}`, bill_date, generated_by ?? null,
     total_amount ?? 0, discount_amount ?? 0, tax_amount ?? 0, net_amount ?? 0, paid_amount ?? 0, balance_amount ?? 0,
     payment_mode ?? 'cash', payment_status ?? 'pending', closed_at ?? null]
  );
  const id = result.insertId;
  const billNumber = `PB-${String(id).padStart(6, '0')}`;
  await db.execute(`UPDATE pharmacy_bills SET bill_number = ? WHERE id = ?`, [billNumber, id]);
  return id;
};

const addBillItem = async ({ bill_id, pharmacy_bill_id, medicine_id, batch_id, quantity, unit_price, discount_percent }) => {
  const billId = pharmacy_bill_id || bill_id;
  await db.execute(
    `INSERT INTO pharmacy_bill_items
       (pharmacy_bill_id, medicine_id, batch_id, quantity, unit_price, discount_percent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [billId, medicine_id, batch_id ?? null, quantity, unit_price, discount_percent ?? 0]
  );
};

const updateBillPayment = async (id, { paid_amount, balance_amount, payment_status, closed_at }) => {
  await db.execute(
    `UPDATE pharmacy_bills
     SET paid_amount = ?, balance_amount = ?, payment_status = ?, closed_at = ?
     WHERE id = ?`,
    [paid_amount, balance_amount, payment_status, closed_at ?? null, id]
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
  const likeConditions = terms.map(() => '(LOWER(m.name) LIKE LOWER(?) OR LOWER(m.generic_name) LIKE LOWER(?))').join(' OR ');
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

/* ─────────────────────────────────────────────
   SUPPLIERS
───────────────────────────────────────────── */

const listSuppliers = async ({ search, activeOnly } = {}) => {
  const filters = [];
  const params = [];
  if (search) { filters.push('(name LIKE ? OR phone LIKE ? OR gstin LIKE ?)'); const s = `%${search}%`; params.push(s, s, s); }
  if (activeOnly) filters.push('is_active = 1');
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.query(`SELECT * FROM pharmacy_suppliers ${where} ORDER BY name`, params);
  return rows;
};

const getSupplier = async (id) => {
  const [rows] = await db.execute(`SELECT * FROM pharmacy_suppliers WHERE id = ?`, [id]);
  return rows[0] ?? null;
};

const createSupplier = async (data) => {
  const { name, contact_person, phone, email, address, gstin } = data;
  const [result] = await db.execute(
    `INSERT INTO pharmacy_suppliers (name, contact_person, phone, email, address, gstin)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, contact_person ?? null, phone ?? null, email ?? null, address ?? null, gstin ?? null]
  );
  return result.insertId;
};

const updateSupplier = async (id, data) => {
  const allowed = ['name', 'contact_person', 'phone', 'email', 'address', 'gstin', 'is_active'];
  const fields = [];
  const vals = [];
  for (const key of allowed) {
    if (data[key] !== undefined) { fields.push(`${key} = ?`); vals.push(data[key]); }
  }
  if (!fields.length) return;
  vals.push(id);
  await db.execute(`UPDATE pharmacy_suppliers SET ${fields.join(', ')} WHERE id = ?`, vals);
};

/* ─────────────────────────────────────────────
   PURCHASE ORDERS  ("Items to order" -> "Place order")
───────────────────────────────────────────── */

const listPurchaseOrders = async ({ status, supplierId, page = 1, limit = 30 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];
  if (status) { filters.push('po.status = ?'); params.push(status); }
  if (supplierId) { filters.push('po.supplier_id = ?'); params.push(supplierId); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT po.*, s.name AS supplier_name,
            COALESCE((SELECT SUM(poi.ordered_qty) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id), 0) AS total_ordered_qty,
            COALESCE((SELECT SUM(poi.received_qty) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id), 0) AS total_received_qty
     FROM purchase_orders po
     JOIN pharmacy_suppliers s ON s.id = po.supplier_id
     ${where}
     ORDER BY po.order_date DESC, po.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM purchase_orders po ${where}`, params
  );
  return { rows, total };
};

const getPurchaseOrder = async (id) => {
  const [rows] = await db.execute(
    `SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone
     FROM purchase_orders po
     JOIN pharmacy_suppliers s ON s.id = po.supplier_id
     WHERE po.id = ?`,
    [id]
  );
  const order = rows[0] ?? null;
  if (!order) return null;

  const [items] = await db.execute(
    `SELECT poi.*, m.name AS medicine_name, m.generic_name, m.unit
     FROM purchase_order_items poi
     JOIN medicines m ON m.id = poi.medicine_id
     WHERE poi.purchase_order_id = ?`,
    [id]
  );
  order.items = items;
  return order;
};

/** Create the PO header + line items, then stamp po_number from the new id. */
const createPurchaseOrder = async ({ supplier_id, order_date, expected_date, notes, created_by, items }) => {
  const connection = await db.getConnection();
  await connection.beginTransaction();
  try {
    const [result] = await connection.execute(
      `INSERT INTO purchase_orders (po_number, supplier_id, order_date, expected_date, status, notes, created_by)
       VALUES (?, ?, ?, ?, 'placed', ?, ?)`,
      [`TMP-${Date.now()}`, supplier_id, order_date, expected_date ?? null, notes ?? null, created_by ?? null]
    );
    const id = result.insertId;
    const poNumber = `PO-${String(id).padStart(6, '0')}`;
    await connection.execute(`UPDATE purchase_orders SET po_number = ? WHERE id = ?`, [poNumber, id]);

    for (const item of items) {
      await connection.execute(
        `INSERT INTO purchase_order_items (purchase_order_id, medicine_id, ordered_qty, estimated_price)
         VALUES (?, ?, ?, ?)`,
        [id, item.medicine_id, item.ordered_qty, item.estimated_price ?? 0]
      );
    }

    await connection.commit();
    return id;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

const updatePurchaseOrderStatus = async (id, status) => {
  await db.execute(`UPDATE purchase_orders SET status = ? WHERE id = ?`, [status, id]);
};

/* Recompute a PO's status from how much of each line item has been received. */
const recomputePurchaseOrderStatus = async (connection, purchaseOrderId) => {
  const [items] = await connection.execute(
    `SELECT ordered_qty, received_qty FROM purchase_order_items WHERE purchase_order_id = ?`,
    [purchaseOrderId]
  );
  if (!items.length) return;
  const fullyReceived = items.every((i) => i.received_qty >= i.ordered_qty);
  const anyReceived = items.some((i) => i.received_qty > 0);
  const status = fullyReceived ? 'received' : anyReceived ? 'partially_received' : 'placed';
  await connection.execute(`UPDATE purchase_orders SET status = ? WHERE id = ?`, [status, purchaseOrderId]);
};

/* ─────────────────────────────────────────────
   GOODS RECEIPT / GRN
   ("Received with bill" -> "Pharmacy entry (bill number)")
───────────────────────────────────────────── */

const listGoodsReceipts = async ({ supplierId, purchaseOrderId, paymentStatus, page = 1, limit = 30 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];
  if (supplierId) { filters.push('gr.supplier_id = ?'); params.push(supplierId); }
  if (purchaseOrderId) { filters.push('gr.purchase_order_id = ?'); params.push(purchaseOrderId); }
  if (paymentStatus) { filters.push('gr.payment_status = ?'); params.push(paymentStatus); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT gr.*, s.name AS supplier_name, po.po_number
     FROM goods_receipts gr
     JOIN pharmacy_suppliers s ON s.id = gr.supplier_id
     LEFT JOIN purchase_orders po ON po.id = gr.purchase_order_id
     ${where}
     ORDER BY gr.received_date DESC, gr.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM goods_receipts gr ${where}`, params
  );
  return { rows, total };
};

const getGoodsReceipt = async (id) => {
  const [rows] = await db.execute(
    `SELECT gr.*, s.name AS supplier_name, po.po_number
     FROM goods_receipts gr
     JOIN pharmacy_suppliers s ON s.id = gr.supplier_id
     LEFT JOIN purchase_orders po ON po.id = gr.purchase_order_id
     WHERE gr.id = ?`,
    [id]
  );
  const grn = rows[0] ?? null;
  if (!grn) return null;

  const [items] = await db.execute(
    `SELECT gri.*, m.name AS medicine_name, m.generic_name, m.unit
     FROM goods_receipt_items gri
     JOIN medicines m ON m.id = gri.medicine_id
     WHERE gri.goods_receipt_id = ?`,
    [id]
  );
  grn.items = items;
  return grn;
};

/**
 * Receive stock against a supplier bill:
 *   - one medicine_batches row per line item (stock actually goes up here)
 *   - one goods_receipt_items row (audit trail, ties back to the batch + PO line)
 *   - one stock_movements 'receipt' row per line item
 *   - rolls the PO's received_qty forward and recomputes its status
 */
const createGoodsReceipt = async ({
  purchase_order_id, supplier_id, supplier_bill_number, supplier_bill_date,
  received_date, received_by, notes, items,
}) => {
  const connection = await db.getConnection();
  await connection.beginTransaction();
  try {
    const totalAmount = items.reduce((s, i) => s + i.qty_received * (i.purchase_price ?? 0), 0);

    const [result] = await connection.execute(
      `INSERT INTO goods_receipts
         (grn_number, purchase_order_id, supplier_id, supplier_bill_number, supplier_bill_date,
          received_date, total_amount, received_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`TMP-${Date.now()}`, purchase_order_id ?? null, supplier_id, supplier_bill_number, supplier_bill_date,
       received_date, totalAmount, received_by ?? null, notes ?? null]
    );
    const grnId = result.insertId;
    const grnNumber = `GRN-${String(grnId).padStart(6, '0')}`;
    await connection.execute(`UPDATE goods_receipts SET grn_number = ? WHERE id = ?`, [grnNumber, grnId]);

    for (const item of items) {
      // Get medicine's tablets_per_strip ratio to convert packs/strips to base unit tablets
      const [[med]] = await connection.execute(
        `SELECT tablets_per_strip FROM medicines WHERE id = ?`,
        [item.medicine_id]
      );
      const ratio = med?.tablets_per_strip && Number(med.tablets_per_strip) > 0 ? Number(med.tablets_per_strip) : 1;

      // Base stock units added = qty_received (strips/packs) * ratio (tablets per strip)
      const baseQtyAdded = Number(item.qty_received) * ratio;

      // Per-tablet prices for dispensing to patient
      const unitPurchasePrice = ratio > 1 ? Number(item.purchase_price ?? 0) / ratio : Number(item.purchase_price ?? 0);
      const unitSellingPrice = ratio > 1 ? Number(item.selling_price ?? 0) / ratio : Number(item.selling_price ?? 0);

      const [batchResult] = await connection.execute(
        `INSERT INTO medicine_batches
           (medicine_id, batch_number, expiry_date, qty_in_stock, purchase_price, selling_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item.medicine_id, item.batch_number, item.expiry_date, baseQtyAdded,
         unitPurchasePrice, unitSellingPrice]
      );
      const batchId = batchResult.insertId;

      await connection.execute(
        `INSERT INTO goods_receipt_items
           (goods_receipt_id, purchase_order_item_id, medicine_id, batch_id, batch_number,
            expiry_date, qty_received, purchase_price, selling_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [grnId, item.purchase_order_item_id ?? null, item.medicine_id, batchId, item.batch_number,
         item.expiry_date, item.qty_received, item.purchase_price ?? 0, item.selling_price ?? 0]
      );

      await connection.execute(
        `INSERT INTO stock_movements (medicine_id, batch_id, movement_type, quantity, reference_type, reference_id, movement_date)
         VALUES (?, ?, 'receipt', ?, 'goods_receipt', ?, ?)`,
        [item.medicine_id, batchId, baseQtyAdded, grnId, received_date]
      );

      if (item.purchase_order_item_id) {
        await connection.execute(
          `UPDATE purchase_order_items SET received_qty = received_qty + ? WHERE id = ?`,
          [item.qty_received, item.purchase_order_item_id]
        );
      }
    }

    if (purchase_order_id) {
      await recomputePurchaseOrderStatus(connection, purchase_order_id);
    }

    await connection.commit();
    return grnId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

const updateGoodsReceiptPayment = async (id, { paid_amount, payment_status }) => {
  await db.execute(
    `UPDATE goods_receipts SET paid_amount = ?, payment_status = ? WHERE id = ?`,
    [paid_amount, payment_status, id]
  );
};

const closeGoodsReceipt = async (id) => {
  await db.execute(`UPDATE goods_receipts SET status = 'closed' WHERE id = ?`, [id]);
};

/* ─────────────────────────────────────────────
   STOCK MOVEMENT LEDGER (used by billing + reports)
───────────────────────────────────────────── */

const logStockMovement = async ({ medicine_id, batch_id, movement_type, quantity, reference_type, reference_id, patient_id, movement_date }) => {
  await db.execute(
    `INSERT INTO stock_movements
       (medicine_id, batch_id, movement_type, quantity, reference_type, reference_id, patient_id, movement_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [medicine_id, batch_id ?? null, movement_type, quantity, reference_type ?? null, reference_id ?? null,
     patient_id ?? null, movement_date]
  );
};

const listMovements = async ({ medicineId, patientId, movementType, from, to, page = 1, limit = 50 }) => {
  const offset = (page - 1) * limit;
  const filters = [];
  const params = [];
  if (medicineId) { filters.push('sm.medicine_id = ?'); params.push(medicineId); }
  if (patientId) { filters.push('sm.patient_id = ?'); params.push(patientId); }
  if (movementType) { filters.push('sm.movement_type = ?'); params.push(movementType); }
  if (from) { filters.push('sm.movement_date >= ?'); params.push(from); }
  if (to) { filters.push('sm.movement_date <= ?'); params.push(to); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT sm.*, m.name AS medicine_name, m.unit, p.full_name AS patient_name
     FROM stock_movements sm
     JOIN medicines m ON m.id = sm.medicine_id
     LEFT JOIN patients p ON p.id = sm.patient_id
     ${where}
     ORDER BY sm.movement_date DESC, sm.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM stock_movements sm ${where}`, params
  );
  return { rows, total };
};

/** Grouped totals per medicine per day — powers the "daily movements" tab. */
const dailyMovementSummary = async ({ date }) => {
  const [rows] = await db.execute(
    `SELECT m.id AS medicine_id, m.name AS medicine_name, m.unit,
            SUM(CASE WHEN sm.movement_type = 'receipt' THEN sm.quantity ELSE 0 END) AS received_qty,
            SUM(CASE WHEN sm.movement_type = 'sale' THEN -sm.quantity ELSE 0 END) AS dispensed_qty,
            SUM(CASE WHEN sm.movement_type = 'return' THEN sm.quantity ELSE 0 END) AS returned_qty,
            SUM(CASE WHEN sm.movement_type = 'adjustment' THEN sm.quantity ELSE 0 END) AS adjusted_qty
     FROM stock_movements sm
     JOIN medicines m ON m.id = sm.medicine_id
     WHERE sm.movement_date = ?
     GROUP BY m.id
     ORDER BY m.name`,
    [date]
  );
  return rows;
};

/* ─────────────────────────────────────────────
   REPORTS — low stock / expiry / non-movable
───────────────────────────────────────────── */

/** Medicines at or below their minimum-stock threshold (reorder_level). */
const lowStockReport = async () => {
  const [rows] = await db.execute(
    `SELECT m.id AS medicine_id, m.name, m.generic_name, m.unit, m.reorder_level,
            COALESCE(SUM(mb.qty_in_stock), 0) AS total_stock
     FROM medicines m
     LEFT JOIN medicine_batches mb ON mb.medicine_id = m.id AND mb.qty_in_stock > 0
     WHERE m.is_active = 1
     GROUP BY m.id
     HAVING total_stock <= m.reorder_level
     ORDER BY total_stock ASC`
  );
  return rows;
};

/** Batches expiring within `days` (includes already-expired, oldest first). */
const expiringStockReport = async ({ days = 90 }) => {
  const [rows] = await db.execute(
    `SELECT mb.*, m.name AS medicine_name, m.generic_name, m.unit,
            DATEDIFF(mb.expiry_date, CURDATE()) AS days_to_expiry
     FROM medicine_batches mb
     JOIN medicines m ON m.id = mb.medicine_id
     WHERE mb.qty_in_stock > 0
       AND mb.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
     ORDER BY mb.expiry_date ASC`,
    [days]
  );
  return rows;
};

/**
 * Non-movable ("dead") stock: medicines still holding stock that received
 * at least once more than `days` ago, with zero 'sale' movement since.
 */
const nonMovableStockReport = async ({ days = 90 }) => {
  const [rows] = await db.execute(
    `SELECT m.id AS medicine_id, m.name, m.generic_name, m.unit,
            COALESCE(SUM(mb.qty_in_stock), 0) AS total_stock,
            MIN(mb.received_at) AS oldest_batch_received_at,
            (SELECT MAX(sm2.movement_date) FROM stock_movements sm2
              WHERE sm2.medicine_id = m.id AND sm2.movement_type = 'sale') AS last_sale_date
     FROM medicines m
     JOIN medicine_batches mb ON mb.medicine_id = m.id AND mb.qty_in_stock > 0
     WHERE mb.received_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY m.id
     HAVING total_stock > 0
        AND (last_sale_date IS NULL OR last_sale_date < DATE_SUB(CURDATE(), INTERVAL ? DAY))
     ORDER BY total_stock DESC`,
    [days, days]
  );
  return rows;
};

module.exports = {
  listMedicines, getMedicineByBarcode, getMedicine, createMedicine, updateMedicine, deleteMedicine, listCategories, createCategory, updateCategory, deleteCategory,
  listFormFactors, createFormFactor, updateFormFactor, deleteFormFactor,
  listBatches, listAllBatches, addBatch, fifoDeduct,
  listBills, getBill, createBill, addBillItem, updateBillPayment,
  suggestMedicines,
  listSuppliers, getSupplier, createSupplier, updateSupplier,
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrderStatus,
  listGoodsReceipts, getGoodsReceipt, createGoodsReceipt, updateGoodsReceiptPayment, closeGoodsReceipt,
  logStockMovement, listMovements, dailyMovementSummary,
  lowStockReport, expiringStockReport, nonMovableStockReport,
};
