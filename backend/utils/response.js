/**
 * response.js — Standardized API response helpers.
 *
 * All API responses will use this shape:
 *   { success: true,  message: "...", data: {...} }
 *   { success: false, message: "..." }
 */

/**
 * Send a successful JSON response.
 *
 * @param {import('express').Response} res
 * @param {string}  message    - Human-readable success description
 * @param {any}     [data]     - Payload (object, array, or null)
 * @param {number}  [status]   - HTTP status code (default 200)
 */
const sendSuccess = (res, message, data = null, status = 200) => {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  res.status(status).json(body);
};

/**
 * Send an error JSON response.
 * (Prefer throwing AppError — this is for ad-hoc use.)
 *
 * @param {import('express').Response} res
 * @param {string}  message    - Human-readable error description
 * @param {number}  [status]   - HTTP status code (default 500)
 */
const sendError = (res, message, status = 500) => {
  res.status(status).json({ success: false, message });
};

module.exports = { sendSuccess, sendError };
