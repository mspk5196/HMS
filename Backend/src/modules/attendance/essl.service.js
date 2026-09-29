/**
 * essl.service.js
 *
 * ⚠️  STRICT READ-ONLY — this service NEVER writes, deletes, clears, or modifies
 *     any data on the physical eSSL / ZKTeco terminal.
 *
 * Standalone UDP (port 4370) driver for local eSSL / ZKTeco biometric attendance terminals.
 *
 * Protocol: ZK binary over UDP with proper CMD_CONNECT → CMD_AUTH (makeCommKey) handshake.
 * Primary path: via BiometricConnector bridge (HTTP).
 * Fallback path: direct UDP to device IP.
 */

const dgram = require('dgram');
const q = require('./attendance.queries');

// ZKTeco / eSSL Command Constants
const USHRT_MAX = 65535;
const CMD_CONNECT = 1000;
const CMD_EXIT = 1001;
const CMD_ATTLOG_RRQ = 13;
const CMD_USERTEMP_RRQ = 9;
const CMD_AUTH = 1102;
const CMD_ACK_OK = 2000;
const CMD_ACK_DATA = 2002;
const CMD_PREPARE_DATA = 1500;
const CMD_DATA = 1501;
const CMD_ACK_UNAUTH = 2005;
const CMD_ACK_ERROR = 2001;

// ---------------------------------------------------------------------------
// UDP Protocol Helpers (proven working with eSSL terminals)
// ---------------------------------------------------------------------------

function createChecksum(buf) {
  let chksum = 0;
  for (let i = 0; i < buf.length; i += 2) {
    if (i === buf.length - 1) chksum += buf[i];
    else chksum += buf.readUInt16LE(i);
    chksum %= USHRT_MAX;
  }
  chksum = USHRT_MAX - chksum - 1;
  return chksum;
}

function buildUDPPacket(command, sessionId, replyId, data = Buffer.alloc(0)) {
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const buf = Buffer.alloc(8 + dataBuffer.length);
  buf.writeUInt16LE(command, 0);
  buf.writeUInt16LE(0, 2);
  buf.writeUInt16LE(sessionId, 4);
  buf.writeUInt16LE(replyId, 6);
  dataBuffer.copy(buf, 8);
  const chksum = createChecksum(buf);
  buf.writeUInt16LE(chksum, 2);
  const nextReplyId = (replyId + 1) % USHRT_MAX;
  buf.writeUInt16LE(nextReplyId, 6);
  return { buf, nextReplyId };
}

function parseUDPPacket(msg) {
  if (!msg || msg.length < 8) return null;
  return {
    command:   msg.readUInt16LE(0),
    checksum:  msg.readUInt16LE(2),
    sessionId: msg.readUInt16LE(4),
    replyId:   msg.readUInt16LE(6),
    data:      msg.subarray(8),
  };
}

/**
 * makeCommKey — ported from pyzk (base.py) which ported from commpro.c – MakeKey.
 * Used to generate the CMD_AUTH payload when device responds with CMD_ACK_UNAUTH.
 */
function makeCommKey(key, sessionId, ticks = 50) {
  key = Number(key) >>> 0;
  sessionId = Number(sessionId);
  let k = 0;
  for (let i = 0; i < 32; i++) {
    if (key & (1 << i)) k = ((k << 1) | 1) >>> 0;
    else                 k = (k << 1) >>> 0;
  }
  k = (k + sessionId) >>> 0;
  const b = Buffer.alloc(4);
  b.writeUInt32LE(k, 0);
  const bytes = [b[0] ^ 0x5A, b[1] ^ 0x4B, b[2] ^ 0x53, b[3] ^ 0x4F];
  const sw = [bytes[2], bytes[3], bytes[0], bytes[1]];
  const B = 0xFF & ticks;
  return Buffer.from([sw[0] ^ B, sw[1] ^ B, B, sw[3] ^ B]);
}

