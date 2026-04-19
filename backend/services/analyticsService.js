/**
 * analyticsService.js — Core analytics aggregation layer.
 * Shared by dashboard, report, and AI controllers.
 * Scoped strictly to organizer-owned events (multi-tenant safe).
 */

const Event    = require('../models/Event');
const Feedback = require('../models/Feedback');

/**
 * Get all event IDs and basic info for a specific organizer.
 */
const getOrganizerEvents = async (organizerId) => {
  const events = await Event.find({ createdBy: organizerId })
    .select('_id name date category')
    .sort({ date: -1 })
    .lean();

  return {
    events,
    eventIds: events.map((e) => e._id),
  };
};

/**
 * Build a complete analytics object for a given set of event IDs.
 * Uses parallel aggregation pipelines for maximum performance.
 *
 * @param {ObjectId[]} eventIds
 * @returns {Promise<Object>} { stats, categoryDistribution, ratingDistribution, sentimentDistribution }
 */
const buildAnalytics = async (eventIds) => {
  if (!eventIds.length) {
    return {
      stats:                { totalResponses: 0, avgRating: 0, avgNPS: 0, avgContent: 0 },
      categoryDistribution: [],
      ratingDistribution:   [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: 0 })),
      sentimentDistribution: [
        { label: 'positive', count: 0, percent: 0 },
        { label: 'neutral',  count: 0, percent: 0 },
        { label: 'negative', count: 0, percent: 0 },
      ],
    };
  }

  const matchStage = { $match: { eventId: { $in: eventIds } } };

  const [statsResult, categoryDistribution, ratingAgg, sentimentAgg] = await Promise.all([
    // 1. Core stats
    Feedback.aggregate([
      matchStage,
      {
        $group: {
          _id: null,
          totalResponses: { $sum: 1 },
          avgRating:      { $avg: '$rating' },
          avgNPS:         { $avg: '$nps' },
          avgContent:     { $avg: '$contentScore' },
        },
      },
      {
        $project: {
          _id: 0,
          totalResponses: 1,
          avgRating:  { $round: ['$avgRating',  2] },
          avgNPS:     { $round: ['$avgNPS',     2] },
          avgContent: { $round: ['$avgContent', 2] },
        },
      },
    ]),

    // 2. Category distribution
    Feedback.aggregate([
      matchStage,
      { $unwind: '$categories' },
      { $group: { _id: '$categories', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, category: '$_id', count: 1 } },
    ]),

    // 3. Rating distribution (1-5)
    Feedback.aggregate([
      matchStage,
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, rating: '$_id', count: 1 } },
    ]),

    // 4. Sentiment distribution (positive/neutral/negative)
    Feedback.aggregate([
      matchStage,
      { $group: { _id: '$sentiment', count: { $sum: 1 } } },
      { $project: { _id: 0, label: '$_id', count: 1 } },
    ]),
  ]);

  const stats = statsResult[0] || { totalResponses: 0, avgRating: 0, avgNPS: 0, avgContent: 0 };

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

  return { stats, categoryDistribution, ratingDistribution, sentimentDistribution };
};

module.exports = { getOrganizerEvents, buildAnalytics };
