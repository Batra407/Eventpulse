const express            = require('express');
const router             = express.Router();
const { getSummary, getCategories, getRatings } = require('../controllers/analyticsController');
const { verifyJWT, verifyOrganizer, verifyApprovedOrganizer } = require('../middleware/authMiddleware');
const asyncHandler       = require('../middleware/asyncHandler');

// Full chain: JWT + Organizer role + Approved status
router.get('/summary',    verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(getSummary));
router.get('/categories', verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(getCategories));
router.get('/ratings',    verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(getRatings));

module.exports = router;
