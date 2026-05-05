const mongoose = require('mongoose');

/**
 * AuditLog Model
 * Tracks all significant mutations across the enterprise platform.
 */
const AuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'userModel',
      required: false,
    },
    userModel: {
      type: String,
      enum: ['Organizer', 'Attendance'],
      default: 'Organizer',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId, // ID of Event, Feedback, etc.
    },
    targetModel: {
      type: String,
      enum: ['Event', 'Feedback', 'Attendance'],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: '',
    },
    traceId: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
    capped: { size: 1024 * 1024 * 50, max: 100000 } // Limit size to prevent infinite growth
  }
);

// TTL Index: Auto delete logs after 90 days (if not capped, but we use capped so this is optional)
// AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
