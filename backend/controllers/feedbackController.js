/**
 * feedbackController.js — Thin HTTP layer for feedback routes.
 * All business logic lives in services/feedbackService.js.
 */

const feedbackService = require('../services/feedbackService');
const { sendSuccess } = require('../utils/response');

/** POST /api/feedback — submit feedback (public) */
const createFeedback = async (req, res) => {
  const feedback = await feedbackService.submit(req.body);
  sendSuccess(res, 'Feedback submitted successfully', feedback, 201);
};

/** GET /api/feedback/event/:eventId — paginated feedback for an event */
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

module.exports = { createFeedback, getFeedbackByEvent };
