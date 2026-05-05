/**
 * feedbackService.js — Feedback business logic layer.
 * Supports both authenticated (userId) and fully public (anonymous) submissions.
 * Production Hardening: withTransaction fallback for standalone MongoDB compatibility.
 */

const Feedback   = require('../models/Feedback');
const Event      = require('../models/Event');
const { AppError } = require('../middleware/errorHandler');
const cache      = require('./cacheService');
const { getSentimentLabel } = require('./aiService');
const { logAudit } = require('./eventService');
const aiWorker = require('../workers/aiWorker');
const { withTransaction } = require('../utils/transaction');

/**
 * Submit feedback for an event.
 * Atomically saves feedback and updates Event aggregates.
 * Works for both authenticated users (userId provided) and public (anonymous) submissions.
 *
 * @param {Object} payload - Feedback fields
 * @param {string|null} userId  - Authenticated user's ObjectId, or null for public
 * @param {string} ip - Request IP for audit logging
 */
const submit = async (payload, userId, ip = '') => {
  const {
    eventId, overallRating, recommendationScore,
    selectedTags, comments, submitterName, attendeeEmail,
  } = payload;

  // ── Validate event exists ────────────────────────────────────────────────
  const event = await Event.findOne({ _id: eventId, isDeleted: false });
  if (!event) throw new AppError('Event not found or has been deleted', 404);

  // ── Duplicate prevention ─────────────────────────────────────────────────
  // For authenticated users: check by userId
  if (userId) {
    const existing = await Feedback.findOne({ eventId, userId, isDeleted: false });
    if (existing) throw new AppError('You have already submitted feedback for this event', 409);
  }
  // For public submissions with email: check by email+eventId
  if (!userId && attendeeEmail) {
    const existing = await Feedback.findOne({ eventId, attendeeEmail: attendeeEmail.trim().toLowerCase(), isDeleted: false });
    if (existing) throw new AppError('Feedback from this email has already been submitted for this event', 409);
  }

  // ── Sentiment analysis ───────────────────────────────────────────────────
  const sentiment = getSentimentLabel(overallRating, comments || '');

  // ── Build the document ───────────────────────────────────────────────────
  const doc = {
    eventId,
    overallRating,
    recommendationScore,
    selectedTags: selectedTags || [],
    comments,
    sentiment,
    submitterName: submitterName || '',
    attendeeEmail: attendeeEmail ? attendeeEmail.trim().toLowerCase() : '',
  };
  // Only attach userId if the user is authenticated
  if (userId) doc.userId = userId;

  // ── Atomic write + event aggregate update ────────────────────────────────
  let feedback;
  await withTransaction(async (session) => {
    const opts = session ? { session } : {};

    [feedback] = await Feedback.create([doc], opts);

    const newTotal     = event.totalResponses + 1;
    const newAvgRating = ((event.avgRating * event.totalResponses) + overallRating) / newTotal;
    const newNpsScore  = ((event.npsScore  * event.totalResponses) + recommendationScore) / newTotal;

    event.totalResponses = newTotal;
    event.avgRating      = newAvgRating;
    event.npsScore       = newNpsScore;
    event.cacheVersion   = (event.cacheVersion || 1) + 1;
    await event.save(opts);
  });

  // ── Cache invalidation ───────────────────────────────────────────────────
  const ownerId = event.ownerId.toString();
  cache.del(cache.dashboardKey(ownerId));
  cache.del(cache.reportKey(ownerId));
  cache.del(cache.aiKey(ownerId));

  // ── Audit log ────────────────────────────────────────────────────────────
  // userId may be null for public submissions — log with 'Public' actor type
  const actorId   = userId || feedback._id; // use feedback doc id as surrogate
  const actorType = userId ? 'User' : 'Public';
  logAudit(actorId, actorType, 'SUBMIT_FEEDBACK', feedback._id, 'Feedback', { eventId, overallRating }, ip);

  // ── Queue async AI analytics ─────────────────────────────────────────────
  aiWorker.emit('process_ai_insights', eventId);

  return feedback;
};

/**
 * Get paginated feedback for an event with soft-delete filtering.
 */
const getByEvent = async (eventId, ownerId, { page = 1, limit = 50 } = {}) => {
  page  = Math.max(1, parseInt(page));
  limit = Math.min(100, parseInt(limit));
  const skip = (page - 1) * limit;

  const event = await Event.findOne({ _id: eventId, isDeleted: false }).select('ownerId').lean();
  if (!event) throw new AppError('Event not found', 404);
  if (event.ownerId.toString() !== ownerId.toString()) {
    throw new AppError('Forbidden — you do not own this event', 403);
  }

  const query = { eventId, isDeleted: false };

  const [feedbacks, total] = await Promise.all([
    Feedback.find(query)
      .select('-__v -updatedAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Feedback.countDocuments(query),
  ]);

  return { feedbacks, total, page, pages: Math.ceil(total / limit) };
};

/**
 * Moderate feedback (Organizer only)
 */
const moderate = async (feedbackId, ownerId, updates, ip = '') => {
  const feedback = await Feedback.findOne({ _id: feedbackId, isDeleted: false }).populate('eventId', 'ownerId');
  if (!feedback) throw new AppError('Feedback not found', 404);
  if (!feedback.eventId || feedback.eventId.ownerId.toString() !== ownerId.toString()) {
    throw new AppError('Forbidden — you do not own the event this feedback belongs to', 403);
  }

  if (updates.isHidden !== undefined) feedback.isHidden = updates.isHidden;
  if (updates.isFlagged !== undefined) feedback.isFlagged = updates.isFlagged;
  if (updates.moderationNotes !== undefined) feedback.moderationNotes = updates.moderationNotes;

  await feedback.save();
  logAudit(ownerId, 'Organizer', 'MODERATE_FEEDBACK', feedback._id, 'Feedback', updates, ip);
  return feedback;
};

/**
 * Delete feedback (Organizer only)
 */
const remove = async (feedbackId, ownerId, ip = '') => {
  const feedback = await Feedback.findOne({ _id: feedbackId, isDeleted: false }).populate('eventId', 'ownerId');
  if (!feedback) throw new AppError('Feedback not found', 404);
  if (!feedback.eventId || feedback.eventId.ownerId.toString() !== ownerId.toString()) {
    throw new AppError('Forbidden — you do not own the event this feedback belongs to', 403);
  }

  feedback.isDeleted = true;
  feedback.deletedAt = new Date();
  await feedback.save();
  logAudit(ownerId, 'Organizer', 'DELETE_FEEDBACK', feedback._id, 'Feedback', {}, ip);
};

module.exports = { submit, getByEvent, moderate, remove };
