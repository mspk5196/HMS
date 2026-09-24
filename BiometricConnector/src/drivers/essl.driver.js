/**
 * essl.driver.js
 *
 * ⚠️  STRICT READ-ONLY — this driver NEVER writes, deletes, clears, or modifies
 *     data on the physical eSSL / ZKTeco terminal.  All attendance records and
 *     user enrollments are stored exclusively in the hospital MySQL database.
 *
 * Protocol: ZK binary over UDP port 4370 (proven to work with this device).
 * Authentication: CMD_CONNECT → CMD_ACK_UNAUTH → CMD_AUTH (makeCommKey) → CMD_ACK_OK
 */

'use strict';

const dgram = require('dgram');

// ---------------------------------------------------------------------------
// Protocol constants
// ---------------------------------------------------------------------------
const USHRT_MAX   = 65535;
const CMD_CONNECT     = 1000;
const CMD_EXIT        = 1001;
const CMD_ENABLEDEVICE  = 1002;
const CMD_DISABLEDEVICE = 1003;
const CMD_AUTH        = 1102;
const CMD_ATTLOG_RRQ  = 13;   // standard ZK constant
const CMD_USERTEMP_RRQ = 9;
const CMD_ACK_OK      = 2000;
const CMD_ACK_ERROR   = 2001;
const CMD_ACK_DATA    = 2002;
const CMD_PREPARE_DATA = 1500;
const CMD_DATA        = 1501;
const CMD_ACK_UNAUTH  = 2005;
const CMD_DATA_WRRQ   = 1503;

// ---------------------------------------------------------------------------
// Packet helpers
// ---------------------------------------------------------------------------

/**
 * ZK 16-bit checksum (copied from commpro.c).
 */
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

/**
 * Builds a ZK UDP header packet.
 * Returns { buf, nextReplyId }.
 */
function buildUDPPacket(command, sessionId, replyId, data = Buffer.alloc(0)) {
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const buf = Buffer.alloc(8 + dataBuffer.length);

  buf.writeUInt16LE(command, 0);
  buf.writeUInt16LE(0, 2);          // checksum placeholder
  buf.writeUInt16LE(sessionId, 4);
  buf.writeUInt16LE(replyId, 6);
  dataBuffer.copy(buf, 8);

  const chksum = createChecksum(buf);
  buf.writeUInt16LE(chksum, 2);

  const nextReplyId = (replyId + 1) % USHRT_MAX;
  buf.writeUInt16LE(nextReplyId, 6);

  return { buf, nextReplyId };
}

/**
 * Parses an incoming ZK UDP packet.
 */
function parseUDPPacket(msg) {
  if (!msg || msg.length < 8) return null;
  const command   = msg.readUInt16LE(0);
  const checksum  = msg.readUInt16LE(2);
  const sessionId = msg.readUInt16LE(4);
  const replyId   = msg.readUInt16LE(6);
  const data      = msg.subarray(8);
  return { command, checksum, sessionId, replyId, data };
}

