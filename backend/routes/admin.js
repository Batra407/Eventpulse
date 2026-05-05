/**
 * routes/admin.js — Super admin management API.
 *
 * All routes protected by: verifyJWT → verifySuperAdmin
 *
 * These routes are NEVER accessible to regular organizers.
 */

const express      = require('express');
const router       = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { verifyJWT, verifySuperAdmin } = require('../middleware/authMiddleware');
const {
  listOrganizers,
  listRequests,
  listPending,
  getDetail,
  approve,
  reject,
  suspend,
  reinstate,
  revoke,
} = require('../controllers/adminController');

// Apply auth middleware to ALL admin routes
router.use(verifyJWT, verifySuperAdmin);

// GET /api/admin/organizers         — list all organizer accounts
router.get('/organizers',           asyncHandler(listOrganizers));
// GET /api/admin/organizers/:id     — single organizer detail
router.get('/organizers/:id',       asyncHandler(getDetail));

// GET /api/admin/requests           — all access requests
router.get('/requests',             asyncHandler(listRequests));
// GET /api/admin/requests/pending   — pending requests only
router.get('/requests/pending',     asyncHandler(listPending));

// POST /api/admin/approve/:id       — approve organizer
router.post('/approve/:id',         asyncHandler(approve));
// POST /api/admin/reject/:id        — reject organizer
router.post('/reject/:id',          asyncHandler(reject));
// POST /api/admin/suspend/:id       — suspend organizer (clears all sessions)
router.post('/suspend/:id',         asyncHandler(suspend));
// POST /api/admin/reinstate/:id     — lift suspension, restore approved status
router.post('/reinstate/:id',       asyncHandler(reinstate));
// POST /api/admin/revoke/:id        — revoke back to pending (re-review)
router.post('/revoke/:id',          asyncHandler(revoke));

module.exports = router;
