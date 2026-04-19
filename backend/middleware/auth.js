/**
 * Legacy re-export shim — keeps old `require('../middleware/auth')` imports working.
 * All new code should import from authMiddleware.js or roleMiddleware.js directly.
 */
const { verifyToken } = require('./authMiddleware');
const { requireRole } = require('./roleMiddleware');

module.exports = { verifyToken, requireRole };
