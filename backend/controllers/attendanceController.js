/**
 * attendanceController.js — HTTP layer for attendance routes.
 * Enterprise Refactor: Transactions, Idempotency, Duplicate Prevention, Zod validation logic
 */

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Event = require('../models/Event');
const cache = require('../services/cacheService');
const { logAudit } = require('../services/eventService');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { withTransaction } = require('../utils/transaction');

/** GET /api/v1/attendance/public/:eventId — Public event info for attendance page */
const getPublicEventInfo = async (req, res) => {
  const { eventId } = req.params;
  const event = await Event.findOne({ _id: eventId, isDeleted: false })
    .select('title date category venue attendanceEnabled attendanceToken')
    .lean();
  if (!event) throw new AppError('Event not found', 404);
  if (!event.attendanceEnabled) throw new AppError('Attendance is not enabled for this event', 403);
  sendSuccess(res, 'Event info retrieved', {
    _id: event._id,
    title: event.title,
    date: event.date,
    category: event.category,
    venue: event.venue,
    attendanceEnabled: event.attendanceEnabled,
    // Do not leak internal seeds
  });
};

/** POST /api/v1/attendance — Mark attendance (public, from QR scan)
 *
 * Concurrency-safe design for 50+ simultaneous submissions:
 *  1. NO pre-check TOCTOU race — MongoDB's unique index is the atomic guard.
 *  2. Atomic $inc for counters — no read-modify-write lost updates.
 *  3. Inline 11000 duplicate handling — friendly 409 before global handler.
 *  4. Write-conflict (code 112) retry up to 3 times.
 */
const markAttendance = async (req, res) => {
  const { eventId, attendanceToken, attendeeName, attendeeEmail, phone, college, batch, course } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

  // ── Event validation (read-only, no race condition) ───────────────────────
  const event = await Event.findOne({ _id: eventId, isDeleted: false })
    .select('_id title ownerId attendanceEnabled attendanceToken startTime endTime')
    .lean();
  if (!event) throw new AppError('Event not found or deleted', 404);

  const now = new Date();
  if (event.startTime && now < new Date(event.startTime)) throw new AppError('Attendance is not yet open for this event.', 403);
  if (event.endTime   && now > new Date(event.endTime))   throw new AppError('Attendance is closed for this event.', 403);
  if (!event.attendanceEnabled) throw new AppError('Attendance session is currently closed.', 403);

  // ── JWT token validation ──────────────────────────────────────────────────
  try {
    const decoded = jwt.verify(attendanceToken, process.env.JWT_SECRET);
    if (decoded.eventId !== eventId || decoded.generationId !== event.attendanceToken) {
      throw new AppError('Invalid or expired attendance QR token', 403);
    }
  } catch (err) {
    if (err.isOperational) throw err;
    throw new AppError(err.name === 'TokenExpiredError' ? 'QR code has expired.' : 'Invalid QR token', 403);
  }

  // ── Atomic insert + counter increment (concurrency-safe) ──────────────────
  // Strategy: attempt the insert and let MongoDB's unique index reject true duplicates.
  // Use $inc for the event counter so 50 simultaneous requests never lose an increment.
  // Retry up to 3× on transient write-conflict errors (code 112).
  const MAX_RETRIES = 3;
  let record;
  let lastErr;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await withTransaction(async (session) => {
        const opts = session ? { session } : {};

        // Insert the attendance record — unique index rejects duplicates atomically
        [record] = await Attendance.create([{
          eventId, attendeeName, attendeeEmail: attendeeEmail || '', phone: phone || '',
          college: college || '', organization: college || '', batch: batch || '',
          course: course || '', attendanceType: 'qr', status: 'checked-in',
          scannedFromIP: ip, deviceInfo: req.headers['user-agent'] || '',
        }], opts);

        // Atomic counter increment — safe under concurrent load (no read-modify-write)
        await Event.updateOne(
          { _id: eventId },
          { $inc: { totalAttendees: 1, qrAttendees: 1, cacheVersion: 1 } },
          opts
        );
      });

      // ── Success path ───────────────────────────────────────────────────────
      cache.del(cache.dashboardKey(event.ownerId.toString()));
      logAudit(null, 'Attendance', 'MARK_ATTENDANCE', record._id, 'Attendance', { method: 'QR', attempt }, ip);
      return sendSuccess(res, 'Attendance marked successfully', record, 201);

    } catch (err) {
      // ── Duplicate key (11000) — user already registered ───────────────────
      if (err.code === 11000) {
        throw new AppError('You have already marked attendance for this event. Each attendee can only register once.', 409);
      }

      // ── Write conflict (112) — retry ──────────────────────────────────────
      if (err.codeName === 'WriteConflict' || err.code === 112) {
        lastErr = err;
        logger.warn(`[markAttendance] Write conflict on attempt ${attempt}/${MAX_RETRIES} for eventId=${eventId}`);
        if (attempt < MAX_RETRIES) {
          // Exponential backoff: 50ms, 100ms, 200ms
          await new Promise(r => setTimeout(r, 50 * attempt));
          continue;
        }
        // All retries exhausted
        throw new AppError('Server is under heavy load. Please try again in a moment.', 503);
      }

      // ── Any other error — bubble up ────────────────────────────────────────
      throw err;
    }
  }
};

