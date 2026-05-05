const mongoose = require('mongoose');

/**
 * Feedback Model
 * Supports both authenticated (userId) and public (anonymous) feedback submissions.
 * Public feedback does not require a userId — prevented by localStorage fingerprint on frontend.
 */
const FeedbackSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'eventId is required'],
      index: true,
    },
    // Optional — only set when a logged-in User submits
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // Optional — set for public (anonymous) submissions
    submitterName: {
      type: String,
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
      default: '',
    },
    attendeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      default: null,
    },
    attendeeEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      validate: {
        validator: (v) => !v || /^\S+@\S+\.\S+$/.test(v),
        message: 'Please provide a valid email',
      },
    },
    overallRating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    recommendationScore: {
      type: Number,
      required: [true, 'Recommendation score is required'],
      min: [0, 'Score must be at least 0'],
      max: [10, 'Score cannot exceed 10'],
    },
    selectedTags: {
      type: [String],
      default: [],
    },
    comments: {
      type: String,
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral',
      index: true,
    },
    keywords: {
      type: [String],
      default: [],
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isHidden: {
      type: Boolean,
      default: false,
      index: true,
    },
    isFlagged: {
      type: Boolean,
      default: false,
      index: true,
    },
    moderationNotes: {
      type: String,
      trim: true,
      default: '',
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Auto manages createdAt and updatedAt
  }
);

// NOTE: Removed the unique compound index { eventId, userId } because:
// 1. userId is now optional (null for public submissions)
// 2. MongoDB treats multiple null values as duplicates in unique sparse indexes
// 3. Duplicate prevention is now handled at the service layer (by email+eventId)
// and on the frontend via localStorage fingerprinting.

// Fast query index for organizer dashboard
FeedbackSchema.index({ eventId: 1, isDeleted: 1, createdAt: -1 });

// Index for email-based duplicate check on public submissions
FeedbackSchema.index({ eventId: 1, attendeeEmail: 1 });

module.exports = mongoose.model('Feedback', FeedbackSchema);