/**
 * Opens an authenticated UDP session to the device.
 * Resolves { sock, sessionId, replyId } after CMD_ACK_OK.
 */
function openUDPSession(ip, port, commKey, timeoutMs) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');
    let stage = 'connect';
    let done  = false;

    const fail = (msg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { sock.close(); } catch (_) {}
      reject(new Error(msg));
    };

    const timer = setTimeout(
      () => fail(`UDP timeout after ${timeoutMs}ms — device ${ip}:${port}`),
      timeoutMs
    );

    sock.on('error', (e) => fail(`UDP error: ${e.message}`));

    sock.on('message', (msg) => {
      if (done) return;
      const res = parseUDPPacket(msg);
      if (!res) return;

      if (stage === 'connect') {
        if (res.command === CMD_ACK_UNAUTH) {
          stage = 'auth';
          const keyBuf = makeCommKey(Number(commKey) || 0, res.sessionId);
          const { buf } = buildUDPPacket(CMD_AUTH, res.sessionId, res.replyId, keyBuf);
          sock.send(buf, port, ip, (e) => { if (e) fail(`CMD_AUTH send error: ${e.message}`); });
        } else if (res.command === CMD_ACK_OK) {
          done = true; clearTimeout(timer);
          resolve({ sock, sessionId: res.sessionId, replyId: res.replyId });
        } else {
          fail(`Unexpected connect response: ${res.command}`);
        }
      } else if (stage === 'auth') {
        if (res.command === CMD_ACK_OK) {
          done = true; clearTimeout(timer);
          resolve({ sock, sessionId: res.sessionId, replyId: res.replyId });
        } else {
          fail(`Authentication failed (cmd ${res.command}). Check comm_key for ${ip}.`);
        }
      }
    });

    const { buf } = buildUDPPacket(CMD_CONNECT, 0, 0);
    sock.send(buf, port, ip, (e) => { if (e) fail(`CMD_CONNECT send error: ${e.message}`); });
  });
}

// ---------------------------------------------------------------------------
// Attendance record decoders (unchanged)
// ---------------------------------------------------------------------------

/**
 * Parses response TCP packet from eSSL device.
 */
function parseTcpPacket(buffer) {
  if (buffer.length < 16) return null;
  // Check for 0x5050827D TCP header
  let offset = 0;
  if (buffer[0] === 0x50 && buffer[1] === 0x50 && buffer[2] === 0x82 && buffer[3] === 0x7d) {
    offset = 8;
  }
  if (buffer.length < offset + 8) return null;

  const command = buffer.readUInt16LE(offset);
  const checksum = buffer.readUInt16LE(offset + 2);
  const sessionId = buffer.readUInt16LE(offset + 4);
  const replyNumber = buffer.readUInt16LE(offset + 6);
  const data = buffer.slice(offset + 8);

  return { command, checksum, sessionId, replyNumber, data };
}

/**
 * Decodes 4-byte packed ZK timestamp (used by many eSSL firmware versions).
 */
