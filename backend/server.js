require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB    = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');

// ── Route imports ──────────────────────────────────────────────────────────
const authRoutes      = require('./routes/auth');
const eventRoutes     = require('./routes/events');
const feedbackRoutes  = require('./routes/feedback');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes        = require('./routes/ai');
const reportRoutes    = require('./routes/report');
const historyRoutes   = require('./routes/history');
const analyticsRoutes = require('./routes/analytics');
const attendanceRoutes = require('./routes/attendance');
const userAuthRoutes   = require('./routes/userAuth');
const adminRoutes      = require('./routes/admin');
const testRoutes       = require('./routes/test'); // E2E test seeding (dev/test only)

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Database Connection Middleware ─────────────────────────────────────────
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Database connection failed' });
    }
  }
});

// ── Security Middleware ────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Prevent NoSQL injection in MongoDB queries
app.use(mongoSanitize());

// ── Cookie Parser ─────────────────────────────────────────────────────────
// Required for reading HttpOnly JWT cookies on organizer routes
app.use(cookieParser());

// ── CORS ───────────────────────────────────────────────────────────────────
// Allow all origins in production (Vercel generates dynamic URLs per deployment).
// Security is enforced by HttpOnly JWT cookies + helmet, not by CORS origin blocking.
app.use(cors({
  origin: true, // Reflect the request origin — allows all origins while still sending credentials
  credentials: true,
  optionsSuccessStatus: 200,
}));

// ── Body Parsers ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Rate Limiting ──────────────────────────────────────────────────────────

// General API limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 5000, // relaxed for dev
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests — please try again later' },
});
app.use('/api/', limiter);

// Auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 5000, // relaxed for dev
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts — please try again later' },
});
app.use('/api/auth', authLimiter);
app.use('/api/v1/auth', authLimiter); // Protect v1 routes as well

// Admin endpoints
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 30 : 5000, // relaxed for dev
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many admin requests' },
});
app.use('/api/admin', adminLimiter);
app.use('/api/v1/admin', adminLimiter);

// ── Request Logger & Trace ID ──────────────────────────────────────────────
const crypto = require('crypto');
const logger = require('./utils/logger');

app.use((req, res, next) => {
  req.id = req.headers['x-trace-id'] || crypto.randomUUID();
  res.setHeader('x-trace-id', req.id);
  next();
});

app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    if (ms > 300) {
      logger.warn(`SLOW REQUEST [${req.id}] ${req.method} ${req.path} → ${status} [${ms}ms]`);
    } else if (process.env.NODE_ENV !== 'production' || status >= 400) {
      logger.info(`[${req.id}] ${req.method} ${req.path} → ${status} [${ms}ms]`);
    }
  });
  next();
});

// ── Serve static frontend ──────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Health Check Endpoints ──────────────────────────────────────────────────
app.get('/health', (_req, res) => res.status(200).json({ status: 'UP', timestamp: new Date() }));
app.get('/ready', async (_req, res) => {
  try {
    const mongoose = require('mongoose');
    const state = mongoose.connection.readyState;
    if (state !== 1) throw new Error('DB not connected');
    res.status(200).json({ status: 'READY', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'NOT_READY', error: err.message });
  }
});
// Versioned alias so frontend apiFetch('/api/v1/health') also works
app.get('/api/v1/health', (_req, res) => res.status(200).json({ status: 'UP', timestamp: new Date() }));

// ── Serve static frontend files ────────────────────────────────────────────
// This MUST come before API routes so .html, .js, .css files are served directly.
app.use(express.static(path.join(__dirname, '../frontend'), {
  index: 'index.html',
  extensions: ['html'],
}));

// ── API Routes (v1) ────────────────────────────────────────────────────────
const apiV1 = express.Router();
apiV1.use('/auth',       authRoutes);
apiV1.use('/events',     eventRoutes);
apiV1.use('/feedback',   feedbackRoutes);
apiV1.use('/dashboard',  dashboardRoutes);
apiV1.use('/ai',         aiRoutes);
apiV1.use('/report',     reportRoutes);
apiV1.use('/history',    historyRoutes);
apiV1.use('/analytics',  analyticsRoutes);
apiV1.use('/attendance', attendanceRoutes);
apiV1.use('/users/auth', userAuthRoutes);
apiV1.use('/admin',      adminRoutes); // Super admin only
if (process.env.NODE_ENV !== 'production') {
  apiV1.use('/test', testRoutes);   // E2E test seeding (dev/test only)
}

app.use('/api/v1', apiV1);

// ── Legacy SPA redirects ───────────────────────────────────────────────────
app.get('/login-page',     (_req, res) => res.redirect(301, '/author-login.html'));
app.get('/dashboard-page', (_req, res) => res.redirect(301, '/dashboard.html'));
app.get('/register-page',  (_req, res) => res.redirect(301, '/register.html'));

// ── Frontend fallback for SPA routes (not files) ────────────────────────
app.get('*', (req, res) => {
  // Only fallback to index.html for non-file routes (no dot in path)
  if (!req.path.includes('.')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// ── Global Error Handler ───────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅  Server running → http://localhost:${PORT}`);
    console.log(`📌  Environment   → ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒  Auth mode     → HttpOnly cookie JWT`);
  });
}

module.exports = app;
