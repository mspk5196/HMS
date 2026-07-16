/**
 * pharmacy.controller.js
 * HTTP layer for the Pharmacy module.
 */

const svc = require('./pharmacy.service');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, created, paginated, fail } = require('../../utils/response');

/* ─── MEDICINES ─── */

/** GET /api/pharmacy/medicines?search=&page=&limit= */
const listMedicines = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  const result = await svc.listMedicines({ search: search || null, page: Number(page), limit: Number(limit) });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/** GET /api/pharmacy/medicines/:id */
const getMedicine = asyncHandler(async (req, res) => {
  const med = await svc.getMedicine(Number(req.params.id));
  if (!med) return res.status(404).json(fail('Medicine not found'));
  return res.json(success(med));
});

/**
 * GET /api/pharmacy/medicines/barcode/:barcode
 * Scanner sends this request when a barcode is scanned on the billing page.
 */
const getByBarcode = asyncHandler(async (req, res) => {
  const med = await svc.lookupByBarcode(req.params.barcode);
  return res.json(success(med));
});

/** POST /api/pharmacy/medicines */
const createMedicine = asyncHandler(async (req, res) => {
  const id = await svc.createMedicine(req.body);
  return res.status(201).json(created({ id }, 'Medicine created'));
});

/** PATCH /api/pharmacy/medicines/:id */
const updateMedicine = asyncHandler(async (req, res) => {
  await svc.updateMedicine(Number(req.params.id), req.body);
  return res.json(success(null, 'Medicine updated'));
});

/* ─── BATCHES / STOCK ─── */

/**
 * GET /api/pharmacy/stock?medicineId=&lowStock=&expiringSoon=&page=&limit=
 * Stock management view — all batches with filters.
 */
const listStock = asyncHandler(async (req, res) => {
  const { medicineId, lowStock, expiringSoon, page = 1, limit = 50 } = req.query;
  const result = await svc.listAllBatches({
    medicineId: medicineId ? Number(medicineId) : null,
    lowStock: lowStock === '1' || lowStock === 'true',
    expiringSoon: expiringSoon === '1' || expiringSoon === 'true',
    page: Number(page), limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/**
 * POST /api/pharmacy/stock
 * Receive new stock batch.
 * Body: { medicine_id, batch_number, expiry_date, qty_in_stock, purchase_price, selling_price }
 */
const addStock = asyncHandler(async (req, res) => {
  const id = await svc.addBatch(req.body);
  return res.status(201).json(created({ id }, 'Stock batch added'));
});

/* ─── PRESCRIPTION SUGGESTION ─── */

/**
 * POST /api/pharmacy/suggest
 * Body: { terms: ['Paracetamol', 'Amoxicillin', ...] }
 * Returns matching medicines with live stock.
 */
const suggestMedicines = asyncHandler(async (req, res) => {
  const { terms } = req.body;
  const results = await svc.suggestFromPrescription(terms);
  return res.json(success(results));
});

/* ─── BILLING ─── */

/** GET /api/pharmacy/bills?patientId=&appointmentId=&admissionId=&page=&limit= */
const listBills = asyncHandler(async (req, res) => {
  const { patientId, appointmentId, admissionId, page = 1, limit = 30 } = req.query;
  const result = await svc.listBills({
    patientId: patientId ? Number(patientId) : null,
    appointmentId: appointmentId ? Number(appointmentId) : null,
    admissionId: admissionId ? Number(admissionId) : null,
    page: Number(page), limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/** GET /api/pharmacy/bills/:id */
const getBill = asyncHandler(async (req, res) => {
  const bill = await svc.getBill(Number(req.params.id));
  if (!bill) return res.status(404).json(fail('Bill not found'));
  return res.json(success(bill));
});

/**
 * POST /api/pharmacy/bills
 * Generate a pharmacy bill (FIFO stock deduction + item insert).
 * Body: {
 *   patient_id, appointment_id?, admission_id?, bill_date, billed_by?,
 *   payment_mode?, discount_amount?,
 *   items: [{ medicine_id, quantity, unit_price?, discount_percent? }]
 * }
 */
const generateBill = asyncHandler(async (req, res) => {
  const bill = await svc.generateBill({ ...req.body, billed_by: req.user?.id ?? req.body.billed_by });
  return res.status(201).json(created(bill, 'Bill generated'));
});

module.exports = {
  listMedicines, getMedicine, getByBarcode, createMedicine, updateMedicine,
  listStock, addStock,
  suggestMedicines,
  listBills, getBill, generateBill,
};
