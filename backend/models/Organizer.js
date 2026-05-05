const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

/**
 * Organizer Model — Production-grade organizer/admin account.
 *
 * organizerStatus lifecycle:
 *   pending  → approved (by superadmin) → suspended / revoked → pending
 *
 * role values:
 *   organizer  — standard event organizer
 *   superadmin — platform admin, can approve/reject/suspend organizers
 */
const OrganizerSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    name: {
      type:      String,
      required:  [true, 'Name is required'],
      trim:      true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select:    false,
    },

    // ── Role & Status ─────────────────────────────────────────────────────────
    role: {
      type:    String,
      default: 'organizer',
      enum:    ['organizer', 'superadmin'],
    },
    organizerStatus: {
      type:    String,
      default: 'pending',
      enum:    ['pending', 'approved', 'rejected', 'suspended'],
    },
    isSuspended: {
      type:    Boolean,
      default: false,
    },

    // ── Session Security ──────────────────────────────────────────────────────
    /**
     * Hashed refresh tokens — supports multiple devices.
     * Max 5 concurrent sessions. Oldest removed when full.
     */
    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },

    // ── Audit Trail ──────────────────────────────────────────────────────────
    lastLogin: {
      type: Date,
    },
    loginHistory: {
      type: [{
        ip:        { type: String },
        userAgent: { type: String },
        at:        { type: Date, default: Date.now },
        success:   { type: Boolean, default: true },
      }],
      default: [],
    },
    failedAttempts: {
      type:    Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────
OrganizerSchema.index({ email: 1 });
OrganizerSchema.index({ organizerStatus: 1 });
OrganizerSchema.index({ role: 1 });

// ── Hooks ──────────────────────────────────────────────────────────────────
OrganizerSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// ── Instance Methods ──────────────────────────────────────────────────────
OrganizerSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

/** Record a login attempt in history (max 20 entries) */
OrganizerSchema.methods.recordLogin = function (ip, userAgent, success = true) {
  if (!this.loginHistory) this.loginHistory = [];
  this.loginHistory.unshift({ ip, userAgent, at: new Date(), success });
  if (this.loginHistory.length > 20) this.loginHistory = this.loginHistory.slice(0, 20);
  if (success) {
    this.lastLogin      = new Date();
    this.failedAttempts = 0;
    this.lockedUntil    = undefined;
  }
};

/** Check if account is locked due to failed attempts */
OrganizerSchema.methods.isLocked = function () {
  return this.lockedUntil && this.lockedUntil > new Date();
};

// ── toJSON — strip sensitive fields ──────────────────────────────────────
OrganizerSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.refreshTokens;
    delete ret.failedAttempts;
    delete ret.lockedUntil;
    return ret;
  },
});

module.exports = mongoose.model('Organizer', OrganizerSchema);
