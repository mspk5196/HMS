const router = require('express').Router();
const ctrl = require('./system.controller');
const { verifyToken, requireSettingsAccess } = require('../../middleware/auth');
const { logoUpload } = require('../../middleware/upload');

router.use(verifyToken);

// Read routes: Accessible to any authenticated user (needed for header banners, receipts, brand logos)
router.get('/', ctrl.listConfig);
router.get('/hospital-profile', ctrl.getHospitalProfile);
router.get('/:key', ctrl.getConfig);

// Write routes: Strictly restricted to users with settings access
router.patch('/hospital-profile', requireSettingsAccess, ctrl.updateHospitalProfile);
router.put('/hospital-profile', requireSettingsAccess, ctrl.updateHospitalProfile);
router.post('/logo', requireSettingsAccess, logoUpload, ctrl.uploadLogo);
router.delete('/logo', requireSettingsAccess, ctrl.deleteLogo);
router.patch('/:key', requireSettingsAccess, ctrl.updateConfig);

module.exports = router;
