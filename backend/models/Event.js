const mongoose = require('mongoose');

/**
 * Event Model
 * Represents an academic event created by an organizer.
 * Multi-tenant: every event is scoped to its creator (createdBy).
 */
const EventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Event name is required'],
      trim: true,
      maxlength: [200, 'Event name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['Workshop', 'Seminar', 'Conference', 'Webinar', 'Hackathon', 'Cultural', 'Sports', 'Other'],
        message: '{VALUE} is not a valid category',
      },
      default: 'Other',
    },
    venue: {
      type: String,
      trim: true,
      maxlength: [300, 'Venue cannot exceed 300 characters'],
    },
    enableAttendance: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organizer',
      required: [true, 'Event must belong to an organizer'],
      index: true, // Fast lookup by organizer
    },
  },
  {
    timestamps: true, // Adds createdAt + updatedAt automatically
  }
);

// Compound index for organizer + date queries (history, filtering)
EventSchema.index({ createdBy: 1, createdAt: -1 });
// Index for public event browsing sorted by date
EventSchema.index({ date: -1 });

module.exports = mongoose.model('Event', EventSchema);
