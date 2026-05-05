/**
 * dashboardController.js — Thin HTTP layer for dashboard route.
 * Enterprise Refactor: Implements Cache Versioning and Hybrid Analytics.
 */

const { getOrganizerEvents, buildAnalytics } = require('../services/analyticsService');
const cache = require('../services/cacheService');
const { sendSuccess } = require('../utils/response');

/** GET /api/v1/dashboard — organizer's aggregate analytics (cached) */
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
  if (events.length === 0) {
    payload = {
      totalEvents: 0,
      events: [],
      stats: { totalResponses: 0, totalAttendees: 0, avgRating: 0, avgNPS: 0 },
      categoryDistribution: [],
      ratingDistribution: [],
      sentimentDistribution: [],
      cacheVersion: 1
    };
  } else {
    // Hybrid analytics logic handles aggregations
    const analytics = await buildAnalytics(events);
    // Sum cacheVersion of all events to create a global version key
    const currentVersion = events.reduce((sum, e) => sum + (e.cacheVersion || 1), 0);
    payload = { totalEvents: events.length, events, ...analytics, cacheVersion: currentVersion };
  }

  // Cache for 60 seconds. Feedback and Attendance insertions will manually bust this cache early.
  cache.set(cacheKey, payload, cache.DASHBOARD_TTL);
  res.setHeader('X-Cache', 'MISS');
  sendSuccess(res, 'Dashboard data retrieved', payload);
};

module.exports = { getDashboard };
