const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
// const { auditMiddleware } = require('./middleware/auditMiddleware');
const rateLimit = require('express-rate-limit');

const app = express();

// Set up global rate limiter: maximum of 1000 requests per 15 minutes
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 10000,
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);


const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://front-hacksaw-yippee.ngrok-free.dev'];
const envOrigins = (process.env.WEB_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(cookieParser());
app.use(express.json());

// Log requests
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`, req.body);
  next();
});

// ─── Module routes ──────────────────────────────────────────────────────────
app.use('/api/auth',       require('./modules/auth/auth.routes'));
app.use('/api/hr',         require('./modules/hr/hr.routes'));
app.use('/api/leave',      require('./modules/leave/leave.routes'));
app.use('/api/patient',    require('./modules/patient/patient.routes'));
app.use('/api/system',     require('./modules/system/system.routes'));

// (Earlier complex modules)
app.use('/api/attendance', require('./modules/attendance/attendance.routes'));
app.use('/api/salary',     require('./modules/salary/salary.routes'));
app.use('/api/pharmacy',   require('./modules/pharmacy/pharmacy.routes'));

// ─── Global error handler (must be last) ────────────────────────────────────
app.use(require('./middleware/errorHandler'));

module.exports = app;