/**
 * Generates the authentication key for CMD_AUTH.
 * Ported from pyzk (base.py) which ported from commpro.c – MakeKey.
 *
 * @param {number} key       – comm_key from device settings (usually 0)
 * @param {number} sessionId – session ID returned by CMD_ACK_UNAUTH
 * @param {number} ticks     – default 50
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

  // XOR with 'Z', 'K', 'S', 'O'
  const bytes = [b[0] ^ 0x5A, b[1] ^ 0x4B, b[2] ^ 0x53, b[3] ^ 0x4F];

  // Swap the two 16-bit words
  const sw = [bytes[2], bytes[3], bytes[0], bytes[1]];

  const B = 0xFF & ticks;
  return Buffer.from([sw[0] ^ B, sw[1] ^ B, B, sw[3] ^ B]);
}

// ---------------------------------------------------------------------------
// Attendance record decoders
// ---------------------------------------------------------------------------

function decodeZKTime(val) {
  val = val >>> 0;
  const second = val % 60;       val = Math.floor(val / 60);
  const minute = val % 60;       val = Math.floor(val / 60);
  const hour   = val % 24;       val = Math.floor(val / 24);
  const day    = (val % 31) + 1; val = Math.floor(val / 31);
  const month  = (val % 12) + 1; val = Math.floor(val / 12);
  const year   = val + 2000;
  const p = (n) => String(n).padStart(2, '0');
  return `${year}-${p(month)}-${p(day)} ${p(hour)}:${p(minute)}:${p(second)}`;
}

function parseAttendanceRecords(buffer) {
  const records = [];
  if (!buffer || buffer.length === 0) return records;

  // Strip 4-byte prefix length header if present
  if (buffer.length > 4 && (buffer.readUInt32LE(0) === buffer.length - 4 || buffer.length % 40 === 4 || buffer.length % 14 === 4)) {
    buffer = buffer.slice(4);
  }

  // Text / ASCII mode (tab or comma separated)
  const sample = buffer.slice(0, Math.min(buffer.length, 200)).toString('ascii');
  if (sample.includes('\t') || (sample.includes(',') && sample.includes('-'))) {
    const lines = buffer.toString('utf8').split(/\r?\n/);
    for (const line of lines) {
      const parts = line.trim().split(/[\t,]+/);
      if (parts.length >= 2) {
        const empCode = parts[0].trim();
        const punchTime = parts[1].trim();
        if (empCode && /\d{4}-\d{2}-\d{2}/.test(punchTime)) {
          records.push({
            employee_code: empCode,
            punch_time: punchTime,
            punch_type: parts[2] === '1' ? 'out' : 'in',
            verify_type: Number(parts[3]) || 1,
          });
        }
      }
    }
    if (records.length > 0) return records;
  }

  // 40-byte record (TFT / standalone eSSL machines)
  if (buffer.length > 0 && buffer.length % 40 === 0) {
    const count = buffer.length / 40;
    for (let i = 0; i < count; i++) {
      const off = i * 40;

      // PIN is at offset 2..24 (or 0..24)
      let pin = buffer.toString('utf8', off + 2, off + 24).replace(/\0/g, '').trim();
      if (!pin || !/^[A-Za-z0-9_-]+$/.test(pin)) {
        pin = buffer.toString('utf8', off, off + 24).replace(/\0/g, '').trim();
      }
      if (!pin || !/^[A-Za-z0-9_-]+$/.test(pin)) {
        const userSn = buffer.readUInt16LE(off);
        if (userSn > 0) pin = String(userSn);
      }
      if (!pin) continue;

      // Timestamp at offset 27 (standard ZK TFT 40-byte layout)
      let rawTime = buffer.readUInt32LE(off + 27);
      let punchTime = decodeZKTime(rawTime);
      const yr = parseInt(punchTime.slice(0, 4), 10);
      if (yr < 2015 || yr > 2040) {
        const altTime = buffer.readUInt32LE(off + 25);
        const altPunchTime = decodeZKTime(altTime);
        const altYr = parseInt(altPunchTime.slice(0, 4), 10);
        if (altYr >= 2015 && altYr <= 2040) {
          punchTime = altPunchTime;
        } else {
          const alt24 = buffer.readUInt32LE(off + 24);
          const altPunch24 = decodeZKTime(alt24);
          const altYr24 = parseInt(altPunch24.slice(0, 4), 10);
          if (altYr24 >= 2015 && altYr24 <= 2040) {
            punchTime = altPunch24;
          }
        }
      }

      const punchState = buffer.readUInt8(off + 31);
      const verifyType = buffer.readUInt8(off + 24);

      if (punchTime && !punchTime.startsWith('2000-01-01')) {
        records.push({
          employee_code: pin,
          punch_time: punchTime,
          punch_type: punchState === 1 ? 'out' : 'in',
          verify_type: verifyType,
        });
      }
    }
    if (records.length > 0) return records;
  }

  // 14-byte record (legacy standalone firmware)
  if (buffer.length > 0 && buffer.length % 14 === 0) {
    const count = buffer.length / 14;
    for (let i = 0; i < count; i++) {
      const off = i * 14;
      const userSn = buffer.readUInt16LE(off);
      const rawTime = buffer.readUInt32LE(off + 2);
      const verifyType = buffer[off + 6];
      const punchState = buffer[off + 7];
      if (userSn > 0 && rawTime > 0) {
        records.push({
          employee_code: String(userSn),
          punch_time: decodeZKTime(rawTime),
          punch_type: punchState === 1 ? 'out' : 'in',
          verify_type: verifyType,
        });
      }
    }
    return records;
  }

  return records;
}

function parseUserRecords(buffer) {
  const users = [];
  if (!buffer || buffer.length === 0) return users;

  const RECORD_SIZE = 72;
  const count = Math.floor(buffer.length / RECORD_SIZE);
  for (let i = 0; i < count; i++) {
    const off = i * RECORD_SIZE;
    if (off + RECORD_SIZE > buffer.length) break;

    let enrollCode = buffer.toString('utf8', off + 48, off + 72).replace(/\0/g, '').trim();
    if (!enrollCode || !/^[A-Za-z0-9_-]+$/.test(enrollCode)) {
      const pinNum = buffer.readUInt16LE(off);
      if (pinNum > 0) enrollCode = String(pinNum);
    }
    if (!enrollCode) continue;

    const privilegeNum = buffer.readUInt8(off + 2);
    const privilege    = privilegeNum >= 2 ? 'admin' : 'user';
    const name         = buffer.toString('utf8', off + 11, off + 35).replace(/\0/g, '').trim();
    const cardNum      = buffer.readUInt32LE(off + 35);

    users.push({
      enroll_code:     enrollCode,
      name:            name || null,
      card_number:     cardNum > 0 ? String(cardNum) : null,
      privilege,
      has_fingerprint: 1,
      has_face:        1,
    });
  }
  return users;
}

// ---------------------------------------------------------------------------
// Core UDP session — authenticate then run a callback with the open socket
// ---------------------------------------------------------------------------

/**
 * Opens an authenticated UDP session to the device.
 * Calls onReady(socket, sessionId, replyId) after successful auth.
 * All resources are cleaned up inside the caller or on timeout.
 *
 * ⚠️  READ-ONLY GUARANTEE: this function sends only CMD_CONNECT and CMD_AUTH.
 *      The caller is responsible for only issuing read commands.
 */
