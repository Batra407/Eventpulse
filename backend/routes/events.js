const express = require('express');
const router  = express.Router();
const {
  getEvents, createEvent, getEventById, updateEvent, deleteEvent,
} = require('../controllers/eventController');
const { verifyJWT, verifyOrganizer, verifyApprovedOrganizer } = require('../middleware/authMiddleware');
const asyncHandler      = require('../middleware/asyncHandler');
const { validateEvent } = require('../middleware/validate');

// Public — attendees can browse events (unchanged)
router.get('/', asyncHandler(getEvents));

// Protected — full chain: JWT + Organizer role + Approved status
router.post('/',      verifyJWT, verifyOrganizer, verifyApprovedOrganizer, validateEvent, asyncHandler(createEvent));
router.get('/:id',    verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(getEventById));
router.put('/:id',    verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(updateEvent));
router.delete('/:id', verifyJWT, verifyOrganizer, verifyApprovedOrganizer, asyncHandler(deleteEvent));

module.exports = router;
