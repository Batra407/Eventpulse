const mongoose = require('mongoose');

/**
 * Attendance Model
 * Stores individual check-ins via QR scan or manual entry.
 */
const AttendanceSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'eventId is required'],
      index: true,
    },
    attendeeName: {
      type: String,
      required: [true, 'Attendee name is required'],
      trim: true,
    },
    attendeeEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    college: {
      type: String,
      trim: true,
      default: '',
    },
    organization: {
      type: String,
      trim: true,
      default: '',
    },
    batch: {
      type: String,
      trim: true,
      default: '',
    },
    course: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'pending', 'checked-in', 'Present', 'Absent'], // Keeping capitalized for legacy compatibility
      default: 'checked-in',
    },
    attendanceType: {
      type: String,
      enum: ['qr', 'manual', 'system', 'QR', 'Manual', 'System'],
      default: 'qr',
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organizer',
      default: null,
    },
    scannedFromIP: {
      type: String,
      trim: true,
      default: '',
    },
    deviceInfo: {
      type: String,
      trim: true,
      default: '',
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Auto manages createdAt and updatedAt (timestamp)
  }
);

// Compound index to prevent duplicate attendance per event per email (only if email is provided)
AttendanceSchema.index(
  { eventId: 1, attendeeEmail: 1 }, 
  { unique: true, partialFilterExpression: { attendeeEmail: { $gt: '' } } }
);

// Index for active queries
AttendanceSchema.index({ eventId: 1, isDeleted: 1, createdAt: -1 });

// Index for analytics and dashboard filters
AttendanceSchema.index({ eventId: 1, status: 1 });
AttendanceSchema.index({ eventId: 1, attendanceType: 1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);
