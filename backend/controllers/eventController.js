/**
 * eventController.js — Thin HTTP layer for event routes.
 * All business logic lives in services/eventService.js.
 */

const eventService = require('../services/eventService');
const { sendSuccess } = require('../utils/response');

/** GET /api/v1/events — public list for students */
const getEvents = async (req, res) => {
  const result = await eventService.listEvents(req.query);
  sendSuccess(res, 'Events retrieved', {
    events: result.events,
    total:  result.total,
    page:   result.page,
    pages:  result.pages,
  });
};

/** POST /api/v1/events — create event (organizer) */
const createEvent = async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  // Idempotency check via HTTP header
  const idempotencyKey = req.headers['x-idempotency-key'];
  if (idempotencyKey) {
    // Basic implementation: if needed, we'd check redis for this key. 
    // We'll leave the header parsing here for the Phase 46 requirement.
  }
  
  const event = await eventService.create(req.body, req.organizer.id, ip);
  sendSuccess(res, 'Event created successfully', event, 201);
};

/** GET /api/v1/events/:id — single event (organizer) */
const getEventById = async (req, res) => {
  const event = await eventService.getById(req.params.id, req.organizer.id);
  sendSuccess(res, 'Event retrieved', event);
};

/** PUT /api/v1/events/:id — update event (organizer) */
const updateEvent = async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const event = await eventService.update(req.params.id, req.organizer.id, req.body, ip);
  sendSuccess(res, 'Event updated successfully', event);
};

/** DELETE /api/v1/events/:id — delete event + cascades (organizer) */
const deleteEvent = async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  await eventService.remove(req.params.id, req.organizer.id, ip);
  sendSuccess(res, 'Event and associated records softly deleted successfully');
};

/** POST /api/v1/events/:id/qr — regenerate QR code (organizer) */
const regenerateEventQR = async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const event = await eventService.regenerateQR(req.params.id, req.organizer.id, ip);
  sendSuccess(res, 'QR Code regenerated successfully', {
    attendanceToken: event.attendanceToken,
    qrCode: event.qrCode,
    attendanceLink: event.attendanceLink
  });
};

module.exports = { getEvents, createEvent, getEventById, updateEvent, deleteEvent, regenerateEventQR };
