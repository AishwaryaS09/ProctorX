const bcrypt = require('bcryptjs');

const { env } = require('../config/env');
const { ROLES } = require('../config/constants');
const User = require('../models/User');
const Admin = require('../models/Admin');

/**
 * Ensure the configured admin account exists (idempotent).
 */
async function seedAdmin() {
  const existing = await User.findOne({ role: ROLES.ADMIN, username: env.adminUsername });
  if (existing) {
    return existing;
  }

  const passwordHash = await bcrypt.hash(env.adminPassword, 12);
  const admin = await Admin.create({
    name: env.adminFullName,
    email: env.adminEmail,
    username: env.adminUsername,
    passwordHash,
    role: ROLES.ADMIN,
    isSuper: true,
  });

  // eslint-disable-next-line no-console
  console.log('[seed] Admin created:', env.adminUsername);
  return admin;
}

module.exports = { seedAdmin };

// Allow `npm run seed` to run standalone.
if (require.main === module) {
  const { connectDB, disconnectDB } = require('../config/db');
  (async () => {
    await connectDB();
    await seedAdmin();
    await disconnectDB();
    process.exit(0);
  })().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
