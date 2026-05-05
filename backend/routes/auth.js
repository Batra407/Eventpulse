const express      = require('express');
const router       = express.Router();
const authController = require('../controllers/authController');
const { verifyJWT, verifyOrganizer } = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');

// ── Public Auth ────────────────────────────────────────────────────────────
router.post('/register', asyncHandler(authController.register));
router.post('/login',    asyncHandler(authController.login));
router.post('/refresh',  asyncHandler(authController.refreshToken));

// ── Protected Auth ─────────────────────────────────────────────────────────
router.post('/logout',     verifyJWT, asyncHandler(authController.logout));
router.post('/logout-all', verifyJWT, asyncHandler(authController.logoutAll));

// ── Profile & Requests ─────────────────────────────────────────────────────
router.get('/me', verifyJWT, asyncHandler(authController.getMe));
router.post('/request-access', verifyJWT, verifyOrganizer, asyncHandler(authController.requestAccess));

module.exports = router;
