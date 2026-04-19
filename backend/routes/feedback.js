const express = require('express');
const router  = express.Router();
const { createFeedback, getFeedbackByEvent } = require('../controllers/feedbackController');
const { verifyToken }      = require('../middleware/authMiddleware');
const asyncHandler         = require('../middleware/asyncHandler');
const { validateFeedback } = require('../middleware/validate');

// Public — students submit feedback
router.post('/', validateFeedback, asyncHandler(createFeedback));

// Protected — organizer views feedback for their event
router.get('/event/:eventId', verifyToken, asyncHandler(getFeedbackByEvent));

module.exports = router;
