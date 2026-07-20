/**
 * pharmacy.service.js
 * Business logic for the Pharmacy module.
 *
 * Key entry point: generateBill(billData)
 *   1. Validate stock availability.
 *   2. FIFO-deduct from medicine_batches.
 *   3. Compute totals (subtotal, GST, discount, net).
 *   4. Insert pharmacy_bill + pharmacy_bill_items.
 *   5. Return complete bill.
 */

const q = require('./pharmacy.queries');
const { AppError } = require('../../utils/errors');

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

/* ─────────────────────────────────────────────
   STOCK (BATCH) MANAGEMENT
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

  return q.addBatch(data);
};

/* ─────────────────────────────────────────────
   BARCODE LOOKUP (scanner integration)
───────────────────────────────────────────── */

/**
 * Used by the pharmacy billing page when a barcode is scanned.
 * Returns the medicine with live stock info.
 */
const lookupByBarcode = async (barcode) => {
  const medicine = await q.getMedicineByBarcode(barcode.trim());
  if (!medicine) throw new AppError(`No medicine found for barcode: ${barcode}`, 404);
  const batches = await q.listBatches(medicine.id);
  return { ...medicine, batches };
};

/* ─────────────────────────────────────────────
   PRESCRIPTION SUGGESTIONS
───────────────────────────────────────────── */

/**
 * Accept a list of drug names/generics from the prescription and return
 * matching medicines with stock availability ranked by stock level.
 */
const suggestFromPrescription = async (terms) => {
  if (!Array.isArray(terms) || !terms.length) {
    throw new AppError('terms must be a non-empty array of drug name strings', 400);
  }
  return q.suggestMedicines(terms);
};

/* ─────────────────────────────────────────────
   BILL GENERATION
───────────────────────────────────────────── */

/**
 * Generate a pharmacy bill with FIFO stock deduction.
 *
 * @param {object} billData
 *   patient_id, appointment_id?, admission_id?, bill_date, billed_by, payment_mode?,
 *   items: [{ medicine_id, quantity, unit_price?, discount_percent? }]
 *
 * @returns {object} complete bill with items
 */
const generateBill = async (billData) => {
  const { patient_id, appointment_id, admission_id, bill_date, billed_by, payment_mode, items } = billData;

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

  // 3. Insert bill header
  const billId = await q.createBill({
    patient_id,
    appointment_id: appointment_id ?? null,
    admission_id: admission_id ?? null,
    bill_date,
    billed_by: billed_by ?? null,
    total_amount: round2(subtotal),
    discount_amount: discountAmt,
    tax_amount: round2(totalTax),
    net_amount: netAmount,
    payment_mode: payment_mode ?? 'cash',
    payment_status: 'paid',
  });

  // 4. Insert bill items
  for (const li of lineItems) {
    await q.addBillItem({ bill_id: billId, ...li });
  }

  // 5. Return the complete bill
  return q.getBill(billId);
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

module.exports = {
  createMedicine,
  updateMedicine,
  addBatch,
  lookupByBarcode,
  suggestFromPrescription,
  generateBill,
  // Pass-through queries
  listMedicines: q.listMedicines,
  getMedicine: q.getMedicine,
  listAllBatches: q.listAllBatches,
  listBills: q.listBills,
  getBill: q.getBill,
};
