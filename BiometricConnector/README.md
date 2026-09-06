# 🏥 Neha Hospitals — Biometric Connector Edge Microservice

The **Biometric Connector** is a lightweight, edge-running Node.js microservice designed to bridge on-premise biometric attendance terminals (eSSL, ZKTeco, etc.) on the hospital LAN to the central Neha Hospitals Cloud ERP.

```
┌─────────────────────────────────────────────────────────┐
│                    HOSPITAL LOCAL LAN                   │
│                                                         │
│   ┌─────────────────────┐       ┌───────────────────┐   │
│   │ Main Reception eSSL │       │ Emergency/ICU eSSL│   │
│   │   192.168.1.201     │       │   192.168.1.202   │   │
│   └──────────┬──────────┘       └─────────┬─────────┘   │
│              │ (TCP Port 4370)            │             │
│              └──────────────┬─────────────┘             │
│                             ▼                           │
│             ┌───────────────────────────────┐           │
│             │  Biometric Connector Service  │           │
│             │    (Node.js on Port 8000)     │           │
│             └───────────────┬───────────────┘           │
└─────────────────────────────┼───────────────────────────┘
                              │
                              ▼
               [ Cloudflare Tunnel Agent (cloudflared) ]
                              │
                              ▼ (Encrypted HTTPS)
              https://neha-bio.tylo.co.in
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│              NEHA HOSPITALS CLOUD BACKEND               │
│               https://api.yourhospital.com              │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Setup on Hospital System

### Step 1: Install Dependencies
Open terminal / command prompt in this directory:
```bash
cd BiometricConnector
npm install
```

### Step 2: Configure Environment (`.env`)
Edit or verify `.env`:
```env
PORT=8000
PUBLIC_URL=https://neha-bio.tylo.co.in
CONNECTOR_API_KEY=neha_bio_secret_key_2026
MAIN_BACKEND_URL=https://api.yourhospital.com
AUTO_SYNC_INTERVAL_MINS=10

# Primary Device
DEFAULT_DEVICE_NAME="Main Entrance Reception"
DEFAULT_DEVICE_IP=192.168.1.201
DEFAULT_DEVICE_PORT=4370
DEFAULT_DEVICE_COMM_KEY=0
DEFAULT_DEVICE_LOCATION="Reception"
```

### Step 3: Run the Connector
On Windows, simply double-click `start.bat` or run:
```bash
npm start
```
The service will start listening on `http://localhost:8000`.

---

## 🌐 Cloudflare Tunnel Setup (Domain Mapping)

To map `https://neha-bio.tylo.co.in` to this service:

### Option A: Using Quick Tunnel
```bash
cloudflared tunnel --url http://localhost:8000
```

### Option B: Named Tunnel with Custom Domain (Recommended)
1. Authenticate Cloudflare (one time):
   ```bash
   cloudflared tunnel login
   ```
2. Create named tunnel:
   ```bash
   cloudflared tunnel create neha-bio-tunnel
   ```
3. Route DNS for `neha-bio.tylo.co.in`:
   ```bash
   cloudflared tunnel route dns neha-bio-tunnel neha-bio.tylo.co.in
   ```
4. In `config.yml` (or run command):
   ```yaml
   tunnel: <TUNNEL_UUID>
   credentials-file: C:\Users\<Username>\.cloudflared\<TUNNEL_UUID>.json

   ingress:
     - hostname: neha-bio.tylo.co.in
       service: http://localhost:8000
     - service: http_status:404
   ```
5. Start the tunnel as a background service:
   ```bash
   cloudflared tunnel run neha-bio-tunnel
   ```
   Or install as Windows Service:
   ```bash
   cloudflared service install
   ```

Now `https://neha-bio.tylo.co.in` points directly to your Biometric Connector!

---

## 📡 REST API Endpoints

All requests from outside should pass the API key in the header:
```http
x-api-key: neha_bio_secret_key_2026
```
*(Or `Authorization: Bearer neha_bio_secret_key_2026`)*

### 1. Health Check
- **`GET /api/health`** (Public)
  - Returns service status, uptime, and device count.

### 2. Manage Multiple Biometric Devices
- **`GET /api/devices`**
  - Lists all configured biometric devices with last test/sync metrics.
- **`POST /api/devices`**
  - Register a new biometric device.
  - Body:
    ```json
    {
      "name": "ICU Entrance eSSL",
      "ip": "192.168.1.202",
      "port": 4370,
      "commKey": "0",
      "location": "ICU / Ward 2",
      "enabled": true
    }
    ```
- **`PUT /api/devices/:id`**
  - Update device IP, port, or location.
- **`DELETE /api/devices/:id`**
  - Remove a device.

### 3. Device Operations & Attendance Sync
- **`GET /api/devices/:id/test`** (or `POST`)
  - Live TCP ping to biometric device on port 4370. Returns latency in ms and session ID.
- **`GET /api/devices/:id/punches`**
  - Downloads raw attendance punch logs from the machine.
- **`POST /api/devices/:id/sync`**
  - Downloads attendance punch logs and immediately forwards them to the central hospital ERP (`POST /api/attendance/punches/import`).
- **`POST /api/sync-all`**
  - Loops through all active devices, downloads punches, and pushes all records to central hospital backend.

### 4. Staff Biometric Enrollments (Fingerprint & Face)
- **`GET /api/devices/:id/users`**
  - Reads enrolled users (fingerprint, face, user PIN, name) directly from the biometric device.
- **`POST /api/devices/:id/sync-users`**
  - Reads enrolled users from a terminal and forwards them to the hospital database (`POST /api/attendance/enrolled-users`).
- **`POST /api/sync-users-all`**
  - Loops through all active biometric terminals, downloads all enrolled staff, and forwards them in bulk to the central database.
- **`POST /api/register-staff`**
  - Accepts a single newly enrolled staff member registration from Windows software/terminal and saves directly to the hospital database.
  - Body:
    ```json
    {
      "enroll_code": "1003",
      "name": "Arun Kumar",
      "device_id": "Reception eSSL",
      "has_fingerprint": 1,
      "has_face": 1,
      "card_number": "00129482"
    }
    ```

---

## 🪪 Windows Quick Enrollment Assistant (`register_staff.bat`)
To register newly joined employees on the Windows system:
1. Double-click **`register_staff.bat`**.
2. It automatically queries the hospital database for the next sequential Employee ID (e.g. `1003`).
3. Enter the staff member's name and confirm whether fingerprint and face were enrolled on the machine.
4. The registration is immediately saved directly in the hospital database and becomes selectable in the web app's **Add Member** screen.

---

## 🔄 Automatic Background Sync
When `AUTO_SYNC_INTERVAL_MINS=10` is configured in `.env`, the connector automatically:
1. Every 10 minutes, pulls new biometric attendance punches from all active terminals and forwards them to the central backend.
2. Simultaneously pulls newly enrolled staff credentials (fingerprint & face) and saves them into the central database.

