const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const { env } = require('../config/env');
const { ROLES } = require('../config/constants');
const User = require('../models/User');
const Candidate = require('../models/Candidate');
const Admin = require('../models/Admin');
const ApiError = require('../utils/ApiError');
const { logAudit } = require('./audit.service');

function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

/**
 * Generate a short, unique candidateId for display in reports.
 */
async function generateCandidateId() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = `PRX${Date.now().toString().slice(-8)}${crypto.randomInt(10, 99)}`;
    const exists = await User.findOne({ candidateId: id });
    if (!exists) return id;
  }
  throw new Error('Could not allocate a unique candidate id');
}

async function registerCandidate({ name, email, password, phone }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists. Please log in.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const candidate = await Candidate.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: ROLES.CANDIDATE,
    candidateId: await generateCandidateId(),
    phone: phone || undefined,
  });

  const token = signToken(candidate);
  return { user: candidate.toSafeJSON(), token };
}

/**
 * Find a user by email or username (candidates log in by email, admins by username).
 */
async function findByIdentifier(identifier) {
  const value = String(identifier).trim().toLowerCase();
  return User.findOne({
    $or: [{ email: value }, { username: value }],
  });
}

async function login({ identifier, password }, { ip } = {}) {
  const user = await findByIdentifier(identifier);
  if (!user) {
    throw ApiError.unauthorized('Invalid credentials.');
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    throw ApiError.unauthorized('Invalid credentials.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);
  await logAudit({
    actor: user,
    action: 'LOGIN',
    resource: 'user',
    resourceId: user._id.toString(),
    details: { identifier },
    ip,
  });

  return { user: user.toSafeJSON(), token };
}

module.exports = { signToken, registerCandidate, login, findByIdentifier };
