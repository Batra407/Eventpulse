/**
 * routes/test.js — Test-only utilities for E2E testing.
 * ⚠️  These routes are ONLY available in development/test environments.
 *     They are stripped out entirely in production.
 */
const express    = require('express');
const router     = express.Router();
const Organizer  = require('../models/Organizer');
const bcrypt     = require('bcryptjs');
const asyncHandler = require('../middleware/asyncHandler');

// Safety guard — never expose in production
if (process.env.NODE_ENV === 'production') {
  module.exports = router; // empty router, no routes mounted
} else {

  /**
   * POST /api/v1/test/seed-organizer
   * Creates an organizer account and immediately sets status to 'approved'.
   * Used exclusively by Playwright E2E tests to bypass the admin approval flow.
   *
   * Body: { name, email, password }
   */
  router.post('/seed-organizer', asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      const err = new Error('name, email and password are required');
      err.status = 400;
      throw err;
    }

    // Delete any pre-existing test account with this email to allow re-runs
    await Organizer.deleteOne({ email: email.toLowerCase() });

    const organizer = await Organizer.create({
      name,
      email: email.toLowerCase(),
      password,                    // Hashed automatically by model pre-save hook
      organizerStatus: 'approved', // Skip admin approval for E2E tests
      role: 'organizer',
    });

    res.status(201).json({
      ok: true,
      data: { id: organizer._id.toString(), email: organizer.email },
    });
  }));

  /**
   * DELETE /api/v1/test/cleanup-organizer
   * Removes a test organizer and all their events/attendance records.
   * Used by Playwright afterAll hooks to clean up test data.
   *
   * Body: { email }
   */
  router.delete('/cleanup-organizer', asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
      const err = new Error('email is required');
      err.status = 400;
      throw err;
    }

    const organizer = await Organizer.findOne({ email: email.toLowerCase() });
    if (organizer) {
      // Cascade delete events and attendance (best-effort)
      try {
        const Event = require('../models/Event');
        const Attendance = require('../models/Attendance');
        const events = await Event.find({ ownerId: organizer._id }).select('_id');
        const ids = events.map(e => e._id);
        if (ids.length) await Attendance.deleteMany({ eventId: { $in: ids } });
        await Event.deleteMany({ ownerId: organizer._id });
      } catch { /* non-fatal */ }
      await organizer.deleteOne();
    }

    res.json({ ok: true, message: 'Test data cleaned up' });
  }));

}

module.exports = router;
