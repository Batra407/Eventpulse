const express = require('express');
const router = express.Router();
const {
  markAttendance, getAttendance, removeAttendee, getPublicEventInfo,
  addManualAttendance, updateAttendance, exportAttendance, getAttendanceAnalytics
} = require('../controllers/attendanceController');
const { verifyJWT, verifyOrganizer, verifyApprovedOrganizer } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const { validateAttendance, validateManualAttendance } = require('../middleware/validate');

// Public — fetch event info for attendance page (no auth required)
router.get('/public/:eventId', asyncHandler(getPublicEventInfo));

// Public — students/attendees mark their own attendance via QR or form (UNCHANGED)
router.post('/', validateAttendance, asyncHandler(markAttendance));

// Protected — organizers view / manage attendance lists (full chain)
// IMPORTANT: specific sub-paths must come BEFORE generic /:eventId to avoid param capture
router.get('/analytics/:eventId',  verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(getAttendanceAnalytics));
router.get('/export/:eventId',     verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(exportAttendance));
router.post('/manual/:eventId',  verifyJWT, verifyOrganizer, verifyApprovedOrganizer, validateManualAttendance, asyncHandler(addManualAttendance));
router.get('/:eventId',            verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(getAttendance));
router.put('/:eventId/:id',      verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(updateAttendance));
router.delete('/:eventId/:id',   verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(removeAttendee));

module.exports = router;
