/**
 * feedbackController.js — Thin HTTP layer for feedback routes.
 * All business logic lives in services/feedbackService.js.
 */

const feedbackService = require('../services/feedbackService');
const { sendSuccess } = require('../utils/response');

/** POST /api/v1/feedback — submit feedback (PUBLIC — no auth required) */
const createFeedback = async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  // req.user is undefined for public (unauthenticated) submissions — pass null
  const userId = req.user?.id || null;
  const feedback = await feedbackService.submit(req.body, userId, ip);
  sendSuccess(res, 'Feedback submitted successfully', feedback, 201);
};

/** GET /api/v1/feedback/event/:eventId — paginated feedback for an event */
const getFeedbackByEvent = async (req, res) => {
  const result = await feedbackService.getByEvent(
    req.params.eventId,
    req.organizer.id,
    req.query
  );
  sendSuccess(res, 'Feedback retrieved', {
    feedbacks: result.feedbacks,
    total:     result.total,
    page:      result.page,
    pages:     result.pages,
  });
};

/** PATCH /api/v1/feedback/:id/moderate — Organizer moderate feedback */
const moderateFeedback = async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const feedback = await feedbackService.moderate(req.params.id, req.organizer.id, req.body, ip);
  sendSuccess(res, 'Feedback moderated successfully', feedback);
};

/** DELETE /api/v1/feedback/:id — Organizer delete feedback */
const deleteFeedback = async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  await feedbackService.remove(req.params.id, req.organizer.id, ip);
  sendSuccess(res, 'Feedback deleted successfully');
};

module.exports = { createFeedback, getFeedbackByEvent, moderateFeedback, deleteFeedback };
