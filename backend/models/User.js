const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

/**
 * User Model
 * Represents a regular event attendee/user (distinct from Organizer).
 * Users can submit feedback after logging in.
 */
const UserSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
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
      type:     String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select:   false, // Never returned in queries by default
    },
    role: {
      type:    String,
      default: 'user',
      enum:    ['user'],
    },
    eventsJoined: [{
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Event',
    }],
  },
  {
    timestamps: true,
  }
);

// Hash password before saving — only if modified
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Instance method — compare plain vs hashed
UserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Never return password in JSON serialization
UserSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', UserSchema);
