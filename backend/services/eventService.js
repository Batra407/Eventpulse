/**
 * eventService.js — Event business logic layer.
 * Enterprise Refactor: Adds MongoDB transactions, token generation, 
 * QR logic, soft deletes, and robust pagination.
 */

const crypto     = require('crypto');
const os         = require('os');
const jwt        = require('jsonwebtoken');
const mongoose   = require('mongoose');
const Event      = require('../models/Event');
const Feedback   = require('../models/Feedback');
const Attendance = require('../models/Attendance');
const AuditLog   = require('../models/AuditLog');
const { AppError } = require('../middleware/errorHandler');
const cache        = require('./cacheService');
const { withTransaction } = require('../utils/transaction');

/** Public fields returned for event lists */
const PUBLIC_FIELDS = 'title date startTime endTime category venue description attendanceEnabled banner totalAttendees totalResponses avgRating';

/**
 * Get local network IP dynamically so QR codes work on mobile devices
 */
const getLocalIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

/**
 * Log an audit action asynchronously.
 */
const logAudit = async (userId, userModel, action, targetId, targetModel, metadata = {}, ip = '') => {
  try {
    // Fire and forget
    AuditLog.create({
      userId,
      userModel,
      action,
      targetId,
      targetModel,
      metadata,
      ip
    }).catch(err => console.error('Audit Log failed:', err.message));
  } catch (error) {
    console.error('Audit Log failed synchronously:', error.message);
  }
};

/**
 * List all active events — public endpoint.
 */
const listEvents = async ({ page = 1, limit = 20 } = {}) => {
  page  = Math.max(1, parseInt(page));
  limit = Math.min(50, parseInt(limit));
  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    Event.find({ isDeleted: false })
      .select(PUBLIC_FIELDS)
      .populate('ownerId', 'name email')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Event.countDocuments({ isDeleted: false }),
  ]);

  return { events, total, page, pages: Math.ceil(total / limit) };
};

/**
 * Get organizer-owned active events.
 */
const getOrganizerEventList = async (ownerId) => {
  return Event.find({ ownerId, isDeleted: false })
    .select('_id title date category totalAttendees totalResponses avgRating npsScore attendanceEnabled')
    .sort({ date: -1 })
    .lean();
};

/**
 * Get a single active event — organizer must own it.
 */
const getById = async (eventId, ownerId) => {
  const event = await Event.findOne({ _id: eventId, isDeleted: false }).lean();
  if (!event) throw new AppError('Event not found or deleted', 404);
  if (event.ownerId.toString() !== ownerId.toString()) {
    throw new AppError('Forbidden — you do not own this event', 403);
  }
  return event;
};

/**
 * Create a new event with automatic QR/Token generation.
 */
