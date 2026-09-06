/**
 * server.js
 *
 * Main entry point for Neha Hospitals Biometric Connector microservice.
 * Runs on hospital LAN, maps to https://neha-bio.tylo.co.in via Cloudflare Tunnel.
 */

const express = require('express');
const cors = require('cors');
const config = require('./config');
const apiRoutes = require('./routes/api.routes');
const deviceManager = require('./services/deviceManager');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Root welcome & info route
app.get('/', (req, res) => {
  res.json({
    service: 'Neha Hospitals — Biometric Connector Edge Microservice',
    status: 'running',
    port: config.port,
    publicUrl: config.publicUrl,
    endpoints: {
      health: 'GET /api/health',
      devices: 'GET /api/devices',
      addDevice: 'POST /api/devices',
      testDevice: 'POST /api/devices/:id/test',
      fetchPunches: 'GET /api/devices/:id/punches',
      syncDevice: 'POST /api/devices/:id/sync',
      syncAll: 'POST /api/sync-all',
    },
    documentation: 'See README.md for setup instructions and Cloudflare tunnel configuration.',
  });
});

// Mount API router
app.use('/api', apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Endpoint ${req.method} ${req.url} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

// Start Server
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log('================================================================');
  console.log(`  🏥 NEHA HOSPITALS — BIOMETRIC CONNECTOR EDGE SERVICE`);
  console.log(`  Listening locally on : http://localhost:${config.port}`);
  console.log(`  Cloudflare Tunnel URL : ${config.publicUrl}`);
  console.log(`  Central Backend API  : ${config.mainBackendUrl}`);
  console.log(`  Devices Configured   : ${deviceManager.listDevices().length}`);
  console.log('================================================================');

  // Start background auto-sync scheduler if enabled
  if (config.autoSyncIntervalMins > 0) {
    const intervalMs = config.autoSyncIntervalMins * 60 * 1000;
    console.log(`[AutoSync] Background auto-sync enabled every ${config.autoSyncIntervalMins} minute(s).`);

    // Initial sync after 10 seconds of startup
    setTimeout(async () => {
      try {
        console.log('[AutoSync] Running startup punch sync across all devices...');
        await deviceManager.syncAllDevices();
        console.log('[AutoSync] Running enrolled staff registrations sync across all devices...');
        await deviceManager.syncAllEnrolledUsers();
      } catch (err) {
        console.warn('[AutoSync] Initial sync warning:', err.message);
      }
    }, 10000);

    // Periodic sync
    setInterval(async () => {
      try {
        console.log('[AutoSync] Triggering scheduled periodic punch sync...');
        await deviceManager.syncAllDevices();
        console.log('[AutoSync] Triggering scheduled periodic enrolled staff sync...');
        await deviceManager.syncAllEnrolledUsers();
      } catch (err) {
        console.warn('[AutoSync] Periodic sync warning:', err.message);
      }
    }, intervalMs);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down Biometric Connector gracefully...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down Biometric Connector...');
  server.close(() => process.exit(0));
});
