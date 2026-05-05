const express         = require('express');
const router          = express.Router();
const { getReport }   = require('../controllers/reportController');
const { verifyJWT, verifyOrganizer, verifyApprovedOrganizer } = require('../middleware/authMiddleware');
const asyncHandler    = require('../middleware/asyncHandler');

router.get('/', verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(getReport));

module.exports = router;
