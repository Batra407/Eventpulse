const express          = require('express');
const router           = express.Router();
const { getAISummary } = require('../controllers/aiController');
const { verifyToken }  = require('../middleware/authMiddleware');
const asyncHandler     = require('../middleware/asyncHandler');

// GET /api/ai/summary  — AI keyword + suggestion analysis (organizer's events only)
router.get('/summary', verifyToken, asyncHandler(getAISummary));

module.exports = router;
