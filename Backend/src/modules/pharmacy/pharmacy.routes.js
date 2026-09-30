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
const { verifyToken, requirePermissions } = require('../../middleware/auth');
const { gate } = require('../../middleware/approvalGate');

router.use(verifyToken);
const canViewPharmacy = requirePermissions(['pharmacy.view']);

// Medicines — NOTE: specific routes MUST come before /:id to avoid conflict
router.get('/medicines/categories', canViewPharmacy, ctrl.listCategories);
router.post('/medicines/categories', gate('pharmacy.create', ctrl.createCategory));
router.patch('/medicines/categories/:id', gate('pharmacy.edit', ctrl.updateCategory));
router.delete('/medicines/categories/:id', gate('pharmacy.delete', ctrl.deleteCategory));
router.get('/medicines/form-factors', canViewPharmacy, ctrl.listFormFactors);
router.post('/medicines/form-factors', gate('pharmacy.create', ctrl.createFormFactor));
router.patch('/medicines/form-factors/:id', gate('pharmacy.edit', ctrl.updateFormFactor));
router.delete('/medicines/form-factors/:id', gate('pharmacy.delete', ctrl.deleteFormFactor));
router.get('/medicines/barcode/:barcode', canViewPharmacy, ctrl.getByBarcode);
router.get('/medicines', canViewPharmacy, ctrl.listMedicines);
router.get('/medicines/:id', canViewPharmacy, ctrl.getMedicine);
router.post('/medicines', gate('pharmacy.create', ctrl.createMedicine));
router.patch('/medicines/:id', gate('pharmacy.edit', ctrl.updateMedicine));
router.delete('/medicines/:id', gate('pharmacy.delete', ctrl.deleteMedicine));

// Stock
router.get('/stock', canViewPharmacy, ctrl.listStock);
router.post('/stock', gate('pharmacy.create', ctrl.addStock));

// Prescription suggestions
router.post('/suggest', canViewPharmacy, ctrl.suggestMedicines);

// Billing
router.get('/bills', canViewPharmacy, ctrl.listBills);
router.get('/bills/:id', canViewPharmacy, ctrl.getBill);
router.post('/bills', gate('pharmacy.dispense_medicine', ctrl.generateBill));
router.patch('/bills/:id/payment', gate('pharmacy.dispense_medicine', ctrl.recordBillPayment));
router.post('/bills/:id/close', gate('pharmacy.dispense_medicine', ctrl.closeBill));

// Suppliers
router.get('/suppliers', canViewPharmacy, ctrl.listSuppliers);
router.get('/suppliers/:id', canViewPharmacy, ctrl.getSupplier);
router.post('/suppliers', gate('pharmacy.create', ctrl.createSupplier));
router.patch('/suppliers/:id', gate('pharmacy.edit', ctrl.updateSupplier));

// Purchase orders
router.get('/purchase-orders', canViewPharmacy, ctrl.listPurchaseOrders);
router.get('/purchase-orders/:id', canViewPharmacy, ctrl.getPurchaseOrder);
router.post('/purchase-orders', gate('pharmacy.create_purchase_order', ctrl.createPurchaseOrder));
router.post('/purchase-orders/:id/cancel', gate('pharmacy.delete', ctrl.cancelPurchaseOrder));

// Goods receipt / GRN
router.get('/goods-receipts', canViewPharmacy, ctrl.listGoodsReceipts);
router.get('/goods-receipts/:id', canViewPharmacy, ctrl.getGoodsReceipt);
router.post('/goods-receipts', gate('pharmacy.receive_goods_grn', ctrl.createGoodsReceipt));
router.patch('/goods-receipts/:id/payment', gate('pharmacy.receive_goods_grn', ctrl.recordGoodsReceiptPayment));
router.post('/goods-receipts/:id/close', gate('pharmacy.receive_goods_grn', ctrl.closeGoodsReceipt));

// Reports — NOTE: specific routes MUST come before any /:id-style report route
router.get('/reports/low-stock', canViewPharmacy, ctrl.lowStockReport);
router.get('/reports/expiring', canViewPharmacy, ctrl.expiringStockReport);
router.get('/reports/non-movable', canViewPharmacy, ctrl.nonMovableStockReport);
router.get('/reports/movements/daily', canViewPharmacy, ctrl.dailyMovementSummary);
router.get('/reports/movements', canViewPharmacy, ctrl.listMovements);

module.exports = router;
