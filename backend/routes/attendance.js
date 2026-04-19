const express = require('express');
const router = express.Router();
const {
  markAttendance, getAttendance, removeAttendee,
} = require('../controllers/attendanceController');
const { verifyToken } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');

// Public — students mark their own attendance via QR or form
router.post('/', asyncHandler(markAttendance));

// Protected — organizers view / manage attendance lists
router.get('/:eventId', verifyToken, asyncHandler(getAttendance));
router.delete('/:eventId/:rollNo', verifyToken, asyncHandler(removeAttendee));

module.exports = router;
