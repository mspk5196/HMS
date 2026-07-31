/**
 * pharmacy.routes.js
 *
 * Base path: /api/pharmacy   (mounted in app.js)
 *
 * Medicines
 * GET    /medicines                     List medicines (search/paginate)
 * GET    /medicines/categories          List medicine categories
 * POST   /medicines/categories          Create a medicine category
 * GET    /medicines/barcode/:barcode    Scanner barcode lookup
 * GET    /medicines/:id                 Get single medicine
 * POST   /medicines                     Create medicine
 * PATCH  /medicines/:id                 Update medicine
 *
 * Stock / Batches
 * GET    /stock                         Stock management view (batch list)
 * POST   /stock                         Manual / opening stock entry
 *
 * Prescription Suggestions
 * POST   /suggest                       Suggest medicines from prescription terms
 *
 * Billing — dispense / sale counter
 *   Doctor's request -> generate charge -> get receipt -> enter paid amount -> close
 * GET    /bills                         List bills (filtered by patient/appointment/admission)
 * GET    /bills/:id                     Get bill with items
 * POST   /bills                         Generate a bill (FIFO stock deduction)
 * PATCH  /bills/:id/payment             Enter paid amount
 * POST   /bills/:id/close               Save and close order
 *
 * Suppliers
 * GET    /suppliers
 * GET    /suppliers/:id
 * POST   /suppliers
 * PATCH  /suppliers/:id
 *
 * Purchase Orders — "Items to order" -> "Place order"
 * GET    /purchase-orders
 * GET    /purchase-orders/:id
 * POST   /purchase-orders
 * POST   /purchase-orders/:id/cancel
 *
 * Goods Receipt / GRN — "Received with bill" -> "Pharmacy entry (bill number)"
 * GET    /goods-receipts
 * GET    /goods-receipts/:id
 * POST   /goods-receipts
 * PATCH  /goods-receipts/:id/payment    Enter paid amount
 * POST   /goods-receipts/:id/close      Save and close order
 *
 * Reports
 * GET    /reports/low-stock             Minimum-stock threshold breaches
 * GET    /reports/expiring?days=90      Expiry stock
 * GET    /reports/non-movable?days=90   Non-movable (dead) stock
 * GET    /reports/movements             Patient-wise / drug-wise ledger (filterable)
 * GET    /reports/movements/daily       Daily movement summary
 */

const router = require('express').Router();
const ctrl = require('./pharmacy.controller');
const { verifyToken } = require('../../middleware/auth');

router.use(verifyToken);

// Medicines — NOTE: specific routes MUST come before /:id to avoid conflict
router.get('/medicines/categories', ctrl.listCategories);
router.post('/medicines/categories', ctrl.createCategory);
router.patch('/medicines/categories/:id', ctrl.updateCategory);
router.delete('/medicines/categories/:id', ctrl.deleteCategory);
router.get('/medicines/barcode/:barcode', ctrl.getByBarcode);
router.get('/medicines', ctrl.listMedicines);
router.get('/medicines/:id', ctrl.getMedicine);
router.post('/medicines', ctrl.createMedicine);
router.patch('/medicines/:id', ctrl.updateMedicine);
router.delete('/medicines/:id', ctrl.deleteMedicine);

// Stock
router.get('/stock', ctrl.listStock);
router.post('/stock', ctrl.addStock);

// Prescription suggestions
router.post('/suggest', ctrl.suggestMedicines);

// Billing
router.get('/bills', ctrl.listBills);
router.get('/bills/:id', ctrl.getBill);
router.post('/bills', ctrl.generateBill);
router.patch('/bills/:id/payment', ctrl.recordBillPayment);
router.post('/bills/:id/close', ctrl.closeBill);

// Suppliers
router.get('/suppliers', ctrl.listSuppliers);
router.get('/suppliers/:id', ctrl.getSupplier);
router.post('/suppliers', ctrl.createSupplier);
router.patch('/suppliers/:id', ctrl.updateSupplier);

// Purchase orders
router.get('/purchase-orders', ctrl.listPurchaseOrders);
router.get('/purchase-orders/:id', ctrl.getPurchaseOrder);
router.post('/purchase-orders', ctrl.createPurchaseOrder);
router.post('/purchase-orders/:id/cancel', ctrl.cancelPurchaseOrder);

// Goods receipt / GRN
router.get('/goods-receipts', ctrl.listGoodsReceipts);
router.get('/goods-receipts/:id', ctrl.getGoodsReceipt);
router.post('/goods-receipts', ctrl.createGoodsReceipt);
router.patch('/goods-receipts/:id/payment', ctrl.recordGoodsReceiptPayment);
router.post('/goods-receipts/:id/close', ctrl.closeGoodsReceipt);

// Reports — NOTE: specific routes MUST come before any /:id-style report route
router.get('/reports/low-stock', ctrl.lowStockReport);
router.get('/reports/expiring', ctrl.expiringStockReport);
router.get('/reports/non-movable', ctrl.nonMovableStockReport);
router.get('/reports/movements/daily', ctrl.dailyMovementSummary);
router.get('/reports/movements', ctrl.listMovements);

module.exports = router;
