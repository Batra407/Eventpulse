/**
 * feedbackService.js — Feedback business logic layer.
 *
 * Stores `sentiment` field at submission time for fast analytics.
 * Busts dashboard/report/AI cache on every new submission.
 */

const Feedback   = require('../models/Feedback');
const Event      = require('../models/Event');
const { AppError }        = require('../middleware/errorHandler');
const cache               = require('./cacheService');
const { getSentimentLabel } = require('./aiService');

/**
 * Submit feedback for an event (public — no auth required).
 * Auto-classifies sentiment and stores it.
 */
const submit = async (payload) => {
  const { eventId, rating, contentScore, nps, categories, comment, suggestion, email } = payload;

  const event = await Event.findById(eventId).select('_id createdBy').lean();
  if (!event) throw new AppError('Event not found', 404);

  // Classify sentiment at write-time for fast read queries
  const sentiment = getSentimentLabel(rating, comment || '');

  const feedback = await Feedback.create({
    eventId,
    rating,
    contentScore,
    nps,
    categories: categories || [],
    comment,
    suggestion,
    email,
    sentiment,
  });

  // Bust the organizer's cached data
  const organizerId = event.createdBy.toString();
  cache.del(cache.dashboardKey(organizerId));
  cache.del(cache.reportKey(organizerId));
  cache.del(cache.aiKey(organizerId));

  return feedback;
};

/**
 * Get paginated feedback for a specific event.
 */
const getByEvent = async (eventId, organizerId, { page = 1, limit = 50 } = {}) => {
  page  = Math.max(1, parseInt(page));
  limit = Math.min(100, parseInt(limit));
  const skip = (page - 1) * limit;

  const event = await Event.findById(eventId).select('createdBy').lean();
  if (!event) throw new AppError('Event not found', 404);
  if (event.createdBy.toString() !== organizerId) {
    throw new AppError('Forbidden — you do not own this event', 403);
  }

  const [feedbacks, total] = await Promise.all([
    Feedback.find({ eventId })
      .select('rating contentScore nps categories comment suggestion email sentiment createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Feedback.countDocuments({ eventId }),
  ]);

  return { feedbacks, total, page, pages: Math.ceil(total / limit) };
};

module.exports = { submit, getByEvent };
