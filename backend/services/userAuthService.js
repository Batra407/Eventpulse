/**
 * userAuthService.js — Authentication for regular Users (attendees).
 * Separate from authService which handles Organizer accounts.
 */

const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

/** Sign a JWT for a regular user */
const signToken = (id) =>
  jwt.sign(
    { id, role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

const PUBLIC_FIELDS = 'name email role eventsJoined createdAt';

/**
 * Register a new user account.
 * @returns {{ token, user }}
 */
const register = async ({ name, email, password }) => {
  const exists = await User.findOne({ email }).select('_id').lean();
  if (exists) throw new AppError('An account with that email already exists', 409);

  const user  = await User.create({ name, email, password });
  const token = signToken(user._id);

  return {
    token,
    user: { id: user._id, name: user.name, email: user.email, role: 'user' },
  };
};

/**
 * Authenticate a user with email + password.
 * @returns {{ token, user }}
 */
const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user) throw new AppError('Invalid email or password', 401);

  const match = await user.comparePassword(password);
  if (!match) throw new AppError('Invalid email or password', 401);

  const token = signToken(user._id);

  return {
    token,
    user: { id: user._id, name: user.name, email: user.email, role: 'user' },
  };
};

/**
 * Get the currently authenticated user profile.
 */
const getMe = async (userId) => {
  const user = await User.findById(userId).select(PUBLIC_FIELDS).lean();
  if (!user) throw new AppError('User not found', 404);
  return user;
};

module.exports = { register, login, getMe };
