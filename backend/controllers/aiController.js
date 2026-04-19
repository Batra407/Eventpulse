/**
 * aiController.js — AI insights endpoint.
 * Serves full intelligence payload: summary, sentiment, keywords,
 * suggestions, health score, and trend. Cached at 120s TTL.
 */

const { getOrganizerEvents, buildAnalytics } = require('../services/analyticsService');
const { generateAIAnalysis } = require('../services/aiService');
const cache = require('../services/cacheService');
const { sendSuccess } = require('../utils/response');

/** GET /api/ai/summary — Full AI intelligence payload (cached) */
const getAISummary = async (req, res) => {
  const organizerId = req.organizer.id;
  const cacheKey    = cache.aiKey(organizerId);

  const cached = cache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return sendSuccess(res, 'AI insights retrieved', cached);
  }

  // Fetch stats + events in parallel (analytics always run fresh here)
  const { eventIds } = await getOrganizerEvents(organizerId);
  const analytics    = eventIds.length ? await buildAnalytics(eventIds) : null;
  const stats        = analytics?.stats || {};

  const analysis = await generateAIAnalysis(eventIds, stats);

  // Merge sentiment distribution from analytics aggregation
  // (uses stored DB values — more accurate than recounting from text)
  if (analytics?.sentimentDistribution) {
    analysis.sentimentDistribution = analytics.sentimentDistribution;
  }

  cache.set(cacheKey, analysis, cache.AI_TTL);
  res.setHeader('X-Cache', 'MISS');
  sendSuccess(res, 'AI insights generated', analysis);
};

module.exports = { getAISummary };
