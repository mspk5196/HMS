/**
 * config.js
 *
 * Central configuration loader for Biometric Connector.
 */

require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 8000,
  publicUrl: process.env.PUBLIC_URL || 'https://neha-bio.tylo.co.in',
  apiKey: process.env.CONNECTOR_API_KEY || 'neha_bio_secret_key_2026',
  mainBackendUrl: process.env.MAIN_BACKEND_URL || 'http://localhost:7000',
  mainBackendApiKey: process.env.MAIN_BACKEND_API_KEY || '',
  autoSyncIntervalMins: Number(process.env.AUTO_SYNC_INTERVAL_MINS) || 5,

  // Default device configuration
  defaultDevice: {
    id: 'dev-1',
    name: process.env.DEFAULT_DEVICE_NAME || 'Main Entrance Reception',
    ip: process.env.DEFAULT_DEVICE_IP || '192.168.1.201',
    port: Number(process.env.DEFAULT_DEVICE_PORT) || 4370,
    commKey: process.env.DEFAULT_DEVICE_COMM_KEY || '0',
    location: process.env.DEFAULT_DEVICE_LOCATION || 'Main Entrance',
    enabled: true,
  },
};

module.exports = config;