function decodeZkTime(t) {
  const second = t % 60;
  t = Math.floor(t / 60);
  const minute = t % 60;
  t = Math.floor(t / 60);
  const hour = t % 24;
  t = Math.floor(t / 24);
  const day = (t % 31) + 1;
  t = Math.floor(t / 31);
  const month = (t % 12) + 1;
  t = Math.floor(t / 12);
  const year = t + 2000;

  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

/**
 * Parses raw attendance binary/ASCII payload from eSSL device.
 */
function parseAttendanceRecords(buffer) {
  const records = [];
  if (!buffer || buffer.length === 0) return records;

  // Strip 4-byte prefix length header if present
  if (buffer.length > 4 && (buffer.readUInt32LE(0) === buffer.length - 4 || buffer.length % 40 === 4 || buffer.length % 14 === 4)) {
    buffer = buffer.slice(4);
  }

  // 1. 40-byte record (TFT / standalone eSSL machines)
  if (buffer.length > 0 && buffer.length % 40 === 0) {
    const count = buffer.length / 40;
    for (let i = 0; i < count; i++) {
      const off = i * 40;
      let pin = buffer.toString('utf8', off + 2, off + 24).replace(/\0/g, '').trim();
      if (!pin || !/^[A-Za-z0-9_-]+$/.test(pin)) {
        pin = buffer.toString('utf8', off, off + 24).replace(/\0/g, '').trim();
      }
      if (!pin || !/^[A-Za-z0-9_-]+$/.test(pin)) {
        const userSn = buffer.readUInt16LE(off);
        if (userSn > 0) pin = String(userSn);
      }
      if (!pin || !/^[A-Za-z0-9_-]+$/.test(pin)) continue;

      let rawTime = buffer.readUInt32LE(off + 27);
      let punchTime = decodeZkTime(rawTime);
      const yr = parseInt(punchTime.slice(0, 4), 10);
      if (yr < 2015 || yr > 2040) {
        const altTime = buffer.readUInt32LE(off + 25);
        const altPunchTime = decodeZkTime(altTime);
        const altYr = parseInt(altPunchTime.slice(0, 4), 10);
        if (altYr >= 2015 && altYr <= 2040) {
          punchTime = altPunchTime;
        } else {
          const alt24 = buffer.readUInt32LE(off + 24);
          const altPunch24 = decodeZkTime(alt24);
          const altYr24 = parseInt(altPunch24.slice(0, 4), 10);
          if (altYr24 >= 2015 && altYr24 <= 2040) {
            punchTime = altPunch24;
          }
        }
      }

      const punchState = buffer.readUInt8(off + 31);
      if (punchTime && !punchTime.startsWith('2000-01-01')) {
        records.push({
          employee_code: pin,
          punch_time: punchTime,
          punch_type: punchState === 1 ? 'out' : 'in',
        });
      }
    }
    if (records.length > 0) return records;
  }

  // 2. Legacy 14-byte record formats
  if (buffer.length > 0 && buffer.length % 14 === 0) {
    for (let i = 0; i < buffer.length; i += 14) {
      const userNumber = buffer.readUInt16LE(i);
      const rawTime = buffer.readUInt32LE(i + 2);
      const state = buffer.readUInt8(i + 7);
      const timeStr = decodeZkTime(rawTime);
      if (userNumber > 0 && timeStr) {
        records.push({
          employee_code: String(userNumber),
          punch_time: timeStr,
          punch_type: state === 1 ? 'out' : 'in',
        });
      }
    }
    if (records.length > 0) return records;
  }

  // 3. Fallback: Check if payload is genuinely ASCII text format
  const textStr = buffer.toString('utf8');
  if (/^[\x09\x0A\x0D\x20-\x7E]+$/.test(textStr) && (textStr.includes('\t') || textStr.includes(','))) {
    const lines = textStr.split(/[\r\n]+/).filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/[\t,]+/).map((s) => s.trim());
      if (parts.length >= 2) {
        const empCode = parts[0];
        const punchTime = parts[1];
        if (empCode && punchTime && /^\d{4}-\d{2}-\d{2}/.test(punchTime)) {
          records.push({
            employee_code: empCode,
            punch_time: punchTime,
            punch_type: parts[2] === '1' ? 'out' : 'in',
          });
        }
      }
    }
  }

  return records;
}

function getConnectorUrl(targetIp) {
  if (targetIp && (targetIp.startsWith('http://') || targetIp.startsWith('https://') || targetIp.includes('tylo.co.in'))) {
    return targetIp.replace(/\/+$/, '');
  }
  if (process.env.BIOMETRIC_CONNECTOR_URL) {
    return process.env.BIOMETRIC_CONNECTOR_URL.replace(/\/+$/, '');
  }
  return null;
}

