const express            = require('express');
const router             = express.Router();
const { getSummary, getCategories, getRatings } = require('../controllers/analyticsController');
const { verifyToken }    = require('../middleware/authMiddleware');
const asyncHandler       = require('../middleware/asyncHandler');

// All analytics endpoints are now protected (organizer-scoped)
router.get('/summary',    verifyToken, asyncHandler(getSummary));
router.get('/categories', verifyToken, asyncHandler(getCategories));
router.get('/ratings',    verifyToken, asyncHandler(getRatings));

module.exports = router;
