/**
 * pharmacy.service.js
 * Business logic for the Pharmacy module — the full stock loop:
 *
 *   Ordering     : createPurchaseOrder            ("Items to order" -> "Place order")
 *   Receiving    : receiveGoodsReceipt             ("Received with bill" -> "Pharmacy entry (bill number)")
 *   Paying in    : recordGoodsReceiptPayment / closeGoodsReceipt  ("Enter paid amount" -> "Save and close order")
 *   Dispensing   : generateBill                     (FIFO deduction + charge, "Doctor's request" -> "generate charge")
 *   Collecting   : recordBillPayment / closeBill    ("Enter paid amount" -> "Save and close order")
 *   Monitoring   : lowStock / expiring / nonMovable / movements reports
 */

const q = require('./pharmacy.queries');
const { AppError } = require('../../utils/errors');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

/* ─────────────────────────────────────────────
   MEDICINE MANAGEMENT
───────────────────────────────────────────── */

const createMedicine = async (data) => {
  if (!data.name) throw new AppError('Medicine name is required', 400);
  return q.createMedicine(data);
};

const updateMedicine = async (id, data) => {
  const medicine = await q.getMedicine(id);
  if (!medicine) throw new AppError('Medicine not found', 404);
  await q.updateMedicine(id, data);
};

const deleteMedicine = async (id) => {
  const medicine = await q.getMedicine(id);
  if (!medicine) throw new AppError('Medicine not found', 404);
  await q.deleteMedicine(id);
};

const createCategory = async (name) => {
  if (!name || !name.trim()) throw new AppError('Category name is required', 400);
  return q.createCategory(name.trim());
};

const updateCategory = async (id, name) => {
  if (!name || !name.trim()) throw new AppError('Category name is required', 400);
  await q.updateCategory(id, name.trim());
};

const deleteCategory = async (id) => {
  try {
    await q.deleteCategory(id);
  } catch (err) {
    throw new AppError(err.message, 400);
  }
};

const createFormFactor = async (name) => {
  if (!name || !name.trim()) throw new AppError('Form factor name is required', 400);
  return q.createFormFactor(name.trim());
};

const updateFormFactor = async (id, name) => {
  if (!name || !name.trim()) throw new AppError('Form factor name is required', 400);
  await q.updateFormFactor(id, name.trim());
};

const deleteFormFactor = async (id) => {
  await q.deleteFormFactor(id);
};

/* ─────────────────────────────────────────────
   STOCK (BATCH) MANAGEMENT — manual / opening stock entry
───────────────────────────────────────────── */

const addBatch = async (data) => {
  if (!data.medicine_id || !data.batch_number || !data.expiry_date || !data.qty_in_stock) {
    throw new AppError('medicine_id, batch_number, expiry_date and qty_in_stock are required', 400);
  }
  if (data.qty_in_stock <= 0) throw new AppError('qty_in_stock must be positive', 400);
  const expiryDate = new Date(data.expiry_date);
  if (expiryDate <= new Date()) throw new AppError('Expiry date must be in the future', 400);

  const medicine = await q.getMedicine(data.medicine_id);
  if (!medicine) throw new AppError('Medicine not found', 404);

  const batchId = await q.addBatch(data);
  await q.logStockMovement({
    medicine_id: data.medicine_id,
    batch_id: batchId,
    movement_type: 'receipt',
    quantity: data.qty_in_stock,
    reference_type: 'manual_entry',
    reference_id: batchId,
    movement_date: today(),
  });
  return batchId;
};

/* ─────────────────────────────────────────────
   BARCODE LOOKUP (scanner integration)
───────────────────────────────────────────── */

const lookupByBarcode = async (barcode) => {
  const medicine = await q.getMedicineByBarcode(barcode.trim());
  if (!medicine) throw new AppError(`No medicine found for barcode: ${barcode}`, 404);
  const batches = await q.listBatches(medicine.id);
  return { ...medicine, batches };
};

