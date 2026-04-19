/**
 * authService.js — Authentication business logic.
 *
 * JWT payload is minimized to { id } only.
 * authMiddleware hydrates `req.organizer` from the DB on each
 * protected request, ensuring stale tokens don't carry stale data.
 */

const jwt        = require('jsonwebtoken');
const Organizer  = require('../models/Organizer');
const { AppError } = require('../middleware/errorHandler');

/** Minimal JWT payload — only the organizer's MongoDB _id */
const signToken = (id) =>
  jwt.sign(
    { id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

/** Safe public projection for organizer responses */
const PUBLIC_FIELDS = 'name email role createdAt';

/**
 * Register a new organizer account.
 * @returns {{ token, organizer }}
 */
const register = async ({ name, email, password }) => {
  const exists = await Organizer.findOne({ email }).select('_id').lean();
  if (exists) throw new AppError('An account with that email already exists', 409);

  const organizer = await Organizer.create({ name, email, password });
  const token = signToken(organizer._id);

  return {
    token,
    organizer: { id: organizer._id, name: organizer.name, email: organizer.email },
  };
};

/**
 * Authenticate an organizer with email + password.
 * @returns {{ token, organizer }}
 */
const login = async ({ email, password }) => {
  // Must select +password because it's hidden in the schema
  const organizer = await Organizer.findOne({ email }).select('+password');
  if (!organizer) throw new AppError('Invalid email or password', 401);

  const match = await organizer.comparePassword(password);
  if (!match) throw new AppError('Invalid email or password', 401);

  const token = signToken(organizer._id);

  return {
    token,
    organizer: { id: organizer._id, name: organizer.name, email: organizer.email },
  };
};

/**
 * Get the currently authenticated organizer profile (read-only).
 * @param {string} organizerId - from req.organizer.id
 */
const getMe = async (organizerId) => {
  const organizer = await Organizer.findById(organizerId)
    .select(PUBLIC_FIELDS)
    .lean();
  if (!organizer) throw new AppError('Organizer not found', 404);
  return organizer;
};

module.exports = { register, login, getMe };