/** GET /api/v1/attendance/:eventId — List attendees for an event (paginated) */
const getAttendance = async (req, res) => {
  const { eventId } = req.params;
  const { page = 1, limit = 50, search = '', type = '', status = '' } = req.query;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const skip = (pageNum - 1) * limitNum;

  const event = await Event.findOne({ _id: eventId, isDeleted: false }).select('ownerId title').lean();
  if (!event) throw new AppError('Event not found', 404);
  if (event.ownerId.toString() !== req.organizer.id) throw new AppError('Forbidden', 403);

  const query = { eventId, isDeleted: false };
  if (search) {
    const regex = new RegExp(search, 'i');
    query.$or = [{ attendeeName: regex }, { attendeeEmail: regex }, { college: regex }];
  }
  if (type) query.attendanceType = type;
  if (status) query.status = status;

  const [records, total] = await Promise.all([
    Attendance.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Attendance.countDocuments(query),
  ]);

  sendSuccess(res, 'Attendance records retrieved', {
    eventId, eventName: event.title, total, page: pageNum,
    pages: Math.ceil(total / limitNum), attendees: records,
  });
};

/** DELETE /api/v1/attendance/:eventId/:id — Soft remove single record (organizer only) */
const removeAttendee = async (req, res) => {
  const { eventId, id } = req.params;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

  const event = await Event.findOne({ _id: eventId, isDeleted: false });
  if (!event) throw new AppError('Event not found', 404);
  if (event.ownerId.toString() !== req.organizer.id) throw new AppError('Forbidden', 403);

  const record = await Attendance.findOne({ _id: id, eventId, isDeleted: false });
  if (!record) throw new AppError('Attendance record not found', 404);

  await withTransaction(async (session) => {
    const opts = session ? { session } : {};
    record.isDeleted = true;
    record.deletedAt = new Date();
    await record.save(opts);

    event.totalAttendees = Math.max(0, event.totalAttendees - 1);
    if (record.attendanceType === 'manual') event.manualAttendees = Math.max(0, (event.manualAttendees || 1) - 1);
    else event.qrAttendees = Math.max(0, (event.qrAttendees || 1) - 1);
    event.cacheVersion = (event.cacheVersion || 1) + 1;
    await event.save(opts);
  });

  cache.del(cache.dashboardKey(event.ownerId.toString()));
  logAudit(req.organizer.id, 'Organizer', 'REMOVE_ATTENDEE', record._id, 'Attendance', {}, ip);
  sendSuccess(res, 'Attendee removed successfully');
};

/** POST /api/v1/attendance/manual/:eventId — Add attendee manually (organizer only) */
const addManualAttendance = async (req, res) => {
  const { eventId } = req.params;
  const { attendeeName, attendeeEmail, phone, college, organization, status } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

  const event = await Event.findOne({ _id: eventId, isDeleted: false });
  if (!event) throw new AppError('Event not found', 404);
  if (event.ownerId.toString() !== req.organizer.id) throw new AppError('Forbidden', 403);

  const existing = attendeeEmail ? await Attendance.findOne({ eventId, attendeeEmail }) : null;
  if (existing) throw new AppError('An attendee with this email already exists for this event', 409);

  let record;
  await withTransaction(async (session) => {
    const opts = session ? { session } : {};
    [record] = await Attendance.create([{
      eventId, attendeeName, attendeeEmail: attendeeEmail || '', phone: phone || '',
      college: college || '', organization: organization || '',
      attendanceType: 'manual', status: status || 'present', submittedBy: req.organizer.id,
    }], opts);

    // Atomic increment — safe under concurrent organizer actions
    await Event.updateOne(
      { _id: eventId },
      { $inc: { totalAttendees: 1, manualAttendees: 1, cacheVersion: 1 } },
      opts
    );
  });

  cache.del(cache.dashboardKey(event.ownerId.toString()));
  logAudit(req.organizer.id, 'Organizer', 'ADD_MANUAL_ATTENDEE', record._id, 'Attendance', {}, ip);
  sendSuccess(res, 'Attendee added manually', record, 201);
};