/* ─────────────────────────────────────────────
   PRESCRIPTION SUGGESTIONS
───────────────────────────────────────────── */

const suggestFromPrescription = async (terms) => {
  if (!Array.isArray(terms) || !terms.length) {
    throw new AppError('terms must be a non-empty array of drug name strings', 400);
  }
  return q.suggestMedicines(terms);
};

/* ─────────────────────────────────────────────
   BILL GENERATION  (dispense / sale counter)
───────────────────────────────────────────── */

/**
 * Generate a pharmacy bill with FIFO stock deduction.
 *
 * @param {object} billData
 *   patient_id, appointment_id?, admission_id?, bill_date, generated_by, payment_mode?,
 *   discount_amount?, paid_amount? (defaults to the full net amount — counter sales
 *   are usually paid in full immediately; pass a smaller number for a credit/partial bill),
 *   items: [{ medicine_id, quantity, unit_price?, discount_percent? }]
 *
 * @returns {object} complete bill with items
 */
const generateBill = async (billData) => {
  const { patient_id, appointment_id, admission_id, bill_date, generated_by, payment_mode, items } = billData;

  if (!patient_id || !bill_date || !Array.isArray(items) || !items.length) {
    throw new AppError('patient_id, bill_date and at least one item are required', 400);
  }

  // 1. Validate stock for all items upfront before touching the DB
  for (const item of items) {
    if (!item.medicine_id || !item.quantity || item.quantity <= 0) {
      throw new AppError('Each item must have medicine_id and quantity > 0', 400);
    }
    const batches = await q.listBatches(item.medicine_id);
    const availableQty = batches.reduce((s, b) => s + b.qty_in_stock, 0);
    if (availableQty < item.quantity) {
      const med = await q.getMedicine(item.medicine_id);
      throw new AppError(
        `Insufficient stock for "${med?.name ?? item.medicine_id}". ` +
        `Available: ${availableQty}, Requested: ${item.quantity}`,
        400
      );
    }
  }

  // 2. FIFO deduct and build line items
  let subtotal = 0;
  let totalTax = 0;
  const lineItems = [];

  for (const item of items) {
    const deductions = await q.fifoDeduct(item.medicine_id, item.quantity);
    const med = await q.getMedicine(item.medicine_id);
    const unitPrice = item.unit_price ?? deductions[0]?.selling_price ?? 0;
    const discountPct = item.discount_percent ?? 0;
    const lineTotal = unitPrice * item.quantity * (1 - discountPct / 100);
    const tax = lineTotal * ((med.gst_percent ?? 0) / 100);

    subtotal += lineTotal;
    totalTax += tax;

    // Build one line item per batch deduction (for audit trail)
    for (const ded of deductions) {
      lineItems.push({
        medicine_id: item.medicine_id,
        batch_id: ded.batch_id,
        quantity: ded.deducted_qty,
        unit_price: ded.selling_price,
        discount_percent: discountPct,
        total_price: round2(ded.selling_price * ded.deducted_qty * (1 - discountPct / 100)),
      });
    }
  }

  const discountAmt = billData.discount_amount ?? 0;
  const netAmount = round2(subtotal + totalTax - discountAmt);
  // Counter sales default to fully paid on generation; pass paid_amount explicitly for credit.
  const paidAmount = round2(billData.paid_amount ?? netAmount);
  const balanceAmount = round2(Math.max(netAmount - paidAmount, 0));
  const paymentStatus = balanceAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';

  // 3. Insert bill header
  const billId = await q.createBill({
    patient_id,
    appointment_id: appointment_id ?? null,
    admission_id: admission_id ?? null,
    bill_date,
    generated_by: generated_by ?? null,
    total_amount: round2(subtotal),
    discount_amount: discountAmt,
    tax_amount: round2(totalTax),
    net_amount: netAmount,
    paid_amount: paidAmount,
    balance_amount: balanceAmount,
    payment_mode: payment_mode ?? 'cash',
    payment_status: paymentStatus,
    closed_at: balanceAmount <= 0 ? new Date() : null,
  });

  // 4. Insert bill items + ledger the stock going out
  for (const li of lineItems) {
    await q.addBillItem({ bill_id: billId, ...li });
    await q.logStockMovement({
      medicine_id: li.medicine_id,
      batch_id: li.batch_id,
      movement_type: 'sale',
      quantity: -li.quantity,
      reference_type: 'pharmacy_bill',
      reference_id: billId,
      patient_id,
      movement_date: bill_date,
    });
  }

  // 5. Return the complete bill
  return q.getBill(billId);
};

