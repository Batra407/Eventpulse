const { AppError } = require('./errorHandler');

/**
 * Input validation middleware factory.
 *
 * Each validator is an Express middleware that validates req.body
 * and throws AppError(400) on failure, so the global error handler
 * sends a clean JSON response.
 */

// ---- Auth Validators -------------------------------------------------------

/** POST /api/auth/register */
const validateRegister = (req, _res, next) => {
  const { name, email, password } = req.body;

  if (!name?.trim()) throw new AppError('Name is required', 400);
  if (!email?.trim()) throw new AppError('Email is required', 400);
  if (!password)      throw new AppError('Password is required', 400);
  if (password.length < 6) throw new AppError('Password must be at least 6 characters', 400);

  // Sanitize
  req.body.name  = name.trim();
  req.body.email = email.trim().toLowerCase();

  next();
};

/** POST /api/auth/login */
const validateLogin = (req, _res, next) => {
  const { email, password } = req.body;

  if (!email?.trim()) throw new AppError('Email is required', 400);
  if (!password)      throw new AppError('Password is required', 400);

  req.body.email = email.trim().toLowerCase();

  next();
};

// ---- Feedback Validator ----------------------------------------------------

/** POST /api/feedback */
const validateFeedback = (req, _res, next) => {
  const { eventId, rating, nps, contentScore, comment } = req.body;

  if (!eventId) throw new AppError('eventId is required', 400);
  if (!rating || rating < 1 || rating > 5) throw new AppError('Rating must be between 1 and 5', 400);
  if (nps !== undefined && (nps < 0 || nps > 10)) throw new AppError('NPS must be between 0 and 10', 400);
  if (contentScore !== undefined && (contentScore < 1 || contentScore > 10)) throw new AppError('Content score must be between 1 and 10', 400);
  if (comment && comment.length > 2000) throw new AppError('Comment cannot exceed 2000 characters', 400);

  // Sanitize
  if (req.body.comment)    req.body.comment    = req.body.comment.trim();
  if (req.body.suggestion) req.body.suggestion = req.body.suggestion.trim();
  if (req.body.email)      req.body.email      = req.body.email.trim().toLowerCase();

  next();
};

// ---- Event Validator -------------------------------------------------------

/** POST /api/events */
const validateEvent = (req, _res, next) => {
  const { name, date, category } = req.body;

  if (!name?.trim())     throw new AppError('Event name is required', 400);
  if (!date)             throw new AppError('Event date is required', 400);
  if (!category?.trim()) throw new AppError('Category is required', 400);

  const validCategories = ['Workshop', 'Seminar', 'Conference', 'Webinar', 'Hackathon', 'Cultural', 'Sports', 'Other'];
  if (!validCategories.includes(category)) {
    throw new AppError(`Invalid category. Must be one of: ${validCategories.join(', ')}`, 400);
  }

  // Sanitize
  req.body.name = name.trim();
  if (req.body.description) req.body.description = req.body.description.trim();
  if (req.body.venue)       req.body.venue       = req.body.venue.trim();

  next();
};

module.exports = { validateRegister, validateLogin, validateFeedback, validateEvent };
