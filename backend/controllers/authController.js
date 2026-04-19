/**
 * authController.js — Thin HTTP layer for authentication routes.
 * All business logic lives in services/authService.js.
 */

const authService  = require('../services/authService');
const { sendSuccess } = require('../utils/response');

/** POST /api/auth/register */
const register = async (req, res) => {
  const result = await authService.register(req.body);
  sendSuccess(res, 'Account created successfully', result, 201);
};

/** POST /api/auth/login */
const login = async (req, res) => {
  const result = await authService.login(req.body);
  sendSuccess(res, 'Login successful', result);
};

/** GET /api/auth/me */
const getMe = async (req, res) => {
  const organizer = await authService.getMe(req.organizer.id);
  sendSuccess(res, 'Profile retrieved', organizer);
};

module.exports = { register, login, getMe };