/** "Enter paid amount" -> recompute balance/status; auto-closes once fully paid. */
const recordBillPayment = async (id, { paid_amount }) => {
  const bill = await q.getBill(id);
  if (!bill) throw new AppError('Bill not found', 404);
  if (paid_amount == null || paid_amount < 0) throw new AppError('paid_amount must be a non-negative number', 400);

  const balance = round2(Math.max(bill.net_amount - paid_amount, 0));
  const status = balance <= 0 ? 'paid' : paid_amount > 0 ? 'partial' : 'pending';
  await q.updateBillPayment(id, {
    paid_amount: round2(paid_amount),
    balance_amount: balance,
    payment_status: status,
    closed_at: balance <= 0 ? new Date() : bill.closed_at,
  });
  return q.getBill(id);
};

/** "Save and close order" for a bill — used to write off a credit balance the party won't pay at counter. */
const closeBill = async (id) => {
  const bill = await q.getBill(id);
  if (!bill) throw new AppError('Bill not found', 404);
  await q.updateBillPayment(id, {
    paid_amount: bill.paid_amount,
    balance_amount: bill.balance_amount,
    payment_status: bill.payment_status,
    closed_at: new Date(),
  });
  return q.getBill(id);
};

/* ─────────────────────────────────────────────
   SUPPLIERS
───────────────────────────────────────────── */

const createSupplier = async (data) => {
  if (!data.name) throw new AppError('Supplier name is required', 400);
  return q.createSupplier(data);
};

const updateSupplier = async (id, data) => {
  const supplier = await q.getSupplier(id);
  if (!supplier) throw new AppError('Supplier not found', 404);
  await q.updateSupplier(id, data);
};

/* ─────────────────────────────────────────────
   PURCHASE ORDERS  ("Items to order" -> "Place order")
───────────────────────────────────────────── */

const createPurchaseOrder = async (data) => {
  const { supplier_id, order_date, items } = data;
  if (!supplier_id || !order_date || !Array.isArray(items) || !items.length) {
    throw new AppError('supplier_id, order_date and at least one item are required', 400);
  }
  for (const item of items) {
    if (!item.medicine_id || !item.ordered_qty || item.ordered_qty <= 0) {
      throw new AppError('Each item needs medicine_id and ordered_qty > 0', 400);
    }
  }
  const supplier = await q.getSupplier(supplier_id);
  if (!supplier) throw new AppError('Supplier not found', 404);

  return q.createPurchaseOrder(data);
};

const cancelPurchaseOrder = async (id) => {
  const order = await q.getPurchaseOrder(id);
  if (!order) throw new AppError('Purchase order not found', 404);
  if (order.status === 'received') throw new AppError('Cannot cancel a fully received purchase order', 400);
  await q.updatePurchaseOrderStatus(id, 'cancelled');
};

/* ─────────────────────────────────────────────
   GOODS RECEIPT / GRN
   ("Received with bill" -> "Pharmacy entry (bill number)")
───────────────────────────────────────────── */

