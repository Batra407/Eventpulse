/**
 * errorHandler.js — Global Express error handler.
 */

const { sendError } = require('../utils/response');
const logger = require('../utils/logger');

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
  let details    = null;

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join('. ');
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {}).join(', ');
    message = `Duplicate value for field: ${field}`;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid or malformed token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Session expired — please log in again';
  } else if (err.name === 'ZodError') {
    statusCode = 400;
    message = 'Validation Error';
    details = err.errors;
  }

  const traceId = req.headers['x-trace-id'] || req.id || 'N/A';
  
  if (statusCode >= 500) {
    logger.error(`[${traceId}] ${message}`, { stack: err.stack, method: req.method, url: req.originalUrl });
  } else {
    logger.warn(`[${traceId}] ${message}`, { method: req.method, url: req.originalUrl });
  }

  const safeMessage = process.env.NODE_ENV === 'production' && !err.isOperational && statusCode >= 500
    ? 'Something went wrong — please try again'
    : message;

  sendError(res, safeMessage, process.env.NODE_ENV !== 'production' ? details || err.stack : details, statusCode);
};

module.exports = { AppError, errorHandler };
