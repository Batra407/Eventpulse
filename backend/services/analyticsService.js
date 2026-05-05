/**
 * analyticsService.js — Core analytics aggregation layer.
 * Enterprise Refactor: Hybrid Strategy (reads stats from Event model, aggregates only distributions).
 */

const Event    = require('../models/Event');
const Feedback = require('../models/Feedback');

/**
 * Get all event IDs and basic info for a specific organizer.
 */
const getOrganizerEvents = async (ownerId) => {
  const events = await Event.find({ ownerId, isDeleted: false })
    .select('_id title date category totalResponses totalAttendees avgRating npsScore attendanceEnabled attendanceToken attendanceLink qrCode cacheVersion')
    .sort({ date: -1 })
    .lean();

  return {
    events,
    eventIds: events.map((e) => e._id),
  };
};

/**
 * Build a complete analytics object for a given set of events.
 * Uses a Hybrid Strategy: Basic stats are aggregated from the pre-calculated Event model fields.
 * Only deep distributions (charts) use the aggregation pipeline.
 *
 * @param {Array} events - Pre-fetched event objects from getOrganizerEvents
 * @returns {Promise<Object>} { stats, categoryDistribution, ratingDistribution, sentimentDistribution }
 */
const buildAnalytics = async (events) => {
  const eventIds = events.map(e => e._id);
  
  if (!eventIds.length) {
    return _emptyAnalytics();
  }

  // Hybrid Stats: Aggregate from the already calculated Event fields (O(N) where N = number of events, very fast)
  let totalResponses = 0;
  let totalAttendees = 0;
  let sumRating = 0;
  let sumNPS = 0;

  events.forEach(e => {
    totalResponses += e.totalResponses || 0;
    totalAttendees += e.totalAttendees || 0;
    sumRating += (e.avgRating || 0) * (e.totalResponses || 0);
    sumNPS += (e.npsScore || 0) * (e.totalResponses || 0);
  });

  const stats = {
    totalResponses,
    totalAttendees,
    avgRating: totalResponses > 0 ? Number((sumRating / totalResponses).toFixed(2)) : 0,
    avgNPS: totalResponses > 0 ? Number((sumNPS / totalResponses).toFixed(2)) : 0,
  };

  const matchStage = { $match: { eventId: { $in: eventIds }, isDeleted: false } };

  // Run aggregations ONLY for chart distributions
  const [categoryAgg, ratingAgg, sentimentAgg] = await Promise.all([
    // 1. Tag distribution
    Feedback.aggregate([
      matchStage,
      { $unwind: '$selectedTags' },
      { $group: { _id: '$selectedTags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, category: '$_id', count: 1 } },
    ]),

    // 2. Rating distribution (1-5)
    Feedback.aggregate([
      matchStage,
      { $group: { _id: '$overallRating', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, rating: '$_id', count: 1 } },
    ]),

    // 3. Sentiment distribution
    Feedback.aggregate([
      matchStage,
      { $group: { _id: '$sentiment', count: { $sum: 1 } } },
      { $project: { _id: 0, label: '$_id', count: 1 } },
    ]),
  ]);

  // Fill missing rating values
  const ratingMap = Object.fromEntries(ratingAgg.map((r) => [r.rating, r.count]));
  const ratingDistribution = [1, 2, 3, 4, 5].map((star) => ({
    rating: star,
    count: ratingMap[star] || 0,
  }));

  // Fill missing sentiment values with percent
  const total = stats.totalResponses || 1;
  const sentimentMap = Object.fromEntries((sentimentAgg || []).map((s) => [s.label, s.count]));
  const sentimentDistribution = ['positive', 'neutral', 'negative'].map((label) => ({
    label,
    count:   sentimentMap[label] || 0,
    percent: Math.round(((sentimentMap[label] || 0) / total) * 100),
  }));

  return { stats, categoryDistribution: categoryAgg, ratingDistribution, sentimentDistribution };
};

const _emptyAnalytics = () => ({
  stats:                { totalResponses: 0, totalAttendees: 0, avgRating: 0, avgNPS: 0 },
  categoryDistribution: [],
  ratingDistribution:   [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: 0 })),
  sentimentDistribution: [
    { label: 'positive', count: 0, percent: 0 },
    { label: 'neutral',  count: 0, percent: 0 },
    { label: 'negative', count: 0, percent: 0 },
  ],
});

module.exports = { getOrganizerEvents, buildAnalytics };
