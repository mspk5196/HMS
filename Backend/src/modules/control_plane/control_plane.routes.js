const router = require('express').Router();
const ctrl = require('./control_plane.controller');
const jwt = require('jsonwebtoken');
const { fail } = require('../../utils/response');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Middleware to verify Super Admin JWT
const verifySuperAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.super_admin_token;
  if (!token) {
    return res.status(401).json(fail('Access denied. Super Admin token required.'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'SUPER_ADMIN') {
      return res.status(403).json(fail('Forbidden: Super Admin privilege required.'));
    }
    req.superAdmin = decoded;
    next();
  } catch (err) {
    return res.status(401).json(fail('Invalid or expired Super Admin token.'));
  }
};

// ─── Public Endpoints ───────────────────────────────────────────────────────
router.post('/auth/login', ctrl.login);
router.post('/connectors/pair', ctrl.pairConnector);

// ─── Super Admin Protected Management Routes ────────────────────────────────
router.use(verifySuperAdmin);

router.get('/organizations', ctrl.listOrganizations);
router.get('/organizations/:id', ctrl.getOrganization);
router.post('/organizations', ctrl.createOrganization);
router.put('/organizations/:id', ctrl.updateOrganization);

router.get('/connectors', ctrl.listConnectors);
router.post('/connectors/generate-token', ctrl.generateToken);

module.exports = router;
