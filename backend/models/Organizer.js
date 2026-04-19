const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

/**
 * User / Organizer Model
 * Represents an admin/organizer account.
 * Email is uniquely indexed for fast login lookups.
 */
const OrganizerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,       // Unique index created automatically
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    role: {
      type: String,
      default: 'organizer',
      enum: ['organizer', 'admin'],
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving — only if modified
OrganizerSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Instance method — compare plain vs hashed
OrganizerSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Never return password in JSON serialization
OrganizerSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('Organizer', OrganizerSchema);
