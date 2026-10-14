/**
 * deviceManager.js
 *
 * Multi-device manager for biometric attendance terminals on local LAN.
 * Handles device registration, status tracking, punch collection, and forwarding to main backend.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { EsslDevice } = require('../drivers/essl.driver');

const STORAGE_FILE = path.resolve(__dirname, '..', '..', 'devices.json');
const OFFLINE_BUFFER_FILE = path.resolve(__dirname, '..', '..', 'offline_punches.json');

/**
 * Normalizes the backend endpoint URL so both 'https://neha.tylo.co.in' and 'https://neha.tylo.co.in/api' work perfectly.
 */
function getBackendApiUrl(endpoint) {
  if (!config.mainBackendUrl) return null;
  const base = config.mainBackendUrl.trim().replace(/\/+$/, '').replace(/\/api$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}/api${cleanEndpoint.replace(/^\/api/, '')}`;
}

class DeviceManager {
  constructor() {
    this.devices = new Map();
    this.deviceMetrics = new Map();
    this.loadDevices();

    // Auto-sync devices from central Backend on startup and every 60s
    this.syncDevicesFromBackend().catch(() => {});
    this._deviceSyncTimer = setInterval(() => {
      this.syncDevicesFromBackend().catch(() => {});
    }, 60000);

    // Heartbeat reporting to Control Plane
    this.sendHeartbeat().catch(() => {});
    this._heartbeatTimer = setInterval(() => {
      this.sendHeartbeat().catch(() => {});
    }, 60000);

    // Periodic flush of offline buffered punches
    this.flushOfflineBuffer().catch(() => {});
    this._bufferFlushTimer = setInterval(() => {
      this.flushOfflineBuffer().catch(() => {});
    }, 45000);
  }

  /**
   * Dynamically synchronizes configured devices from the central Neha Hospital backend.
   * Ensures new devices added via Web UI ('Biometric Devices & Sync' page) are automatically connected.
   */
  async syncDevicesFromBackend() {
    const url = getBackendApiUrl('/attendance/devices');
    if (!url) return;
    try {
      const headers = {};
      if (config.mainBackendApiKey) {
        headers['Authorization'] = `Bearer ${config.mainBackendApiKey}`;
        headers['x-api-key'] = config.mainBackendApiKey;
      }
      const resp = await axios.get(url, { headers, timeout: 5000 });
      const data = resp.data?.data || resp.data?.devices || (Array.isArray(resp.data) ? resp.data : []);
      if (Array.isArray(data) && data.length > 0) {
        let changed = false;
        for (const item of data) {
          const devId = String(item.id || item.device_id || `dev-${item.ip_address || item.ip}`);
          const ip = item.ip_address || item.ip;
          if (!ip) continue;
          const existing = this.devices.get(devId);
          const devObj = {
            id: devId,
            name: item.name || existing?.name || `Biometric Device (${ip})`,
            ip: ip,
            port: Number(item.port || item.port_number || existing?.port || 4370),
            commKey: String(item.comm_key ?? item.commKey ?? existing?.commKey ?? '0'),
            location: item.location || existing?.location || 'Hospital Gate',
            enabled: item.is_active !== 0 && item.auto_sync_enabled !== 0 && item.enabled !== false,
            createdAt: item.created_at || existing?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          this.devices.set(devId, devObj);
          changed = true;
        }
        if (changed) {
          this.saveDevices();
          console.log(`[DeviceManager] Synced ${this.devices.size} device(s) from central backend.`);
        }
      }
    } catch (err) {
      // Backend may be booting or unreachable
    }
  }

  loadDevices() {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          list.forEach((d) => this.devices.set(String(d.id), d));
          console.log(`[DeviceManager] Loaded ${this.devices.size} device(s) from devices.json`);
          return;
        }
      }
    } catch (err) {
      console.warn('[DeviceManager] Could not load devices.json, using defaults:', err.message);
    }

    // Initialize with default device from config
    const def = config.defaultDevice;
    this.devices.set(def.id, def);
    this.saveDevices();
    console.log(`[DeviceManager] Initialized with default device: ${def.name} (${def.ip}:${def.port})`);
  }

  saveDevices() {
    try {
      const list = Array.from(this.devices.values());
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.error('[DeviceManager] Failed to persist devices.json:', err.message);
    }
  }

  listDevices() {
    return Array.from(this.devices.values()).map((d) => {
      const metrics = this.deviceMetrics.get(String(d.id)) || {
        status: 'unknown',
        lastTestedAt: null,
        lastSyncedAt: null,
        lastSyncCount: 0,
        lastLatencyMs: null,
      };
      return { ...d, metrics };
    });
  }

  getDevice(id) {
    if (!id) return Array.from(this.devices.values())[0] || null;
    const strId = String(id).trim();
    if (this.devices.has(strId)) return this.devices.get(strId);
    if (this.devices.has(`dev-${strId}`)) return this.devices.get(`dev-${strId}`);

    for (const d of this.devices.values()) {
      if (String(d.id) === strId || String(d.id) === `dev-${strId}` || d.ip === strId || d.name?.toLowerCase() === strId.toLowerCase()) {
        return d;
      }
    }
    return Array.from(this.devices.values())[0] || null;
  }

  addDevice(data) {
    const id = data.id || `dev-${Date.now()}`;
    const device = {
      id: String(id),
      name: data.name || `Biometric Device ${this.devices.size + 1}`,
      ip: data.ip || '192.168.1.201',
      port: Number(data.port) || 4370,
      commKey: data.commKey || '0',
      location: data.location || 'Hospital Gate',
      enabled: data.enabled !== false,
      createdAt: new Date().toISOString(),
    };
    this.devices.set(device.id, device);
    this.saveDevices();
    return device;
  }

  updateDevice(id, data) {
    const existing = this.devices.get(String(id));
    if (!existing) return null;

    const updated = {
      ...existing,
      ...data,
      id: existing.id, // preserve ID
      updatedAt: new Date().toISOString(),
    };
    this.devices.set(existing.id, updated);
    this.saveDevices();
    return updated;
  }

  deleteDevice(id) {
    const existed = this.devices.delete(String(id));
    if (existed) {
      this.deviceMetrics.delete(String(id));
      this.saveDevices();
    }
    return existed;
  }

  /**
   * Tests live TCP connection to a device on LAN.
   */
  async testDevice(id) {
    const device = this.getDevice(id);
    if (!device) throw new Error(`Device with ID "${id}" not found`);

    const driver = new EsslDevice({
      name: device.name,
      ip: device.ip,
      port: device.port,
      commKey: device.commKey,
      timeoutMs: 6000,
    });

    try {
      const result = await driver.testConnection();
      this.deviceMetrics.set(String(id), {
        status: 'online',
        lastTestedAt: new Date().toISOString(),
        lastLatencyMs: result.latencyMs,
      });
      return { success: true, ...result };
    } catch (err) {
      this.deviceMetrics.set(String(id), {
        status: 'unreachable',
        lastTestedAt: new Date().toISOString(),
        lastError: err.message,
      });
      throw err;
    }
  }

  /**
   * Fetches raw attendance punches from a specific device.
   */
  async fetchPunchesFromDevice(id) {
    const device = this.getDevice(id);
    if (!device) throw new Error(`Device with ID "${id}" not found`);

    const driver = new EsslDevice({
      name: device.name,
      ip: device.ip,
      port: device.port,
      commKey: device.commKey,
      timeoutMs: 12000,
    });

    const rawPunches = await driver.fetchPunches();
    
    // Enrich punches with device identifier
    const punches = rawPunches.map((p) => ({
      employee_code: String(p.employee_code).trim(),
      punch_time: p.punch_time,
      punch_type: p.punch_type || 'in',
      device_id: device.name || `DEV-${device.id}`,
    }));

    const prevMetrics = this.deviceMetrics.get(String(id)) || {};
    this.deviceMetrics.set(String(id), {
      ...prevMetrics,
      status: 'online',
      lastSyncedAt: new Date().toISOString(),
      lastSyncCount: punches.length,
    });

    return {
      deviceId: device.id,
      deviceName: device.name,
      totalPunches: punches.length,
      punches,
    };
  }

  /**
   * Loads pending offline punches from local storage file
   */
  loadOfflineBuffer() {
    try {
      if (fs.existsSync(OFFLINE_BUFFER_FILE)) {
        const raw = fs.readFileSync(OFFLINE_BUFFER_FILE, 'utf8');
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list : [];
      }
    } catch (err) {
      console.warn('[OfflineBuffer] Error loading offline buffer:', err.message);
    }
    return [];
  }

  /**
   * Saves punches to offline buffer file when central backend is unreachable
   */
  saveToOfflineBuffer(newPunches) {
    if (!newPunches || newPunches.length === 0) return;
    try {
      const existing = this.loadOfflineBuffer();
      const existingKeys = new Set(existing.map((p) => `${p.employee_code || p.employee_id}_${p.punch_time}`));
      let added = 0;
      for (const p of newPunches) {
        const key = `${p.employee_code || p.employee_id}_${p.punch_time}`;
        if (!existingKeys.has(key)) {
          existing.push(p);
          existingKeys.add(key);
          added++;
        }
      }
      if (added > 0) {
        fs.writeFileSync(OFFLINE_BUFFER_FILE, JSON.stringify(existing, null, 2), 'utf8');
        console.log(`[OfflineBuffer] Buffered ${added} punch(es) locally due to offline network. Total pending: ${existing.length}`);
      }
    } catch (err) {
      console.error('[OfflineBuffer] Failed to write offline buffer:', err.message);
    }
  }

  /**
   * Flushes locally buffered punches to central backend once network connection is restored
   */
  async flushOfflineBuffer() {
    const buffer = this.loadOfflineBuffer();
    if (buffer.length === 0) return;

    console.log(`[OfflineBuffer] Attempting to flush ${buffer.length} buffered punch(es) to central backend...`);
    const targetUrl = getBackendApiUrl('/attendance/punches/import');
    if (!targetUrl) return;

    const headers = { 'Content-Type': 'application/json' };
    if (config.mainBackendApiKey) {
      headers['Authorization'] = `Bearer ${config.mainBackendApiKey}`;
      headers['x-api-key'] = config.mainBackendApiKey;
    }

    try {
      const resp = await axios.post(targetUrl, { punches: buffer }, { headers, timeout: 20000 });
      console.log(`[OfflineBuffer] Successfully flushed ${buffer.length} buffered punch(es) to backend!`);
      fs.writeFileSync(OFFLINE_BUFFER_FILE, JSON.stringify([], null, 2), 'utf8');
      return resp.data;
    } catch (err) {
      console.warn(`[OfflineBuffer] Backend still unreachable (${err.message}). Retrying in next cycle.`);
    }
  }

  /**
   * Periodic outbound heartbeat reporting connector health to the Control Plane
   */
  async sendHeartbeat() {
    const targetUrl = getBackendApiUrl('/attendance/connector/heartbeat');
    if (!targetUrl) return;

    const headers = { 'Content-Type': 'application/json' };
    if (config.mainBackendApiKey) {
      headers['Authorization'] = `Bearer ${config.mainBackendApiKey}`;
      headers['x-api-key'] = config.mainBackendApiKey;
    }

    const payload = {
      connector_key: config.mainBackendApiKey,
      public_url: config.publicUrl,
      version: '1.0.0',
      devices_total: this.devices.size,
      buffered_punches: this.loadOfflineBuffer().length,
      uptime_seconds: Math.floor(process.uptime()),
    };

    try {
      await axios.post(targetUrl, payload, { headers, timeout: 5000 });
    } catch (err) {
      // Non-fatal if backend is rebooting
    }
  }

  /**
   * Forwards a list of punches to the central Neha Hospital backend.
   * Seamlessly falls back to local offline buffering if internet/network fails.
   */
  async forwardPunchesToBackend(punches) {
    if (!punches || punches.length === 0) return { inserted: 0, message: 'No punches to forward' };

    const targetUrl = getBackendApiUrl('/attendance/punches/import');
    if (!targetUrl) return { inserted: 0, message: 'MAIN_BACKEND_URL not configured' };
    const headers = {
      'Content-Type': 'application/json',
    };
    if (config.mainBackendApiKey) {
      headers['Authorization'] = `Bearer ${config.mainBackendApiKey}`;
      headers['x-api-key'] = config.mainBackendApiKey;
    }

    console.log(`[DeviceManager] Forwarding ${punches.length} punch(es) to ${targetUrl}...`);

    try {
      const resp = await axios.post(targetUrl, { punches }, { headers, timeout: 15000 });
      // On success, try flushing any previously buffered punches as connectivity is confirmed healthy
      this.flushOfflineBuffer().catch(() => {});
      return resp.data;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      console.warn(`[DeviceManager] Failed to forward punches to backend (${errMsg}). Buffering offline...`);
      this.saveToOfflineBuffer(punches);
      return { inserted: 0, buffered: punches.length, offline: true, message: `Punches buffered offline: ${errMsg}` };
    }
  }

  /**
   * Syncs one device: pulls from hardware terminal, then forwards to central backend.
   */
  async syncDevice(id) {
    const fetchResult = await this.fetchPunchesFromDevice(id);
    let forwardResult = null;
    let error = null;

    if (fetchResult.punches.length > 0 && config.mainBackendUrl) {
      try {
        forwardResult = await this.forwardPunchesToBackend(fetchResult.punches);
      } catch (fErr) {
        error = fErr.message;
      }
    }

    return {
      success: !error,
      deviceId: id,
      deviceName: fetchResult.deviceName,
      totalLogsFetched: fetchResult.totalPunches,
      forwardResult,
      error,
      syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Syncs all enabled devices in sequence.
   */
  async syncAllDevices() {
    await this.syncDevicesFromBackend().catch(() => {});
    const enabledDevices = Array.from(this.devices.values()).filter((d) => d.enabled !== false);
    const results = [];
    const allPunches = [];

    for (const dev of enabledDevices) {
      try {
        const fetchRes = await this.fetchPunchesFromDevice(dev.id);
        allPunches.push(...fetchRes.punches);
        results.push({
          deviceId: dev.id,
          deviceName: dev.name,
          status: 'success',
          count: fetchRes.totalPunches,
        });
      } catch (err) {
        results.push({
          deviceId: dev.id,
          deviceName: dev.name,
          status: 'failed',
          error: err.message,
        });
      }
    }

    let forwardResult = null;
    if (allPunches.length > 0 && config.mainBackendUrl) {
      try {
        forwardResult = await this.forwardPunchesToBackend(allPunches);
      } catch (err) {
        console.error('[DeviceManager] Error pushing combined punches to backend:', err.message);
      }
    }

    return {
      success: true,
      devicesSynced: results,
      totalPunchesFetched: allPunches.length,
      backendForward: forwardResult,
      syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Fetches enrolled users directly from a biometric device.
   */
  async fetchUsersFromDevice(id) {
    const device = this.getDevice(id);
    if (!device) throw new Error(`Device with ID "${id}" not found`);

    const driver = new EsslDevice({
      name: device.name,
      ip: device.ip,
      port: device.port,
      commKey: device.commKey,
      timeoutMs: 12000,
    });

    const rawUsers = await driver.fetchUsers();
    const users = rawUsers.map((u) => ({
      ...u,
      device_id: device.name || `DEV-${device.id}`,
    }));

    return {
      deviceId: device.id,
      deviceName: device.name,
      totalUsers: users.length,
      users,
    };
  }

  /**
   * Forwards enrolled users list to the central Neha Hospital backend.
   */
  async forwardUsersToBackend(users) {
    if (!users || users.length === 0) return { upserted: 0, message: 'No users to forward' };

    const targetUrl = getBackendApiUrl('/attendance/enrolled-users');
    if (!targetUrl) return { upserted: 0, message: 'MAIN_BACKEND_URL not configured' };
    const headers = { 'Content-Type': 'application/json' };
    if (config.mainBackendApiKey) {
      headers['Authorization'] = `Bearer ${config.mainBackendApiKey}`;
      headers['x-api-key'] = config.mainBackendApiKey;
    }

    console.log(`[DeviceManager] Forwarding ${users.length} enrolled user(s) to ${targetUrl}...`);
    try {
      const resp = await axios.post(targetUrl, { users }, { headers, timeout: 15000 });
      return resp.data;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      console.error(`[DeviceManager] Failed to forward enrolled users: ${errMsg}`);
      throw new Error(`Failed to forward enrolled users to main backend (${targetUrl}): ${errMsg}`);
    }
  }

  /**
   * Pulls enrolled users from hardware terminal, then saves to central backend.
   */
  async syncDeviceUsers(id) {
    const fetchResult = await this.fetchUsersFromDevice(id);
    let forwardResult = null;
    let error = null;

    if (fetchResult.users.length > 0 && config.mainBackendUrl) {
      try {
        forwardResult = await this.forwardUsersToBackend(fetchResult.users);
      } catch (fErr) {
        error = fErr.message;
      }
    }

    return {
      success: !error,
      deviceId: id,
      deviceName: fetchResult.deviceName,
      totalUsersFetched: fetchResult.totalUsers,
      forwardResult,
      error,
      syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Syncs enrolled users across all enabled biometric devices to the central hospital backend.
   */
  async syncAllEnrolledUsers() {
    const enabledDevices = Array.from(this.devices.values()).filter((d) => d.enabled !== false);
    const results = [];
    const allUsers = [];

    for (const dev of enabledDevices) {
      try {
        const fetchRes = await this.fetchUsersFromDevice(dev.id);
        allUsers.push(...fetchRes.users);
        results.push({
          deviceId: dev.id,
          deviceName: dev.name,
          status: 'success',
          count: fetchRes.totalUsers,
        });
      } catch (err) {
        results.push({
          deviceId: dev.id,
          deviceName: dev.name,
          status: 'failed',
          error: err.message,
        });
      }
    }

    let forwardResult = null;
    if (allUsers.length > 0 && config.mainBackendUrl) {
      try {
        forwardResult = await this.forwardUsersToBackend(allUsers);
      } catch (err) {
        console.error('[DeviceManager] Error pushing combined enrolled users to backend:', err.message);
      }
    }

    return {
      success: true,
      devicesSynced: results,
      totalUsersFetched: allUsers.length,
      backendForward: forwardResult,
      syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Directly register single staff member from Windows machine to backend.
   */
  async registerStaffDirectly(staffData) {
    const targetUrl = getBackendApiUrl('/attendance/enrolled-users/register');
    if (!targetUrl) throw new Error('MAIN_BACKEND_URL not configured');
    const headers = { 'Content-Type': 'application/json' };
    if (config.mainBackendApiKey) {
      headers['Authorization'] = `Bearer ${config.mainBackendApiKey}`;
      headers['x-api-key'] = config.mainBackendApiKey;
    }

    console.log(`[DeviceManager] Registering staff #${staffData.enroll_code} directly to ${targetUrl}...`);
    try {
      const resp = await axios.post(targetUrl, staffData, { headers, timeout: 15000 });
      return resp.data;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      console.error(`[DeviceManager] Failed to register staff on backend: ${errMsg}`);
      throw new Error(`Failed to register staff on main backend (${targetUrl}): ${errMsg}`);
    }
  }
}

module.exports = new DeviceManager();
