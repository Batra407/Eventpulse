const express          = require('express');
const router           = express.Router();
const { getDashboard } = require('../controllers/dashboardController');
const { verifyToken }  = require('../middleware/authMiddleware');
const asyncHandler     = require('../middleware/asyncHandler');

// GET /api/dashboard  — organizer dashboard analytics
router.get('/', verifyToken, asyncHandler(getDashboard));

module.exports = router;
