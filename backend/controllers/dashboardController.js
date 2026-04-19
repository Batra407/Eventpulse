/**
 * dashboardController.js — Thin HTTP layer for dashboard route.
 * Adds caching on top of the analytics service (60-second TTL).
 */

const { getOrganizerEvents, buildAnalytics } = require('../services/analyticsService');
const cache = require('../services/cacheService');
const { sendSuccess } = require('../utils/response');

/** GET /api/dashboard — organizer's aggregate analytics (cached) */
const getDashboard = async (req, res) => {
  const organizerId = req.organizer.id;
  const cacheKey    = cache.dashboardKey(organizerId);

  // Attempt cache hit first
  const cached = cache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return sendSuccess(res, 'Dashboard data retrieved', cached);
  }

  const { events, eventIds } = await getOrganizerEvents(organizerId);

  let payload;
  if (eventIds.length === 0) {
    payload = {
      totalEvents: 0,
      events: [],
      stats: { totalResponses: 0, avgRating: 0, avgNPS: 0, avgContent: 0 },
      categoryDistribution: [],
      ratingDistribution: [],
    };
  } else {
    const analytics = await buildAnalytics(eventIds);
    payload = { totalEvents: events.length, events, ...analytics };
  }

  // Cache for 60 seconds
  cache.set(cacheKey, payload, cache.DASHBOARD_TTL);
  res.setHeader('X-Cache', 'MISS');
  sendSuccess(res, 'Dashboard data retrieved', payload);
};

module.exports = { getDashboard };
