const express         = require('express');
const router          = express.Router();
const { getHistory }  = require('../controllers/historyController');
const { verifyToken } = require('../middleware/authMiddleware');
const asyncHandler    = require('../middleware/asyncHandler');

// GET /api/history
// GET /api/history?start=YYYY-MM-DD&end=YYYY-MM-DD&page=1&limit=50&search=keyword
router.get('/', verifyToken, asyncHandler(getHistory));

module.exports = router;
