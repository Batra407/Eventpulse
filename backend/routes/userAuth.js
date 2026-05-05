const express     = require('express');
const router      = express.Router();
const { register, login, getMe } = require('../controllers/userAuthController');
const { verifyUserToken }        = require('../middleware/authMiddleware');
const asyncHandler               = require('../middleware/asyncHandler');
const { AppError }               = require('../middleware/errorHandler');

// ── Validators ────────────────────────────────────────────────────────────

const validateRegister = (req, _res, next) => {
  const { name, email, password } = req.body;
  if (!name?.trim()) throw new AppError('Name is required', 400);
  if (!email?.trim()) throw new AppError('Email is required', 400);
  if (!password) throw new AppError('Password is required', 400);
  if (password.length < 6) throw new AppError('Password must be at least 6 characters', 400);
  req.body.name  = name.trim();
  req.body.email = email.trim().toLowerCase();
  next();
};

const validateLogin = (req, _res, next) => {
  const { email, password } = req.body;
  if (!email?.trim()) throw new AppError('Email is required', 400);
  if (!password) throw new AppError('Password is required', 400);
  req.body.email = email.trim().toLowerCase();
  next();
};

// POST /api/users/auth/register
router.post('/register', validateRegister, asyncHandler(register));

// POST /api/users/auth/login
router.post('/login', validateLogin, asyncHandler(login));

// GET  /api/users/auth/me   (protected)
router.get('/me', verifyUserToken, asyncHandler(getMe));

module.exports = router;
