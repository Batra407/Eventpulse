/**
 * analyticsService.js — Core analytics aggregation layer.
 * Enterprise Refactor: Hybrid Strategy (reads stats from Event model, aggregates only distributions).
 */

const Event    = require('../models/Event');
const Feedback = require('../models/Feedback');

/**
 * Get all event IDs and basic info for a specific organizer.
 * Also runs a self-heal check: if any event has totalResponses=0 but actual
 * feedback exists in the Feedback collection, recalculate and fix it.
 */
const getOrganizerEvents = async (ownerId) => {
  const events = await Event.find({ ownerId, isDeleted: false })
    .select('_id title date category totalResponses totalAttendees avgRating npsScore attendanceEnabled attendanceToken attendanceLink qrCode cacheVersion')
    .sort({ date: -1 })
    .lean();

  // ── Full self-heal: verify ALL events against actual Feedback collection counts ──
  // This catches both zero-count and under-counted events (e.g. race conditions that
  // left totalResponses=1 when 2 feedbacks actually exist).
  const allEventIds = events.map(e => e._id);

  if (allEventIds.length > 0) {
    // Get the ground-truth count from Feedback collection for every event
    const realCounts = await Feedback.aggregate([
      { $match: { eventId: { $in: allEventIds }, isDeleted: false } },
      {
        $group: {
          _id: '$eventId',
          actualCount:     { $sum: 1 },
          actualAvgRating: { $avg: '$overallRating' },
          actualAvgNPS:    { $avg: '$recommendationScore' },
        }
      }
    ]);

    // Build a lookup map: eventId -> real counts
    const realMap = Object.fromEntries(
      realCounts.map(r => [r._id.toString(), r])
    );

    // Find events whose stored totalResponses doesn't match the ground truth
    const healOps = [];
    events.forEach(e => {
      const real = realMap[e._id.toString()];
      const actualCount = real ? real.actualCount : 0;
      // Heal if stored count differs from real count (including under-counts, not just zeros)
      if ((e.totalResponses || 0) !== actualCount) {
        healOps.push({
          updateOne: {
            filter: { _id: e._id },
            update: {
              $set: {
                totalResponses: actualCount,
                avgRating:      real ? Number((real.actualAvgRating || 0).toFixed(2)) : 0,
                npsScore:       real ? Number((real.actualAvgNPS    || 0).toFixed(2)) : 0,
                cacheVersion:   Date.now(),
              }
            }
          }
        });
        // Patch the in-memory event so the response is immediately correct
        e.totalResponses = actualCount;
        e.avgRating      = real ? Number((real.actualAvgRating || 0).toFixed(2)) : 0;
        e.npsScore       = real ? Number((real.actualAvgNPS    || 0).toFixed(2)) : 0;
      }
    });

    if (healOps.length > 0) {
      // Fire-and-forget the DB fix — don't block the dashboard response
      Event.bulkWrite(healOps).catch(err =>
        console.error('[self-heal] bulkWrite failed:', err.message)
      );
    }
  }

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
