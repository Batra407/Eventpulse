/**
 * historyController.js — Thin HTTP layer for history route.
 */

const Feedback   = require('../models/Feedback');
const { getOrganizerEvents } = require('../services/analyticsService');
const { AppError }           = require('../middleware/errorHandler');
const { sendSuccess }        = require('../utils/response');

/** GET /api/history — paginated, filtered feedback history */
const getHistory = async (req, res) => {
  const { start, end, search, page: qPage, limit: qLimit } = req.query;

  const page  = Math.max(1, parseInt(qPage)  || 1);
  const limit = Math.min(100, parseInt(qLimit) || 50);
  const skip  = (page - 1) * limit;

  const { events, eventIds } = await getOrganizerEvents(req.organizer.id);

  if (eventIds.length === 0) {
    return sendSuccess(res, 'No history found', { feedbacks: [], total: 0, page, pages: 0 });
  }

  const query = { eventId: { $in: eventIds } };

  if (start || end) {
    query.createdAt = {};
    if (start) {
      const startDate = new Date(start);
      if (isNaN(startDate)) throw new AppError('Invalid start date format', 400);
      startDate.setHours(0, 0, 0, 0);
      query.createdAt.$gte = startDate;
    }
    if (end) {
      const endDate = new Date(end);
      if (isNaN(endDate)) throw new AppError('Invalid end date format', 400);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endDate;
    }
  }

  if (search?.trim()) {
    const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ comment: regex }, { suggestion: regex }];
  }

  const [feedbacks, total] = await Promise.all([
    Feedback.find(query)
      .select('eventId rating nps contentScore categories comment suggestion email createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Feedback.countDocuments(query),
  ]);

  const eventMap = Object.fromEntries(events.map((e) => [e._id.toString(), e.name]));
  const enriched = feedbacks.map((f) => ({
    ...f,
    eventName: eventMap[f.eventId.toString()] || 'Unknown Event',
  }));

  sendSuccess(res, 'History retrieved', {
    feedbacks: enriched,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
};

module.exports = { getHistory };
