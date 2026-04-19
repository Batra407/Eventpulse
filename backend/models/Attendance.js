const mongoose = require('mongoose');

/**
 * Attendance Model
 * Tracks individual attendance records per event.
 * Each roll number can only appear once per event (enforced by unique index).
 */
const AttendanceSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Attendee name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    rollNo: {
      type: String,
      required: [true, 'Roll number is required'],
      trim: true,
      uppercase: true,
      maxlength: [50, 'Roll number cannot exceed 50 characters'],
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    ip: {
      type: String,
      default: '',
    },
    method: {
      type: String,
      enum: ['qr', 'manual'],
      default: 'qr',
    },
  },
  { timestamps: true }
);

// Prevent duplicate roll number per event
AttendanceSchema.index({ eventId: 1, rollNo: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
