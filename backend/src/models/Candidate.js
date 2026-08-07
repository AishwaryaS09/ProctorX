const mongoose = require('mongoose');
const User = require('./User');

const { ROLES } = require('../config/constants');

const candidateSchema = new mongoose.Schema(
  {
    // Candidate-specific fields can be extended here (phone lives on the base User schema).
  },
  { timestamps: true }
);

/**
 * Candidate discriminator. Uses the same `users` collection as User and Admin,
 * keyed by role. Candidate records are always role === 'candidate' and carry a
 * generated candidateId.
 */
const Candidate = User.discriminator(ROLES.CANDIDATE, candidateSchema);

module.exports = Candidate;
