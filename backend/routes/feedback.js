const express = require('express');
const router  = express.Router();
const { createFeedback, getFeedbackByEvent, moderateFeedback, deleteFeedback } = require('../controllers/feedbackController');
const { verifyJWT, verifyOrganizer, verifyApprovedOrganizer, verifyUserToken } = require('../middleware/authMiddleware');
const asyncHandler         = require('../middleware/asyncHandler');
const { validateFeedback } = require('../middleware/validate');

// PUBLIC — anyone can submit feedback (no login required)
// Duplicate prevention handled in service layer (email+eventId) and frontend (localStorage)
router.post('/', validateFeedback, asyncHandler(createFeedback));

// Protected (Organizer) — view and moderate feedback
router.get('/event/:eventId',   verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(getFeedbackByEvent));
router.patch('/:id/moderate',   verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(moderateFeedback));
router.delete('/:id',           verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(deleteFeedback));

module.exports = router;
