/**
 * asyncHandler — Eliminates try/catch boilerplate in async route handlers.
 *
 * Wraps an async Express handler so that any thrown error is automatically
 * forwarded to Express's next() error handler instead of crashing the process.
 *
 * Usage:
 *   router.get('/route', asyncHandler(async (req, res) => { ... }));
 *
 * @param {Function} fn - Async route handler (req, res, next)
 * @returns {Function}  - Wrapped handler
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
