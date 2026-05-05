/**
 * adminController.js — Super admin management HTTP layer.
 * All routes protected by verifyJWT + verifySuperAdmin middleware.
 */

const adminService   = require('../services/adminService');
const { sendSuccess } = require('../utils/response');

/** GET /api/admin/organizers — list all organizer accounts */
const listOrganizers = async (req, res) => {
  const organizers = await adminService.listOrganizers();
  sendSuccess(res, 'Organizers retrieved', organizers);
};

/** GET /api/admin/requests — list all access requests */
const listRequests = async (req, res) => {
  const requests = await adminService.listAllRequests();
  sendSuccess(res, 'Requests retrieved', requests);
};

/** GET /api/admin/requests/pending — pending requests only */
const listPending = async (req, res) => {
  const requests = await adminService.listPendingRequests();
  sendSuccess(res, 'Pending requests retrieved', requests);
};

/** GET /api/admin/organizers/:id — single organizer detail */
const getDetail = async (req, res) => {
  const org = await adminService.getOrganizerDetail(req.params.id);
  sendSuccess(res, 'Organizer retrieved', org);
};

/** POST /api/admin/approve/:id */
const approve = async (req, res) => {
  const result = await adminService.approveOrganizer(req.params.id, req.organizer.id);
  sendSuccess(res, result.message, result.organizer);
};

/** POST /api/admin/reject/:id */
const reject = async (req, res) => {
  const { notes } = req.body;
  const result = await adminService.rejectOrganizer(req.params.id, req.organizer.id, notes);
  sendSuccess(res, result.message);
};

/** POST /api/admin/suspend/:id */
const suspend = async (req, res) => {
  const result = await adminService.suspendOrganizer(req.params.id, req.organizer.id);
  sendSuccess(res, result.message);
};

/** POST /api/admin/reinstate/:id */
const reinstate = async (req, res) => {
  const result = await adminService.reinstateOrganizer(req.params.id);
  sendSuccess(res, result.message);
};

/** POST /api/admin/revoke/:id */
const revoke = async (req, res) => {
  const result = await adminService.revokeOrganizer(req.params.id);
  sendSuccess(res, result.message);
};

module.exports = { listOrganizers, listRequests, listPending, getDetail, approve, reject, suspend, reinstate, revoke };
