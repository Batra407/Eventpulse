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

/** POST /api/v1/attendance — Mark attendance (public, from QR scan) */
const markAttendance = async (req, res) => {
  const { eventId, attendanceToken, attendeeName, attendeeEmail, phone, college, batch, course } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

  const event = await Event.findOne({ _id: eventId, isDeleted: false });
  if (!event) throw new AppError('Event not found or deleted', 404);
  const now = new Date();
  if (event.startTime && now < new Date(event.startTime)) throw new AppError('Attendance is not yet open for this event.', 403);
  if (event.endTime && now > new Date(event.endTime)) throw new AppError('Attendance is closed for this event.', 403);
  if (!event.attendanceEnabled) throw new AppError('Attendance session is currently closed.', 403);
  
  try {
    const decoded = jwt.verify(attendanceToken, process.env.JWT_SECRET);
    if (decoded.eventId !== eventId || decoded.generationId !== event.attendanceToken) throw new AppError('Invalid or expired attendance QR token', 403);
  } catch (err) {
    throw new AppError(err.name === 'TokenExpiredError' ? 'QR code has expired.' : 'Invalid QR token', 403);
  }

  const existing = attendeeEmail ? await Attendance.findOne({ eventId, attendeeEmail }) : null;
  if (existing) throw new AppError('Attendance already marked for this email', 409);

  let record;
  await withTransaction(async (session) => {
    const opts = session ? { session } : {};
    [record] = await Attendance.create([{
      eventId, attendeeName, attendeeEmail, phone, college, organization: college,
      batch, course, attendanceType: 'qr', status: 'checked-in', scannedFromIP: ip,
      deviceInfo: req.headers['user-agent'] || '',
    }], opts);

    event.totalAttendees += 1;
    event.qrAttendees = (event.qrAttendees || 0) + 1;
    event.cacheVersion = (event.cacheVersion || 1) + 1;
    await event.save(opts);
  });

  cache.del(cache.dashboardKey(event.ownerId.toString()));
  logAudit(null, 'Attendance', 'MARK_ATTENDANCE', record._id, 'Attendance', { method: 'QR' }, ip);
  sendSuccess(res, 'Attendance marked successfully', record, 201);
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
      eventId, attendeeName, attendeeEmail, phone, college, organization,
      attendanceType: 'manual', status: status || 'present', submittedBy: req.organizer.id,
    }], opts);

    event.totalAttendees += 1;
    event.manualAttendees = (event.manualAttendees || 0) + 1;
    event.cacheVersion = (event.cacheVersion || 1) + 1;
    await event.save(opts);
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