function openSession(ip, port, commKey, timeoutMs) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');
    let sessionId = 0;
    let replyId   = 0;
    let stage     = 'connect';
    let done      = false;

    const fail = (msg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { sock.close(); } catch (_) {}
      reject(new Error(msg));
    };

    const timer = setTimeout(() => fail(`UDP timeout after ${timeoutMs}ms — device ${ip}:${port}`), timeoutMs);

    sock.on('error', (err) => fail(`UDP error: ${err.message}`));

    sock.on('message', (msg) => {
      if (done) return;
      const res = parseUDPPacket(msg);
      if (!res) return;

      if (stage === 'connect') {
        sessionId = res.sessionId;
        replyId   = res.replyId;

        if (res.command === CMD_ACK_UNAUTH) {
          // Device requires authentication
          stage = 'auth';
          const keyBuf = makeCommKey(Number(commKey) || 0, sessionId);
          const { buf, nextReplyId } = buildUDPPacket(CMD_AUTH, sessionId, replyId, keyBuf);
          replyId = nextReplyId;
          sock.send(buf, port, ip, (err) => { if (err) fail(`Send CMD_AUTH failed: ${err.message}`); });

        } else if (res.command === CMD_ACK_OK) {
          // No password required
          stage = 'ready';
          done  = true;
          clearTimeout(timer);
          resolve({ sock, sessionId, replyId });
        } else {
          fail(`Unexpected connect response: ${res.command}`);
        }

      } else if (stage === 'auth') {
        if (res.command === CMD_ACK_OK) {
          sessionId = res.sessionId;
          replyId   = res.replyId;
          stage     = 'ready';
          done      = true;
          clearTimeout(timer);
          resolve({ sock, sessionId, replyId });
        } else {
          fail(`Authentication failed (cmd ${res.command}). Check comm_key for ${ip}.`);
        }
      }
    });

    // Send initial CMD_CONNECT
    const { buf, nextReplyId } = buildUDPPacket(CMD_CONNECT, 0, 0);
    replyId = nextReplyId;
    sock.send(buf, port, ip, (err) => { if (err) fail(`Send CMD_CONNECT failed: ${err.message}`); });
  });
}

// ---------------------------------------------------------------------------
// EsslDevice public API
// ---------------------------------------------------------------------------

