/**
 * roleMiddleware — requireRole
 *
 * Usage:  router.get('/admin-only', verifyToken, requireRole('organizer'), handler)
 *
 * Checks that the JWT payload role matches the required role string.
 * Must be placed AFTER verifyToken in the middleware chain.
 *
 * @param {string} role  — Required role (e.g. 'organizer', 'admin')
 */
const requireRole = (role) => (req, res, next) => {
  if (!req.organizer) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  if (req.organizer.role !== role) {
    return res.status(403).json({
      success: false,
      error: `Forbidden — this route requires the '${role}' role`,
    });
  }

  next();
};

module.exports = { requireRole };