/**
 * Tests live connection to an eSSL biometric device (or via Biometric Connector bridge).
 */
async function testDeviceConnection({ ip_address, port, timeoutMs = 4000 } = {}) {
  const connectorUrl = getConnectorUrl(ip_address);
  if (connectorUrl) {
    const startTime = Date.now();
    try {
      const apiKey = process.env.BIOMETRIC_CONNECTOR_KEY || process.env.CONNECTOR_API_KEY || 'neha_bio_secret_key_2026';
      const endpoint = `${connectorUrl}/api/health`;
      const res = await fetch(endpoint, {
        headers: { 'x-api-key': apiKey },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const data = await res.json();
      const latencyMs = Date.now() - startTime;
      if (res.ok && data.success) {
        return {
          online: true,
          ip_address: connectorUrl,
          port: 443,
          session_id: 1,
          message: `Connected successfully to Biometric Connector at ${connectorUrl} (${latencyMs}ms, ${data.deviceCount || 1} active device(s)).`,
        };
      }
      return {
        online: false,
        error: data.message || `Connector returned HTTP status ${res.status}`,
      };
    } catch (cErr) {
      return {
        online: false,
        error: `Could not reach Biometric Connector at ${connectorUrl}: ${cErr.message}`,
      };
    }
  }

  const targetIp = ip_address || process.env.ESSL_DEVICE_IP || '192.168.1.201';
  const targetPort = Number(port || process.env.ESSL_DEVICE_PORT || 4370);
  const commKey = process.env.ESSL_COMM_KEY || '0';
  const startTime = Date.now();

  try {
    const { sock, sessionId } = await openUDPSession(targetIp, targetPort, commKey, timeoutMs);
    const { buf } = buildUDPPacket(CMD_EXIT, sessionId, 0);
    await new Promise((res) => sock.send(buf, targetPort, targetIp, () => res()));
    try { sock.close(); } catch (_) {}
    return {
      online: true,
      ip_address: targetIp,
      port: targetPort,
      session_id: sessionId,
      message: `Connected to eSSL device at ${targetIp}:${targetPort} in ${Date.now() - startTime}ms.`,
    };
  } catch (err) {
    return {
      online: false,
      error: `${err.message} — Verify device is powered on and IP is reachable on LAN.`,
    };
  }
}

/**
 * Downloads attendance punch logs from an eSSL device over TCP/IP or Biometric Connector.
 */
async function fetchDevicePunches({ deviceId, ip_address, port, timeoutMs = 8000 } = {}) {
  const connectorUrl = getConnectorUrl(ip_address);
  if (connectorUrl) {
    const apiKey = process.env.BIOMETRIC_CONNECTOR_KEY || process.env.CONNECTOR_API_KEY || 'neha_bio_secret_key_2026';
    const targetDevId = deviceId ? String(deviceId) : (ip_address ? encodeURIComponent(ip_address) : 'dev-1');
    const endpoint = `${connectorUrl}/api/devices/${targetDevId}/punches`;
    const res = await fetch(endpoint, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.punches)) {
      return data.punches;
    }
    throw new Error(data.message || `Failed to fetch punches from connector at ${connectorUrl}: HTTP ${res.status}`);
  }

  const targetIp = ip_address || process.env.ESSL_DEVICE_IP || '192.168.1.201';
  const targetPort = Number(port || process.env.ESSL_DEVICE_PORT || 4370);
  const commKey = process.env.ESSL_COMM_KEY || '0';

  const { sock, sessionId, replyId: initReplyId } = await openUDPSession(
    targetIp, targetPort, commKey, timeoutMs
  );

  return new Promise((resolve, reject) => {
    const chunks = [];
    let isDone = false;
    let dataExpected = 0;

    const finish = (err) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(globalTimer);
      try { sock.close(); } catch (_) {}
      if (err) { reject(err); return; }
      const combined = Buffer.concat(chunks);
      resolve(parseAttendanceRecords(combined));
    };

    const globalTimer = setTimeout(() => finish(null), timeoutMs * 3);

    sock.on('error', (e) => finish(e));

    sock.on('message', (msg) => {
      if (isDone) return;
      const res = parseUDPPacket(msg);
      if (!res) return;
      if (res.command === CMD_PREPARE_DATA) {
        if (res.data.length >= 4) dataExpected = res.data.readUInt32LE(0);
        return;
      }
      if (res.command === CMD_DATA || res.command === CMD_ACK_DATA) {
        if (res.data && res.data.length > 0) chunks.push(res.data);
        const received = chunks.reduce((s, c) => s + c.length, 0);
        if (dataExpected > 0 && received >= dataExpected) finish(null);
        return;
      }
      if (res.command === CMD_ACK_OK && chunks.length > 0) finish(null);
      if (res.command === CMD_ACK_ERROR) finish(null);
    });

    const { buf } = buildUDPPacket(CMD_ATTLOG_RRQ, sessionId, initReplyId);
    sock.send(buf, targetPort, targetIp, (e) => { if (e) finish(e); });
  });
}

