/**
 * essl.driver.js
 *
 * Standalone TCP/IP driver for eSSL and ZKTeco biometric attendance terminals (Port 4370).
 * Implements the standard ZK binary protocol without external C/C++ or Python dependencies.
 */

const net = require('net');

// Protocol command constants
const CMD_CONNECT = 1000;
const CMD_EXIT = 1001;
const CMD_ENABLEDEVICE = 1002;
const CMD_DISABLEDEVICE = 1003;
const CMD_ATTLOG_RRQ = 502;
const CMD_GET_TIME = 201;
const CMD_ACK_OK = 2000;
const CMD_ACK_DATA = 2002;
const CMD_PREPARE_DATA = 1500;
const CMD_DATA = 1501;

/**
 * Calculates 16-bit 1's complement checksum for ZK protocol packets.
 */
function createChecksum(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length - 1; i += 2) {
    sum += buffer.readUInt16LE(i);
  }
  if (buffer.length % 2 !== 0) {
    sum += buffer[buffer.length - 1];
  }
  while (sum > 0xffff) {
    sum = (sum & 0xffff) + (sum >> 16);
  }
  return (~sum) & 0xffff;
}

/**
 * Creates a TCP-framed ZK protocol packet.
 * Frame: [0x50, 0x50, 0x82, 0x7D, length_low, length_high, 0, 0] + Payload
 */
function createTcpPacket(command, sessionId = 0, replyNumber = 0, data = Buffer.alloc(0)) {
  const payload = Buffer.alloc(8 + data.length);
  payload.writeUInt16LE(command, 0);
  payload.writeUInt16LE(0, 2); // Checksum placeholder
  payload.writeUInt16LE(sessionId, 4);
  payload.writeUInt16LE(replyNumber, 6);
  if (data.length > 0) {
    data.copy(payload, 8);
  }

  const checksum = createChecksum(payload);
  payload.writeUInt16LE(checksum, 2);

  const tcpHeader = Buffer.from([0x50, 0x50, 0x82, 0x7d]);
  const lengthBuf = Buffer.alloc(4);
  lengthBuf.writeUInt16LE(payload.length, 0);
  lengthBuf.writeUInt16LE(0, 2);

  return Buffer.concat([tcpHeader, lengthBuf, payload]);
}

/**
 * Parses response TCP packet from eSSL device.
 */
function parseTcpPacket(buffer) {
  if (buffer.length < 16) return null;
  if (buffer[0] !== 0x50 || buffer[1] !== 0x50 || buffer[2] !== 0x82 || buffer[3] !== 0x7d) {
    return null;
  }
  const payloadLength = buffer.readUInt16LE(4);
  if (buffer.length < 8 + payloadLength) return null;

  const payload = buffer.slice(8, 8 + payloadLength);
  const command = payload.readUInt16LE(0);
  const checksum = payload.readUInt16LE(2);
  const sessionId = payload.readUInt16LE(4);
  const replyNumber = payload.readUInt16LE(6);
  const data = payload.slice(8);

  return { command, checksum, sessionId, replyNumber, data };
}

/**
 * Decodes 4-byte packed ZK timestamp.
 */
