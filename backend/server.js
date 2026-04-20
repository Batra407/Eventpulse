require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const { errorHandler } = require('./middleware/errorHandler');

// ── Route imports ──────────────────────────────────────────────────────────
const authRoutes      = require('./routes/auth');
const eventRoutes     = require('./routes/events');
const feedbackRoutes  = require('./routes/feedback');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes        = require('./routes/ai');
const reportRoutes    = require('./routes/report');
const historyRoutes   = require('./routes/history');
const analyticsRoutes  = require('./routes/analytics');
const attendanceRoutes = require('./routes/attendance');

const app  = express();
const PORT = process.env.PORT || 5000;

app.get('/api/debug-env', (req, res) => {
  res.json({
    mongo_uri_exists: !!process.env.MONGO_URI,
    jwt_secret_exists: !!process.env.JWT_SECRET,
    keys: Object.keys(process.env).filter(k => k.includes('MONGO') || k.includes('JWT'))
  });
});

// ── Database Connection Middleware for Serverless ──────────────────────────
// Ensure DB is connected before processing any API route
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    if (!res.headersSent) {
      // TEMPORARILY EXPOSE ERROR VISUALLY FOR DEBUGGING
      res.status(500).json({ success: false, message: `DB Error: ${err.message}` });
    }
  }
});

// ── Security Middleware ────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// General API rate limit — 200 req / 15 min per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests — please try again later' },
});
app.use('/api/', limiter);

// Stricter limit on auth endpoints — 20 req / 15 min
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts — please try again later' },
});
app.use('/api/auth', authLimiter);

// ── Body Parsers ───────────────────────────────────────────────────────────
// ── CORS ──────────────────────────────────────────────────────────────────
// In production, lock to FRONTEND_ORIGIN env var (same-origin via Express static
// means CORS is not needed between our own pages, but external tools may call API).
const corsOptions = process.env.FRONTEND_ORIGIN
  ? { origin: process.env.FRONTEND_ORIGIN, optionsSuccessStatus: 200 }
  : {}; // development — allow all origins
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request Logger (latency-aware) ────────────────────────────────────────
app.use((req, _res, next) => {
  if (!req.path.startsWith('/api/')) return next();

  const start = Date.now();
  _res.on('finish', () => {
    const ms     = Date.now() - start;
    const status = _res.statusCode;
    const flag   = ms > 300 ? ' ⚠️  SLOW' : '';

    if (process.env.NODE_ENV !== 'production') {
      console.log(`${req.method} ${req.path} → ${status} [${ms}ms]${flag}`);
    } else if (status >= 400 || ms > 300) {
      // In production only log errors + slow requests
      console.log(`${req.method} ${req.path} → ${status} [${ms}ms]${flag}`);
    }
  });
  next();
});

// ── Serve static frontend ──────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/events',    eventRoutes);
app.use('/api/feedback',  feedbackRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/report',    reportRoutes);
app.use('/api/history',   historyRoutes);
app.use('/api/analytics',  analyticsRoutes);
app.use('/api/attendance', attendanceRoutes);

// ── Legacy SPA route redirects ─────────────────────────────────────────────
// Old frontend code called showPage('login-page') — redirect to the real pages
app.get('/login-page',     (_req, res) => res.redirect(301, '/login.html'));
app.get('/dashboard-page', (_req, res) => res.redirect(301, '/dashboard.html'));
app.get('/register-page',  (_req, res) => res.redirect(301, '/register.html'));

// ── Frontend fallback ──────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Global Error Handler ───────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`✅  Server running → http://localhost:${PORT}`);
    console.log(`📌  Environment   → ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
