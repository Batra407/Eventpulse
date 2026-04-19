const Feedback = require('../models/Feedback');

/**
 * analytics.js — Shared aggregation helpers
 *
 * All functions accept an array of eventIds (belonging to the requesting organizer)
 * to enforce strict multi-tenant data isolation.
 */

/**
 * Build a complete analytics object for a given set of event IDs.
 * Uses a single aggregation pass to compute all metrics efficiently.
 *
 * @param {ObjectId[]} eventIds
 * @returns {Promise<Object>} analytics payload
 */
const buildAnalytics = async (eventIds) => {
  const matchStage = { $match: { eventId: { $in: eventIds } } };

  // ── 1. Core stats (one $group pass) ──────────────────────────────────────
  const [statsResult] = await Feedback.aggregate([
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
  ]);

  const stats = statsResult || {
    totalResponses: 0,
    avgRating: 0,
    avgNPS: 0,
    avgContent: 0,
  };

  // ── 2. Category distribution ──────────────────────────────────────────────
  const categoryDistribution = await Feedback.aggregate([
    matchStage,
    { $unwind: '$categories' },
    { $group: { _id: '$categories', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { _id: 0, category: '$_id', count: 1 } },
  ]);

  // ── 3. Rating distribution (fill missing 1-5 stars) ──────────────────────
  const ratingAgg = await Feedback.aggregate([
    matchStage,
    { $group: { _id: '$rating', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, rating: '$_id', count: 1 } },
  ]);

  const ratingMap = Object.fromEntries(ratingAgg.map((r) => [r.rating, r.count]));
  const ratingDistribution = [1, 2, 3, 4, 5].map((star) => ({
    rating: star,
    count: ratingMap[star] || 0,
  }));

  return { stats, categoryDistribution, ratingDistribution };
};

module.exports = { buildAnalytics };
