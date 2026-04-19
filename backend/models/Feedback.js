const mongoose = require('mongoose');

/**
 * Feedback Model
 * Stores student-submitted feedback for a specific event.
 * Scoped to an organizer indirectly via eventId → Event.createdBy.
 *
 * INDEXES:
 *  - eventId (single)  → fastest lookup per event
 *  - eventId + createdAt (compound) → range queries, history, pagination
 */
const FeedbackSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'eventId is required'],
      index: true, // Single-field index for fast event lookups
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    contentScore: {
      type: Number,
      min: [1, 'Content score must be at least 1'],
      max: [10, 'Content score cannot exceed 10'],
    },
    nps: {
      type: Number,
      min: [0, 'NPS must be at least 0'],
      max: [10, 'NPS cannot exceed 10'],
    },
    categories: {
      type: [String],
      default: [],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    suggestion: {
      type: String,
      trim: true,
      maxlength: [2000, 'Suggestion cannot exceed 2000 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral',
      index: true, // Fast sentiment distribution aggregation
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// Compound index: fastest for "all feedback for event X in date range"
FeedbackSchema.index({ eventId: 1, createdAt: -1 });

module.exports = mongoose.model('Feedback', FeedbackSchema);
