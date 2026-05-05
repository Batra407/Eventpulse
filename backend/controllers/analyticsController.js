const Feedback = require('../models/Feedback');
const { getOrganizerEvents } = require('../services/analyticsService');

/**
 * Analytics controller — all endpoints scoped to the authenticated organizer's events.
 * Fixes the previous security gap where analytics queried ALL feedback globally.
 */

// @desc   Total responses, avg rating, avg NPS (organizer-scoped)
// @route  GET /api/analytics/summary
const getSummary = async (req, res) => {
  const { eventIds } = await getOrganizerEvents(req.organizer.id);

  if (!eventIds.length) {
    return res.status(200).json({
      success: true,
      data: { totalResponses: 0, avgRating: 0, avgNPS: 0 },
    });
  }

  const result = await Feedback.aggregate([
    { $match: { eventId: { $in: eventIds } } },
    {
      $group: {
        _id: null,
        totalResponses: { $sum: 1 },
        avgRating:      { $avg: '$overallRating' },
        avgNPS:         { $avg: '$recommendationScore' },
      },
    },
    {
      $project: {
        _id: 0,
        totalResponses: 1,
        avgRating: { $round: ['$avgRating', 2] },
        avgNPS:    { $round: ['$avgNPS', 2] },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: result[0] || { totalResponses: 0, avgRating: 0, avgNPS: 0 },
  });
};

// @desc   Frequency count of each category (organizer-scoped)
// @route  GET /api/analytics/categories
const getCategories = async (req, res) => {
  const { eventIds } = await getOrganizerEvents(req.organizer.id);

  const result = await Feedback.aggregate([
    { $match: { eventId: { $in: eventIds } } },
    { $unwind: '$selectedTags' },
    { $group: { _id: '$selectedTags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { _id: 0, category: '$_id', count: 1 } },
  ]);

  res.status(200).json({ success: true, data: result });
};

// @desc   Count of each star rating 1–5 (organizer-scoped)
// @route  GET /api/analytics/ratings
const getRatings = async (req, res) => {
  const { eventIds } = await getOrganizerEvents(req.organizer.id);

  const result = await Feedback.aggregate([
    { $match: { eventId: { $in: eventIds } } },
    { $group: { _id: '$overallRating', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, rating: '$_id', count: 1 } },
  ]);

  const map = Object.fromEntries(result.map((r) => [r.rating, r.count]));
  const data = [1, 2, 3, 4, 5].map((star) => ({ rating: star, count: map[star] || 0 }));

  res.status(200).json({ success: true, data });
};

module.exports = { getSummary, getCategories, getRatings };
