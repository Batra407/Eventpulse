const express = require('express');
const router  = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { verifyToken }            = require('../middleware/authMiddleware');
const asyncHandler               = require('../middleware/asyncHandler');
const { validateRegister, validateLogin } = require('../middleware/validate');

// POST /api/auth/register  — create organizer account
router.post('/register', validateRegister, asyncHandler(register));

// POST /api/auth/login     — returns JWT
router.post('/login', validateLogin, asyncHandler(login));

// GET  /api/auth/me        — returns current organizer profile (protected)
router.get('/me', verifyToken, asyncHandler(getMe));

module.exports = router;
