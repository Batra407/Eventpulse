/**
 * eventController.js — Thin HTTP layer for event routes.
 * All business logic lives in services/eventService.js.
 */

const eventService = require('../services/eventService');
const { sendSuccess } = require('../utils/response');

/** GET /api/events — public list for students */
const getEvents = async (req, res) => {
  const result = await eventService.listEvents(req.query);
  sendSuccess(res, 'Events retrieved', {
    events: result.events,
    total:  result.total,
    page:   result.page,
    pages:  result.pages,
  });
};

/** POST /api/events — create event (organizer) */
const createEvent = async (req, res) => {
  const event = await eventService.create(req.body, req.organizer.id);
  sendSuccess(res, 'Event created successfully', event, 201);
};

/** GET /api/events/:id — single event (organizer) */
const getEventById = async (req, res) => {
  const event = await eventService.getById(req.params.id, req.organizer.id);
  sendSuccess(res, 'Event retrieved', event);
};

/** PUT /api/events/:id — update event (organizer) */
const updateEvent = async (req, res) => {
  const event = await eventService.update(req.params.id, req.organizer.id, req.body);
  sendSuccess(res, 'Event updated successfully', event);
};

/** DELETE /api/events/:id — delete event + cascades (organizer) */
const deleteEvent = async (req, res) => {
  await eventService.remove(req.params.id, req.organizer.id);
  sendSuccess(res, 'Event and associated feedback deleted successfully');
};

module.exports = { getEvents, createEvent, getEventById, updateEvent, deleteEvent };
