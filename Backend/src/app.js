const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { auditMiddleware } = require('./middleware/auditMiddleware');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1);
app.set('etag', false); // Disable ETag to prevent conditional 304 Not Modified responses on dynamic API routes

// Ensure API responses are not cached and always return 200 OK
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

// Set up global rate limiter: maximum of 1000 requests per 15 minutes
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 10000,
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);


const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8086',
  'http://127.0.0.1:8086',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:3000',
  'http://localhost:5006',
  'https://front-hacksaw-yippee.ngrok-free.dev'
];
const envOrigins = (process.env.WEB_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

const isLocalhostOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname.endsWith('.localhost') ||
      url.hostname.endsWith('.local')
    );
  } catch {
    return false;
  }
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*')) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (isLocalhostOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-api-key',
    'X-Connector-Key',
    'x-tenant-code',
    'x-tenant-id',
    'x-branch-id'
  ],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request audit middleware: captures metadata (method, endpoint, user, public IP, device, status code)
// Strictly omits headers and payload body
app.use(auditMiddleware);

const path = require('path');
const uploadsDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// Log HTTP requests without logging request body, query parameters, or sensitive payload data
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl || req.url} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health check endpoint (always accessible for liveness & uptime probes)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Neha Hospitals HRMS Backend',
    timestamp: new Date().toISOString()
  });
});

// ─── Multi-Tenant Resolver Middleware ───────────────────────────────────────
// Identifies tenant from domain/subdomain or connector key and binds AsyncLocalStorage DB pool
const tenantResolver = require('./middleware/tenantResolver');
app.use(tenantResolver);

// ─── Module routes ──────────────────────────────────────────────────────────
// Control Plane routes are mounted ONLY on platform server (never customer-hosted servers)
const isControlPlaneEnabled = process.env.ENABLE_CONTROL_PLANE !== 'false';
if (isControlPlaneEnabled) {
  app.use('/api/control-plane', require('./modules/control_plane/control_plane.routes'));
} else {
  app.use('/api/control-plane', (req, res) => {
    res.status(404).json({ success: false, message: 'Control Plane is only available on Platform infrastructure.' });
  });
}
app.use('/api/auth',       require('./modules/auth/auth.routes'));
app.use('/api/branches',   require('./modules/branch/branch.routes'));
app.use('/api/hr',         require('./modules/hr/hr.routes'));
app.use('/api/leave',      require('./modules/leave/leave.routes'));
app.use('/api/patient',    require('./modules/patient/patient.routes'));
app.use('/api/system',     require('./modules/system/system.routes'));

// (Earlier complex modules)
app.use('/api/attendance', require('./modules/attendance/attendance.routes'));
app.use('/api/salary',     require('./modules/salary/salary.routes'));
app.use('/api/pharmacy',   require('./modules/pharmacy/pharmacy.routes'));
app.use('/api/consultation', require('./modules/consultation/consultation.routes'));
app.use('/api/visiting-doctors', require('./modules/visiting_doctor/visiting_doctor.routes'));
app.use('/api/bed', require('./modules/bed/bed.routes'));
app.use('/api/payment', require('./modules/payment/payment.routes'));
app.use('/api/rbac', require('./modules/rbac/rbac.routes'));
app.use('/api/users', require('./modules/users/users.routes'));
app.use('/api/audit', require('./modules/audit/audit.routes'));

// ─── Global error handler (must be last) ────────────────────────────────────
app.use(require('./middleware/errorHandler'));

module.exports = app;
