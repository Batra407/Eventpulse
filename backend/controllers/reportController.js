/**
 * reportController.js — Thin HTTP layer for full report route.
 * Adds caching on top of analytics + AI service (120-second TTL).
 */

const Feedback   = require('../models/Feedback');
const { getOrganizerEvents, buildAnalytics } = require('../services/analyticsService');
const { generateAIAnalysis } = require('../services/aiService');
const cache = require('../services/cacheService');
const { sendSuccess } = require('../utils/response');

/** GET /api/report — full analytics + AI summary (cached) */
const getReport = async (req, res) => {
  const organizerId = req.organizer.id;
  const cacheKey    = cache.reportKey(organizerId);

  const cached = cache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return sendSuccess(res, 'Report generated', cached);
  }

  const { events, eventIds } = await getOrganizerEvents(organizerId);

  if (eventIds.length === 0) {
    const empty = {
      totalEvents: 0,
      generatedAt: new Date().toISOString(),
      stats: { totalResponses: 0, avgRating: 0, avgNPS: 0, avgContent: 0 },
      categoryDistribution: [],
      ratingDistribution: [],
      aiSummary: 'No data available.',
      topSuggestions: [],
      allFeedback: [],
    };
    return sendSuccess(res, 'Report generated', empty);
  }

  const [analytics, aiAnalysis, feedbacks] = await Promise.all([
    buildAnalytics(eventIds),
    generateAIAnalysis(eventIds),
    Feedback.find({ eventId: { $in: eventIds } })
      .select('eventId rating nps contentScore categories comment suggestion email createdAt')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const eventMap = Object.fromEntries(events.map((e) => [e._id.toString(), e.name]));
  const enrichedFeedback = feedbacks.map((f) => ({
    ...f,
    eventName: eventMap[f.eventId.toString()] || 'Unknown Event',
  }));

  const payload = {
    totalEvents: events.length,
    generatedAt: new Date().toISOString(),
    events,
    ...analytics,
    aiSummary:    aiAnalysis.summary,
    topSuggestions: aiAnalysis.topSuggestions,
    allFeedback:  enrichedFeedback,
  };

  cache.set(cacheKey, payload, cache.REPORT_TTL);
  res.setHeader('X-Cache', 'MISS');
  sendSuccess(res, 'Report generated', payload);
};

module.exports = { getReport };
