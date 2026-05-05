const mongoose = require('mongoose');

/**
 * Event Model
 * Represents an academic/professional event created by an organizer.
 */
const EventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Event title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['Workshop', 'Seminar', 'Conference', 'Webinar', 'Hackathon', 'Cultural', 'Sports', 'Networking', 'Other'],
      default: 'Other',
    },
    venue: {
      type: String,
      trim: true,
      maxlength: [300, 'Venue cannot exceed 300 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    startTime: {
      type: String,
      trim: true,
    },
    endTime: {
      type: String,
      trim: true,
    },
    banner: {
      type: String,
      trim: true,
      default: '', // Store base64 or URL
    },
    attendanceEnabled: {
      type: Boolean,
      default: false,
    },
    attendanceToken: {
      type: String,
      trim: true,
      index: true,
    },
    attendanceLink: {
      type: String,
      trim: true,
    },
    qrCode: {
      type: String,
      trim: true,
    },
    totalResponses: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAttendees: {
      type: Number,
      default: 0,
      min: 0,
    },
    manualAttendees: {
      type: Number,
      default: 0,
      min: 0,
    },
    qrAttendees: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    npsScore: {
      type: Number,
      default: 0,
      min: -100,
      max: 100,
    },
    analyticsSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organizer',
      required: [true, 'Event must belong to an organizer'],
      index: true,
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
    cacheVersion: {
      type: Number,
      default: 1,
    }
  },
  {
    timestamps: true,
  }
);

// Compound index for active organizer events
EventSchema.index({ ownerId: 1, isDeleted: 1, date: -1 });

module.exports = mongoose.model('Event', EventSchema);
