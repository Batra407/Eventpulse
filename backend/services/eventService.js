/**
 * eventService.js — Event business logic layer.
 *
 * Keeps the controller thin. All database access and ownership
 * checks live here. Cache is busted on create/update/delete.
 */

const Event      = require('../models/Event');
const Feedback   = require('../models/Feedback');
const { AppError } = require('../middleware/errorHandler');
const cache        = require('./cacheService');

/** Public fields returned for event lists */
const PUBLIC_FIELDS = 'name date category venue description enableAttendance';

/**
 * List all events — public endpoint for students.
 */
const listEvents = async ({ page = 1, limit = 20 } = {}) => {
  page  = Math.max(1, parseInt(page));
  limit = Math.min(50, parseInt(limit));
  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    Event.find()
      .select(PUBLIC_FIELDS)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Event.countDocuments(),
  ]);

  return { events, total, page, pages: Math.ceil(total / limit) };
};

/**
 * Get organizer-owned events (for dashboard/reports).
 * Includes _id for internal usage.
 */
const getOrganizerEventList = async (organizerId) => {
  return Event.find({ createdBy: organizerId })
    .select('_id name date category')
    .sort({ date: -1 })
    .lean();
};

/**
 * Get a single event — organizer must own it.
 */
const getById = async (eventId, organizerId) => {
  const event = await Event.findById(eventId).lean();
  if (!event) throw new AppError('Event not found', 404);
  if (event.createdBy.toString() !== organizerId) {
    throw new AppError('Forbidden — you do not own this event', 403);
  }
  return event;
};

/**
 * Create a new event; busts organizer dashboard/report cache.
 */
const create = async (data, organizerId) => {
  const event = await Event.create({ ...data, createdBy: organizerId });
  _bustOrganizerCache(organizerId);
  return event;
};

/**
 * Update an event's allowed fields; busts cache.
 */
const update = async (eventId, organizerId, updates) => {
  const event = await Event.findById(eventId);
  if (!event) throw new AppError('Event not found', 404);
  if (event.createdBy.toString() !== organizerId) {
    throw new AppError('Forbidden — you do not own this event', 403);
  }

  const allowed = ['name', 'date', 'category', 'description', 'venue', 'enableAttendance'];
  allowed.forEach((f) => { if (updates[f] !== undefined) event[f] = updates[f]; });

  await event.save();
  _bustOrganizerCache(organizerId);
  return event;
};

/**
 * Delete an event and cascade-delete its feedback; busts cache.
 */
const remove = async (eventId, organizerId) => {
  const event = await Event.findById(eventId);
  if (!event) throw new AppError('Event not found', 404);
  if (event.createdBy.toString() !== organizerId) {
    throw new AppError('Forbidden — you do not own this event', 403);
  }

  await Promise.all([
    Feedback.deleteMany({ eventId: event._id }),
    event.deleteOne(),
  ]);

  _bustOrganizerCache(organizerId);
};

/** Internal: invalidate all cached data for this organizer */
const _bustOrganizerCache = (organizerId) => {
  cache.del(cache.dashboardKey(organizerId));
  cache.del(cache.reportKey(organizerId));
  cache.del(cache.aiKey(organizerId));
};

module.exports = { listEvents, getOrganizerEventList, getById, create, update, remove };
