const express          = require('express');
const router           = express.Router();
const { getDashboard } = require('../controllers/dashboardController');
const { verifyJWT, verifyOrganizer, verifyApprovedOrganizer } = require('../middleware/authMiddleware');
const asyncHandler     = require('../middleware/asyncHandler');

// GET /api/dashboard — full middleware chain
router.get('/', verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(getDashboard));

module.exports = router;
