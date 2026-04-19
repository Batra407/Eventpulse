/**
 * attendanceController.js — HTTP layer for attendance routes.
 */

const Attendance = require('../models/Attendance');
const Event = require('../models/Event');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../middleware/errorHandler');

/** POST /api/attendance — Mark attendance (public, from QR scan or manual) */
const markAttendance = async (req, res) => {
  const { eventId, name, rollNo, method } = req.body;

  if (!eventId || !name || !rollNo) {
    throw new AppError('eventId, name, and rollNo are required', 400);
  }

  // Verify event exists and attendance is enabled
  const event = await Event.findById(eventId).lean();
  if (!event) throw new AppError('Event not found', 404);
  if (!event.enableAttendance) {
    throw new AppError('Attendance is not enabled for this event', 403);
  }

  // Check duplicate
  const existing = await Attendance.findOne({ eventId, rollNo: rollNo.toUpperCase() });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'Already marked',
      alreadyMarked: true,
      data: { markedAt: existing.markedAt },
    });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const record = await Attendance.create({
    eventId,
    name: name.trim(),
    rollNo: rollNo.trim().toUpperCase(),
    method: method || 'qr',
    ip,
  });

  sendSuccess(res, 'Attendance marked successfully', {
    name: record.name,
    rollNo: record.rollNo,
    markedAt: record.markedAt,
  }, 201);
};

/** GET /api/attendance/:eventId — List attendees for an event (organizer only) */
const getAttendance = async (req, res) => {
  const { eventId } = req.params;

  // Verify ownership
  const event = await Event.findById(eventId).lean();
  if (!event) throw new AppError('Event not found', 404);
  if (String(event.createdBy) !== String(req.organizer.id)) {
    throw new AppError('Forbidden — you do not own this event', 403);
  }

  const records = await Attendance.find({ eventId })
    .sort({ markedAt: 1 })
    .lean();

  sendSuccess(res, 'Attendance records retrieved', {
    eventId,
    eventName: event.name,
    total: records.length,
    attendees: records,
  });
};

/** DELETE /api/attendance/:eventId/:rollNo — Remove single record (organizer only) */
const removeAttendee = async (req, res) => {
  const { eventId, rollNo } = req.params;

  const event = await Event.findById(eventId).lean();
  if (!event) throw new AppError('Event not found', 404);
  if (String(event.createdBy) !== String(req.organizer.id)) {
    throw new AppError('Forbidden — you do not own this event', 403);
  }

  await Attendance.deleteOne({ eventId, rollNo: rollNo.toUpperCase() });
  sendSuccess(res, 'Attendee removed');
};

module.exports = { markAttendance, getAttendance, removeAttendee };