class EsslDevice {
  constructor(options = {}) {
    this.name      = options.name     || 'eSSL Device';
    this.ip        = options.ip       || '192.168.1.201';
    this.port      = Number(options.port) || 4370;
    this.commKey   = options.commKey  || '0';
    this.timeoutMs = options.timeoutMs || 8000;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // testConnection — ping + authenticate, return online status.
  // ⚠️  No writes. Sends CMD_EXIT immediately after auth.
  // ─────────────────────────────────────────────────────────────────────────
  async testConnection() {
    const startTime = Date.now();
    let sock = null;
    try {
      const session = await openSession(this.ip, this.port, this.commKey, this.timeoutMs);
      sock = session.sock;
      const { sessionId, replyId } = session;

      // Graceful logout — read-only, just sends CMD_EXIT
      const { buf } = buildUDPPacket(CMD_EXIT, sessionId, replyId);
      await new Promise((res) => sock.send(buf, this.port, this.ip, () => res()));

      try { sock.close(); } catch (_) {}
      const latencyMs = Date.now() - startTime;

      return {
        online: true,
        ip: this.ip,
        port: this.port,
        latencyMs,
        sessionId,
        message: `Connected to ${this.name} (${this.ip}:${this.port}) in ${latencyMs}ms`,
      };
    } catch (err) {
      if (sock) { try { sock.close(); } catch (_) {} }
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // fetchPunches — download attendance logs, NO writes to device.
  // ─────────────────────────────────────────────────────────────────────────
  async fetchPunches() {
    const { sock, sessionId, replyId: initReplyId } = await openSession(
      this.ip, this.port, this.commKey, this.timeoutMs
    );

    return new Promise((resolve, reject) => {
      let rId = initReplyId;
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

      const globalTimer = setTimeout(
        () => finish(null), // resolve with whatever we have on timeout
        this.timeoutMs * 3
      );

      sock.on('error', (e) => finish(e));

      sock.on('message', (msg) => {
        if (isDone) return;
        const res = parseUDPPacket(msg);
        if (!res) return;

        if (res.command === CMD_PREPARE_DATA) {
          // Device tells us how many bytes to expect
          if (res.data.length >= 4) {
            dataExpected = res.data.readUInt32LE(0);
          }
          return;
        }

        if (res.command === CMD_DATA || res.command === CMD_ACK_DATA) {
          if (res.data && res.data.length > 0) {
            chunks.push(res.data);
          }
          // If we got everything, close
          const received = chunks.reduce((s, c) => s + c.length, 0);
          if (dataExpected > 0 && received >= dataExpected) {
            finish(null);
          }
          return;
        }

        if (res.command === CMD_ACK_OK) {
          // ACK after data stream — done
          if (chunks.length > 0) finish(null);
          return;
        }

        if (res.command === CMD_ACK_ERROR) {
          finish(null); // device returned error — resolve with empty
        }
      });

      // Send read-only attendance request
      const { buf: reqBuf, nextReplyId } = buildUDPPacket(CMD_ATTLOG_RRQ, sessionId, rId);
      rId = nextReplyId;
      sock.send(reqBuf, this.port, this.ip, (err) => {
        if (err) finish(err);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // fetchUsers — download enrolled users, NO writes to device.
  // ─────────────────────────────────────────────────────────────────────────
  async fetchUsers() {
    const { sock, sessionId, replyId: initReplyId } = await openSession(
      this.ip, this.port, this.commKey, this.timeoutMs
    );

    return new Promise((resolve, reject) => {
      let rId = initReplyId;
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
        resolve(parseUserRecords(combined));
      };

      const globalTimer = setTimeout(() => finish(null), this.timeoutMs * 2);

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

        if (res.command === CMD_ACK_OK) {
          if (chunks.length > 0) finish(null);
          return;
        }

        if (res.command === CMD_ACK_ERROR) {
          finish(null);
        }
      });

      const { buf: reqBuf, nextReplyId } = buildUDPPacket(CMD_USERTEMP_RRQ, sessionId, rId);
      rId = nextReplyId;
      sock.send(reqBuf, this.port, this.ip, (err) => {
        if (err) finish(err);
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  EsslDevice,
  openSession,
  parseAttendanceRecords,
  parseUserRecords,
  decodeZKTime,
  makeCommKey,
  buildUDPPacket,
  parseUDPPacket,
};
