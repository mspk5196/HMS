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

/** GET /api/pharmacy/medicines/categories */
const listCategories = asyncHandler(async (req, res) => {
  const rows = await svc.listCategories();
  return res.json(success(rows));
});

/** POST /api/pharmacy/medicines/categories — Body: { name } */
const createCategory = asyncHandler(async (req, res) => {
  const id = await svc.createCategory(req.body.name);
  return res.status(201).json(created({ id }, 'Category created'));
});

/** PATCH /api/pharmacy/medicines/categories/:id — Body: { name } */
const updateCategory = asyncHandler(async (req, res) => {
  await svc.updateCategory(Number(req.params.id), req.body.name);
  return res.json(success(null, 'Category updated successfully'));
});

/** DELETE /api/pharmacy/medicines/categories/:id */
const deleteCategory = asyncHandler(async (req, res) => {
  await svc.deleteCategory(Number(req.params.id));
  return res.json(success(null, 'Category deleted successfully'));
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

/** DELETE /api/pharmacy/medicines/:id */
const deleteMedicine = asyncHandler(async (req, res) => {
  await svc.deleteMedicine(Number(req.params.id));
  return res.json(success(null, 'Medicine deleted successfully'));
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
 * Receive new stock batch (manual / opening-stock entry, outside the PO/GRN flow).
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

/* ─── BILLING (dispense / sale counter) ─── */

/** GET /api/pharmacy/bills?patientId=&appointmentId=&admissionId=&paymentStatus=&page=&limit= */
const listBills = asyncHandler(async (req, res) => {
  const { patientId, appointmentId, admissionId, paymentStatus, page = 1, limit = 30 } = req.query;
  const result = await svc.listBills({
    patientId: patientId ? Number(patientId) : null,
    appointmentId: appointmentId ? Number(appointmentId) : null,
    admissionId: admissionId ? Number(admissionId) : null,
    paymentStatus: paymentStatus || null,
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
 *   patient_id, appointment_id?, admission_id?, bill_date, payment_mode?,
 *   discount_amount?, paid_amount?,
 *   items: [{ medicine_id, quantity, unit_price?, discount_percent? }]
 * }
 */
const generateBill = asyncHandler(async (req, res) => {
  const bill = await svc.generateBill({ ...req.body, generated_by: req.user?.id ?? req.body.generated_by });
  return res.status(201).json(created(bill, 'Bill generated'));
});

/** PATCH /api/pharmacy/bills/:id/payment — "Enter paid amount". Body: { paid_amount } */
const recordBillPayment = asyncHandler(async (req, res) => {
  const bill = await svc.recordBillPayment(Number(req.params.id), req.body);
  return res.json(success(bill, 'Payment recorded'));
});

/** POST /api/pharmacy/bills/:id/close — "Save and close order". */
const closeBill = asyncHandler(async (req, res) => {
  const bill = await svc.closeBill(Number(req.params.id));
  return res.json(success(bill, 'Bill closed'));
});

/* ─── SUPPLIERS ─── */

/** GET /api/pharmacy/suppliers?search=&activeOnly= */
const listSuppliers = asyncHandler(async (req, res) => {
  const { search, activeOnly } = req.query;
  const rows = await svc.listSuppliers({ search: search || null, activeOnly: activeOnly === '1' || activeOnly === 'true' });
  return res.json(success(rows));
});

/** GET /api/pharmacy/suppliers/:id */
const getSupplier = asyncHandler(async (req, res) => {
  const supplier = await svc.getSupplier(Number(req.params.id));
  if (!supplier) return res.status(404).json(fail('Supplier not found'));
  return res.json(success(supplier));
});

/** POST /api/pharmacy/suppliers */
const createSupplier = asyncHandler(async (req, res) => {
  const id = await svc.createSupplier(req.body);
  return res.status(201).json(created({ id }, 'Supplier created'));
});

/** PATCH /api/pharmacy/suppliers/:id */
const updateSupplier = asyncHandler(async (req, res) => {
  await svc.updateSupplier(Number(req.params.id), req.body);
  return res.json(success(null, 'Supplier updated'));
});

/* ─── PURCHASE ORDERS ("Items to order" -> "Place order") ─── */

/** GET /api/pharmacy/purchase-orders?status=&supplierId=&page=&limit= */
const listPurchaseOrders = asyncHandler(async (req, res) => {
  const { status, supplierId, page = 1, limit = 30 } = req.query;
  const result = await svc.listPurchaseOrders({
    status: status || null,
    supplierId: supplierId ? Number(supplierId) : null,
    page: Number(page), limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/** GET /api/pharmacy/purchase-orders/:id */
const getPurchaseOrder = asyncHandler(async (req, res) => {
  const order = await svc.getPurchaseOrder(Number(req.params.id));
  if (!order) return res.status(404).json(fail('Purchase order not found'));
  return res.json(success(order));
});

/**
 * POST /api/pharmacy/purchase-orders
 * Body: { supplier_id, order_date, expected_date?, notes?, items: [{ medicine_id, ordered_qty, estimated_price? }] }
 */
const createPurchaseOrder = asyncHandler(async (req, res) => {
  const id = await svc.createPurchaseOrder({ ...req.body, created_by: req.user?.id ?? req.body.created_by });
  const order = await svc.getPurchaseOrder(id);
  return res.status(201).json(created(order, 'Purchase order placed'));
});

/** POST /api/pharmacy/purchase-orders/:id/cancel */
const cancelPurchaseOrder = asyncHandler(async (req, res) => {
  await svc.cancelPurchaseOrder(Number(req.params.id));
  return res.json(success(null, 'Purchase order cancelled'));
});

/* ─── GOODS RECEIPT / GRN ("Received with bill" -> "Pharmacy entry (bill number)") ─── */

/** GET /api/pharmacy/goods-receipts?supplierId=&purchaseOrderId=&paymentStatus=&page=&limit= */
const listGoodsReceipts = asyncHandler(async (req, res) => {
  const { supplierId, purchaseOrderId, paymentStatus, page = 1, limit = 30 } = req.query;
  const result = await svc.listGoodsReceipts({
    supplierId: supplierId ? Number(supplierId) : null,
    purchaseOrderId: purchaseOrderId ? Number(purchaseOrderId) : null,
    paymentStatus: paymentStatus || null,
    page: Number(page), limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/** GET /api/pharmacy/goods-receipts/:id */
const getGoodsReceipt = asyncHandler(async (req, res) => {
  const grn = await svc.getGoodsReceipt(Number(req.params.id));
  if (!grn) return res.status(404).json(fail('Goods receipt not found'));
  return res.json(success(grn));
});

/**
 * POST /api/pharmacy/goods-receipts
 * Body: {
 *   purchase_order_id?, supplier_id, supplier_bill_number, supplier_bill_date, received_date, notes?,
 *   items: [{ purchase_order_item_id?, medicine_id, batch_number, expiry_date, qty_received, purchase_price, selling_price }]
 * }
 */
const createGoodsReceipt = asyncHandler(async (req, res) => {
  const grn = await svc.receiveGoodsReceipt({ ...req.body, received_by: req.user?.id ?? req.body.received_by });
  return res.status(201).json(created(grn, 'Stock received'));
});

/** PATCH /api/pharmacy/goods-receipts/:id/payment — "Enter paid amount". Body: { paid_amount } */
const recordGoodsReceiptPayment = asyncHandler(async (req, res) => {
  const grn = await svc.recordGoodsReceiptPayment(Number(req.params.id), req.body);
  return res.json(success(grn, 'Payment recorded'));
});

/** POST /api/pharmacy/goods-receipts/:id/close — "Save and close order". */
const closeGoodsReceipt = asyncHandler(async (req, res) => {
  const grn = await svc.closeGoodsReceipt(Number(req.params.id));
  return res.json(success(grn, 'Goods receipt closed'));
});

/* ─── REPORTS ─── */

/** GET /api/pharmacy/reports/low-stock — medicines at/below their minimum-stock threshold */
const lowStockReport = asyncHandler(async (req, res) => {
  const rows = await svc.lowStockReport();
  return res.json(success(rows));
});

/** GET /api/pharmacy/reports/expiring?days=90 */
const expiringStockReport = asyncHandler(async (req, res) => {
  const rows = await svc.expiringStockReport(req.query.days ? Number(req.query.days) : undefined);
  return res.json(success(rows));
});

/** GET /api/pharmacy/reports/non-movable?days=90 */
const nonMovableStockReport = asyncHandler(async (req, res) => {
  const rows = await svc.nonMovableStockReport(req.query.days ? Number(req.query.days) : undefined);
  return res.json(success(rows));
});

/** GET /api/pharmacy/reports/movements?medicineId=&patientId=&movementType=&from=&to=&page=&limit= */
const listMovements = asyncHandler(async (req, res) => {
  const { medicineId, patientId, movementType, from, to, page = 1, limit = 50 } = req.query;
  const result = await svc.listMovements({
    medicineId: medicineId ? Number(medicineId) : null,
    patientId: patientId ? Number(patientId) : null,
    movementType: movementType || null,
    from: from || null, to: to || null,
    page: Number(page), limit: Number(limit),
  });
  return res.json(paginated(result.rows, result.total, page, limit));
});

/** GET /api/pharmacy/reports/movements/daily?date=YYYY-MM-DD */
const dailyMovementSummary = asyncHandler(async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const rows = await svc.dailyMovementSummary({ date });
  return res.json(success(rows));
});

module.exports = {
  listMedicines, listCategories, createCategory, updateCategory, deleteCategory, getMedicine, getByBarcode, createMedicine, updateMedicine, deleteMedicine,
  listStock, addStock,
  suggestMedicines,
  listBills, getBill, generateBill, recordBillPayment, closeBill,
  listSuppliers, getSupplier, createSupplier, updateSupplier,
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, cancelPurchaseOrder,
  listGoodsReceipts, getGoodsReceipt, createGoodsReceipt, recordGoodsReceiptPayment, closeGoodsReceipt,
  lowStockReport, expiringStockReport, nonMovableStockReport, listMovements, dailyMovementSummary,
};