const receiveGoodsReceipt = async (data) => {
  const { supplier_id, supplier_bill_number, supplier_bill_date, received_date, items } = data;
  if (!supplier_id || !supplier_bill_number || !supplier_bill_date || !received_date ||
      !Array.isArray(items) || !items.length) {
    throw new AppError(
      'supplier_id, supplier_bill_number, supplier_bill_date, received_date and at least one item are required',
      400
    );
  }
  for (const item of items) {
    if (!item.medicine_id || !item.batch_number || !item.expiry_date || !item.qty_received || item.qty_received <= 0) {
      throw new AppError('Each item needs medicine_id, batch_number, expiry_date and qty_received > 0', 400);
    }
    if (new Date(item.expiry_date) <= new Date()) {
      throw new AppError(`Batch "${item.batch_number}" has an expiry date that is not in the future`, 400);
    }
  }

  const supplier = await q.getSupplier(supplier_id);
  if (!supplier) throw new AppError('Supplier not found', 404);

  if (data.purchase_order_id) {
    const po = await q.getPurchaseOrder(data.purchase_order_id);
    if (!po) throw new AppError('Purchase order not found', 404);
    if (po.status === 'cancelled') throw new AppError('Cannot receive stock against a cancelled purchase order', 400);
  }

  const grnId = await q.createGoodsReceipt(data);
  return q.getGoodsReceipt(grnId);
};

/** "Enter paid amount" for a supplier bill. */
const recordGoodsReceiptPayment = async (id, { paid_amount }) => {
  const grn = await q.getGoodsReceipt(id);
  if (!grn) throw new AppError('Goods receipt not found', 404);
  if (paid_amount == null || paid_amount < 0) throw new AppError('paid_amount must be a non-negative number', 400);

  const status = paid_amount <= 0 ? 'unpaid' : paid_amount >= grn.total_amount ? 'paid' : 'partial';
  await q.updateGoodsReceiptPayment(id, { paid_amount: round2(paid_amount), payment_status: status });
  return q.getGoodsReceipt(id);
};

/** "Save and close order" for a goods receipt. */
const closeGoodsReceipt = async (id) => {
  const grn = await q.getGoodsReceipt(id);
  if (!grn) throw new AppError('Goods receipt not found', 404);
  await q.closeGoodsReceipt(id);
  return q.getGoodsReceipt(id);
};

/* ─────────────────────────────────────────────
   REPORTS
───────────────────────────────────────────── */

const lowStockReport = () => q.lowStockReport();
const expiringStockReport = (days) => q.expiringStockReport({ days: days ?? 90 });
const nonMovableStockReport = (days) => q.nonMovableStockReport({ days: days ?? 90 });

module.exports = {
  createMedicine,
  updateMedicine,
  deleteMedicine,
  createCategory,
  updateCategory,
  deleteCategory,
  createFormFactor,
  updateFormFactor,
  deleteFormFactor,
  addBatch,
  lookupByBarcode,
  suggestFromPrescription,
  generateBill,
  recordBillPayment,
  closeBill,
  createSupplier,
  updateSupplier,
  createPurchaseOrder,
  cancelPurchaseOrder,
  receiveGoodsReceipt,
  recordGoodsReceiptPayment,
  closeGoodsReceipt,
  lowStockReport,
  expiringStockReport,
  nonMovableStockReport,
  // Pass-through queries
  listMedicines: q.listMedicines,
  getMedicine: q.getMedicine,
  listCategories: q.listCategories,
  listFormFactors: q.listFormFactors,
  listAllBatches: q.listAllBatches,
  listBills: q.listBills,
  getBill: q.getBill,
  listSuppliers: q.listSuppliers,
  getSupplier: q.getSupplier,
  listPurchaseOrders: q.listPurchaseOrders,
  getPurchaseOrder: q.getPurchaseOrder,
  listGoodsReceipts: q.listGoodsReceipts,
  getGoodsReceipt: q.getGoodsReceipt,
  listMovements: q.listMovements,
  dailyMovementSummary: q.dailyMovementSummary,
};
