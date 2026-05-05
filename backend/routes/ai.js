const express          = require('express');
const router           = express.Router();
const { getAISummary } = require('../controllers/aiController');
const { verifyJWT, verifyOrganizer, verifyApprovedOrganizer } = require('../middleware/authMiddleware');
const asyncHandler     = require('../middleware/asyncHandler');

// GET /api/ai/summary — full chain required
router.get('/summary', verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(getAISummary));

module.exports = router;