function decodeZKTime(val) {
  const second = val % 60;
  val = Math.floor(val / 60);
  const minute = val % 60;
  val = Math.floor(val / 60);
  const hour = val % 24;
  val = Math.floor(val / 24);
  const day = (val % 31) + 1;
  val = Math.floor(val / 31);
  const month = val % 12;
  val = Math.floor(val / 12);
  const year = val + 2000;

  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

/**
 * Parses raw attendance binary or text payload from eSSL device.
 */
function parseAttendanceRecords(buffer) {
  const records = [];
  if (!buffer || buffer.length === 0) return records;

  // Check if text/ASCII based (e.g. "1\t2026-09-06 08:30:00\t0\t1\r\n")
  const textSample = buffer.slice(0, Math.min(buffer.length, 200)).toString('ascii');
  if (textSample.includes('\t') || textSample.includes(',')) {
    const lines = buffer.toString('utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/[\t,]+/);
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

  // 14-byte record format (standard ZKTeco standalone firmware)
  if (buffer.length % 14 === 0) {
    const count = buffer.length / 14;
    for (let i = 0; i < count; i++) {
      const offset = i * 14;
      const userSn = buffer.readUInt16LE(offset);
      const rawTime = buffer.readUInt32LE(offset + 2);
      const verifyType = buffer[offset + 6];
      const punchState = buffer[offset + 7];
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

  // 40-byte record format (ZKTeco newer/large display terminals)
  if (buffer.length % 40 === 0) {
    const count = buffer.length / 40;
    for (let i = 0; i < count; i++) {
      const offset = i * 40;
      let codeStr = '';
      for (let j = 0; j < 24; j++) {
        const b = buffer[offset + j];
        if (b === 0) break;
        codeStr += String.fromCharCode(b);
      }
      codeStr = codeStr.trim();
      const rawTime = buffer.readUInt32LE(offset + 24);
      const punchState = buffer[offset + 28];
      const verifyType = buffer[offset + 29];
      if (codeStr && rawTime > 0) {
        records.push({
          employee_code: codeStr,
          punch_time: decodeZKTime(rawTime),
          punch_type: punchState === 1 ? 'out' : 'in',
          verify_type: verifyType,
        });
      }
    }
    return records;
  }

  // Fallback: sliding window search for packed timestamps
  for (let offset = 0; offset <= buffer.length - 8; offset += 4) {
    try {
      const rawTime = buffer.readUInt32LE(offset);
      if (rawTime > 0x10000000 && rawTime < 0x50000000) {
        const timeStr = decodeZKTime(rawTime);
        if (/^202[0-9]/.test(timeStr)) {
          const userSn = offset >= 2 ? buffer.readUInt16LE(offset - 2) : 0;
          if (userSn > 0 && userSn < 99999) {
            records.push({
              employee_code: String(userSn),
              punch_time: timeStr,
              punch_type: 'in',
              verify_type: 1,
            });
          }
        }
      }
    } catch (_) {}
  }

  return records;
}

/**
 * Class representing a biometric terminal connection.
 */
class EsslDevice {
  constructor(options = {}) {
    this.name = options.name || 'eSSL Device';
    this.ip = options.ip || '192.168.1.201';
    this.port = Number(options.port) || 4370;
    this.commKey = options.commKey || '0';
    this.timeoutMs = options.timeoutMs || 8000;
  }

  /**
   * Pings and checks live TCP connection to biometric device.
   */
  async testConnection() {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let sessionId = 0;
      let isDone = false;

      const timer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          socket.destroy();
          reject(new Error(`Timeout: Device ${this.ip}:${this.port} did not respond within ${this.timeoutMs}ms.`));
        }
      }, this.timeoutMs);

      socket.connect(this.port, this.ip, () => {
        const packet = createTcpPacket(CMD_CONNECT, 0, 0);
        socket.write(packet);
      });

      socket.on('data', (data) => {
        if (isDone) return;
        const res = parseTcpPacket(data);
        if (!res) return;

        if (res.command === CMD_ACK_OK) {
          sessionId = res.sessionId;
          isDone = true;
          clearTimeout(timer);

          try {
            const exitPacket = createTcpPacket(CMD_EXIT, sessionId, res.replyNumber + 1);
            socket.write(exitPacket);
          } catch (_) {}

          socket.end();
          const latencyMs = Date.now() - startTime;
          resolve({
            online: true,
            ip: this.ip,
            port: this.port,
            latencyMs,
            sessionId,
            message: `Connected successfully to ${this.name} (${this.ip}:${this.port}) in ${latencyMs}ms.`,
          });
        }
      });

      socket.on('error', (err) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          reject(new Error(`Failed to connect to ${this.ip}:${this.port}: ${err.message}`));
        }
      });
    });
  }

  /**
   * Fetches attendance punch logs from biometric device.
   */
  async fetchPunches() {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let sessionId = 0;
      let replyNum = 0;
      let rawDataChunks = [];
      let isDone = false;

      const timer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          socket.destroy();
          reject(new Error(`Timeout reading attendance logs from ${this.ip}:${this.port}`));
        }
      }, this.timeoutMs * 2);

      socket.connect(this.port, this.ip, () => {
        const packet = createTcpPacket(CMD_CONNECT, 0, 0);
        socket.write(packet);
      });

      socket.on('data', (data) => {
        if (isDone) return;
        const res = parseTcpPacket(data);
        if (!res) return;

        if (res.command === CMD_ACK_OK && sessionId === 0) {
          sessionId = res.sessionId;
          replyNum = res.replyNumber;

          // Disable device keypad during read
          socket.write(createTcpPacket(CMD_DISABLEDEVICE, sessionId, ++replyNum));

          // Request attendance logs
          socket.write(createTcpPacket(CMD_ATTLOG_RRQ, sessionId, ++replyNum));
          return;
        }

        if (res.command === CMD_PREPARE_DATA) {
          // Device is preparing attendance log transfer
          return;
        }

        if (res.command === CMD_DATA || res.command === CMD_ACK_DATA) {
          if (res.data && res.data.length > 0) {
            rawDataChunks.push(res.data);
          }
          return;
        }

        if (res.command === CMD_ACK_OK && rawDataChunks.length > 0) {
          // Finished reading data stream
          isDone = true;
          clearTimeout(timer);

          // Re-enable device
          socket.write(createTcpPacket(CMD_ENABLEDEVICE, sessionId, ++replyNum));
          socket.write(createTcpPacket(CMD_EXIT, sessionId, ++replyNum));
          socket.end();

          const combinedBuffer = Buffer.concat(rawDataChunks);
          const punches = parseAttendanceRecords(combinedBuffer);
          resolve(punches);
        }
      });

      socket.on('close', () => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          if (rawDataChunks.length > 0) {
            const combinedBuffer = Buffer.concat(rawDataChunks);
            const punches = parseAttendanceRecords(combinedBuffer);
            resolve(punches);
          } else {
            resolve([]);
          }
        }
      });

      socket.on('error', (err) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          reject(new Error(`Socket error with ${this.ip}:${this.port}: ${err.message}`));
        }
      });
    });
  }

  /**
   * Fetches enrolled users & registrations from the device.
   */
  async fetchUsers() {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let sessionId = 0;
      let replyNum = 0;
      let rawDataChunks = [];
      let isDone = false;

      const timer = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          socket.destroy();
          reject(new Error(`Fetch users timeout after ${this.timeoutMs}ms from ${this.ip}:${this.port}`));
        }
      }, this.timeoutMs);

      socket.connect(this.port, this.ip, () => {
        socket.write(createTcpPacket(CMD_CONNECT, 0, 0));
      });

      socket.on('data', (data) => {
        if (isDone) return;
        const res = parseTcpPacket(data);
        if (!res) return;

        if (res.command === CMD_ACK_OK && sessionId === 0) {
          sessionId = res.sessionId;
          replyNum = res.replyNumber;
          socket.write(createTcpPacket(CMD_DISABLEDEVICE, sessionId, ++replyNum));
          socket.write(createTcpPacket(9, sessionId, ++replyNum)); // CMD_USERTEMP_RRQ = 9
          return;
        }

        if (res.command === CMD_PREPARE_DATA || res.command === CMD_DATA || res.command === CMD_ACK_DATA) {
          if (res.data && res.data.length > 0) {
            rawDataChunks.push(res.data);
          }
          setTimeout(() => {
            if (!isDone) {
              isDone = true;
              clearTimeout(timer);
              socket.write(createTcpPacket(CMD_ENABLEDEVICE, sessionId, ++replyNum));
              socket.write(createTcpPacket(CMD_EXIT, sessionId, ++replyNum));
              socket.end();

              const combinedBuffer = Buffer.concat(rawDataChunks);
              const users = parseUserRecords(combinedBuffer);
              resolve(users);
            }
          }, 1200);
          return;
        }

        if (res.command === CMD_ACK_OK && rawDataChunks.length > 0) {
          if (!isDone) {
            isDone = true;
            clearTimeout(timer);
            socket.write(createTcpPacket(CMD_ENABLEDEVICE, sessionId, ++replyNum));
            socket.write(createTcpPacket(CMD_EXIT, sessionId, ++replyNum));
            socket.end();

            const combinedBuffer = Buffer.concat(rawDataChunks);
            const users = parseUserRecords(combinedBuffer);
            resolve(users);
          }
        }
      });

      socket.on('close', () => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          if (rawDataChunks.length > 0) {
            const combinedBuffer = Buffer.concat(rawDataChunks);
            const users = parseUserRecords(combinedBuffer);
            resolve(users);
          } else {
            resolve([]);
          }
        }
      });

      socket.on('error', (err) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          reject(new Error(`Socket error with ${this.ip}:${this.port}: ${err.message}`));
        }
      });
    });
  }
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
    });
  }
  return users;
}

module.exports = {
  EsslDevice,
  createTcpPacket,
  parseTcpPacket,
  parseAttendanceRecords,
  parseUserRecords,
  decodeZKTime,
};