/**
 * Synchronizes attendance punches for a specific configured biometric device.
 * Stores raw punches, backfills employee IDs, and triggers day recalculation.
 * 
 * Guarantees idempotency: Any punch already present in the database is left intact.
 */
async function syncBiometricDevice(deviceId, attendanceService, { fromDate, toDate, timeoutMs } = {}) {
  const device = await q.getBiometricDevice(deviceId);
  if (!device) throw new Error('Biometric device configuration not found');

  try {
    let punches = [];
    if (device.device_type === 'essl_standalone' || device.device_type === 'zkteco') {
      punches = await fetchDevicePunches({
        deviceId: device.id,
        ip_address: device.ip_address,
        port: device.port || 4370,
        timeoutMs: timeoutMs || 15000,
      });
    }

    // Optional date range filtering for targeted historical sync
    if (fromDate) {
      punches = punches.filter((p) => (p.punch_time || '').slice(0, 10) >= fromDate);
    }
    if (toDate) {
      punches = punches.filter((p) => (p.punch_time || '').slice(0, 10) <= toDate);
    }

    let insertedCount = 0;
    const affectedDates = new Set();

    if (punches.length > 0) {
      const punchRows = punches.map((p) => {
        const datePart = (p.punch_time || '').slice(0, 10);
        if (datePart) affectedDates.add(datePart);
        return {
          employee_code: String(p.employee_code).trim(),
          device_id: device.name || `DEV-${device.id}`,
          punch_time: p.punch_time,
          punch_type: p.punch_type || null,
        };
      });

      // INSERT IGNORE ensures duplicate punches already recorded are skipped and left untouched
      const { inserted } = await q.bulkInsertPunches(punchRows);
      insertedCount = inserted;
      await q.linkOrphanPunches();

      // Recalculate daily attendance summaries for affected dates
      const procFn = attendanceService?.processDailyAttendance || attendanceService?.processDay;
      if (typeof procFn === 'function') {
        for (const d of affectedDates) {
          try {
            await procFn(d);
          } catch (procErr) {
            console.error(`Error processing attendance for date ${d}:`, procErr);
          }
        }
      }
    }

    await q.updateDeviceSyncStatus(deviceId, {
      status: 'online',
      last_sync_at: new Date(),
      last_sync_count: insertedCount,
    });

    const preservedCount = Math.max(0, punches.length - insertedCount);

    return {
      success: true,
      deviceId,
      deviceName: device.name,
      totalLogsFetched: punches.length,
      newPunchesInserted: insertedCount,
      existingPunchesPreserved: preservedCount,
      affectedDates: Array.from(affectedDates),
      affectedDatesCount: affectedDates.size,
      syncedAt: new Date().toISOString(),
    };
  } catch (err) {
    await q.updateDeviceSyncStatus(deviceId, {
      status: 'unreachable',
      last_sync_at: device.last_sync_at,
      last_sync_count: 0,
    });
    throw err;
  }
}

