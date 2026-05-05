/**
 * authMiddleware.js — Production-grade JWT verification and role guards.
 *
 * Token strategy:
 *   Primary   — HttpOnly cookie 'ep_access' (XSS-safe)
 *   Fallback  — Authorization: Bearer <token> header (API clients / Postman)
 *
 * Middleware chain for organizer routes:
 *   verifyJWT → verifyOrganizer → verifyApprovedOrganizer
 *
 * Middleware chain for admin routes:
 *   verifyJWT → verifySuperAdmin
 *
 * Unchanged:
 *   verifyUserToken — for attendee routes
 */

const jwt       = require('jsonwebtoken');
const Organizer = require('../models/Organizer');
const User      = require('../models/User');

// ── Token extractor ────────────────────────────────────────────────────────

function extractToken(req) {
  // 1. HttpOnly cookie (preferred — XSS-safe)
  if (req.cookies && req.cookies.ep_access) {
    return req.cookies.ep_access;
  }
  // 2. Authorization header (for API clients / backward compat)
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (header && header.startsWith('Bearer ')) {
    return header.split(' ')[1];
  }
  return null;
}

// ── 1. verifyJWT ──────────────────────────────────────────────────────────
/**
 * Reads JWT from cookie or header, verifies signature + expiry,
 * then hydrates req.organizer with fresh DB data.
 *
 * Importantly: checks organizerStatus and isSuspended on EVERY request
 * so a suspension takes effect immediately on the next API call.
 */
const verifyJWT = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied — authentication required',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Session expired — please log in again'
        : 'Invalid or malformed token';
    return res.status(401).json({ success: false, message });
  }

  // Hydrate from DB — always fresh to catch suspensions / status changes
  try {
    const organizer = await Organizer.findById(decoded.id)
      .select('_id name email role organizerStatus isSuspended')
      .lean();

    if (!organizer) {
      return res.status(401).json({
        success: false,
        message: 'Account not found — please log in again',
      });
    }

    req.organizer = {
      id:              organizer._id.toString(),
      name:            organizer.name,
      email:           organizer.email,
      role:            organizer.role,
      organizerStatus: organizer.organizerStatus,
      isSuspended:     organizer.isSuspended,
    };

    next();
  } catch (err) {
    next(err);
  }
};

// ── 2. verifyOrganizer ────────────────────────────────────────────────────
/**
 * Confirms the authenticated account holds an organizer-level role.
 * Must run after verifyJWT.
 */
const verifyOrganizer = (req, res, next) => {
  if (!req.organizer) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (req.organizer.role !== 'organizer' && req.organizer.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden — organizer account required',
    });
  }
  next();
};

// ── 3. verifyApprovedOrganizer ────────────────────────────────────────────
/**
 * Confirms the organizer is APPROVED by superadmin and NOT suspended.
 * This is the critical gate that enforces the admin approval workflow.
 * Must run after verifyJWT + verifyOrganizer.
 */
const verifyApprovedOrganizer = (req, res, next) => {
  if (!req.organizer) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  // Superadmins bypass approval check — they have full access
  if (req.organizer.role === 'superadmin') return next();

  if (req.organizer.isSuspended) {
    return res.status(403).json({
      success: false,
      message: 'Account suspended — contact support',
      code:    'ACCOUNT_SUSPENDED',
    });
  }

  if (req.organizer.organizerStatus !== 'approved') {
    return res.status(403).json({
      success: false,
      message: req.organizer.organizerStatus === 'pending'
        ? 'Account pending admin approval — you will be notified when approved'
        : 'Account access revoked — contact support',
      code: 'NOT_APPROVED',
      status: req.organizer.organizerStatus,
    });
  }

  next();
};

// ── 4. verifySuperAdmin ───────────────────────────────────────────────────
/**
 * Confirms the account is a superadmin.
 * Used exclusively for admin management routes.
 * Must run after verifyJWT.
 */
const verifySuperAdmin = (req, res, next) => {
  if (!req.organizer) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  if (req.organizer.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden — admin access required',
    });
  }
  next();
};

// ── 5. verifyUserToken — UNCHANGED (attendee routes) ─────────────────────
/**
 * Validates attendee/user JWTs.
 * Completely separate from organizer auth — attendee flow unchanged.
 */
const verifyUserToken = async (req, res, next) => {
  const header = req.headers['authorization'] || req.headers['Authorization'];

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied — no token provided',
    });
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Session expired — please log in again'
        : 'Invalid or malformed token';
    return res.status(401).json({ success: false, message });
  }

  try {
    const user = await User.findById(decoded.id).select('_id name email role').lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Account not found — please log in again',
      });
    }

    req.user = {
      id:    user._id.toString(),
      name:  user.name,
      email: user.email,
      role:  user.role,
    };

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  verifyJWT,
  verifyOrganizer,
  verifyApprovedOrganizer,
  verifySuperAdmin,
  verifyUserToken,
  // Legacy alias — keeps old imports working during transition
  verifyToken: verifyJWT,
};
