/**
 * errorHandler.js — Global Express error handler.
 *
 * All API error responses use the standardized shape:
 *   { success: false, message: "Human-readable description" }
 *
 * Handles:
 *  - AppError (operational)           → statusCode + message
 *  - Mongoose ValidationError         → 400 with joined field messages
 *  - Mongoose CastError (bad ObjectId)→ 400
 *  - MongoDB duplicate key (11000)    → 409 conflict
 *  - JWT errors                       → 401
 *  - Everything else                  → 500
 */

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal Server Error';

  // ── Mongoose Validation Error ──────────────────────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join('. ');
  }

  // ── Mongoose CastError (invalid ObjectId format) ───────────────────────
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // ── MongoDB Duplicate Key ──────────────────────────────────────────────
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {}).join(', ');
    message = `Duplicate value for field: ${field}`;
  }

  // ── JWT Errors ──────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid or malformed token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired — please log in again';
  }

  // ── Development logging ─────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR ${statusCode}] ${message}`);
    if (!err.isOperational) console.error(err.stack);
  }

  // ── Production: hide internals ──────────────────────────────────────────
  const safeMessage =
    process.env.NODE_ENV === 'production' && !err.isOperational
      ? 'Something went wrong — please try again'
      : message;

  res.status(statusCode).json({ success: false, message: safeMessage });
};

module.exports = { AppError, errorHandler };
