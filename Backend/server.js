process.env.TZ = 'Asia/Kolkata';
require('dotenv').config();

const app = require('./src/app');
const PORT = process.env.PORT || 5000;
const http = require('http');
const server = http.createServer(app);

const db = require('./src/config/db');
const { startBiometricAutoSync, stopBiometricAutoSync } = require('./src/modules/attendance/attendance.cron');

app.set('trust proxy', 1);

app.get("/", (req, res) => {
  res.send(`OK-App`);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  // Start automated 5-minute biometric background synchronization
  startBiometricAutoSync();
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Cleaning up background tasks...');
  stopBiometricAutoSync();
  server.close(() => process.exit(0));
});