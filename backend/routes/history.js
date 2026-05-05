const express         = require('express');
const router          = express.Router();
const { getHistory }  = require('../controllers/historyController');
const { verifyJWT, verifyOrganizer, verifyApprovedOrganizer } = require('../middleware/authMiddleware');
const asyncHandler    = require('../middleware/asyncHandler');

router.get('/', verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(getHistory));

module.exports = router;
