/**
 * pharmacy.routes.js
 *
 * Base path: /api/pharmacy   (mounted in app.js)
 *
 * Medicines
 * GET    /medicines                     List medicines (search/paginate)
 * GET    /medicines/barcode/:barcode    Scanner barcode lookup
 * GET    /medicines/:id                 Get single medicine
 * POST   /medicines                     Create medicine
 * PATCH  /medicines/:id                 Update medicine
 *
 * Stock / Batches
 * GET    /stock                         Stock management view (batch list)
 * POST   /stock                         Receive new stock batch
 *
 * Prescription Suggestions
 * POST   /suggest                       Suggest medicines from prescription terms
 *
 * Billing
 * GET    /bills                         List bills (filtered by patient/appointment/admission)
 * GET    /bills/:id                     Get bill with items
 * POST   /bills                         Generate a bill (FIFO stock deduction)
 */

const router = require('express').Router();
const ctrl = require('./pharmacy.controller');

// Medicines — NOTE: barcode route MUST come before /:id to avoid conflict
router.get('/medicines/barcode/:barcode', ctrl.getByBarcode);
router.get('/medicines', ctrl.listMedicines);
router.get('/medicines/:id', ctrl.getMedicine);
router.post('/medicines', ctrl.createMedicine);
router.patch('/medicines/:id', ctrl.updateMedicine);

// Stock
router.get('/stock', ctrl.listStock);
router.post('/stock', ctrl.addStock);

// Prescription suggestions
router.post('/suggest', ctrl.suggestMedicines);

// Billing
router.get('/bills', ctrl.listBills);
router.get('/bills/:id', ctrl.getBill);
router.post('/bills', ctrl.generateBill);

module.exports = router;
