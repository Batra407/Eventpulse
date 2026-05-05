/**
 * authController.js — Organizer authentication and profile HTTP layer.
 */

const authService     = require('../services/authService');
const { sendSuccess } = require('../utils/response');

/** Get real client IP (works behind proxies) */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

// ── Authentication ─────────────────────────────────────────────────────────

/** POST /api/auth/register */
const register = async (req, res) => {
  const { email, name, password } = req.body;
  const result = await authService.register(email, name, password);
  sendSuccess(res, result.message, result.organizer, 201);
};

/** POST /api/auth/login */
const login = async (req, res) => {
  const { email, password } = req.body;
  const ip        = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  const result = await authService.login(email, password, ip, userAgent, res);
  sendSuccess(res, 'Login successful', result.organizer);
};

// ── Session Management ─────────────────────────────────────────────────────

/** POST /api/auth/refresh */
const refreshToken = async (req, res) => {
  const plainRefresh = req.cookies?.ep_refresh;
  const result = await authService.refreshAccessToken(plainRefresh, res);
  sendSuccess(res, result.message);
};

/** POST /api/auth/logout */
const logout = async (req, res) => {
  const organizerId  = req.organizer?.id; // may be undefined if token already expired
  const plainRefresh = req.cookies?.ep_refresh;
  const result = await authService.logoutSession(organizerId, plainRefresh, res);
  sendSuccess(res, result.message);
};

/** POST /api/auth/logout-all */
const logoutAll = async (req, res) => {
  const result = await authService.logoutAllSessions(req.organizer.id, res);
  sendSuccess(res, result.message);
};

// ── Profile & Requests ─────────────────────────────────────────────────────

/** GET /api/auth/me */
const getMe = async (req, res) => {
  const organizer = await authService.getMe(req.organizer.id);
  sendSuccess(res, 'Profile retrieved', organizer);
};

/** POST /api/auth/request-access */
const requestAccess = async (req, res) => {
  const result = await authService.requestAccess(req.organizer.id, req.body);
  sendSuccess(res, result.message, { requestId: result.requestId }, 201);
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  getMe,
  requestAccess
};
