/**
 * attendance.cron.js
 *
 * Background scheduled worker that periodically syncs biometric punch logs
 * and enrolled staff records from all active biometric machines every 5 minutes,
 * automatically updating raw punches, linking orphan punches, and processing
 * daily attendance summaries in the database.
 */

const esslSvc = require('./essl.service');
const attendanceSvc = require('./attendance.service');

let isSyncInProgress = false;
let autoSyncIntervalTimer = null;

const DEFAULT_INTERVAL_MINS = 5;

/**
 * Runs a single cycle of biometric synchronization across all active devices.
 */
async function runBiometricAutoSync() {
  if (isSyncInProgress) {
    console.log('[BiometricAutoSync] Previous sync cycle still running, skipping this tick...');
    return;
  }

  isSyncInProgress = true;
  const startTime = Date.now();

  try {
    console.log(`[BiometricAutoSync] 🔄 Starting 5-minute automated biometric sync...`);

    // 1. Sync punches from all active devices and process attendance
    const results = await esslSvc.syncAllActiveDevices(attendanceSvc);

    let totalLogsFetched = 0;
    let totalNewInserted = 0;
    let totalAffectedDates = 0;
    let successCount = 0;
    let errorCount = 0;

    if (Array.isArray(results)) {
      for (const r of results) {
        if (r.success) {
          successCount++;
          totalLogsFetched += (r.totalLogsFetched || 0);
          totalNewInserted += (r.newPunchesInserted || 0);
          totalAffectedDates += (r.affectedDatesCount || 0);
        } else {
          errorCount++;
          console.warn(`[BiometricAutoSync] ⚠️ Sync error for device "${r.deviceName || r.deviceId}":`, r.error);
        }
      }
    }

    // 2. Sync enrolled users registrations from devices
    try {
      await esslSvc.syncAllEnrolledUsers();
    } catch (userErr) {
      console.warn('[BiometricAutoSync] ⚠️ Enrolled users sync warning:', userErr.message);
    }

    const elapsedMs = Date.now() - startTime;
    console.log(
      `[BiometricAutoSync] ✅ Auto-sync complete (${elapsedMs}ms). ` +
      `Devices: ${successCount} ok, ${errorCount} failed | ` +
      `Logs fetched: ${totalLogsFetched} | New punches: ${totalNewInserted} | ` +
      `Dates updated: ${totalAffectedDates}`
    );
  } catch (err) {
    console.error('[BiometricAutoSync] ❌ Automated sync error:', err.message);
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Starts the automated 5-minute background biometric sync scheduler.
 */
function startBiometricAutoSync() {
  const intervalMins = Number(process.env.BIOMETRIC_AUTO_SYNC_INTERVAL_MINS) || DEFAULT_INTERVAL_MINS;
  const intervalMs = Math.max(1, intervalMins) * 60 * 1000;

  console.log(`[BiometricAutoSync] Initializing background auto-sync every ${intervalMins} minute(s)...`);

  // Initial auto-sync 15 seconds after startup
  setTimeout(() => {
    runBiometricAutoSync().catch((err) => {
      console.warn('[BiometricAutoSync] Startup auto-sync warning:', err.message);
    });
  }, 15000);

  // Periodic recurring timer
  if (autoSyncIntervalTimer) {
    clearInterval(autoSyncIntervalTimer);
  }
  autoSyncIntervalTimer = setInterval(() => {
    runBiometricAutoSync().catch((err) => {
      console.warn('[BiometricAutoSync] Periodic auto-sync warning:', err.message);
    });
  }, intervalMs);

  return autoSyncIntervalTimer;
}

/**
 * Stops the scheduler (for graceful server shutdown).
 */
function stopBiometricAutoSync() {
  if (autoSyncIntervalTimer) {
    clearInterval(autoSyncIntervalTimer);
    autoSyncIntervalTimer = null;
    console.log('[BiometricAutoSync] Background auto-sync stopped.');
  }
}

module.exports = {
  startBiometricAutoSync,
  stopBiometricAutoSync,
  runBiometricAutoSync,
};
