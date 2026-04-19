/**
 * authMiddleware.js — JWT verification + organizer hydration.
 *
 * JWT payload now contains only { id }.
 * The full organizer object is fetched from the DB here and
 * attached to req.organizer — ensuring controllers always get
 * fresh, authoritative data (no stale token payloads).
 */

const jwt       = require('jsonwebtoken');
const Organizer = require('../models/Organizer');

const verifyToken = async (req, res, next) => {
  const header = req.headers['authorization'] || req.headers['Authorization'];

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied — no token provided',
    });
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'
        ? 'Session expired — please log in again'
        : 'Invalid or malformed token';
    return res.status(401).json({ success: false, message });
  }

  // Hydrate req.organizer from DB — lean for speed, no password
  try {
    const organizer = await Organizer.findById(decoded.id)
      .select('_id name email role')
      .lean();

    if (!organizer) {
      return res.status(401).json({
        success: false,
        message: 'Account not found — please log in again',
      });
    }

    // Expose as { id, name, email, role } for controller use
    req.organizer = {
      id:    organizer._id.toString(),
      name:  organizer.name,
      email: organizer.email,
      role:  organizer.role,
    };

    next();
  } catch (err) {
    next(err); // Pass DB errors to global error handler
  }
};

module.exports = { verifyToken };
