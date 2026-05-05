/**
 * response.js — Standardized API response helpers.
 */

const sendSuccess = (res, message, data = null, status = 200) => {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  res.status(status).json(body);
};

const sendError = (res, error, details = null, status = 500) => {
  const body = { success: false, error };
  if (details !== null) body.details = details;
  res.status(status).json(body);
};

const sendPaginated = (res, message, data, pagination, status = 200) => {
  res.status(status).json({ success: true, message, data, pagination });
};

module.exports = { sendSuccess, sendError, sendPaginated };
