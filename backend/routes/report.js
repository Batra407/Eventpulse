const express         = require('express');
const router          = express.Router();
const { getReport }   = require('../controllers/reportController');
const { verifyToken } = require('../middleware/authMiddleware');
const asyncHandler    = require('../middleware/asyncHandler');

// GET /api/report  — full report for organizer's events only
router.get('/', verifyToken, asyncHandler(getReport));

module.exports = router;
