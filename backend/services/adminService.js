/**
 * adminService.js — Super admin management operations.
 *
 * All functions require the caller to be a verified superadmin
 * (enforced at the route level via verifySuperAdmin middleware).
 *
 * Operations:
 *   listOrganizers()      — all organizer accounts + stats
 *   listPendingRequests() — access requests awaiting review
 *   approveOrganizer()    — set organizerStatus = approved
 *   rejectOrganizer()     — set organizerStatus = rejected
 *   suspendOrganizer()    — set isSuspended = true
 *   reinstateOrganizer()  — lift suspension, restore to approved
 *   revokeOrganizer()     — set organizerStatus = pending (re-review)
 */

const Organizer        = require('../models/Organizer');
const OrganizerRequest = require('../models/OrganizerRequest');
const { AppError }     = require('../middleware/errorHandler');

const ORG_LIST_FIELDS  = 'name email role organizerStatus isSuspended lastLogin createdAt loginHistory';
const REQUEST_POPULATE = { path: 'organizerId', select: 'name email createdAt organizerStatus' };

// ── Query helpers ──────────────────────────────────────────────────────────

const listOrganizers = async (filters = {}) => {
  const query = { role: 'organizer', ...filters };
  return Organizer.find(query)
    .select(ORG_LIST_FIELDS)
    .sort({ createdAt: -1 })
    .lean();
};

const listPendingRequests = async () => {
  return OrganizerRequest.find({ status: 'pending' })
    .populate(REQUEST_POPULATE)
    .sort({ createdAt: -1 })
    .lean();
};

const listAllRequests = async () => {
  return OrganizerRequest.find()
    .populate(REQUEST_POPULATE)
    .sort({ createdAt: -1 })
    .lean();
};

// ── State mutations ────────────────────────────────────────────────────────

const approveOrganizer = async (organizerId, adminId) => {
  const org = await Organizer.findById(organizerId);
  if (!org) throw new AppError('Organizer not found', 404);
  if (org.role === 'superadmin') throw new AppError('Cannot modify superadmin accounts', 403);

  org.organizerStatus = 'approved';
  org.isSuspended     = false;
  await org.save();

  // Mark any pending requests as approved
  await OrganizerRequest.updateMany(
    { organizerId, status: 'pending' },
    { $set: { status: 'approved', reviewedBy: adminId, reviewedAt: new Date() } }
  );

  return { message: `${org.name} approved successfully`, organizer: { id: org._id, name: org.name, organizerStatus: 'approved' } };
};

const rejectOrganizer = async (organizerId, adminId, notes = '') => {
  const org = await Organizer.findById(organizerId);
  if (!org) throw new AppError('Organizer not found', 404);
  if (org.role === 'superadmin') throw new AppError('Cannot modify superadmin accounts', 403);

  org.organizerStatus = 'rejected';
  await org.save();

  await OrganizerRequest.updateMany(
    { organizerId, status: 'pending' },
    { $set: { status: 'rejected', reviewedBy: adminId, reviewedAt: new Date(), reviewNotes: notes } }
  );

  return { message: `${org.name} rejected` };
};

const suspendOrganizer = async (organizerId, adminId) => {
  const org = await Organizer.findById(organizerId);
  if (!org) throw new AppError('Organizer not found', 404);
  if (org.role === 'superadmin') throw new AppError('Cannot modify superadmin accounts', 403);

  org.isSuspended     = true;
  org.refreshTokens   = []; // force logout all sessions immediately
  await org.save();

  return { message: `${org.name} suspended and all sessions revoked` };
};

const reinstateOrganizer = async (organizerId) => {
  const org = await Organizer.findById(organizerId);
  if (!org) throw new AppError('Organizer not found', 404);
  if (org.role === 'superadmin') throw new AppError('Cannot modify superadmin accounts', 403);

  org.isSuspended     = false;
  org.organizerStatus = 'approved';
  await org.save();

  return { message: `${org.name} reinstated` };
};

const revokeOrganizer = async (organizerId) => {
  const org = await Organizer.findById(organizerId);
  if (!org) throw new AppError('Organizer not found', 404);
  if (org.role === 'superadmin') throw new AppError('Cannot modify superadmin accounts', 403);

  org.organizerStatus = 'pending';
  org.refreshTokens   = []; // force logout
  await org.save();

  return { message: `${org.name} revoked to pending status — all sessions cleared` };
};

const getOrganizerDetail = async (organizerId) => {
  const org = await Organizer.findById(organizerId)
    .select(`${ORG_LIST_FIELDS} loginHistory failedAttempts`)
    .lean();
  if (!org) throw new AppError('Organizer not found', 404);
  if (org.role === 'superadmin') throw new AppError('Cannot view superadmin details', 403);
  return org;
};

module.exports = {
  listOrganizers,
  listPendingRequests,
  listAllRequests,
  approveOrganizer,
  rejectOrganizer,
  suspendOrganizer,
  reinstateOrganizer,
  revokeOrganizer,
  getOrganizerDetail,
};
