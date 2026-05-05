/**
 * userAuthController.js — HTTP layer for user (attendee) authentication.
 */

const userAuthService = require('../services/userAuthService');
const { sendSuccess }  = require('../utils/response');

/** POST /api/users/auth/register */
const register = async (req, res) => {
  const result = await userAuthService.register(req.body);
  sendSuccess(res, 'Account created successfully', result, 201);
};

/** POST /api/users/auth/login */
const login = async (req, res) => {
  const result = await userAuthService.login(req.body);
  sendSuccess(res, 'Login successful', result);
};

/** GET /api/users/auth/me */
const getMe = async (req, res) => {
  const user = await userAuthService.getMe(req.user.id);
  sendSuccess(res, 'Profile retrieved', user);
};

module.exports = { register, login, getMe };