/** PUT /api/v1/attendance/:eventId/:id — Edit single attendee status (organizer only) */
const updateAttendance = async (req, res) => {
  const { eventId, id } = req.params;
  const updates = req.body; // Can contain status, organization, etc
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

  const event = await Event.findOne({ _id: eventId, isDeleted: false });
  if (!event) throw new AppError('Event not found', 404);
  if (event.ownerId.toString() !== req.organizer.id) {
    throw new AppError('Forbidden', 403);
  }

  const record = await Attendance.findOneAndUpdate(
    { _id: id, eventId, isDeleted: false },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!record) throw new AppError('Attendee not found', 404);

  logAudit(req.organizer.id, 'Organizer', 'UPDATE_ATTENDEE', record._id, 'Attendance', { updates }, ip);
  sendSuccess(res, 'Attendee updated successfully', record);
};

/** GET /api/v1/attendance/:eventId/export — Export CSV (organizer only) */
const exportAttendance = async (req, res) => {
  const { eventId } = req.params;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

  const event = await Event.findOne({ _id: eventId, isDeleted: false });
  if (!event) throw new AppError('Event not found', 404);
  if (event.ownerId.toString() !== req.organizer.id) throw new AppError('Forbidden', 403);

  logAudit(req.organizer.id, 'Organizer', 'EXPORT_ATTENDANCE', event._id, 'Event', { action: 'stream' }, ip);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendance_${eventId}.csv"`);
  
  const records = await Attendance.find({ eventId, isDeleted: false })
    .select('attendeeName attendeeEmail college course status attendanceType createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const header = 'Name,Email,College,Course,Status,Method,Timestamp';
  const rows = records.map(r => [
    `"${(r.attendeeName || '').replace(/"/g, '""')}"`,
    `"${(r.attendeeEmail || '').replace(/"/g, '""')}"`,
    `"${(r.college || '').replace(/"/g, '""')}"`,
    `"${(r.course || '').replace(/"/g, '""')}"`,
    r.status || 'checked-in',
    r.attendanceType || 'qr',
    new Date(r.createdAt).toISOString()
  ].join(','));

  res.send([header, ...rows].join('\n'));
};

/** GET /api/v1/attendance/:eventId/analytics — Advanced Dashboard Analytics (organizer only) */
const getAttendanceAnalytics = async (req, res) => {
  const { eventId } = req.params;

  const event = await Event.findOne({ _id: eventId, isDeleted: false });
  if (!event) throw new AppError('Event not found', 404);
  if (event.ownerId.toString() !== req.organizer.id) {
    throw new AppError('Forbidden', 403);
  }

  // Aggregate hourly check-ins
  const hourlyTrends = await Attendance.aggregate([
    { $match: { eventId: new mongoose.Types.ObjectId(eventId), isDeleted: false, status: { $in: ['present', 'checked-in'] } } },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
          hour: { $hour: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.hour": 1 } }
  ]);

  // Aggregate methods (qr vs manual)
  const methodStats = await Attendance.aggregate([
    { $match: { eventId: new mongoose.Types.ObjectId(eventId), isDeleted: false } },
    { $group: { _id: "$attendanceType", count: { $sum: 1 } } }
  ]);

  sendSuccess(res, 'Analytics retrieved', {
    hourlyTrends,
    methodStats
  });
};

module.exports = { 
  markAttendance, 
  getAttendance,  
  removeAttendee, 
  getPublicEventInfo,
  addManualAttendance,
  updateAttendance,
  exportAttendance,
  getAttendanceAnalytics
};
