const mongoose = require('mongoose');
const User = require('./User');

const { ROLES } = require('../config/constants');

const adminSchema = new mongoose.Schema(
  {
    isSuper: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/**
 * Admin discriminator. Also uses the `users` collection; role === 'admin'.
 */
const Admin = User.discriminator(ROLES.ADMIN, adminSchema);

module.exports = Admin;
