const express = require('express');
const router  = express.Router();
const {
  getEvents, createEvent, getEventById, updateEvent, deleteEvent,
} = require('../controllers/eventController');
const { verifyToken }    = require('../middleware/authMiddleware');
const asyncHandler       = require('../middleware/asyncHandler');
const { validateEvent }  = require('../middleware/validate');

// Public — students can browse events
router.get('/', asyncHandler(getEvents));

// Protected — organizers manage their own events
router.post('/',      verifyToken, validateEvent, asyncHandler(createEvent));
router.get('/:id',    verifyToken, asyncHandler(getEventById));
router.put('/:id',    verifyToken, asyncHandler(updateEvent));
router.delete('/:id', verifyToken, asyncHandler(deleteEvent));

module.exports = router;
