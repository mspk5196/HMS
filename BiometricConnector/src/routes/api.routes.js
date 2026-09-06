/**
 * api.routes.js
 *
 * REST API router for Biometric Connector edge service.
 */

const express = require('express');
const router = express.Router();
const config = require('../config');
const deviceManager = require('../services/deviceManager');

// Optional API Key Authentication Middleware
const authMiddleware = (req, res, next) => {
  if (!config.apiKey) return next();

  const headerKey = req.headers['x-api-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  const queryKey = req.query.apiKey;

  if ((headerKey && headerKey === config.apiKey) || (queryKey && queryKey === config.apiKey)) {
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized: Invalid or missing x-api-key header.',
  });
};

/* ─────────────────────────────────────────────
   PUBLIC HEALTH CHECK
───────────────────────────────────────────── */
router.get('/health', (req, res) => {
  const devices = deviceManager.listDevices();
  res.json({
    success: true,
    status: 'online',
    service: 'Neha Hospitals Biometric Connector',
    publicUrl: config.publicUrl,
    deviceCount: devices.length,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/* ─────────────────────────────────────────────
   DEVICE MANAGEMENT
───────────────────────────────────────────── */

// List all devices
router.get('/devices', authMiddleware, (req, res) => {
  const devices = deviceManager.listDevices();
  res.json({ success: true, count: devices.length, data: devices });
});

// Add a new device
router.post('/devices', authMiddleware, (req, res) => {
  const { name, ip, port, commKey, location, enabled } = req.body;
  if (!ip) {
    return res.status(400).json({ success: false, message: 'Device IP address (ip) is required' });
  }

  const device = deviceManager.addDevice({ name, ip, port, commKey, location, enabled });
  res.status(201).json({ success: true, message: 'Biometric device added successfully', data: device });
});

// Update an existing device
router.put('/devices/:id', authMiddleware, (req, res) => {
  const updated = deviceManager.updateDevice(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ success: false, message: `Device "${req.params.id}" not found` });
  }
  res.json({ success: true, message: 'Device updated successfully', data: updated });
});

// Delete a device
router.delete('/devices/:id', authMiddleware, (req, res) => {
  const deleted = deviceManager.deleteDevice(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: `Device "${req.params.id}" not found` });
  }
  res.json({ success: true, message: 'Device deleted successfully' });
});

/* ─────────────────────────────────────────────
   DEVICE OPERATIONS & PUNCH SYNC
───────────────────────────────────────────── */

// Test live connection to a device on LAN
router.all('/devices/:id/test', authMiddleware, async (req, res) => {
  try {
    const result = await deviceManager.testDevice(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(502).json({
      success: false,
      deviceId: req.params.id,
      message: err.message,
    });
  }
});

// Fetch punches from a device (returns punch logs directly)
router.get('/devices/:id/punches', authMiddleware, async (req, res) => {
  try {
    const result = await deviceManager.fetchPunchesFromDevice(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(502).json({
      success: false,
      deviceId: req.params.id,
      message: err.message,
    });
  }
});

// Sync a single device (fetch logs & forward to central backend)
router.post('/devices/:id/sync', authMiddleware, async (req, res) => {
  try {
    const result = await deviceManager.syncDevice(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(502).json({
      success: false,
      deviceId: req.params.id,
      message: err.message,
    });
  }
});

// Sync all enabled devices
router.post('/sync-all', authMiddleware, async (req, res) => {
  try {
    const result = await deviceManager.syncAllDevices();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Direct forward punch batch to central backend
router.post('/forward', authMiddleware, async (req, res) => {
  const { punches } = req.body;
  if (!Array.isArray(punches)) {
    return res.status(400).json({ success: false, message: 'punches array is required' });
  }
  try {
    const forwardResult = await deviceManager.forwardPunchesToBackend(punches);
    res.json({ success: true, result: forwardResult });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message });
  }
});

// Fetch enrolled users from a biometric device
router.get('/devices/:id/users', authMiddleware, async (req, res) => {
  try {
    const result = await deviceManager.fetchUsersFromDevice(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(502).json({
      success: false,
      deviceId: req.params.id,
      message: err.message,
    });
  }
});

// Sync enrolled users from a device to central backend
router.post('/devices/:id/sync-users', authMiddleware, async (req, res) => {
  try {
    const result = await deviceManager.syncDeviceUsers(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(502).json({
      success: false,
      deviceId: req.params.id,
      message: err.message,
    });
  }
});

// Sync all enrolled users across all devices to central backend
router.post('/sync-users-all', authMiddleware, async (req, res) => {
  try {
    const result = await deviceManager.syncAllEnrolledUsers();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Directly register single staff member from Windows machine to central backend
router.post('/register-staff', authMiddleware, async (req, res) => {
  try {
    const result = await deviceManager.registerStaffDirectly(req.body);
    res.json({ success: true, result });
  } catch (err) {
    res.status(502).json({ success: false, message: err.message });
  }
});

module.exports = router;
