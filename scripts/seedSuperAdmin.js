/**
 * seedSuperAdmin.js — One-time script to create the EventPulse Super Admin.
 *
 * Run once after initial setup:
 *   node scripts/seedSuperAdmin.js
 *
 * Uses SUPER_ADMIN_EMAIL, SUPER_ADMIN_NAME, SUPER_ADMIN_PASSWORD from .env
 *
 * Safe to re-run — will not create duplicates.
 */

require('dotenv').config();
const mongoose  = require('mongoose');
const bcrypt    = require('bcryptjs');
const Organizer = require('../backend/models/Organizer');

async function seed() {
  const { MONGO_URI, SUPER_ADMIN_EMAIL, SUPER_ADMIN_NAME, SUPER_ADMIN_PASSWORD } = process.env;

  if (!MONGO_URI)               { console.error('❌  MONGO_URI not set in .env'); process.exit(1); }
  if (!SUPER_ADMIN_EMAIL)       { console.error('❌  SUPER_ADMIN_EMAIL not set in .env'); process.exit(1); }
  if (!SUPER_ADMIN_PASSWORD || SUPER_ADMIN_PASSWORD.length < 8) {
    console.error('❌  SUPER_ADMIN_PASSWORD must be at least 8 characters'); process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB');

  const existing = await Organizer.findOne({ email: SUPER_ADMIN_EMAIL.toLowerCase() });

  if (existing) {
    if (existing.role === 'superadmin') {
      console.log(`ℹ️   Super admin already exists: ${existing.email}`);
    } else {
      // Upgrade existing organizer to superadmin
      existing.role            = 'superadmin';
      existing.organizerStatus = 'approved';
      existing.isSuspended     = false;
      await existing.save();
      console.log(`✅  Upgraded ${existing.email} to superadmin`);
    }
    await mongoose.disconnect();
    return;
  }

  const admin = await Organizer.create({
    name:            SUPER_ADMIN_NAME || 'Super Admin',
    email:           SUPER_ADMIN_EMAIL.toLowerCase(),
    password:        SUPER_ADMIN_PASSWORD,
    role:            'superadmin',
    organizerStatus: 'approved',
    isSuspended:     false,
  });

  console.log(`\n🚀  Super Admin created successfully!`);
  console.log(`    Name:  ${admin.name}`);
  console.log(`    Email: ${admin.email}`);
  console.log(`    Role:  ${admin.role}`);
  console.log(`\n⚠️   Store these credentials securely. This script won't show the password again.\n`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
