/**
 * authService.js — Organizer authentication business logic.
 */

const jwt               = require('jsonwebtoken');
const bcrypt            = require('bcryptjs');
const Organizer         = require('../models/Organizer');
const OrganizerRequest  = require('../models/OrganizerRequest');
const { AppError }      = require('../middleware/errorHandler');

const PUBLIC_FIELDS = 'name email role organizerStatus isSuspended lastLogin createdAt';
const MAX_SESSIONS  = 5;

// ── JWT helpers ────────────────────────────────────────────────────────────

function signAccessToken(id, role) {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

function signRefreshToken(id) {
  return jwt.sign(
    { id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
}

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge:   maxAgeMs,
    path:     '/',
  };
}

async function storeRefreshToken(organizer, plainRefresh) {
  const hashed = await bcrypt.hash(plainRefresh, 10);
  let tokens = organizer.refreshTokens || [];
  if (tokens.length >= MAX_SESSIONS) {
    tokens = tokens.slice(tokens.length - (MAX_SESSIONS - 1));
  }
  tokens.push(hashed);
  await Organizer.updateOne({ _id: organizer._id }, { $set: { refreshTokens: tokens } });
}

// ── Registration ───────────────────────────────────────────────────────────

const register = async (email, name, password) => {
  const emailLc = email.toLowerCase().trim();

  const exists = await Organizer.findOne({ email: emailLc }).select('_id').lean();
  if (exists) {
    throw new AppError('An account with this email already exists. Please sign in.', 409);
  }

  if (!name || name.trim().length < 2) {
    throw new AppError('Name must be at least 2 characters', 400);
  }

  if (!password || password.length < 8) {
    throw new AppError('Password must be at least 8 characters long', 400);
  }

  const organizer = await Organizer.create({
    name:            name.trim(),
    email:           emailLc,
    password,
    role:            'organizer',
    organizerStatus: 'approved',  // Auto-approved; remove this for manual approval workflow
    isSuspended:     false,
  });

  return {
    message:   'Account created successfully. Awaiting admin approval.',
    organizer: {
      id:              organizer._id,
      name:            organizer.name,
      email:           organizer.email,
      organizerStatus: 'pending',
    },
  };
};

// ── Login ──────────────────────────────────────────────────────────────────

const login = async (email, password, ip, userAgent, res) => {
  const emailLc = email.toLowerCase().trim();

  const organizer = await Organizer.findOne({ email: emailLc })
    .select('+password refreshTokens name email role organizerStatus isSuspended');

  if (!organizer) {
    throw new AppError('Invalid email or password', 401);
  }

  if (organizer.isSuspended) {
    throw new AppError('This account has been suspended. Please contact support.', 403);
  }

  const isMatch = await organizer.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  if (organizer.role !== 'superadmin') {
    if (organizer.organizerStatus === 'pending') {
      throw new AppError('Your account is pending admin approval. You will be notified when approved.', 403);
    }
    if (organizer.organizerStatus === 'rejected') {
      throw new AppError('Your account access was rejected. Contact support.', 403);
    }
    if (organizer.organizerStatus !== 'approved') {
      throw new AppError('Account access denied. Contact support.', 403);
    }
  }

  const accessToken  = signAccessToken(organizer._id, organizer.role);
  const refreshToken = signRefreshToken(organizer._id);

  await storeRefreshToken(organizer, refreshToken);

  if (typeof organizer.recordLogin === 'function') {
    organizer.recordLogin(ip, userAgent, true);
    await organizer.save({ validateBeforeSave: false });
  }

  res.cookie('ep_access', accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie('ep_refresh', refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));

  const safeOrganizer = {
    id: organizer._id,
    name: organizer.name,
    email: organizer.email,
    role: organizer.role,
    organizerStatus: organizer.organizerStatus,
  };

  return { organizer: safeOrganizer };
};

// ── Session Management ─────────────────────────────────────────────────────

const refreshAccessToken = async (plainRefresh, res) => {
  if (!plainRefresh) throw new AppError('No refresh token provided', 401);

  let decoded;
  try {
    decoded = jwt.verify(plainRefresh, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch (err) {
    throw new AppError('Invalid or expired refresh token', 403);
  }

  if (decoded.type !== 'refresh') throw new AppError('Invalid token type', 403);

  const organizer = await Organizer.findById(decoded.id)
    .select('role refreshTokens isSuspended organizerStatus');
  if (!organizer) throw new AppError('Organizer not found', 404);
  if (organizer.isSuspended) throw new AppError('Account suspended', 403);

  const tokens = organizer.refreshTokens || [];
  let tokenIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (await bcrypt.compare(plainRefresh, tokens[i])) {
      tokenIndex = i; break;
    }
  }

  if (tokenIndex === -1) {
    await Organizer.updateOne({ _id: organizer._id }, { $set: { refreshTokens: [] } });
    res.clearCookie('ep_access');
    res.clearCookie('ep_refresh');
    throw new AppError('Refresh token reuse detected. All sessions revoked. Please log in again.', 403);
  }

  tokens.splice(tokenIndex, 1);
  const newAccessToken  = signAccessToken(organizer._id, organizer.role);
  const newRefreshToken = signRefreshToken(organizer._id);
  const newHashed = await bcrypt.hash(newRefreshToken, 10);
  tokens.push(newHashed);

  await Organizer.updateOne({ _id: organizer._id }, { $set: { refreshTokens: tokens } });

  res.cookie('ep_access', newAccessToken, cookieOptions(15 * 60 * 1000));
  res.cookie('ep_refresh', newRefreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));

  return { message: 'Session refreshed' };
};

const logoutSession = async (organizerId, plainRefresh, res) => {
  res.clearCookie('ep_access',     { path: '/' });
  res.clearCookie('ep_refresh', { path: '/' });

  if (organizerId && plainRefresh) {
    const organizer = await Organizer.findById(organizerId).select('refreshTokens');
    if (organizer && organizer.refreshTokens?.length) {
      const remaining = [];
      for (const hash of organizer.refreshTokens) {
        if (!(await bcrypt.compare(plainRefresh, hash))) remaining.push(hash);
      }
      await Organizer.updateOne({ _id: organizer._id }, { $set: { refreshTokens: remaining } });
    }
  }
  return { message: 'Logged out successfully' };
};

const logoutAllSessions = async (organizerId, res) => {
  res.clearCookie('ep_access',   { path: '/' });
  res.clearCookie('ep_refresh', { path: '/' });
  await Organizer.updateOne({ _id: organizerId }, { $set: { refreshTokens: [] } });
  return { message: 'All sessions revoked' };
};

// ── Profile & Requests ─────────────────────────────────────────────────────

const getMe = async (organizerId) => {
  const organizer = await Organizer.findById(organizerId)
    .select(PUBLIC_FIELDS)
    .lean();
  if (!organizer) throw new AppError('Organizer not found', 404);
  return organizer;
};

const requestAccess = async (organizerId, requestData) => {
  const { organizationName, category, reason, socialLinks } = requestData;

  if (!organizationName?.trim()) throw new AppError('Organization name is required', 400);
  if (!category)                  throw new AppError('Category is required', 400);
  if (!reason?.trim())            throw new AppError('Reason is required', 400);

  const existing = await OrganizerRequest.findOne({
    organizerId,
    status: 'pending',
  }).lean();

  if (existing) {
    throw new AppError('You already have a pending access request', 409);
  }

  const request = await OrganizerRequest.create({
    organizerId,
    organizationName: organizationName.trim(),
    category,
    reason:           reason.trim(),
    socialLinks:      socialLinks || {},
    status:           'pending',
  });

  return {
    message:   'Access request submitted. An admin will review it shortly.',
    requestId: request._id,
  };
};

module.exports = {
  register,
  login,
  refreshAccessToken,
  logoutSession,
  logoutAllSessions,
  getMe,
  requestAccess
};