const create = async (data, ownerId, ip = '') => {
  const generationId = crypto.randomBytes(8).toString('hex');
  const eventId = new mongoose.Types.ObjectId();
  
  const signedToken = jwt.sign(
    { eventId: eventId.toString(), generationId },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  const attendanceLink = `/attendance.html?eventId=${eventId.toString()}&token=${encodeURIComponent(signedToken)}`;
  const isVercel = process.env.VERCEL === '1';
  const baseUrl = process.env.FRONTEND_URL || (isVercel ? 'https://eventpulse-blue.vercel.app' : `http://${getLocalIp()}:5000`);
  const fullUrl = `${baseUrl}${attendanceLink}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(fullUrl)}`;

  const event = await Event.create({ 
    ...data, 
    _id: eventId,
    ownerId,
    attendanceToken: generationId,
    qrCode: qrCodeUrl,
    attendanceLink,
  });

  _bustOrganizerCache(ownerId);
  logAudit(ownerId, 'Organizer', 'CREATE_EVENT', event._id, 'Event', { title: data.title }, ip);
  
  return event;
};

/**
 * Update an event's allowed fields.
 */
const update = async (eventId, ownerId, updates, ip = '') => {
  const event = await Event.findOne({ _id: eventId, isDeleted: false });
  if (!event) throw new AppError('Event not found or deleted', 404);
  if (event.ownerId.toString() !== ownerId.toString()) {
    throw new AppError('Forbidden — you do not own this event', 403);
  }

  const allowed = ['title', 'date', 'startTime', 'endTime', 'category', 'description', 'venue', 'attendanceEnabled', 'banner'];
  let updated = false;
  allowed.forEach((f) => { 
    if (updates[f] !== undefined) {
      event[f] = updates[f]; 
      updated = true;
    }
  });

  if (updated) {
    // Bump cache version
    event.cacheVersion = (event.cacheVersion || 1) + 1;
    await event.save();
    _bustOrganizerCache(ownerId);
    logAudit(ownerId, 'Organizer', 'UPDATE_EVENT', event._id, 'Event', { updates: Object.keys(updates) }, ip);
  }
  
  return event;
};

/**
 * Soft Delete an event using MongoDB Transactions.
 */
const remove = async (eventId, ownerId, ip = '') => {
  const event = await Event.findOne({ _id: eventId, isDeleted: false });
  if (!event) throw new AppError('Event not found or already deleted', 404);
  if (event.ownerId.toString() !== String(ownerId)) throw new AppError('Forbidden', 403);

  const now = new Date();

  await withTransaction(async (session) => {
    const opts = session ? { session } : {};
    event.isDeleted = true;
    event.deletedAt = now;
    await event.save(opts);

    await Feedback.updateMany(
      { eventId: event._id },
      { $set: { isDeleted: true, deletedAt: now } },
      opts
    );

    await Attendance.updateMany(
      { eventId: event._id },
      { $set: { isDeleted: true, deletedAt: now } },
      opts
    );
  });

  _bustOrganizerCache(ownerId);
  logAudit(ownerId, 'Organizer', 'SOFT_DELETE_EVENT', event._id, 'Event', {}, ip);
};

/**
 * Regenerate QR and invalidate old token.
 */
const regenerateQR = async (eventId, ownerId, ip = '') => {
  const event = await Event.findOne({ _id: eventId, isDeleted: false });
  if (!event) throw new AppError('Event not found', 404);
  if (event.ownerId.toString() !== ownerId.toString()) {
    throw new AppError('Forbidden — you do not own this event', 403);
  }

  // Create a new generation seed to invalidate old tokens
  const generationId = crypto.randomBytes(8).toString('hex');
  event.attendanceToken = generationId;
  
  // Sign a tamper-proof, expiring JWT (valid for 30 days)
  const signedToken = jwt.sign(
    { eventId: event._id.toString(), generationId },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  const attendanceLinkRegen = `/attendance.html?eventId=${event._id}&token=${encodeURIComponent(signedToken)}`;
  const isVercel = process.env.VERCEL === '1';
  const baseUrlRegen = process.env.FRONTEND_URL || (isVercel ? 'https://eventpulse-blue.vercel.app' : `http://${getLocalIp()}:5000`);
  const fullUrlRegen = `${baseUrlRegen}${attendanceLinkRegen}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(fullUrlRegen)}`;

  event.qrCode = qrCodeUrl;
  event.attendanceLink = attendanceLinkRegen;
  event.cacheVersion = (event.cacheVersion || 1) + 1;
  await event.save();

  _bustOrganizerCache(ownerId);
  logAudit(ownerId, 'Organizer', 'REGENERATE_QR', event._id, 'Event', {}, ip);

  return event;
};

/** Internal: invalidate all cached data for this organizer */
const _bustOrganizerCache = (organizerId) => {
  cache.del(cache.dashboardKey(organizerId));
  cache.del(cache.reportKey(organizerId));
  cache.del(cache.aiKey(organizerId));
};

module.exports = { listEvents, getOrganizerEventList, getById, create, update, remove, regenerateQR, logAudit };