/**
 * Synchronizes all active auto-sync enabled devices (or targeted historical range).
 */
async function syncAllActiveDevices(attendanceService, options = {}) {
  const devices = await q.listBiometricDevices();
  const activeDevices = devices.filter((d) => d.auto_sync_enabled || options.includeAll);
  const targets = activeDevices.length > 0 ? activeDevices : devices;

  const results = [];
  for (const dev of targets) {
    try {
      const res = await syncBiometricDevice(dev.id, attendanceService, options);
      results.push(res);
    } catch (err) {
      results.push({
        success: false,
        deviceId: dev.id,
        deviceName: dev.name,
        error: err.message,
      });
    }
  }
  return results;
}

/**
 * Parses user enrollment binary records from eSSL/ZKTeco device.
 */
function parseUserRecords(buffer) {
  const users = [];
  const RECORD_SIZE = 72;
  const count = Math.floor(buffer.length / RECORD_SIZE);

  for (let i = 0; i < count; i++) {
    const offset = i * RECORD_SIZE;
    if (offset + RECORD_SIZE > buffer.length) break;

    // PIN string at offset 48, fallback to uint16 at offset 0
    let enrollCode = buffer.toString('utf8', offset + 48, offset + 72).replace(/\0/g, '').trim();
    if (!enrollCode || !/^[A-Za-z0-9_-]+$/.test(enrollCode)) {
      const pinNum = buffer.readUInt16LE(offset);
      if (pinNum > 0) enrollCode = String(pinNum);
    }
    if (!enrollCode) continue;

    const privilegeNum = buffer.readUInt8(offset + 2);
    const privilege = privilegeNum >= 2 ? 'admin' : 'user';
    const name = buffer.toString('utf8', offset + 11, offset + 35).replace(/\0/g, '').trim();
    const cardNum = buffer.readUInt32LE(offset + 35);

    users.push({
      enroll_code: enrollCode,
      name: name || null,
      card_number: cardNum > 0 ? String(cardNum) : null,
      privilege,
      has_fingerprint: 1,
      has_face: 1,
      registered_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
  }
  return users;
}

/**
 * Downloads enrolled staff registrations from an eSSL terminal over TCP/IP or Biometric Connector.
 */
async function fetchDeviceUsers({ deviceId, ip_address, port, timeoutMs = 8000 } = {}) {
  const connectorUrl = getConnectorUrl(ip_address);
  if (connectorUrl) {
    const apiKey = process.env.BIOMETRIC_CONNECTOR_KEY || process.env.CONNECTOR_API_KEY || 'neha_bio_secret_key_2026';
    const targetDevId = deviceId ? String(deviceId) : (ip_address ? encodeURIComponent(ip_address) : 'dev-1');
    const endpoint = `${connectorUrl}/api/devices/${targetDevId}/users`;
    const res = await fetch(endpoint, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json();
    if (res.ok && data.success && Array.isArray(data.users)) {
      return data.users;
    }
    throw new Error(data.message || `Failed to fetch enrolled users from connector at ${connectorUrl}: HTTP ${res.status}`);
  }

  const targetIp = ip_address || process.env.ESSL_DEVICE_IP || '192.168.1.201';
  const targetPort = Number(port || process.env.ESSL_DEVICE_PORT || 4370);

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let sessionId = 0;
    let replyNum = 0;
    let rawDataChunks = [];
    let isFinished = false;

    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        socket.destroy();
        reject(new Error(`Timeout while communicating with device ${targetIp}:${targetPort}`));
      }
    }, timeoutMs);

    socket.connect(targetPort, targetIp, () => {
      socket.write(createTcpPacket(CMD_CONNECT, 0, 0));
    });

    socket.on('data', (data) => {
      if (isFinished) return;
      const res = parseTcpPacket(data);
      if (!res) return;

      if (res.command === CMD_ACK_OK && sessionId === 0) {
        sessionId = res.sessionId;
        replyNum = res.replyNumber;
        socket.write(createTcpPacket(CMD_DISABLEDEVICE, sessionId, ++replyNum));
        socket.write(createTcpPacket(9, sessionId, ++replyNum)); // CMD_USERTEMP_RRQ = 9
      } else if (res.command === CMD_PREPARE_DATA || res.command === CMD_DATA || res.command === CMD_ACK_DATA) {
        if (res.data && res.data.length > 0) {
          rawDataChunks.push(res.data);
        }
        setTimeout(() => {
          if (!isFinished) {
            isFinished = true;
            clearTimeout(timer);
            socket.write(createTcpPacket(CMD_ENABLEDEVICE, sessionId, ++replyNum));
            socket.write(createTcpPacket(CMD_EXIT, sessionId, ++replyNum));
            socket.end();

            const fullBuffer = Buffer.concat(rawDataChunks);
            const users = parseUserRecords(fullBuffer);
            resolve(users);
          }
        }, 1200);
      } else if (res.command === CMD_ACK_OK && rawDataChunks.length > 0) {
        if (!isFinished) {
          isFinished = true;
          clearTimeout(timer);
          socket.write(createTcpPacket(CMD_ENABLEDEVICE, sessionId, ++replyNum));
          socket.write(createTcpPacket(CMD_EXIT, sessionId, ++replyNum));
          socket.end();

          const fullBuffer = Buffer.concat(rawDataChunks);
          const users = parseUserRecords(fullBuffer);
          resolve(users);
        }
      } else if (res.command === CMD_ACK_ERROR) {
        if (!isFinished) {
          isFinished = true;
          clearTimeout(timer);
          socket.destroy();
          reject(new Error('Device returned error acknowledging user info request'));
        }
      }
    });

    socket.on('error', (err) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

/**
 * Pulls registered users from a biometric device and stores them in MySQL database.
 */
async function syncBiometricEnrolledUsers(deviceId) {
  const device = await q.getBiometricDevice(deviceId);
  if (!device) throw new Error('Biometric device configuration not found');

  try {
    const users = await fetchDeviceUsers({
      deviceId: device.id,
      ip_address: device.ip_address,
      port: device.port || 4370,
    });

    const deviceLabel = device.name || `Device-${device.id}`;
    const usersWithDevice = users.map((u) => ({ ...u, device_id: deviceLabel }));
    const result = await q.upsertBiometricEnrolledUsers(usersWithDevice);

    return {
      success: true,
      deviceId: device.id,
      deviceName: deviceLabel,
      totalEnrolledOnDevice: users.length,
      upsertedInDatabase: result.upserted,
      syncedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`[syncBiometricEnrolledUsers] Error for device ${deviceId}:`, err.message);
    throw err;
  }
}

/**
 * Synchronizes registered users from all active auto-sync enabled devices.
 */
async function syncAllEnrolledUsers() {
  const devices = await q.listBiometricDevices();
  const activeDevices = devices.filter((d) => d.auto_sync_enabled !== 0 && d.is_active !== 0);
  const targets = activeDevices.length > 0 ? activeDevices : devices;

  const results = [];
  for (const dev of targets) {
    try {
      const res = await syncBiometricEnrolledUsers(dev.id);
      results.push(res);
    } catch (err) {
      results.push({
        success: false,
        deviceId: dev.id,
        deviceName: dev.name,
        error: err.message,
      });
    }
  }

  return results;
}

module.exports = {
  testDeviceConnection,
  fetchDevicePunches,
  fetchDeviceUsers,
  syncBiometricDevice,
  syncAllActiveDevices,
  syncBiometricEnrolledUsers,
  syncAllEnrolledUsers,
};
