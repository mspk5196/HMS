/**
 * register-staff.js
 *
 * Windows enrollment assistant script.
 * Enables the hospital operator at the Windows biometric workstation to:
 * 1. Automatically fetch the next available Employee ID from the central database.
 * 2. Input newly enrolled staff details (Name, Fingerprint: Yes, Face: Yes).
 * 3. Save the new registration directly into the central Neha Hospital database.
 * 4. Trigger an immediate hardware-to-database sync across all biometric machines.
 */

const readline = require('readline');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const MAIN_BACKEND_URL = (process.env.MAIN_BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_KEY = process.env.CONNECTOR_API_KEY || '';

const client = axios.create({
  baseURL: MAIN_BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}`, 'x-api-key': API_KEY } : {}),
  },
  timeout: 15000,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('====================================================================');
  console.log('  🏥 NEHA HOSPITALS — BIOMETRIC STAFF ENROLLMENT UTILITY');
  console.log('  Target Database API:', MAIN_BACKEND_URL);
  console.log('====================================================================\n');

  try {
    // 1. Fetch next recommended employee code
    process.stdout.write('Fetching next available Employee ID from database... ');
    let recommendedCode = '1001';
    try {
      const codeRes = await client.get('/api/attendance/enrolled-users/next-code');
      recommendedCode = codeRes.data?.data?.nextCode || '1001';
      console.log(`[Suggested: ${recommendedCode}]`);
    } catch (err) {
      console.log('(Could not query next code, defaulting to manual entry)');
    }

    // 2. Prompt user
    const inputCode = await ask(`Enter Employee ID / Biometric Code [Default: ${recommendedCode}]: `);
    const employeeCode = inputCode.trim() || recommendedCode;

    const name = await ask('Enter Full Name of Staff Member: ');
    if (!name.trim()) {
      console.log('❌ Error: Staff name cannot be empty.');
      rl.close();
      return;
    }

    const fingerAns = await ask('Fingerprint Enrolled on Machine? (Y/n) [Default: Y]: ');
    const hasFingerprint = fingerAns.trim().toLowerCase() !== 'n' ? 1 : 0;

    const faceAns = await ask('Face Recognition Enrolled on Machine? (Y/n) [Default: Y]: ');
    const hasFace = faceAns.trim().toLowerCase() !== 'n' ? 1 : 0;

    const deviceName = await ask('Enrollment Station / Machine Name [Default: Reception eSSL]: ');
    const device = deviceName.trim() || 'Reception eSSL';

    const cardNum = await ask('RFID Card Number (optional, press Enter if none): ');

    // 3. Submit registration to database
    console.log('\nSubmitting registration to central database...');
    const payload = {
      enroll_code: employeeCode,
      name: name.trim(),
      device_id: device,
      card_number: cardNum.trim() || null,
      has_fingerprint: hasFingerprint,
      has_face: hasFace,
      privilege: 'user',
      registered_at: new Date().toISOString(),
    };

    const res = await client.post('/api/attendance/enrolled-users/register', payload);

    console.log('--------------------------------------------------------------------');
    console.log('✅ SUCCESS: Biometric Staff Registration Saved in Hospital Database!');
    console.log(`   Employee ID / Enroll Code : ${employeeCode}`);
    console.log(`   Staff Name                : ${name.trim()}`);
    console.log(`   Fingerprint Enrolled      : ${hasFingerprint ? 'YES' : 'NO'}`);
    console.log(`   Face Recognition Enrolled : ${hasFace ? 'YES' : 'NO'}`);
    console.log(`   Terminal Station          : ${device}`);
    console.log('--------------------------------------------------------------------');
    console.log('💡 Note: When creating this staff member in the Neha Hospitals web app,');
    console.log(`   use Employee Code "${employeeCode}" (it will auto-detect this registration)!`);

    // 4. Offer hardware sync
    const syncAns = await ask('\nWould you also like to sync all biometric hardware terminals right now? (y/N): ');
    if (syncAns.trim().toLowerCase() === 'y') {
      try {
        console.log('Triggering hardware sync...');
        await client.post('/api/attendance/devices/sync-all-users');
        console.log('✅ Terminal synchronization triggered successfully.');
      } catch (sErr) {
        console.warn('⚠️ Hardware sync note:', sErr.message);
      }
    }
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error('\n❌ Registration failed:', msg);
  } finally {
    rl.close();
  }
}

main();
