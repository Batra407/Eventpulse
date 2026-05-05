const mongoose = require('mongoose');

/**
 * OrganizerRequest Model
 *
 * Submitted by organizers who want platform access.
 * Must be reviewed and approved by a superadmin before
 * the organizer's status becomes 'approved'.
 */
const OrganizerRequestSchema = new mongoose.Schema(
  {
    organizerId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Organizer',
      required: true,
      index:    true,
    },

    // ── Application Details ─────────────────────────────────────────────
    organizationName: {
      type:      String,
      required:  [true, 'Organization name is required'],
      trim:      true,
      maxlength: [200, 'Organization name too long'],
    },
    category: {
      type:    String,
      required: [true, 'Event category is required'],
      enum:    ['Academic', 'Corporate', 'Cultural', 'Sports', 'Tech', 'Social', 'Other'],
    },
    reason: {
      type:      String,
      required:  [true, 'Reason for access is required'],
      trim:      true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    socialLinks: {
      website:   { type: String, trim: true },
      linkedin:  { type: String, trim: true },
      instagram: { type: String, trim: true },
    },

    // ── Admin Review ────────────────────────────────────────────────────
    status: {
      type:    String,
      default: 'pending',
      enum:    ['pending', 'approved', 'rejected'],
      index:   true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Organizer', // superadmin who reviewed
    },
    reviewedAt:  { type: Date },
    reviewNotes: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('OrganizerRequest', OrganizerRequestSchema);
